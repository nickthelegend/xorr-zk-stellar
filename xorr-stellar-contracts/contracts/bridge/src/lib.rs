#![no_std]
//! Xorr — Cross-chain Bridge (Ethereum ⇄ Stellar)
//! ==============================================
//! Mints shielded notes in the Stellar [`privacy_pool`] from value locked on
//! Ethereum (Sepolia). The flow:
//!
//! 1. A user locks USDC in the Ethereum `ShieldedBridgeEscrow`, which appends the
//!    note `commitment` to an on-chain (off-chain-mirrored) **deposit Merkle tree**
//!    and emits `Locked(nonce, amount, commitment)`.
//! 2. A relayer maintains that ETH deposit tree, computes its **keccak256 root**,
//!    and posts it here via [`Bridge::set_eth_root`] (replay-safe history).
//! 3. To claim, the relayer calls [`Bridge::bridge_in`] with (a) a Groth16 proof
//!    that `commitment` opens to `amount` + extends the Stellar note tree, and
//!    (b) an **ETH Merkle membership proof** that `commitment` is a leaf under a
//!    posted `eth_root`. The bridge verifies BOTH on-chain, so a mint is gated by
//!    the real Ethereum deposit set — not merely the relayer's say-so.
//!
//! Single-use of the Ethereum `nonce` gives replay protection. The relayer
//! attesting the *root* (one value covering all deposits) is the documented MVP;
//! it can be replaced by a trustless Ethereum state proof of the same root.

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, Bytes,
    BytesN, Env, Symbol, Vec,
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
    EthRootUnknown = 5,
    BadEthProof = 6,
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
    /// Latest Ethereum deposit-tree root posted by the relayer.
    EthRoot,
    /// Bounded history of recent ETH roots (so in-flight claims stay valid).
    EthRoots,
}

const TOPIC: Symbol = symbol_short!("bridge");
const ETH_ROOT_HISTORY: u32 = 32;

#[contract]
pub struct Bridge;

#[contractimpl]
impl Bridge {
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

    /// Relayer-only: post the current Ethereum deposit-tree root.
    pub fn set_eth_root(env: Env, root: BytesN<32>) -> Result<(), Error> {
        Self::relayer(&env)?.require_auth();
        let s = env.storage();
        s.instance().set(&DataKey::EthRoot, &root);
        let mut hist: Vec<BytesN<32>> = s.persistent().get(&DataKey::EthRoots).unwrap_or(Vec::new(&env));
        hist.push_back(root.clone());
        while hist.len() > ETH_ROOT_HISTORY {
            hist.pop_front();
        }
        s.persistent().set(&DataKey::EthRoots, &hist);
        env.events().publish((TOPIC, symbol_short!("ethroot")), root);
        Ok(())
    }

    /// The latest posted Ethereum deposit-tree root (zero if none).
    pub fn eth_root(env: Env) -> BytesN<32> {
        env.storage().instance().get(&DataKey::EthRoot).unwrap_or(BytesN::from_array(&env, &[0u8; 32]))
    }

    /// Whether `root` is a recently-posted ETH root.
    pub fn is_known_eth_root(env: Env, root: BytesN<32>) -> bool {
        let hist: Vec<BytesN<32>> = env.storage().persistent().get(&DataKey::EthRoots).unwrap_or(Vec::new(&env));
        hist.iter().any(|r| r == root)
    }

    /// Bridge an Ethereum lock into a shielded Stellar note. Verifies BOTH the
    /// shielded-note Groth16 proof AND ETH deposit-tree membership.
    #[allow(clippy::too_many_arguments)]
    pub fn bridge_in(
        env: Env,
        eth_nonce: u64,
        amount: i128,
        commitment: BytesN<32>,
        old_root: BytesN<32>,
        new_root: BytesN<32>,
        proof: Proof,
        eth_root: BytesN<32>,
        eth_index: u32,
        eth_path: Vec<BytesN<32>>,
    ) -> Result<(), Error> {
        Self::relayer(&env)?.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        if env.storage().persistent().has(&DataKey::Nonce(eth_nonce)) {
            return Err(Error::NonceAlreadyUsed);
        }

        // (1) ETH deposit-tree membership: commitment is a leaf under a posted root.
        if !Self::is_known_eth_root(env.clone(), eth_root.clone()) {
            return Err(Error::EthRootUnknown);
        }
        let computed = Self::eth_merkle_root(&env, &commitment, eth_index, &eth_path);
        if computed != eth_root {
            return Err(Error::BadEthProof);
        }

        env.storage().persistent().set(&DataKey::Nonce(eth_nonce), &true);

        let pool: Address = env.storage().instance().get(&DataKey::Pool).unwrap();
        let token: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let bridge_addr = env.current_contract_address();

        // (2) Move backing liquidity in, then mint (the pool verifies the Groth16 proof).
        token::TokenClient::new(&env, &token).transfer(&bridge_addr, &pool, &amount);
        MinterClient::new(&env, &pool).mint_note(&bridge_addr, &amount, &commitment, &old_root, &new_root, &proof);

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

    fn relayer(env: &Env) -> Result<Address, Error> {
        env.storage().instance().get(&DataKey::Relayer).ok_or(Error::RelayerNotSet)
    }

    /// Recompute a keccak256 Merkle root from a leaf + its inclusion path.
    /// Node hash = keccak256(left ‖ right); both sides 32-byte big-endian.
    fn eth_merkle_root(env: &Env, leaf: &BytesN<32>, index: u32, path: &Vec<BytesN<32>>) -> BytesN<32> {
        let mut cur = leaf.clone();
        let mut idx = index;
        for sib in path.iter() {
            let mut buf = Bytes::new(env);
            let cur_b = Bytes::from_array(env, &cur.to_array());
            let sib_b = Bytes::from_array(env, &sib.to_array());
            if idx & 1 == 0 {
                buf.append(&cur_b);
                buf.append(&sib_b);
            } else {
                buf.append(&sib_b);
                buf.append(&cur_b);
            }
            cur = env.crypto().keccak256(&buf).to_bytes();
            idx >>= 1;
        }
        cur
    }
}

mod test;
