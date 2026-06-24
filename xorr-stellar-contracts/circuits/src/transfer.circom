pragma circom 2.1.6;

include "./note.circom";
include "./merkle.circom";
include "../node_modules/circomlib/circuits/bitify.circom";

// Private transfer: 2 inputs -> 2 outputs. Hides amounts and the input/output
// linkage; reveals only nullifiers and output commitments.
//
// Public signals (MUST match privacy-pool `Circuit::Transfer`):
//   [ oldRoot, newRoot, nullifierA, nullifierB, outCommitmentA, outCommitmentB ]
//
// Proves:
//   * both input notes are members of `oldRoot`,
//   * the revealed nullifiers are correctly derived (spend authority),
//   * value is conserved: inA + inB == outA + outB,
//   * the two output commitments open correctly, and
//   * inserting both outputs takes oldRoot -> newRoot.
template Transfer(depth) {
    // public
    signal input oldRoot;
    signal input newRoot;
    signal input nullifierA;
    signal input nullifierB;
    signal input outCommitmentA;
    signal input outCommitmentB;

    // private — inputs
    signal input inAmountA;
    signal input inSkA;
    signal input inBlindingA;
    signal input inPathElementsA[depth];
    signal input inPathIndicesA[depth];

    signal input inAmountB;
    signal input inSkB;
    signal input inBlindingB;
    signal input inPathElementsB[depth];
    signal input inPathIndicesB[depth];

    // private — outputs
    signal input outAmountA;
    signal input outPkA;
    signal input outBlindingA;
    signal input outInsPathElementsA[depth];
    signal input outInsPathIndicesA[depth];

    signal input outAmountB;
    signal input outPkB;
    signal input outBlindingB;
    signal input outInsPathElementsB[depth];
    signal input outInsPathIndicesB[depth];

    // --- Spend input A ---
    component noteA = NoteOpen();
    noteA.amount <== inAmountA;
    noteA.sk <== inSkA;
    noteA.blinding <== inBlindingA;
    noteA.nullifier === nullifierA;
    component memA = MerkleProve(depth);
    memA.leaf <== noteA.commitment;
    memA.root <== oldRoot;
    for (var i = 0; i < depth; i++) {
        memA.pathElements[i] <== inPathElementsA[i];
        memA.pathIndices[i] <== inPathIndicesA[i];
    }

    // --- Spend input B ---
    component noteB = NoteOpen();
    noteB.amount <== inAmountB;
    noteB.sk <== inSkB;
    noteB.blinding <== inBlindingB;
    noteB.nullifier === nullifierB;
    component memB = MerkleProve(depth);
    memB.leaf <== noteB.commitment;
    memB.root <== oldRoot;
    for (var i = 0; i < depth; i++) {
        memB.pathElements[i] <== inPathElementsB[i];
        memB.pathIndices[i] <== inPathIndicesB[i];
    }

    // --- Range-check all amounts (128-bit) so the sum can't wrap the field ---
    component rcIa = Num2Bits(128); rcIa.in <== inAmountA;
    component rcIb = Num2Bits(128); rcIb.in <== inAmountB;
    component rcOa = Num2Bits(128); rcOa.in <== outAmountA;
    component rcOb = Num2Bits(128); rcOb.in <== outAmountB;

    // --- Value conservation ---
    inAmountA + inAmountB === outAmountA + outAmountB;

    // --- Output commitments ---
    component coutA = Commitment();
    coutA.amount <== outAmountA;
    coutA.pk <== outPkA;
    coutA.blinding <== outBlindingA;
    coutA.out === outCommitmentA;

    component coutB = Commitment();
    coutB.amount <== outAmountB;
    coutB.pk <== outPkB;
    coutB.blinding <== outBlindingB;
    coutB.out === outCommitmentB;

    // --- Insert both outputs: oldRoot -> mid -> newRoot ---
    component insA = MerkleInsert(depth);
    insA.leaf <== outCommitmentA;
    insA.oldRoot <== oldRoot;
    for (var i = 0; i < depth; i++) {
        insA.pathElements[i] <== outInsPathElementsA[i];
        insA.pathIndices[i] <== outInsPathIndicesA[i];
    }

    component insB = MerkleInsert(depth);
    insB.leaf <== outCommitmentB;
    insB.oldRoot <== insA.newRoot;
    for (var i = 0; i < depth; i++) {
        insB.pathElements[i] <== outInsPathElementsB[i];
        insB.pathIndices[i] <== outInsPathIndicesB[i];
    }
    insB.newRoot === newRoot;
}

component main {
    public [oldRoot, newRoot, nullifierA, nullifierB, outCommitmentA, outCommitmentB]
} = Transfer(20);
