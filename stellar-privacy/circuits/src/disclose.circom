pragma circom 2.1.6;

include "./note.circom";
include "../node_modules/circomlib/circuits/bitify.circom";

// Selective disclosure: prove to an auditor that you OWN an on-chain note and
// that it holds a specific `amount`, WITHOUT revealing your spend key, blinding,
// or linking it to your other notes.
//
// Public signals: [ commitment, amount, auditorTag ]
//   * commitment  — the public note commitment (the auditor checks it's on-chain)
//   * amount      — the disclosed value
//   * auditorTag  — binds the proof to a specific auditor/session (anti-replay)
// Private: sk, blinding.
//
// Verifying a set of these (off-chain, snarkjs) gives an auditor a provable
// "proof of funds / source of funds": the discloser controls these commitments
// and they sum to the disclosed total. No spend authority is exposed.
template Disclose() {
    signal input commitment;
    signal input amount;
    signal input auditorTag;
    signal input sk;
    signal input blinding;

    component rc = Num2Bits(128);
    rc.in <== amount;

    // commitment == Poseidon(amount, Poseidon(sk), blinding)  -> proves ownership
    component note = NoteOpen();
    note.amount <== amount;
    note.sk <== sk;
    note.blinding <== blinding;
    note.commitment === commitment;

    // Bind the auditor tag into the constraint system (non-malleable).
    signal tagSq;
    tagSq <== auditorTag * auditorTag;
}

component main {public [commitment, amount, auditorTag]} = Disclose();
