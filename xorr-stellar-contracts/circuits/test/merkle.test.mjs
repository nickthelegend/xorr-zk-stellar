// Runnable test (no circom required) for the Poseidon/BN254 incremental Merkle
// tree that the frontend mirror (frontend/src/lib/notes.ts) and the circuits
// (circuits/src/merkle.circom) implement. Validates:
//   1. insert() advances the root deterministically,
//   2. the authentication path from proof() recomputes to the current root,
//   3. note commitment/nullifier derivation is stable.
//
// Run: `node --test test/merkle.test.mjs`  (after `pnpm install`).
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPoseidon } from "circomlibjs";

const DEPTH = 6;
let P;
const H = (a, b) => P.F.toObject(P([a, b]));
const Hn = (xs) => P.F.toObject(P(xs));

class Tree {
  constructor(depth) {
    this.depth = depth;
    this.zeros = [];
    this.filled = [];
    let cur = 0n;
    for (let i = 0; i < depth; i++) {
      this.zeros[i] = cur;
      this.filled[i] = cur;
      cur = H(cur, cur);
    }
    this.root = cur;
    this.leaves = [];
  }
  insert(leaf) {
    const index = this.leaves.length;
    const oldRoot = this.root;
    let cur = leaf, idx = index;
    for (let i = 0; i < this.depth; i++) {
      if ((idx & 1) === 0) { this.filled[i] = cur; cur = H(cur, this.zeros[i]); }
      else { cur = H(this.filled[i], cur); }
      idx >>= 1;
    }
    this.leaves.push(leaf);
    this.root = cur;
    return { index, oldRoot, newRoot: cur };
  }
  proof(index) {
    const pathElements = [], pathIndices = [];
    let layer = [...this.leaves], idx = index;
    for (let i = 0; i < this.depth; i++) {
      const isRight = idx & 1;
      const sib = isRight ? idx - 1 : idx + 1;
      pathIndices.push(isRight);
      pathElements.push(sib < layer.length ? layer[sib] : this.zeros[i]);
      const next = [];
      for (let j = 0; j < layer.length; j += 2)
        next.push(H(layer[j], j + 1 < layer.length ? layer[j + 1] : this.zeros[i]));
      layer = next; idx >>= 1;
    }
    return { pathElements, pathIndices };
  }
}

const rootFromPath = (leaf, { pathElements, pathIndices }) => {
  let cur = leaf;
  for (let i = 0; i < pathElements.length; i++)
    cur = pathIndices[i] ? H(pathElements[i], cur) : H(cur, pathElements[i]);
  return cur;
};

test("setup poseidon", async () => { P = await buildPoseidon(); assert.ok(P); });

test("empty root is deterministic", () => {
  const a = new Tree(DEPTH), b = new Tree(DEPTH);
  assert.equal(a.root, b.root);
});

test("insert advances root and membership path verifies", () => {
  const t = new Tree(DEPTH);
  const commitments = [11n, 22n, 33n, 44n, 55n];
  const indices = [];
  for (const c of commitments) {
    const before = t.root;
    const { index, newRoot } = t.insert(c);
    indices.push(index);
    assert.notEqual(before, newRoot, "root must change on insert");
    assert.equal(t.root, newRoot);
  }
  // Every inserted leaf authenticates against the final root.
  for (let k = 0; k < commitments.length; k++) {
    const pf = t.proof(indices[k]);
    assert.equal(rootFromPath(commitments[k], pf), t.root, `leaf ${k} must verify`);
  }
});

test("note commitment + nullifier derivation is stable", () => {
  const amount = 1000n, sk = 123456789n, blinding = 987654321n;
  const pk = Hn([sk]);
  const commitment = Hn([amount, pk, blinding]);
  const nullifier = Hn([commitment, sk]);
  // Recomputation matches (deterministic, field-stable).
  assert.equal(Hn([amount, Hn([sk]), blinding]), commitment);
  assert.equal(Hn([commitment, sk]), nullifier);
  // Different blinding -> different commitment (hiding).
  assert.notEqual(Hn([amount, pk, blinding + 1n]), commitment);
});
