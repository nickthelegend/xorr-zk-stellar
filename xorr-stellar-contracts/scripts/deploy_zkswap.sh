#!/usr/bin/env bash
# Deploy the privacy-pool build that includes `private_swap` (ZK swaps) and wire
# it to the existing USDC SAC, BN254 verifier, and the pool-factory AMM.
set -euo pipefail
cd "$(dirname "$0")/.."

IDENT="${IDENT:-xorr}"
NET=testnet
TOKEN="${TOKEN:-CAD7OEAESCGR5XV2BA2AHZCWM6EVJEYBYOOCA3D3ZG4TCOBWWHMZVFIV}"          # USDC SAC
VERIFIER="${VERIFIER:-CC46C65SFSA2QNNGZRRXAYTDB4S6V4MB52MGDBZC5A6NI3QG5H4L2FO2}"   # BN254 Groth16 verifier
FACTORY="${FACTORY:-CADU5RQBNEDPIRLGWOEC62EIGAV6V54KGITMGJ52R2ODT6EUBM66NP55}"     # pool-factory AMM
SWAP_POOL_ID="${SWAP_POOL_ID:-0}"
TOKEN_OUT="${TOKEN_OUT:-CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC}" # native XLM SAC
mkdir -p .deploy

stellar keys fund "$IDENT" --network "$NET" 2>/dev/null || true
ADMIN=$(stellar keys address "$IDENT")
echo "==> admin=$ADMIN"

echo "==> Build privacy-pool wasm (with private_swap)"
(cd contracts && stellar contract build --package privacy-pool >/dev/null)
WASM=contracts/target/wasm32v1-none/release/privacy_pool.wasm

EMPTY_ROOT=$(node circuits/scripts/empty-root.mjs 20)
echo "==> Deploy pool (empty_root=$EMPTY_ROOT)"
POOL=$(stellar contract deploy --wasm "$WASM" --source "$IDENT" --network "$NET" -- \
  --admin "$ADMIN" --token "$TOKEN" --verifier "$VERIFIER" --empty_root "$EMPTY_ROOT")
echo "    pool=$POOL"
echo "$POOL" > .deploy/zkswap_pool_id.txt

set_vk() {
  stellar contract invoke --id "$POOL" --source "$IDENT" --network "$NET" -- \
    set_vk --circuit "$1" --vk "$(cat "$2")" >/dev/null && echo "    set_vk $1 ✓"
}
echo "==> Install verifying keys"
set_vk 0 circuits/build/deposit.vk.soroban.json
set_vk 1 circuits/build/transfer.vk.soroban.json
set_vk 2 circuits/build/withdraw.vk.soroban.json

echo "==> Wire AMM swap venue (factory=$FACTORY pool=$SWAP_POOL_ID out=XLM)"
stellar contract invoke --id "$POOL" --source "$IDENT" --network "$NET" --send=yes -- \
  set_swap_venue --factory "$FACTORY" --pool_id "$SWAP_POOL_ID" --token_out "$TOKEN_OUT" >/dev/null
echo "    venue set ✓"

echo ""
echo "✅ ZK-swap pool: $POOL"
echo "   set NEXT_PUBLIC_POOL_ID=$POOL in xorr-core/.env.local"
