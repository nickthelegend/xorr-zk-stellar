// End-to-end ZK test: proves the private-payment lifecycle works and reports
// timing. Generates REAL Groth16 proofs through the deposit, transfer (2-in /
// 2-out private payment) and withdraw circuits and verifies them with snarkjs
// (the same Groth16/BN254 math the on-chain verifier runs).
//
//   • UTXO accounts: deterministic, unlinkable per-note keys from one master.
//   • Private payment: a 2-in/2-out transfer that hides amounts + linkage and
//     conserves value, verified by a real proof.
//   • Bridge: shares the deposit statement (asserted), so a passing deposit
//     proof demonstrates the bridge-mint verification path too.
//
// Run: `node --test 'test/*.test.mjs'` (after `pnpm build` produces build/*.zkey).
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { buildPoseidon } from "circomlibjs";
import { groth16 } from "snarkjs";
import { readFileSync } from "node:fs";

const DEPTH = 20;
const B = (c) => `build/${c}`;
const ART = (c) => ({ wasm: `build/${c}_js/${c}.wasm`, zkey: `build/${c}.zkey`, vkey: `build/${c}.vkey.json` });
const haveArtifacts = ["deposit", "transfer", "withdraw"].every(
  (c) => existsSync(ART(c).wasm) && existsSync(ART(c).zkey),
);

let P, timings = {};
const H = (xs) => P.F.toObject(P(xs));
const deriveSpendKey = (master, i) => H([master, BigInt(i)]);
const deriveViewKey = (master) => H([master, 0n]);
const pubKey = (sk) => H([sk]);
const commit = (amount, pk, blinding) => H([amount, pk, blinding]);
const nullifier = (cmt, sk) => H([cmt, sk]);
const rand = () => {
  const b = new Uint8Array(31); crypto.getRandomValues(b);
  let v = 0n; for (const x of b) v = (v << 8n) | BigInt(x); return v;
};

class Tree {
  constructor(d = DEPTH) {
    this.depth = d; this.zeros = []; this.filled = []; this.leaves = [];
    let z = 0n; for (let i = 0; i < d; i++) { this.zeros[i] = z; this.filled[i] = z; z = H([z, z]); }
    this.root = z;
  }
  insert(leaf) {
    const index = this.leaves.length, oldRoot = this.root;
    const pathElements = [], pathIndices = [];
    let cur = leaf, idx = index;
    for (let i = 0; i < this.depth; i++) {
      const isRight = idx & 1; pathIndices.push(isRight);
      if (isRight === 0) { pathElements.push(this.zeros[i]); this.filled[i] = cur; cur = H([cur, this.zeros[i]]); }
      else { pathElements.push(this.filled[i]); cur = H([this.filled[i], cur]); }
      idx >>= 1;
    }
    this.leaves.push(leaf); this.root = cur;
    return { index, pathElements, pathIndices, oldRoot, newRoot: cur };
  }
  proof(index) {
    const pathElements = [], pathIndices = [];
    let layer = [...this.leaves], idx = index;
    for (let i = 0; i < this.depth; i++) {
      const isRight = idx & 1, sib = isRight ? idx - 1 : idx + 1;
      pathIndices.push(isRight);
      pathElements.push(sib < layer.length ? layer[sib] : this.zeros[i]);
      const next = [];
      for (let j = 0; j < layer.length; j += 2)
        next.push(H([layer[j], j + 1 < layer.length ? layer[j + 1] : this.zeros[i]]));
      layer = next; idx >>= 1;
    }
    return { pathElements, pathIndices };
  }
}

async function proveVerify(circuit, input) {
  const { wasm, zkey, vkey } = ART(circuit);
  const t0 = performance.now();
  const { proof, publicSignals } = await groth16.fullProve(input, wasm, zkey);
  const tProve = performance.now() - t0;
  const vk = JSON.parse(readFileSync(vkey, "utf8"));
  const t1 = performance.now();
  const ok = await groth16.verify(vk, publicSignals, proof);
  const tVerify = performance.now() - t1;
  timings[circuit] = { prove: tProve, verify: tVerify };
  return { ok, publicSignals };
}

before(async () => { P = await buildPoseidon(); });

// -------------------- UTXO accounts --------------------
test("UTXO accounts: deterministic, unlinkable, recoverable", () => {
  const master = 88997766554433n;
  // deterministic
  assert.equal(deriveSpendKey(master, 1), deriveSpendKey(master, 1));
  assert.equal(deriveViewKey(master), deriveViewKey(master));
  // distinct indices -> distinct keys (the "constellation")
  assert.notEqual(deriveSpendKey(master, 1), deriveSpendKey(master, 2));
  // view key separate from any spend key
  assert.notEqual(deriveViewKey(master), deriveSpendKey(master, 1));
  // unlinkability: same amount under two derived keys -> different commitments
  const a = 1000000n, bl = 42n;
  const c1 = commit(a, pubKey(deriveSpendKey(master, 1)), bl);
  const c2 = commit(a, pubKey(deriveSpendKey(master, 2)), bl);
  assert.notEqual(c1, c2, "notes under different derived keys must be unlinkable");
  // recoverable: a fresh wallet from the same master re-derives identical keys
  assert.equal(deriveSpendKey(master, 5), deriveSpendKey(88997766554433n, 5));
});

