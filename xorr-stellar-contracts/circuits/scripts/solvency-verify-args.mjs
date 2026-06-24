#!/usr/bin/env node
// Emit shell-eval-able args to verify the solvency proof directly on the
// generic Groth16 verifier contract. pub_signals = [root, threshold, nullifier]
// (snarkjs public.json, decimal strings = Soroban u256).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { convertProof } from "./export-vk.mjs";

const dir = resolve(import.meta.dirname, "../build");
const proof = convertProof(JSON.parse(readFileSync(`${dir}/solvency.proof.json`, "utf8")));
const pub = JSON.parse(readFileSync(`${dir}/solvency.public.json`, "utf8"));

process.stdout.write(
  `PROOF='${JSON.stringify({ a: proof.a, b: proof.b, c: proof.c })}'\n` +
  `PUB_SIGNALS='${JSON.stringify(pub)}'\n`,
);
