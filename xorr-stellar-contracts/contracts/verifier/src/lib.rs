#![no_std]
//! Standalone Groth16 verifier over **BN254** (CAP-0074 host functions).
//!
//! Single-purpose and audit-isolated: it performs the pairing check and nothing
//! else, so the privacy pool and bridge can reuse it via the `zk-interface`
//! client. Mirrors the structure of the official `groth16_verifier` example,
//! retargeted from BLS12-381 to BN254 (the curve produced by circom/snarkjs).

use soroban_sdk::{contract, contracterror, contractimpl, crypto::bn254::Fr, vec, Env, Vec};
use zk_interface::{Proof, VerificationKey};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Groth16Error {
    /// `pub_signals.len() + 1 != vk.ic.len()`
    MalformedVerifyingKey = 0,
}

#[contract]
pub struct Groth16Verifier;

#[contractimpl]
impl Groth16Verifier {
    /// Verify a Groth16 proof. Returns `true` iff the pairing equation holds:
    /// `e(-A, B) * e(alpha, beta) * e(vk_x, gamma) * e(C, delta) == 1`
    /// where `vk_x = ic[0] + Σ pub_signals[i] * ic[i+1]`.
    pub fn verify_proof(
        env: Env,
        vk: VerificationKey,
        proof: Proof,
        pub_signals: Vec<Fr>,
    ) -> bool {
        Self::try_verify(&env, vk, proof, pub_signals)
            .expect("malformed verifying key / public signal length mismatch")
    }
}

impl Groth16Verifier {
    fn try_verify(
        env: &Env,
        vk: VerificationKey,
        proof: Proof,
        pub_signals: Vec<Fr>,
    ) -> Result<bool, Groth16Error> {
        let bn = env.crypto().bn254();

        if pub_signals.len() + 1 != vk.ic.len() {
            return Err(Groth16Error::MalformedVerifyingKey);
        }

        // vk_x = ic[0] + Σ pub_signals[i] * ic[i+1]
        let mut vk_x = vk.ic.get(0).unwrap();
        for (s, v) in pub_signals.iter().zip(vk.ic.iter().skip(1)) {
            let prod = bn.g1_mul(&v, &s);
            vk_x = bn.g1_add(&vk_x, &prod);
        }

        let neg_a = -proof.a;
        let vp1 = vec![env, neg_a, vk.alpha, vk_x, proof.c];
        let vp2 = vec![env, proof.b, vk.beta, vk.gamma, vk.delta];

        Ok(bn.pairing_check(vp1, vp2))
    }
}
