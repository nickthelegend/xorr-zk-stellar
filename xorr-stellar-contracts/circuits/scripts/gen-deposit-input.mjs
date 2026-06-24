#!/usr/bin/env node
// Produce a valid witness input for deposit.circom: shield `amount` into a fresh
// note inserted at leaf 0 of an empty depth-20 tree. Mirrors the frontend
// MerkleTree exactly, so this doubles as an end-to-end check that the circuit,
// the JS tree, and the Poseidon constants all agree.
import { buildPoseidon } from "circomlibjs";
import { writeFileSync } from "node:fs";

const DEPTH = 20;
const P = await buildPoseidon();
const H = (a, b) => P.F.toObject(P([a, b]));
const Hn = (xs) => P.F.toObject(P(xs));

const amount = 1000000n;        // 0.1 USDC (7 decimals)
const sk = 424242424242n;
const blinding = 13371337n;

const pk = Hn([sk]);
const commitment = Hn([amount, pk, blinding]);

// zeros[i] and the empty root (== oldRoot for an index-0 insertion).
const zeros = [];
let z = 0n;
for (let i = 0; i < DEPTH; i++) { zeros[i] = z; z = H(z, z); }
const oldRoot = z;

// Insert commitment at index 0: pathElements = zeros, pathIndices = 0.
let cur = commitment;
for (let i = 0; i < DEPTH; i++) cur = H(cur, zeros[i]);
const newRoot = cur;

const input = {
  oldRoot: oldRoot.toString(),
  newRoot: newRoot.toString(),
  commitment: commitment.toString(),
  amount: amount.toString(),
  sk: sk.toString(),
  blinding: blinding.toString(),
  pathElements: zeros.map((x) => x.toString()),
  pathIndices: zeros.map(() => "0"),
};

writeFileSync("build/deposit.input.json", JSON.stringify(input, null, 2));
console.log("wrote build/deposit.input.json");
console.log("  commitment:", commitment.toString());
console.log("  oldRoot:   ", oldRoot.toString());
console.log("  newRoot:   ", newRoot.toString());
