pragma circom 2.1.6;

include "../node_modules/circomlib/circuits/poseidon.circom";

// A ShieldedBridge note is (amount, pk, blinding) where the owner's public key
// pk = Poseidon(sk) is derived from a secret spend key sk.
//
//   commitment = Poseidon(amount, pk, blinding)
//   nullifier  = Poseidon(commitment, sk)
//
// Revealing the nullifier proves spend authority (knowledge of sk) without
// revealing which commitment is being spent.

template DerivePk() {
    signal input sk;
    signal output pk;
    component h = Poseidon(1);
    h.inputs[0] <== sk;
    pk <== h.out;
}

template Commitment() {
    signal input amount;
    signal input pk;
    signal input blinding;
    signal output out;
    component h = Poseidon(3);
    h.inputs[0] <== amount;
    h.inputs[1] <== pk;
    h.inputs[2] <== blinding;
    out <== h.out;
}

template Nullifier() {
    signal input commitment;
    signal input sk;
    signal output out;
    component h = Poseidon(2);
    h.inputs[0] <== commitment;
    h.inputs[1] <== sk;
    out <== h.out;
}

// Full opening of a note: derive pk from sk, then the commitment and nullifier.
template NoteOpen() {
    signal input amount;
    signal input sk;
    signal input blinding;
    signal output commitment;
    signal output nullifier;

    component pk = DerivePk();
    pk.sk <== sk;

    component c = Commitment();
    c.amount <== amount;
    c.pk <== pk.pk;
    c.blinding <== blinding;
    commitment <== c.out;

    component n = Nullifier();
    n.commitment <== c.out;
    n.sk <== sk;
    nullifier <== n.out;
}
