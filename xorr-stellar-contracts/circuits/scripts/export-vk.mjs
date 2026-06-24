#!/usr/bin/env node
// Convert a snarkjs BN254 verification_key.json into the byte encoding the
// Soroban host expects for `crypto::bn254::{Bn254G1Affine, Bn254G2Affine}`
// (CAP-0074):
//
//   * Each Fp coordinate -> 32 bytes, big-endian.
//   * G1Affine  (64 bytes)  = be(x) || be(y)
//   * G2Affine (128 bytes)  = be(x) || be(y), each Fp2 = be(c1) || be(c0)
//     (imaginary component first, EIP-197 ordering). snarkjs lists Fp2 as
//     [c0, c1], so each coordinate is swapped here.
//
// Output is a JSON object of hex strings, consumed by `scripts/deploy.mjs`
// (which builds the `VerificationKey` ScVal) and mirrored by the frontend's
// `prover.ts` for `Proof` values. The encoding mirrors Ethereum's BN254
// precompiles, so it round-trips with standard tooling.

import { readFileSync, writeFileSync } from "node:fs";

const FP_BYTES = 32;

function fpToHex(dec) {
  let hex = BigInt(dec).toString(16);
  if (hex.length > FP_BYTES * 2) throw new Error("Fp coordinate overflows 32 bytes");
  return hex.padStart(FP_BYTES * 2, "0");
}

// G1 point [x, y, z(=1)] -> 64-byte hex (be(x) || be(y)), affine.
export function g1ToHex(p) {
  return fpToHex(p[0]) + fpToHex(p[1]);
}

// G2 point [[x.c0, x.c1], [y.c0, y.c1], z] -> 128-byte hex, Fp2 = c1 || c0.
export function g2ToHex(p) {
  return fpToHex(p[0][1]) + fpToHex(p[0][0]) + fpToHex(p[1][1]) + fpToHex(p[1][0]);
}

export function convertVk(vk) {
  return {
    alpha: g1ToHex(vk.vk_alpha_1),
    beta: g2ToHex(vk.vk_beta_2),
    gamma: g2ToHex(vk.vk_gamma_2),
    delta: g2ToHex(vk.vk_delta_2),
    ic: vk.IC.map(g1ToHex),
  };
}

// snarkjs proof.json -> { a, b, c } hex (a,c are G1; b is G2).
export function convertProof(proof) {
  return { a: g1ToHex(proof.pi_a), b: g2ToHex(proof.pi_b), c: g1ToHex(proof.pi_c) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , inPath, outPath] = process.argv;
  if (!inPath || !outPath) {
    console.error("usage: export-vk.mjs <verification_key.json> <out.json>");
    process.exit(1);
  }
  const vk = JSON.parse(readFileSync(inPath, "utf8"));
  const out = convertVk(vk);
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`wrote ${outPath} (${out.ic.length} IC points)`);
}
