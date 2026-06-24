pragma circom 2.1.6;

include "./note.circom";
include "./merkle.circom";
include "../node_modules/circomlib/circuits/bitify.circom";

// Deposit / Bridge-in statement.
//
// Public signals (MUST match privacy-pool `Circuit::Deposit` / `Circuit::Bridge`):
//   [ oldRoot, newRoot, commitment, amount ]
//
// Proves: the prover knows (sk, blinding) such that
//   commitment == Poseidon(amount, Poseidon(sk), blinding)
// and inserting `commitment` at an empty leaf transforms oldRoot -> newRoot.
// `amount` is public, so the hidden note value is bound to the deposited amount.
template Deposit(depth) {
    // public
    signal input oldRoot;
    signal input newRoot;
    signal input commitment;
    signal input amount;
    // private
    signal input sk;
    signal input blinding;
    signal input pathElements[depth];
    signal input pathIndices[depth];

    // Bound the amount to 128 bits so field arithmetic can't wrap (matches the
    // contract's i128 amounts).
    component rc = Num2Bits(128);
    rc.in <== amount;

    // The note opens to (amount, pk, blinding) and yields this commitment.
    component note = NoteOpen();
    note.amount <== amount;
    note.sk <== sk;
    note.blinding <== blinding;
    note.commitment === commitment;

    // Inserting it at an empty slot must take oldRoot -> newRoot.
    component ins = MerkleInsert(depth);
    ins.leaf <== commitment;
    ins.oldRoot <== oldRoot;
    for (var i = 0; i < depth; i++) {
        ins.pathElements[i] <== pathElements[i];
        ins.pathIndices[i] <== pathIndices[i];
    }
    ins.newRoot === newRoot;
}

component main {public [oldRoot, newRoot, commitment, amount]} = Deposit(20);
