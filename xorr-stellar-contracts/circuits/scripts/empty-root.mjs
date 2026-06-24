#!/usr/bin/env node
// Print the root of the empty Poseidon(BN254) Merkle tree of the given depth as
// a 64-char big-endian hex string (for PrivacyPool's `empty_root` constructor
// arg). Matches frontend/src/lib/notes.ts MerkleTree and circuits/src/merkle.circom.
//   usage: node circuits/scripts/empty-root.mjs [depth=20]
import { buildPoseidon } from "circomlibjs";

const depth = Number(process.argv[2] ?? "20");
const P = await buildPoseidon();
const H = (a, b) => P.F.toObject(P([a, b]));

let cur = 0n;
for (let i = 0; i < depth; i++) cur = H(cur, cur);

let hex = cur.toString(16).padStart(64, "0");
process.stdout.write(hex);
