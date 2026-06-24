#!/usr/bin/env bash
# Deploy the XORR Pool Factory (multi-pool AMM + confidential pools) to testnet
# and create+seed a USDC/XLM pool.
set -euo pipefail
cd "$(dirname "$0")/.."

IDENT="${IDENT:-xorr}"
NET=testnet
TOKEN_A="${TOKEN_A:-CAD7OEAESCGR5XV2BA2AHZCWM6EVJEYBYOOCA3D3ZG4TCOBWWHMZVFIV}"   # USDC SAC
mkdir -p .deploy

stellar keys fund "$IDENT" --network "$NET" 2>/dev/null || true
DEP=$(stellar keys address "$IDENT")
TOKEN_B="${TOKEN_B:-$(stellar contract id asset --asset native --network "$NET")}"  # XLM SAC

echo "==> Build"
(cd contracts && stellar contract build --package pool-factory >/dev/null)
WASM=contracts/target/wasm32v1-none/release/pool_factory.wasm

echo "==> Deploy factory"
FAC=$(stellar contract deploy --wasm "$WASM" --source "$IDENT" --network "$NET")
echo "$FAC" > .deploy/factory_id.txt

echo "==> Create USDC/XLM pool (#0)"
stellar contract invoke --id "$FAC" --source "$IDENT" --network "$NET" --send=yes -- \
  create_pool --creator "$DEP" --token_a "$TOKEN_A" --token_b "$TOKEN_B" --fee_bps 30 --confidential false

echo "==> Seed 100 USDC + 500 XLM"
stellar contract invoke --id "$FAC" --source "$IDENT" --network "$NET" --send=yes -- \
  add_liquidity --pool_id 0 --from "$DEP" --amount_a 1000000000 --amount_b 5000000000

echo ""
echo "✅ Pool factory: $FAC"
echo "   set NEXT_PUBLIC_POOL_FACTORY_ID=$FAC in xorr-core/.env.local"
