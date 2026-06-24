#!/usr/bin/env bash
# Fresh Xorr deployment under OUR OWN testnet identity.
#
# Reuses the already-on-chain contract *bytecode* (fetched with `stellar
# contract fetch`, so no heavy cargo build is needed) but redeploys new
# instances we control, and installs OUR freshly-generated verifying keys.
# Requires: circuits/build/*.vk.soroban.json (run `pnpm build` in circuits/).
set -euo pipefail
cd "$(dirname "$0")/.."

IDENT="${IDENT:-xorr}"
ISSUER="${ISSUER:-xorrissuer}"
NET=testnet
RPC=https://soroban-testnet.stellar.org
# Existing on-chain contracts whose (identical) wasm we redeploy under our key.
SRC_VERIFIER="${SRC_VERIFIER:-CCHSKQ2ZAEVIZ5KXZIB4NJI363NHFIARIUWJP47KSCY6CTENSPL33IQW}"
SRC_POOL="${SRC_POOL:-CDZENDZMVLPGVBPQXWIWIJJED3GD5AH33SIWCU2GFUEHGM5GIS5S6WYU}"
OUT=.deploy
mkdir -p "$OUT"

echo "==> Identities (funded via friendbot)"
stellar keys generate --global "$IDENT"  --network "$NET" --fund 2>/dev/null || stellar keys fund "$IDENT"  --network "$NET" 2>/dev/null || true
stellar keys generate --global "$ISSUER" --network "$NET" --fund 2>/dev/null || stellar keys fund "$ISSUER" --network "$NET" 2>/dev/null || true
ADMIN=$(stellar keys address "$IDENT")
ISSUER_ADDR=$(stellar keys address "$ISSUER")
echo "    admin=$ADMIN"
echo "    issuer=$ISSUER_ADDR"

echo "==> Fetch contract wasm from chain (no cargo build)"
stellar contract fetch --id "$SRC_VERIFIER" --network "$NET" --out-file "$OUT/verifier.wasm"
stellar contract fetch --id "$SRC_POOL"     --network "$NET" --out-file "$OUT/privacy_pool.wasm"
ls -lh "$OUT"/*.wasm | awk '{print "    "$5, $9}'

echo "==> USDC Stellar Asset Contract"
TOKEN=$(stellar contract asset deploy --asset "USDC:$ISSUER_ADDR" --source "$ISSUER" --network "$NET" 2>/dev/null \
  || stellar contract id asset --asset "USDC:$ISSUER_ADDR" --network "$NET")
echo "    token=$TOKEN"
echo "==> Admin trustline + mint 100k test USDC"
stellar tx new change-trust --source "$IDENT" --network "$NET" --line "USDC:$ISSUER_ADDR" 2>&1 | tail -1 || true
stellar contract invoke --id "$TOKEN" --source "$ISSUER" --network "$NET" -- \
  mint --to "$ADMIN" --amount 1000000000000 >/dev/null

echo "==> Deploy verifier"
VERIFIER=$(stellar contract deploy --wasm "$OUT/verifier.wasm" --source "$IDENT" --network "$NET")
echo "    verifier=$VERIFIER"

EMPTY_ROOT=$(node circuits/scripts/empty-root.mjs 20)
echo "==> Deploy privacy-pool (empty_root=$EMPTY_ROOT)"
POOL=$(stellar contract deploy --wasm "$OUT/privacy_pool.wasm" --source "$IDENT" --network "$NET" -- \
  --admin "$ADMIN" --token "$TOKEN" --verifier "$VERIFIER" --empty_root "$EMPTY_ROOT")
echo "    pool=$POOL"

echo "==> Install verifying keys (set_vk)"
# Circuit is an integer-backed enum (Deposit=0, Transfer=1, Withdraw=2); the
# stellar CLI 25.x wants the integer as JSON, not the variant name.
set_vk() { # <circuit-int> <label> <vk-file>
  if [ -f "$3" ]; then
    stellar contract invoke --id "$POOL" --source "$IDENT" --network "$NET" -- \
      set_vk --circuit "$1" --vk "$(cat "$3")" >/dev/null && echo "    set_vk $2 ✓"
  else echo "    ! missing $3 — build circuits first"; fi
}
set_vk 0 Deposit  circuits/build/deposit.vk.soroban.json
set_vk 1 Transfer circuits/build/transfer.vk.soroban.json
set_vk 2 Withdraw circuits/build/withdraw.vk.soroban.json

echo "==> Write xorr-core/.env.local"
cat > ../xorr-core/.env.local <<EOF
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_RPC_URL=$RPC
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
NEXT_PUBLIC_POOL_ID=$POOL
NEXT_PUBLIC_VERIFIER_ID=$VERIFIER
NEXT_PUBLIC_TOKEN_ID=$TOKEN
NEXT_PUBLIC_TREE_DEPTH=20
NEXT_PUBLIC_USDC_ISSUER=$ISSUER_ADDR
EOF

cat > "$OUT/deploy.json" <<EOF
{"network":"testnet","admin":"$ADMIN","issuer":"$ISSUER_ADDR","token":"$TOKEN","verifier":"$VERIFIER","pool":"$POOL","empty_root":"$EMPTY_ROOT"}
EOF
echo "==> DONE"
cat "$OUT/deploy.json"
