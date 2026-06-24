#!/usr/bin/env bash
# Install the toolchain needed to build & deploy ShieldedBridge:
#   - Rust + wasm32v1-none target (Soroban contracts)
#   - Stellar CLI (deploy/invoke)
#   - circom (circuit compiler)
# Node deps (snarkjs, circomlibjs, the frontend) are installed via pnpm.
set -euo pipefail

echo "==> Rust"
if ! command -v cargo >/dev/null 2>&1; then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal
  source "$HOME/.cargo/env"
fi
rustup target add wasm32v1-none

echo "==> Stellar CLI"
if ! command -v stellar >/dev/null 2>&1; then
  # Protocol 23+ CLI (supports BN254 contracts). cargo install is slow but
  # reliable; prebuilt binaries: https://github.com/stellar/stellar-cli/releases
  cargo install --locked stellar-cli
fi
stellar --version

echo "==> circom"
if ! command -v circom >/dev/null 2>&1; then
  echo "Installing circom from source (requires Rust)…"
  tmp=$(mktemp -d)
  git clone --depth 1 https://github.com/iden3/circom.git "$tmp/circom"
  ( cd "$tmp/circom" && cargo build --release && cargo install --path circom )
fi
circom --version

echo
echo "All tools installed. Next: pnpm install (root), then scripts/deploy_testnet.sh"
