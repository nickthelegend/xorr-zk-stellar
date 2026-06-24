#!/usr/bin/env node
// Build a witness input for solvency.circom: prove the note we deposited at
// leaf 0 (0.1 USDC) is worth >= `threshold`, without revealing its amount.
// Uses the SAME secret opening as gen-deposit-input.mjs, and computes the live
// pool root (commitment inserted at leaf 0), so the public `root` matches the
// on-chain Merkle root after that deposit.
import { buildPoseidon } from "circomlibjs";
import { writeFileSync } from "node:fs";

const DEPTH = 20;
const P = await buildPoseidon();
const H = (a, b) => P.F.toObject(P([a, b]));
const Hn = (xs) => P.F.toObject(P(xs));

const amount = 1000000n;        // the deposited note (0.1 USDC) — stays SECRET
const sk = 424242424242n;
const blinding = 13371337n;
const threshold = 500000n;      // prove balance >= 0.05 USDC (public)

const pk = Hn([sk]);
const commitment = Hn([amount, pk, blinding]);
const nullifier = Hn([commitment, sk]);

const zeros = [];
let z = 0n;
for (let i = 0; i < DEPTH; i++) { zeros[i] = z; z = H(z, z); }

// commitment at leaf 0 -> the current on-chain root.
let cur = commitment;
for (let i = 0; i < DEPTH; i++) cur = H(cur, zeros[i]);
const root = cur;

const input = {
  root: root.toString(),
  threshold: threshold.toString(),
  nullifier: nullifier.toString(),
  amount: amount.toString(),
  sk: sk.toString(),
  blinding: blinding.toString(),
  pathElements: zeros.map((x) => x.toString()),
  pathIndices: zeros.map(() => "0"),
};

writeFileSync("build/solvency.input.json", JSON.stringify(input, null, 2));
console.log("wrote build/solvency.input.json");
console.log("  threshold:", threshold.toString(), "(0.05 USDC)  hidden amount:", amount.toString());
console.log("  root:     ", root.toString());
console.log("  nullifier:", nullifier.toString());
