#!/usr/bin/env bash
# Deploy to testnet and verify a REAL Groth16 proof on-chain by running the
# already-generated deposit proof through pool.deposit (full shielded flow:
# token pulled in + proof verified on-chain + note inserted).
set -euo pipefail
cd "$(dirname "$0")/.."
source "$HOME/.cargo/env" 2>/dev/null || true
export PATH="$HOME/.cargo/bin:$PATH"

IDENT=shieldedbridge          # admin + depositor
ISSUER=sbissuer               # separate USDC issuer (can't mint to issuer itself)
NET=testnet
WASM=contracts/target/wasm32v1-none/release
ADMIN=$(stellar keys address "$IDENT")
echo "admin=$ADMIN"

stellar keys generate --global "$ISSUER" --network "$NET" --fund 2>/dev/null || stellar keys fund "$ISSUER" --network "$NET" 2>/dev/null || true
ISSUER_ADDR=$(stellar keys address "$ISSUER")
echo "issuer=$ISSUER_ADDR"

inv() { stellar contract invoke --id "$1" --source "$2" --network "$NET" -- "${@:3}"; }

echo "== USDC SAC (issuer=$ISSUER) =="
TOKEN=$(stellar contract asset deploy --asset "USDC:$ISSUER_ADDR" --source "$ISSUER" --network "$NET" 2>/dev/null \
  || stellar contract id asset --asset "USDC:$ISSUER_ADDR" --network "$NET")
echo "  token=$TOKEN"

echo "== depositor trustline + mint =="
stellar tx new change-trust --source "$IDENT" --network "$NET" --line "USDC:$ISSUER_ADDR" 2>&1 | tail -1
inv "$TOKEN" "$ISSUER" mint --to "$ADMIN" --amount 1000000000 >/dev/null
echo "  minted 100 USDC to admin"

VERIFIER="${VERIFIER:-$(stellar contract deploy --wasm "$WASM/verifier.wasm" --source "$IDENT" --network "$NET" 2>/dev/null)}"
echo "  verifier=$VERIFIER"

EMPTY_ROOT=$(node circuits/scripts/empty-root.mjs 20)
echo "== pool (empty_root=$EMPTY_ROOT) =="
POOL=$(stellar contract deploy --wasm "$WASM/privacy_pool.wasm" --source "$IDENT" --network "$NET" -- \
  --admin "$ADMIN" --token "$TOKEN" --verifier "$VERIFIER" --empty_root "$EMPTY_ROOT" 2>/dev/null)
echo "  pool=$POOL"

echo "== set deposit VK =="
inv "$POOL" "$IDENT" set_vk --circuit 0 --vk "$(cat circuits/build/deposit.vk.soroban.json)" >/dev/null
echo "  VK installed"

eval "$(node circuits/scripts/deposit-cli-args.mjs)"
echo "== DEPOSIT (pulls $AMOUNT base USDC + verifies proof ON-CHAIN) =="
inv "$POOL" "$IDENT" deposit \
  --from "$ADMIN" --amount "$AMOUNT" \
  --commitment "$COMMITMENT" --old_root "$OLD_ROOT" --new_root "$NEW_ROOT" \
  --proof "$PROOF"

echo "== results =="
echo -n "  total_shielded="; inv "$POOL" "$IDENT" total_shielded
echo -n "  next_leaf=";      inv "$POOL" "$IDENT" next_leaf
echo
echo "ONCHAIN_DEPOSIT=SUCCESS"
echo "TOKEN=$TOKEN VERIFIER=$VERIFIER POOL=$POOL ISSUER=$ISSUER_ADDR" | tee deploy.testnet.env