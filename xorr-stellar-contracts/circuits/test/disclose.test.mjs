// Selective-disclosure test: prove ownership + amount of an on-chain note to an
// auditor, without revealing sk/blinding. Verifies a real proof and that a
// tampered disclosed amount is rejected.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { buildPoseidon } from "circomlibjs";
import { groth16 } from "snarkjs";

const ART = { wasm: "build/disclose_js/disclose.wasm", zkey: "build/disclose.zkey", vkey: "build/disclose.vkey.json" };
const have = existsSync(ART.wasm) && existsSync(ART.zkey);
let P;
const H = (xs) => P.F.toObject(P(xs));

before(async () => { P = await buildPoseidon(); });

test("selective disclosure: proves ownership + amount; rejects a lie", { skip: !have && "build disclose zkey first" }, async () => {
  const amount = 1234567n, sk = 99887766n, blinding = 5550123n;
  const commitment = H([amount, H([sk]), blinding]); // == Poseidon(amount, Poseidon(sk), blinding)
  const auditorTag = 424242n;

  const { proof, publicSignals } = await groth16.fullProve(
    { commitment, amount, auditorTag, sk, blinding }, ART.wasm, ART.zkey,
  );
  const vkey = JSON.parse(readFileSync(ART.vkey, "utf8"));

  // honest disclosure verifies
  assert.ok(await groth16.verify(vkey, publicSignals, proof), "valid disclosure must verify");
  // public signals = [commitment, amount, auditorTag]
  assert.equal(BigInt(publicSignals[1]), amount, "disclosed amount is public");

  // lying about the amount (same proof) must fail
  const lied = [...publicSignals];
  lied[1] = (amount + 1n).toString();
  assert.equal(await groth16.verify(vkey, lied, proof), false, "tampered amount must be rejected");
});
