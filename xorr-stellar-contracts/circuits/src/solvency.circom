pragma circom 2.1.6;

include "./note.circom";
include "./merkle.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

// Proof of Solvency / Proof of Funds (Xorr's originality piece).
//
// Lets a holder prove, in zero knowledge, that they control shielded value of
// AT LEAST `threshold` USDC inside the pool — without revealing the actual
// amount or which note it is. The real-world hook: confidential "proof of
// funds" / "proof of reserves" for OTC desks, collateral checks, or
// accredited-investor thresholds on a regulated stablecoin.
//
// Public signals (order matters — the app + verifier must match):
//   [ root, threshold, nullifier ]
//
// Proves the prover knows (amount, sk, blinding, path) such that:
//   * note = (amount, Poseidon(sk), blinding) is a member of tree `root`,
//   * the revealed `nullifier = Poseidon(commitment, sk)` is correctly derived
//     (binds the attestation to ONE real note; a verifier rejects it if that
//     nullifier is already spent on-chain, so stale/double claims fail), and
//   * amount >= threshold, with the amount kept secret.
template Solvency(depth) {
    // public
    signal input root;
    signal input threshold;
    signal input nullifier;

    // private
    signal input amount;
    signal input sk;
    signal input blinding;
    signal input pathElements[depth];
    signal input pathIndices[depth];

    // Open the note: derive its commitment + nullifier from the secret opening.
    component note = NoteOpen();
    note.amount <== amount;
    note.sk <== sk;
    note.blinding <== blinding;
    note.nullifier === nullifier;

    // The note must be a member of the committed pool tree.
    component mem = MerkleProve(depth);
    mem.leaf <== note.commitment;
    mem.root <== root;
    for (var i = 0; i < depth; i++) {
        mem.pathElements[i] <== pathElements[i];
        mem.pathIndices[i] <== pathIndices[i];
    }

    // 128-bit range bound so the comparison is sound and can't wrap the field
    // (matches the contract's i128 amounts).
    component rcAmt = Num2Bits(128); rcAmt.in <== amount;
    component rcThr = Num2Bits(128); rcThr.in <== threshold;

    // The heart of the statement: amount >= threshold, amount stays hidden.
    component ge = GreaterEqThan(128);
    ge.in[0] <== amount;
    ge.in[1] <== threshold;
    ge.out === 1;
}

component main { public [root, threshold, nullifier] } = Solvency(20);