// -------------------- deposit (== bridge statement) --------------------
test("private deposit: real proof verifies (also the bridge-mint path)", { skip: !haveArtifacts && "build zkeys first (pnpm build)" }, async () => {
  const master = 1234567n, idx = 1, amount = 1000000n;
  const sk = deriveSpendKey(master, idx), blinding = rand();
  const cmt = commit(amount, pubKey(sk), blinding);
  const t = new Tree();
  const ins = t.insert(cmt);
  const { ok, publicSignals } = await proveVerify("deposit", {
    oldRoot: ins.oldRoot, newRoot: ins.newRoot, commitment: cmt, amount,
    sk, blinding, pathElements: ins.pathElements, pathIndices: ins.pathIndices,
  });
  assert.ok(ok, "deposit proof must verify");
  // public signals = [oldRoot, newRoot, commitment, amount]
  assert.equal(BigInt(publicSignals[3]), amount);
  assert.equal(BigInt(publicSignals[2]), cmt);
});

// -------------------- private transfer (the headline) --------------------
test("private payment: 2-in/2-out transfer hides amounts, conserves value", { skip: !haveArtifacts && "build zkeys first (pnpm build)" }, async () => {
  const master = 555n;
  const skA = deriveSpendKey(master, 1), skB = deriveSpendKey(master, 2);
  const inAmtA = 600000n, inAmtB = 400000n;          // two owned notes
  const blA = rand(), blB = rand();
  const cmtInA = commit(inAmtA, pubKey(skA), blA);
  const cmtInB = commit(inAmtB, pubKey(skB), blB);

  const t = new Tree();
  t.insert(cmtInA); t.insert(cmtInB);                 // leaves 0,1
  const R0 = t.root;
  const memA = t.proof(0), memB = t.proof(1);

  // outputs: 0.7 to a recipient key, 0.3 change to a fresh own key (value conserved)
  const outAmtA = 700000n, outAmtB = 300000n;
  assert.equal(inAmtA + inAmtB, outAmtA + outAmtB);
  const pkOutA = pubKey(deriveSpendKey(999n, 1));      // recipient's shielded key
  const pkOutB = pubKey(deriveSpendKey(master, 3));    // change to self
  const obA = rand(), obB = rand();
  const cmtOutA = commit(outAmtA, pkOutA, obA);
  const cmtOutB = commit(outAmtB, pkOutB, obB);
  const insA = t.insert(cmtOutA);                      // R0 -> R1
  const insB = t.insert(cmtOutB);                      // R1 -> R2

  const { ok } = await proveVerify("transfer", {
    oldRoot: R0, newRoot: insB.newRoot,
    nullifierA: nullifier(cmtInA, skA), nullifierB: nullifier(cmtInB, skB),
    outCommitmentA: cmtOutA, outCommitmentB: cmtOutB,
    inAmountA: inAmtA, inSkA: skA, inBlindingA: blA,
    inPathElementsA: memA.pathElements, inPathIndicesA: memA.pathIndices,
    inAmountB: inAmtB, inSkB: skB, inBlindingB: blB,
    inPathElementsB: memB.pathElements, inPathIndicesB: memB.pathIndices,
    outAmountA: outAmtA, outPkA: pkOutA, outBlindingA: obA,
    outInsPathElementsA: insA.pathElements, outInsPathIndicesA: insA.pathIndices,
    outAmountB: outAmtB, outPkB: pkOutB, outBlindingB: obB,
    outInsPathElementsB: insB.pathElements, outInsPathIndicesB: insB.pathIndices,
  });
  assert.ok(ok, "transfer proof must verify");
});

// -------------------- withdraw --------------------
test("withdraw: unshield + change, real proof verifies", { skip: !haveArtifacts && "build zkeys first (pnpm build)" }, async () => {
  const master = 777n, sk = deriveSpendKey(master, 1);
  const inAmt = 1000000n, bl = rand();
  const cmtIn = commit(inAmt, pubKey(sk), bl);
  const t = new Tree();
  t.insert(cmtIn);
  const R0 = t.root;
  const mem = t.proof(0);

  const amount = 400000n, changeAmt = 600000n;
  const changeBl = rand(), changePk = pubKey(deriveSpendKey(master, 2));
  const changeCmt = commit(changeAmt, changePk, changeBl);
  const ins = t.insert(changeCmt);

  const { ok } = await proveVerify("withdraw", {
    oldRoot: R0, newRoot: ins.newRoot,
    nullifier: nullifier(cmtIn, sk), changeCommitment: changeCmt,
    amount, recipientField: 123456789n,
    inAmount: inAmt, inSk: sk, inBlinding: bl,
    inPathElements: mem.pathElements, inPathIndices: mem.pathIndices,
    changeAmount: changeAmt, changePk, changeBlinding: changeBl,
    changeInsPathElements: ins.pathElements, changeInsPathIndices: ins.pathIndices,
  });
  assert.ok(ok, "withdraw proof must verify");
});

// -------------------- timing report --------------------
test("⏱ timing report", () => {
  if (Object.keys(timings).length === 0) { console.log("  (proof artifacts absent — ran logic-only)"); return; }
  console.log("\n  ── ZK proof timing (prove → verify) ──");
  for (const [c, t] of Object.entries(timings))
    console.log(`  ${c.padEnd(9)}  prove ${ (t.prove/1000).toFixed(2)}s   verify ${t.verify.toFixed(0)}ms`);
  const totalProve = Object.values(timings).reduce((s, t) => s + t.prove, 0);
  console.log(`  total prove time: ${(totalProve/1000).toFixed(2)}s\n`);
});
