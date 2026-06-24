#!/usr/bin/env node
// Emit shell-eval-able CLI args for `pool.deposit`, derived from the real
// snarkjs deposit proof + public signals. Lets deploy_and_test.sh feed an
// actual proof to the on-chain verifier.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { convertProof } from "./export-vk.mjs";

const dir = resolve(import.meta.dirname, "../build");
const proof = convertProof(JSON.parse(readFileSync(`${dir}/deposit.proof.json`, "utf8")));
const pub = JSON.parse(readFileSync(`${dir}/deposit.public.json`, "utf8"));
// public signal order = [oldRoot, newRoot, commitment, amount]
const hex32 = (dec) => BigInt(dec).toString(16).padStart(64, "0");

const [oldRoot, newRoot, commitment, amount] = pub;
const proofJson = JSON.stringify({ a: proof.a, b: proof.b, c: proof.c });

process.stdout.write(
  [
    `OLD_ROOT=${hex32(oldRoot)}`,
    `NEW_ROOT=${hex32(newRoot)}`,
    `COMMITMENT=${hex32(commitment)}`,
    `AMOUNT=${amount}`,
    `PROOF='${proofJson}'`,
  ].join("\n") + "\n",
);
