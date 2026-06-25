#!/usr/bin/env bash
# Deploy the XORR lending money market + list the USDC/XLM markets + seed liquidity.
# Idempotent-ish: re-running deploys a fresh contract. Prints NEXT_PUBLIC_LENDING_ID.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

SRC=${SRC:-xorr}                 # admin/oracle + liquidity source key
NET=${NET:-testnet}
USDC=${USDC:-CAD7OEAESCGR5XV2BA2AHZCWM6EVJEYBYOOCA3D3ZG4TCOBWWHMZVFIV}
XLM=${XLM:-CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC}
ADMIN=$(stellar keys address "$SRC")

echo "▸ building wasm…"
( cd contracts && cargo build -p lending --target wasm32v1-none --release >/dev/null )
WASM=contracts/target/wasm32v1-none/release/lending.wasm

echo "▸ deploying (admin=$ADMIN)…"
LENDING=$(stellar contract deploy --wasm "$WASM" --source "$SRC" --network "$NET" -- --admin "$ADMIN" | tail -1)
echo "  LENDING=$LENDING"

inv() { stellar contract invoke --id "$LENDING" --source "$SRC" --network "$NET" --send=yes -- "$@" >/dev/null; }

echo "▸ add markets (USDC 85% LTV \$1 · XLM 70% LTV \$0.11)…"
inv add_market --asset "$USDC" --collateral_factor 8500 --reserve_factor 1000 --base_rate 200 --slope 2000 --price 10000000
inv add_market --asset "$XLM"  --collateral_factor 7000 --reserve_factor 1500 --base_rate 200 --slope 3000 --price 1100000

echo "▸ seed 2000 USDC liquidity…"
inv supply --asset "$USDC" --from "$ADMIN" --amount 20000000000

echo ""
echo "✓ deployed + seeded. Set in xorr-core/.env.local:"
echo "  NEXT_PUBLIC_LENDING_ID=$LENDING"
