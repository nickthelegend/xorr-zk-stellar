#!/usr/bin/env bash
# Build ONLY the solvency circuit (Xorr's originality feature), reusing the
# powers-of-tau produced by build.sh. Cheap: one compile + one Groth16 setup.
set -euo pipefail
cd "$(dirname "$0")/.."   # circuits/
export PATH="/Users/jaibajrang/Desktop/Projects/stellar/.bin:$PATH"

BUILD=build
PTAU="$BUILD/pot_final.ptau"
[ -f "$PTAU" ] || { echo "ERROR: $PTAU not found — run scripts/build.sh first"; exit 1; }

echo "==> Compiling solvency (BN254)"
circom src/solvency.circom --r1cs --wasm --sym -l node_modules -o "$BUILD"

echo "==> Groth16 setup: solvency"
npx snarkjs groth16 setup "$BUILD/solvency.r1cs" "$PTAU" "$BUILD/solvency_0.zkey"
npx snarkjs zkey contribute "$BUILD/solvency_0.zkey" "$BUILD/solvency.zkey" \
  --name="xorr-solvency" -v -e="$(head -c 64 /dev/urandom | base64)"
npx snarkjs zkey export verificationkey "$BUILD/solvency.zkey" "$BUILD/solvency.vkey.json"
node scripts/export-vk.mjs "$BUILD/solvency.vkey.json" "$BUILD/solvency.vk.soroban.json"

echo "==> Done:"
ls -lh "$BUILD"/solvency.zkey "$BUILD"/solvency_js/solvency.wasm "$BUILD"/solvency.vk.soroban.json | awk '{print "    "$5, $9}'
