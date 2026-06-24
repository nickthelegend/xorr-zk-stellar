#!/usr/bin/env bash
# Deploy Xorr to Stellar Testnet and wire everything together:
#   verifier -> privacy-pool -> bridge, a test USDC asset, verifying keys, and
#   the frontend env file. Requires: stellar CLI, and (for VKs) the artifacts
#   from `cd circuits && pnpm build`.
#
# Usage: scripts/deploy_testnet.sh [identity]
set -euo pipefail
cd "$(dirname "$0")/.."
source "$HOME/.cargo/env" 2>/dev/null || true

IDENT="${1:-shieldedbridge}"
NET=testnet
WASM=contracts/target/wasm32v1-none/release

echo "==> Identity: $IDENT (funding on testnet)"
stellar keys generate --global "$IDENT" --network "$NET" --fund 2>/dev/null || true
ADMIN=$(stellar keys address "$IDENT")
echo "    admin = $ADMIN"

echo "==> Building contracts"
stellar contract build
# (equivalently: cargo build --target wasm32v1-none --release)

echo "==> Test USDC (Stellar Asset Contract)"
# Issue a classic asset from the admin and deploy its SAC wrapper.
TOKEN=$(stellar contract asset deploy --asset "USDC:$ADMIN" --source "$IDENT" --network "$NET")
echo "    token = $TOKEN"
# Mint demo balance to admin (SAC admin == issuer).
stellar contract invoke --id "$TOKEN" --source "$IDENT" --network "$NET" -- \
  mint --to "$ADMIN" --amount 1000000000000 >/dev/null

deploy() { # <wasm> [constructor args...]
  stellar contract deploy --wasm "$1" --source "$IDENT" --network "$NET" -- "${@:2}"
}

echo "==> Deploying verifier"
VERIFIER=$(deploy "$WASM/verifier.wasm")
echo "    verifier = $VERIFIER"

# Empty Poseidon-tree root (depth 20). Computed by the circuit tooling; default
# is the canonical zeros root used by the frontend MerkleTree.
EMPTY_ROOT="${EMPTY_ROOT:-$(node circuits/scripts/empty-root.mjs ${TREE_DEPTH:-20})}"

echo "==> Deploying privacy-pool"
POOL=$(deploy "$WASM/privacy_pool.wasm" \
  --admin "$ADMIN" --token "$TOKEN" --verifier "$VERIFIER" --empty_root "$EMPTY_ROOT")
echo "    pool = $POOL"

echo "==> Deploying bridge"
BRIDGE=$(deploy "$WASM/bridge.wasm" --admin "$ADMIN" --pool "$POOL" --token "$TOKEN")
echo "    bridge = $BRIDGE"

echo "==> Wiring: pool.set_minter(bridge), bridge.set_relayer(admin)"
stellar contract invoke --id "$POOL" --source "$IDENT" --network "$NET" -- \
  set_minter --minter "$BRIDGE" >/dev/null
stellar contract invoke --id "$BRIDGE" --source "$IDENT" --network "$NET" -- \
  set_relayer --relayer "$ADMIN" >/dev/null
# Fund the bridge with liquidity backing future ETH->Stellar mints.
stellar contract invoke --id "$TOKEN" --source "$IDENT" --network "$NET" -- \
  transfer --from "$ADMIN" --to "$BRIDGE" --amount 100000000000 >/dev/null

echo "==> Installing verifying keys (requires circuits/build/*.vk.soroban.json)"
set_vk() { # <circuit-variant> <vk-json-file>
  if [ -f "$2" ]; then
    stellar contract invoke --id "$POOL" --source "$IDENT" --network "$NET" -- \
      set_vk --circuit "$1" --vk "$(cat "$2")" >/dev/null && echo "    set_vk $1 ✓"
  else
    echo "    ! $2 missing — run 'cd circuits && pnpm build' then re-run set_vk"
  fi
}
set_vk Deposit  circuits/build/deposit.vk.soroban.json
set_vk Transfer circuits/build/transfer.vk.soroban.json
set_vk Withdraw circuits/build/withdraw.vk.soroban.json
set_vk Bridge   circuits/build/deposit.vk.soroban.json  # bridge reuses the deposit statement

echo "==> Writing frontend/.env.local"
cat > frontend/.env.local <<EOF
VITE_STELLAR_NETWORK=testnet
VITE_RPC_URL=https://soroban-testnet.stellar.org
VITE_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
VITE_POOL_ID=$POOL
VITE_BRIDGE_ID=$BRIDGE
VITE_VERIFIER_ID=$VERIFIER
VITE_TOKEN_ID=$TOKEN
VITE_TREE_DEPTH=${TREE_DEPTH:-20}
EOF

echo
echo "Done. Contracts:"
echo "  TOKEN=$TOKEN"
echo "  VERIFIER=$VERIFIER"
echo "  POOL=$POOL"
echo "  BRIDGE=$BRIDGE"
echo "Next: copy circuits/build/*_js/*.wasm + *.zkey into frontend/public/circuits/, then 'cd frontend && pnpm dev'."
