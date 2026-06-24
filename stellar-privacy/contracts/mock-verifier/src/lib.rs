#![no_std]
//! Test-only verifier that implements the same interface as the real Groth16
//! verifier but returns a configurable result. This lets the privacy-pool and
//! bridge tests exercise *all* state/bookkeeping logic deterministically,
//! without running a trusted setup or generating real proofs in-process.
//!
//! Cryptographic correctness of the real verifier is covered separately by the
//! circuit + `snarkjs` test vectors (see `circuits/`).

use soroban_sdk::{contract, contractimpl, crypto::bn254::Fr, symbol_short, Env, Symbol, Vec};
use zk_interface::{Proof, VerificationKey};

const RESULT: Symbol = symbol_short!("RESULT");

#[contract]
pub struct MockVerifier;

#[contractimpl]
impl MockVerifier {
    /// Configure what `verify_proof` returns (default `true`).
    pub fn set_result(env: Env, ok: bool) {
        env.storage().instance().set(&RESULT, &ok);
    }

    pub fn verify_proof(
        env: Env,
        _vk: VerificationKey,
        _proof: Proof,
        _pub_signals: Vec<Fr>,
    ) -> bool {
        env.storage().instance().get(&RESULT).unwrap_or(true)
    }
}
