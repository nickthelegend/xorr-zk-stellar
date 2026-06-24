#![no_std]
//! Xorr — Cross-chain Bridge (Ethereum → Stellar)
//! ==============================================
//! Mints shielded notes in the Stellar [`privacy_pool`] from value locked on
//! Ethereum (Sepolia). The flow:
//!
//! 1. A user locks USDC in the Ethereum `ShieldedBridgeLock` contract, which
//!    emits `Locked(nonce, amount, commitment)`.
//! 2. A relayer observes the lock and calls [`Bridge::bridge_in`] with a
//!    Groth16 proof (the pool's *Bridge* circuit) that `commitment` opens to
//!    `amount` and correctly extends the note tree.
//! 3. The bridge enforces single-use of the Ethereum `nonce` (replay
//!    protection) and calls `pool.mint_note`, which verifies the proof on
//!    Stellar and pulls the bridge's pre-funded liquidity into the pool so the
//!    shielded supply stays fully backed.
//!
//! ## Trust model & upgrade path
//! Cross-chain *observation* (that the Ethereum lock really happened) is, in
//! this MVP, attested by an authorized `relayer`. The *shielded-note
//! correctness* is fully zero-knowledge and verified on Stellar. The relayer
//! can be replaced by a trustless Ethereum state proof (an SP1/RISC-Zero or
//! Groth16 light-client proof of the `Locked` log) verified by the same
//! on-chain Groth16 machinery — the `bridge_in` interface stays unchanged.
//! The reverse direction (Stellar → Ethereum burn + proof) is a documented
//! stretch goal; see `circuits/` and the Ethereum `eth/` contracts.

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, BytesN,
    Env, Symbol,
};
use zk_interface::{MinterClient, Proof};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    RelayerNotSet = 2,
    NonceAlreadyUsed = 3,
    InvalidAmount = 4,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Pool,
    Token,
    Relayer,
    /// Marks an Ethereum lock nonce as already bridged.
    Nonce(u64),
}

const TOPIC: Symbol = symbol_short!("bridge");

#[contract]
pub struct Bridge;

#[contractimpl]
impl Bridge {
    /// * `admin`   — may set the relayer.
    /// * `pool`    — the [`privacy_pool`] this bridge mints into.
    ///   The bridge must be registered as that pool's minter
    ///   (`pool.set_minter(bridge_address)`) and pre-funded with pool-asset
    ///   liquidity equal to the bridged value.
    pub fn __constructor(env: Env, admin: Address, pool: Address, token: Address) {
        let s = env.storage().instance();
        s.set(&DataKey::Admin, &admin);
        s.set(&DataKey::Pool, &pool);
        s.set(&DataKey::Token, &token);
    }

    /// Admin-only: set the authorized cross-chain relayer.
    pub fn set_relayer(env: Env, relayer: Address) {
        Self::admin(&env).require_auth();
        env.storage().instance().set(&DataKey::Relayer, &relayer);
    }

    /// Bridge an Ethereum lock into a shielded Stellar note.
    pub fn bridge_in(
        env: Env,
        eth_nonce: u64,
        amount: i128,
        commitment: BytesN<32>,
        old_root: BytesN<32>,
        new_root: BytesN<32>,
        proof: Proof,
    ) -> Result<(), Error> {
        let relayer: Address = env
            .storage()
            .instance()
            .get(&DataKey::Relayer)
            .ok_or(Error::RelayerNotSet)?;
        relayer.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        if env.storage().persistent().has(&DataKey::Nonce(eth_nonce)) {
            return Err(Error::NonceAlreadyUsed);
        }
        env.storage().persistent().set(&DataKey::Nonce(eth_nonce), &true);

        let pool: Address = env.storage().instance().get(&DataKey::Pool).unwrap();
        let token: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let bridge_addr = env.current_contract_address();

        // Move the bridge's locked-equivalent liquidity into the pool. The
        // bridge is the direct invoker here, so this transfer is authorized
        // automatically; `mint_note` then only does the ZK + bookkeeping.
        token::TokenClient::new(&env, &token).transfer(&bridge_addr, &pool, &amount);

        MinterClient::new(&env, &pool).mint_note(
            &bridge_addr,
            &amount,
            &commitment,
            &old_root,
            &new_root,
            &proof,
        );

        env.events()
            .publish((TOPIC, symbol_short!("in")), (eth_nonce, commitment, amount, new_root));
        Ok(())
    }

    pub fn is_nonce_used(env: Env, eth_nonce: u64) -> bool {
        env.storage().persistent().has(&DataKey::Nonce(eth_nonce))
    }

    pub fn pool(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Pool).unwrap()
    }

    fn admin(env: &Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }
}

mod test;
