#!/usr/bin/env bash
# Full deployment: fresh pool + bridge + all 4 verifying keys + liquidity, then
# a real bridge_in for the Sepolia lock (closes the ETH->Stellar bridge loop
# on-chain). Writes frontend/.env.local. Requires circuits/build/*.zkey.
set -euo pipefail
cd "$(dirname "$0")/.."
source "$HOME/.cargo/env" 2>/dev/null || true
export PATH="$HOME/.cargo/bin:$PATH"

IDENT=shieldedbridge; ISSUER=sbissuer; NET=testnet
WASM=contracts/target/wasm32v1-none/release
ADMIN=$(stellar keys address "$IDENT"); ISSUER_ADDR=$(stellar keys address "$ISSUER")
inv() { stellar contract invoke --id "$1" --source "$2" --network "$NET" -- "${@:3}"; }
echo "admin=$ADMIN"

TOKEN=$(stellar contract id asset --asset "USDC:$ISSUER_ADDR" --network "$NET")
echo "token=$TOKEN"
VERIFIER="${VERIFIER:-$(stellar contract deploy --wasm "$WASM/verifier.wasm" --source "$IDENT" --network "$NET" 2>/dev/null)}"
echo "verifier=$VERIFIER"

EMPTY_ROOT=$(node circuits/scripts/empty-root.mjs 20)
POOL=$(stellar contract deploy --wasm "$WASM/privacy_pool.wasm" --source "$IDENT" --network "$NET" -- \
  --admin "$ADMIN" --token "$TOKEN" --verifier "$VERIFIER" --empty_root "$EMPTY_ROOT" 2>/dev/null)
echo "pool=$POOL"

echo "== set all VKs (deposit=0, transfer=1, withdraw=2, bridge=3=deposit stmt) =="
inv "$POOL" "$IDENT" set_vk --circuit 0 --vk "$(cat circuits/build/deposit.vk.soroban.json)"  >/dev/null
inv "$POOL" "$IDENT" set_vk --circuit 1 --vk "$(cat circuits/build/transfer.vk.soroban.json)" >/dev/null
inv "$POOL" "$IDENT" set_vk --circuit 2 --vk "$(cat circuits/build/withdraw.vk.soroban.json)" >/dev/null
inv "$POOL" "$IDENT" set_vk --circuit 3 --vk "$(cat circuits/build/deposit.vk.soroban.json)"  >/dev/null
echo "  4 VKs installed"

echo "== bridge =="
BRIDGE=$(stellar contract deploy --wasm "$WASM/bridge.wasm" --source "$IDENT" --network "$NET" -- \
  --admin "$ADMIN" --pool "$POOL" --token "$TOKEN" 2>/dev/null)
echo "bridge=$BRIDGE"
inv "$POOL" "$IDENT" set_minter --minter "$BRIDGE" >/dev/null
inv "$BRIDGE" "$IDENT" set_relayer --relayer "$ADMIN" >/dev/null
# Fund the bridge with USDC liquidity (issuer mints to the bridge contract).
inv "$TOKEN" "$ISSUER" mint --to "$BRIDGE" --amount 100000000 >/dev/null
echo "  bridge wired + funded"

echo "== bridge_in for the Sepolia lock (note: amount 1000000, commitment 0x1c484cca…) =="
eval "$(node circuits/scripts/gen-note-args.mjs 1000000 987654321 55555)"
echo "  commitment=$COMMITMENT (must match Sepolia Locked event)"
inv "$BRIDGE" "$IDENT" bridge_in \
  --eth_nonce 0 --amount "$AMOUNT" --commitment "$COMMITMENT" \
  --old_root "$OLD_ROOT" --new_root "$NEW_ROOT" --proof "$PROOF"

echo "== results =="
echo -n "  total_shielded="; inv "$POOL" "$IDENT" total_shielded
echo -n "  nonce 0 used? ";  inv "$BRIDGE" "$IDENT" is_nonce_used --eth_nonce 0

cat > frontend/.env.local <<EOF
VITE_STELLAR_NETWORK=testnet
VITE_RPC_URL=https://soroban-testnet.stellar.org
VITE_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
VITE_POOL_ID=$POOL
VITE_BRIDGE_ID=$BRIDGE
VITE_VERIFIER_ID=$VERIFIER
VITE_TOKEN_ID=$TOKEN
VITE_TREE_DEPTH=20
EOF
echo
echo "FULL_DEPLOY=SUCCESS"
echo "POOL=$POOL BRIDGE=$BRIDGE VERIFIER=$VERIFIER TOKEN=$TOKEN" | tee deploy.testnet.env