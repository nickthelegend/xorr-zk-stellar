#!/usr/bin/env bash
# Deploy the XORR AMM (constant-product swaps) to testnet under our identity.
# Pair defaults to USDC (the shielded asset's SAC) <-> native XLM.
set -euo pipefail
cd "$(dirname "$0")/.."

IDENT="${IDENT:-xorr}"
NET=testnet
RPC=https://soroban-testnet.stellar.org
FEE_BPS="${FEE_BPS:-30}"
# token_a = the USDC Stellar Asset Contract (xUSDC's underlying). token_b = XLM.
TOKEN_A="${TOKEN_A:-CAD7OEAESCGR5XV2BA2AHZCWM6EVJEYBYOOCA3D3ZG4TCOBWWHMZVFIV}"
OUT=.deploy
mkdir -p "$OUT"

echo "==> Funding identity $IDENT"
stellar keys fund "$IDENT" --network "$NET" 2>/dev/null || true
ADMIN=$(stellar keys address "$IDENT")
echo "    admin=$ADMIN"

TOKEN_B="${TOKEN_B:-$(stellar contract id asset --asset native --network "$NET")}"
echo "==> Pair: token_a=$TOKEN_A  token_b=$TOKEN_B  fee=${FEE_BPS}bps"

echo "==> Build wasm"
(cd contracts && stellar contract build --package amm >/dev/null)
WASM=contracts/target/wasm32v1-none/release/amm.wasm

echo "==> Deploy AMM"
AMM_ID=$(stellar contract deploy \
  --wasm "$WASM" --source "$IDENT" --network "$NET" \
  -- --token_a "$TOKEN_A" --token_b "$TOKEN_B" --fee_bps "$FEE_BPS")
echo "$AMM_ID" > "$OUT/amm_id.txt"

echo ""
echo "✅ AMM deployed: $AMM_ID"
echo "   set NEXT_PUBLIC_AMM_ID=$AMM_ID in xorr-core/.env.local"
echo "   reserves: $(stellar contract invoke --id "$AMM_ID" --source "$IDENT" --network "$NET" -- get_reserves 2>/dev/null || echo '[0,0] (seed liquidity to trade)')"
