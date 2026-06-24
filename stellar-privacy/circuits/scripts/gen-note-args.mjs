#!/usr/bin/env node
// Generate a real deposit/bridge proof for a note (amount, sk, blinding)
// inserted at leaf 0 of an empty depth-20 tree, and emit shell-eval-able CLI
// args (OLD_ROOT, NEW_ROOT, COMMITMENT, AMOUNT, PROOF). Used to feed bridge_in.
//   node scripts/gen-note-args.mjs <amount> <sk> <blinding>
import { resolve } from "node:path";
import { buildPoseidon } from "circomlibjs";
import { groth16 } from "snarkjs";
import { convertProof } from "./export-vk.mjs";

const DEPTH = 20;
const dir = resolve(import.meta.dirname, "../build");
const [amount, sk, blinding] = process.argv.slice(2).map((x) => BigInt(x));

const P = await buildPoseidon();
const H = (xs) => P.F.toObject(P(xs));
const commitment = H([amount, H([sk]), blinding]);

const zeros = []; let z = 0n;
for (let i = 0; i < DEPTH; i++) { zeros[i] = z; z = H([z, z]); }
const oldRoot = z;
let cur = commitment; for (let i = 0; i < DEPTH; i++) cur = H([cur, zeros[i]]);
const newRoot = cur;

const input = {
  oldRoot, newRoot, commitment, amount, sk, blinding,
  pathElements: zeros, pathIndices: zeros.map(() => 0),
};
const { proof, publicSignals } = await groth16.fullProve(
  input, `${dir}/deposit_js/deposit.wasm`, `${dir}/deposit.zkey`,
);
const p = convertProof(proof);
const hex32 = (d) => BigInt(d).toString(16).padStart(64, "0");
// publicSignals = [oldRoot, newRoot, commitment, amount]
process.stdout.write([
  `OLD_ROOT=${hex32(publicSignals[0])}`,
  `NEW_ROOT=${hex32(publicSignals[1])}`,
  `COMMITMENT=${hex32(publicSignals[2])}`,
  `AMOUNT=${publicSignals[3]}`,
  `PROOF='${JSON.stringify({ a: p.a, b: p.b, c: p.c })}'`,
].join("\n") + "\n");
