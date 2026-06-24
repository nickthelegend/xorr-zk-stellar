#![no_std]
//! Shared ZK types and the cross-contract verifier interface for Xorr.
//!
//! ## Curve: BN254 (CAP-0074, live since Protocol 25 / Jan 2026)
//! We verify Groth16 proofs over **BN254**. This is the curve `circom`,
//! `snarkjs` and `circomlibjs` use natively, so the Poseidon used in the
//! circuits, the Poseidon used by the browser tree-builder, and the field the
//! on-chain verifier checks are all the *same* field — no cross-field
//! conversion, which is what makes the proof pipeline work end-to-end.
//!
//! ## On-chain trust model
//! All hashing (Poseidon, Merkle updates) stays inside the circuits. The
//! contracts only (1) verify a Groth16 proof over BN254 (host-accelerated
//! `pairing_check`) and (2) enforce application bookkeeping (root history,
//! nullifier set, token flow).
//!
//! Point encodings (must match `circuits/scripts/export-vk.mjs` and the
//! frontend prover, per `soroban_sdk::crypto::bn254`):
//!   * Bn254Fp     : 32 bytes, big-endian
//!   * Bn254G1Affine (64 bytes)  = be(X) || be(Y)
//!   * Bn254G2Affine (128 bytes) = be(X) || be(Y), each Fp2 = be(c1) || be(c0)
//!     (imaginary component first — EIP-197 ordering; snarkjs lists [c0, c1],
//!     so the exporter swaps).

use soroban_sdk::{
    contractclient, contracttype,
    crypto::bn254::{Bn254G1Affine, Bn254G2Affine},
    Address, Bytes, BytesN, Env, Vec,
};

// Re-export the BN254 scalar so downstream contracts can name it without
// reaching into the SDK's crypto module.
pub use soroban_sdk::crypto::bn254::Fr;

/// Groth16 verifying key (BN254). Produced by `snarkjs zkey export
/// verificationkey` and converted to Soroban point encoding by
/// `circuits/scripts/export-vk.mjs`.
#[derive(Clone)]
#[contracttype]
pub struct VerificationKey {
    pub alpha: Bn254G1Affine,
    pub beta: Bn254G2Affine,
    pub gamma: Bn254G2Affine,
    pub delta: Bn254G2Affine,
    pub ic: Vec<Bn254G1Affine>,
}

/// A Groth16 proof (BN254).
#[derive(Clone)]
#[contracttype]
pub struct Proof {
    pub a: Bn254G1Affine,
    pub b: Bn254G2Affine,
    pub c: Bn254G1Affine,
}

/// Cross-contract interface implemented by the `verifier` contract.
///
/// `#[contractclient]` generates `VerifierClient`, which the privacy pool and
/// bridge use to delegate the cryptographic check to an independently
/// deployable, auditable verifier (the "policy-and-proof split" recommended by
/// the Stellar ZK skill).
#[contractclient(name = "VerifierClient")]
pub trait VerifierInterface {
    fn verify_proof(env: Env, vk: VerificationKey, proof: Proof, pub_signals: Vec<Fr>) -> bool;
}

/// Interface for the privacy pool's bridge-minter entrypoint. The bridge depends
/// on this `#[contractclient]` — NOT the pool crate — so the pool's
/// `#[contractimpl]` (and its own `__constructor`) is never linked into the
/// bridge wasm.
#[contractclient(name = "MinterClient")]
pub trait MinterInterface {
    fn mint_note(
        env: Env,
        minter: Address,
        amount: i128,
        commitment: BytesN<32>,
        old_root: BytesN<32>,
        new_root: BytesN<32>,
        proof: Proof,
    );
}

/// Convert a canonical big-endian 32-byte field element (a commitment,
/// nullifier or Merkle root as emitted by the circuits) into a BN254 scalar.
/// Circuit-side field elements are always `< r`, so this is exact.
pub fn fr_from_bytes(_env: &Env, b: &BytesN<32>) -> Fr {
    Fr::from_bytes(b.clone())
}

/// Encode a non-negative `i128` amount as a field element.
pub fn fr_from_amount(env: &Env, amount: i128) -> Fr {
    let v = amount as u128;
    let mut buf = [0u8; 32];
    buf[16..32].copy_from_slice(&v.to_be_bytes());
    Fr::from_bytes(BytesN::from_array(env, &buf))
}

/// Encode a 32-byte tag (e.g. keccak256 of a recipient address) into a field
/// element, masking the top byte so the result is guaranteed `< r`. The
/// circuits / frontend apply the identical mask so the recipient is bound to
/// the proof and cannot be substituted after proving.
pub fn fr_from_tag(env: &Env, tag: &BytesN<32>) -> Fr {
    let mut arr = tag.to_array();
    arr[0] &= 0x1f; // keep 251 bits -> always < the BN254 scalar field order r
    Fr::from_bytes(BytesN::from_array(env, &arr))
}

/// keccak256 of arbitrary bytes (host function) -> 32-byte tag.
pub fn keccak_tag(env: &Env, data: &Bytes) -> BytesN<32> {
    env.crypto().keccak256(data).to_bytes()
}
