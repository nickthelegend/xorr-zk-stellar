#!/usr/bin/env bash
# Compile the ShieldedBridge circuits over BN254 and run a (demo) Groth16
# trusted setup, producing proving keys (.zkey), witness generators (.wasm) and
# Soroban-encoded verifying keys.
#
# Requires: circom (https://docs.circom.io/getting-started/installation/) and
# the npm deps in this folder (`pnpm install`). BN254 (bn128) is circom's
# default prime and the curve the Stellar verifier checks on-chain via CAP-0074
# host functions, so no `-p` flag is needed and the circomlibjs Poseidon used by
# the frontend matches the in-circuit Poseidon exactly.
set -euo pipefail
cd "$(dirname "$0")/.."

CIRCUITS=(deposit transfer withdraw)
PTAU_POWER="${PTAU_POWER:-17}"   # 2^17 = 131072; transfer is ~67k constraints (verified via circom)
BUILD=build
mkdir -p "$BUILD"

command -v circom >/dev/null 2>&1 || {
  echo "ERROR: circom not found. Install: https://docs.circom.io/getting-started/installation/"; exit 1; }

echo "==> Compiling circuits (BN254)"
for c in "${CIRCUITS[@]}"; do
  echo "    - $c"
  circom "src/$c.circom" --r1cs --wasm --sym -l node_modules -o "$BUILD"
done

# ---- Phase 1: universal powers of tau (BN254 / bn128) ----
PTAU_FINAL="$BUILD/pot_final.ptau"
if [ ! -f "$PTAU_FINAL" ]; then
  echo "==> Powers of Tau (bn128, 2^$PTAU_POWER)"
  npx snarkjs powersoftau new bn128 "$PTAU_POWER" "$BUILD/pot_0.ptau" -v
  npx snarkjs powersoftau contribute "$BUILD/pot_0.ptau" "$BUILD/pot_1.ptau" \
    --name="shieldedbridge-demo" -v -e="$(head -c 64 /dev/urandom | base64)"
  npx snarkjs powersoftau prepare phase2 "$BUILD/pot_1.ptau" "$PTAU_FINAL" -v
fi

# ---- Phase 2: per-circuit Groth16 setup ----
for c in "${CIRCUITS[@]}"; do
  echo "==> Groth16 setup: $c"
  npx snarkjs groth16 setup "$BUILD/$c.r1cs" "$PTAU_FINAL" "$BUILD/${c}_0.zkey"
  npx snarkjs zkey contribute "$BUILD/${c}_0.zkey" "$BUILD/$c.zkey" \
    --name="shieldedbridge-demo" -v -e="$(head -c 64 /dev/urandom | base64)"
  npx snarkjs zkey export verificationkey "$BUILD/$c.zkey" "$BUILD/${c}.vkey.json"
  node scripts/export-vk.mjs "$BUILD/${c}.vkey.json" "$BUILD/${c}.vk.soroban.json"
done

echo
echo "==> Done. Artifacts in ./$BUILD:"
echo "    *.zkey        proving keys"
echo "    *_js/*.wasm   witness generators"
echo "    *.vk.soroban.json  verifying keys for PrivacyPool::set_vk"
echo
echo "Copy witness wasm + zkey into ../frontend/public/circuits/ for in-browser proving."
