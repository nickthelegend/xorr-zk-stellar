pragma circom 2.1.6;

include "./note.circom";
include "./merkle.circom";
include "../node_modules/circomlib/circuits/bitify.circom";

// Unshield (withdraw) one note: pay `amount` publicly, re-shield the remainder
// into a change note.
//
// Public signals (MUST match privacy-pool `Circuit::Withdraw`):
//   [ oldRoot, newRoot, nullifier, changeCommitment, amount, recipientField ]
//
// Proves:
//   * the input note is a member of `oldRoot`,
//   * the revealed nullifier is correctly derived,
//   * inAmount == amount + changeAmount  (value conservation),
//   * the change commitment opens correctly, and
//   * inserting the change note takes oldRoot -> newRoot.
//
// `recipientField` is bound into the constraint system (so the withdraw target
// cannot be substituted after proving) via a quadratic constraint.
template Withdraw(depth) {
    // public
    signal input oldRoot;
    signal input newRoot;
    signal input nullifier;
    signal input changeCommitment;
    signal input amount;
    signal input recipientField;

    // private
    signal input inAmount;
    signal input inSk;
    signal input inBlinding;
    signal input inPathElements[depth];
    signal input inPathIndices[depth];

    signal input changeAmount;
    signal input changePk;
    signal input changeBlinding;
    signal input changeInsPathElements[depth];
    signal input changeInsPathIndices[depth];

    // Spend the input note.
    component note = NoteOpen();
    note.amount <== inAmount;
    note.sk <== inSk;
    note.blinding <== inBlinding;
    note.nullifier === nullifier;

    component mem = MerkleProve(depth);
    mem.leaf <== note.commitment;
    mem.root <== oldRoot;
    for (var i = 0; i < depth; i++) {
        mem.pathElements[i] <== inPathElements[i];
        mem.pathIndices[i] <== inPathIndices[i];
    }

    // Range-check amounts (128-bit) so the sum can't wrap the field.
    component rcIn = Num2Bits(128); rcIn.in <== inAmount;
    component rcAmt = Num2Bits(128); rcAmt.in <== amount;
    component rcChg = Num2Bits(128); rcChg.in <== changeAmount;

    // Value conservation: spent = withdrawn + change.
    inAmount === amount + changeAmount;

    // Change note commitment.
    component change = Commitment();
    change.amount <== changeAmount;
    change.pk <== changePk;
    change.blinding <== changeBlinding;
    change.out === changeCommitment;

    // Insert the change note: oldRoot -> newRoot.
    component ins = MerkleInsert(depth);
    ins.leaf <== changeCommitment;
    ins.oldRoot <== oldRoot;
    for (var i = 0; i < depth; i++) {
        ins.pathElements[i] <== changeInsPathElements[i];
        ins.pathIndices[i] <== changeInsPathIndices[i];
    }
    ins.newRoot === newRoot;

    // Bind the recipient field so it cannot be malleated/front-run.
    signal recipientSquared;
    recipientSquared <== recipientField * recipientField;
}

component main {
    public [oldRoot, newRoot, nullifier, changeCommitment, amount, recipientField]
} = Withdraw(20);
