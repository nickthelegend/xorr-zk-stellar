pragma circom 2.1.6;

include "../node_modules/circomlib/circuits/poseidon.circom";

// Hash two children into a parent, ordered by `isRight` (the path bit):
//   isRight = 0  -> parent = H(cur, sibling)   (cur is the left child)
//   isRight = 1  -> parent = H(sibling, cur)
template HashPair() {
    signal input cur;
    signal input sibling;
    signal input isRight;
    signal output out;

    isRight * (1 - isRight) === 0; // boolean

    signal left;
    signal right;
    left  <== cur + isRight * (sibling - cur);
    right <== sibling + isRight * (cur - sibling);

    component h = Poseidon(2);
    h.inputs[0] <== left;
    h.inputs[1] <== right;
    out <== h.out;
}

// Compute the Merkle root obtained by placing `leaf` at the position described
// by (pathElements, pathIndices).
template MerkleRoot(depth) {
    signal input leaf;
    signal input pathElements[depth];
    signal input pathIndices[depth];
    signal output root;

    component hashers[depth];
    signal cur[depth + 1];
    cur[0] <== leaf;
    for (var i = 0; i < depth; i++) {
        hashers[i] = HashPair();
        hashers[i].cur <== cur[i];
        hashers[i].sibling <== pathElements[i];
        hashers[i].isRight <== pathIndices[i];
        cur[i + 1] <== hashers[i].out;
    }
    root <== cur[depth];
}

// Prove that inserting `leaf` at an *empty* position (old leaf == 0) transforms
// the tree from `oldRoot` to `newRoot`, sharing the same authentication path.
// Enforcing oldLeaf == 0 prevents overwriting (and thereby burning) an existing
// note.
template MerkleInsert(depth) {
    signal input leaf;
    signal input pathElements[depth];
    signal input pathIndices[depth];
    signal input oldRoot;
    signal output newRoot;

    component oldR = MerkleRoot(depth);
    oldR.leaf <== 0;
    for (var i = 0; i < depth; i++) {
        oldR.pathElements[i] <== pathElements[i];
        oldR.pathIndices[i] <== pathIndices[i];
    }
    oldR.root === oldRoot;

    component newR = MerkleRoot(depth);
    newR.leaf <== leaf;
    for (var i = 0; i < depth; i++) {
        newR.pathElements[i] <== pathElements[i];
        newR.pathIndices[i] <== pathIndices[i];
    }
    newRoot <== newR.root;
}

// Prove `leaf` is a member of the tree with root `root`.
template MerkleProve(depth) {
    signal input leaf;
    signal input pathElements[depth];
    signal input pathIndices[depth];
    signal input root;

    component r = MerkleRoot(depth);
    r.leaf <== leaf;
    for (var i = 0; i < depth; i++) {
        r.pathElements[i] <== pathElements[i];
        r.pathIndices[i] <== pathIndices[i];
    }
    r.root === root;
}
