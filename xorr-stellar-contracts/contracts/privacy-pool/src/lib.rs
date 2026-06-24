#![no_std]
//! Xorr — Privacy Pool
//! ===================
//! A Moonlight-inspired, UTXO/note-based shielded pool for a Stellar asset
//! (e.g. USDC issued as a Stellar Asset Contract). Public tokens are deposited
//! to create hidden *notes* (Pedersen/Poseidon commitments). Notes are spent
//! privately by revealing a *nullifier* (preventing double-spends) while a
//! Groth16 proof attests, in zero knowledge, that:
//!   * the spent note exists in the commitment Merkle tree (membership),
//!   * the nullifier is correctly derived from the note + owner key,
//!   * value is conserved (Σ inputs == Σ outputs [+ public withdraw amount]),
//!   * the new output notes are correctly inserted, yielding `new_root`.
//!
//! ## On-chain trust model
//! The contract performs **no hashing**. All Poseidon/Merkle work lives in the
//! circuits; on-chain we only (a) delegate the pairing check to the standalone
//! [`verifier`] contract and (b) enforce application bookkeeping: the current
//! Merkle root, the nullifier set, value accounting and token custody.
//!
//! Every state-changing op proves its transition against the **current root**
//! (`old_root == current_root`), which the contract enforces much like a nonce.
//! This collapses the membership-root and insertion-root into one value, which
//! keeps the circuits small for in-browser proving. A production system would
//! keep a rolling window of historical membership roots (see `RootHistory`,
//! retained here for indexing/UX) decoupled from the insertion root.
//!
//! ## Public-signal layouts (must match `circuits/`)
//! * deposit  : `[old_root, new_root, commitment, amount]`
//! * transfer : `[old_root, new_root, nullifier_a, nullifier_b, out_cmt_a, out_cmt_b]`
//! * withdraw : `[old_root, new_root, nullifier, change_commitment, amount, recipient_field]`

use soroban_sdk::{
    auth::{ContractContext, InvokerContractAuthEntry, SubContractInvocation},
    contract, contractclient, contracterror, contractimpl, contracttype, symbol_short, token, vec,
    Address, BytesN, Env, IntoVal, Symbol, Val, Vec,
};
use zk_interface::{fr_from_amount, fr_from_bytes, fr_from_tag, Proof, VerificationKey, VerifierClient};

/// Minimal client interface for the AMM (`pool-factory`) used by `private_swap`.
/// Declared as a trait so the pool doesn't link the factory crate into its wasm.
#[contractclient(name = "AmmClient")]
pub trait AmmInterface {
    fn swap(env: Env, pool_id: u32, from: Address, token_in: Address, amount_in: i128, min_out: i128) -> i128;
}

/// Number of recent roots retained for indexing / UX (not used for enforcement
/// in this MVP — see the module docs).
const ROOT_HISTORY: u32 = 64;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    InvalidAmount = 4,
    VkNotSet = 5,
    StaleRoot = 6,           // old_root != current_root
    NullifierAlreadyUsed = 7,
    DuplicateNullifier = 8,
    InvalidProof = 9,
    SwapVenueNotSet = 10,
}

/// Which circuit a verifying key belongs to.
#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Circuit {
    Deposit = 0,
    Transfer = 1,
    Withdraw = 2,
    /// Mints a shielded note from bridged-in (cross-chain) liquidity. Same
    /// note-opening statement as `Deposit`, but invoked by the bridge minter.
    Bridge = 3,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Token,
    Verifier,
    Minter,
    Vk(Circuit),
    CurrentRoot,
    RootHistory,
    NextLeaf,
    TotalShielded,
    Nullifier(BytesN<32>),
    SwapFactory,
    SwapPoolId,
    SwapTokenOut,
}

const TOPIC: Symbol = symbol_short!("shielded");

#[contract]
pub struct PrivacyPool;

#[contractimpl]
impl PrivacyPool {
    /// Deploy-time initialization (Protocol 22+ constructor).
    ///
    /// * `admin`         — may set/rotate verifying keys.
    /// * `token`         — the shielded asset (Stellar Asset Contract address).
    /// * `verifier`      — deployed Groth16 verifier contract.
    /// * `empty_root`    — the root of the empty Merkle tree (Poseidon zeros),
    ///                     computed off-chain by the circuit tooling.
    pub fn __constructor(
        env: Env,
        admin: Address,
        token: Address,
        verifier: Address,
        empty_root: BytesN<32>,
    ) {
        let s = env.storage().instance();
        s.set(&DataKey::Admin, &admin);
        s.set(&DataKey::Token, &token);
        s.set(&DataKey::Verifier, &verifier);
        s.set(&DataKey::CurrentRoot, &empty_root);
        s.set(&DataKey::NextLeaf, &0u32);
        s.set(&DataKey::TotalShielded, &0i128);
        let mut hist: Vec<BytesN<32>> = Vec::new(&env);
        hist.push_back(empty_root.clone());
        env.storage().persistent().set(&DataKey::RootHistory, &hist);
    }

    /// Admin-only: install/rotate the verifying key for a circuit. Keys are
    /// produced by `circuits/scripts/export-vk.mjs` after the trusted setup.
    pub fn set_vk(env: Env, circuit: Circuit, vk: VerificationKey) {
        Self::admin(&env).require_auth();
        env.storage().persistent().set(&DataKey::Vk(circuit), &vk);
    }

    /// Admin-only: authorize a bridge contract to mint shielded notes from
    /// cross-chain liquidity via [`PrivacyPool::mint_note`].
    pub fn set_minter(env: Env, minter: Address) {
        Self::admin(&env).require_auth();
        env.storage().instance().set(&DataKey::Minter, &minter);
    }

    /// Admin-only: configure the AMM venue used by [`PrivacyPool::private_swap`]
    /// — a `pool-factory` contract, the pool id whose input token is this pool's
    /// shielded asset, and that pool's output token (delivered to the recipient).
    pub fn set_swap_venue(env: Env, factory: Address, pool_id: u32, token_out: Address) {
        Self::admin(&env).require_auth();
        env.storage().instance().set(&DataKey::SwapFactory, &factory);
        env.storage().instance().set(&DataKey::SwapPoolId, &pool_id);
        env.storage().instance().set(&DataKey::SwapTokenOut, &token_out);
    }

    /// Mint a shielded note from bridged-in liquidity.
    ///
    /// Callable only by the configured minter (the bridge contract). The minter
    /// is trusted to have already transferred pool-asset liquidity equal to
    /// `amount` into the pool (representing funds locked on the source chain),
    /// which it does atomically in the same transaction before calling this.
    /// The ZK proof (Bridge circuit) binds `commitment` to `amount` and to the
    /// `old_root -> new_root` insertion exactly as a normal deposit does.
    pub fn mint_note(
        env: Env,
        minter: Address,
        amount: i128,
        commitment: BytesN<32>,
        old_root: BytesN<32>,
        new_root: BytesN<32>,
        proof: Proof,
    ) -> Result<(), Error> {
        minter.require_auth();
        let configured: Address = env
            .storage()
            .instance()
            .get(&DataKey::Minter)
            .ok_or(Error::Unauthorized)?;
        if configured != minter {
            return Err(Error::Unauthorized);
        }
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        Self::require_current_root(&env, &old_root)?;

        let signals = vec![
            &env,
            fr_from_bytes(&env, &old_root),
            fr_from_bytes(&env, &new_root),
            fr_from_bytes(&env, &commitment),
            fr_from_amount(&env, amount),
        ];
        Self::verify(&env, Circuit::Bridge, &proof, signals)?;

        Self::advance_root(&env, &new_root);
        Self::bump_leaf(&env, 1);
        Self::add_shielded(&env, amount);

        env.events().publish(
            (TOPIC, symbol_short!("bridgein")),
            (commitment, amount, new_root),
        );
        Ok(())
    }

    // ---------------------------------------------------------------------
    // Shielded operations
    // ---------------------------------------------------------------------

    /// Shield public tokens into a new note.
    ///
    /// Pulls `amount` of the pool asset from `from` and records `commitment`
    /// (whose hidden value the circuit binds to `amount`). Advances the tree
    /// root from `old_root` to `new_root`.
    pub fn deposit(
        env: Env,
        from: Address,
        amount: i128,
        commitment: BytesN<32>,
        old_root: BytesN<32>,
        new_root: BytesN<32>,
        proof: Proof,
    ) -> Result<(), Error> {
        from.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        Self::require_current_root(&env, &old_root)?;

        let signals = vec![
            &env,
            fr_from_bytes(&env, &old_root),
            fr_from_bytes(&env, &new_root),
            fr_from_bytes(&env, &commitment),
            fr_from_amount(&env, amount),
        ];
        Self::verify(&env, Circuit::Deposit, &proof, signals)?;

        // Effects: move funds in, then advance state.
        Self::token_client(&env).transfer(&from, &env.current_contract_address(), &amount);
        Self::advance_root(&env, &new_root);
        Self::bump_leaf(&env, 1);
        Self::add_shielded(&env, amount);

        env.events().publish(
            (TOPIC, symbol_short!("deposit")),
            (commitment, amount, new_root),
        );
        Ok(())
    }

    /// Private transfer: spend two input notes, create two output notes.
    /// Hides amounts and the link between inputs and outputs. No tokens move;
    /// the circuit enforces `in_a + in_b == out_a + out_b`.
    pub fn transfer(
        env: Env,
        nullifier_a: BytesN<32>,
        nullifier_b: BytesN<32>,
        out_commitment_a: BytesN<32>,
        out_commitment_b: BytesN<32>,
        old_root: BytesN<32>,
        new_root: BytesN<32>,
        proof: Proof,
    ) -> Result<(), Error> {
        Self::require_current_root(&env, &old_root)?;
        if nullifier_a == nullifier_b {
            return Err(Error::DuplicateNullifier);
        }
        Self::require_unspent(&env, &nullifier_a)?;
        Self::require_unspent(&env, &nullifier_b)?;

        let signals = vec![
            &env,
            fr_from_bytes(&env, &old_root),
            fr_from_bytes(&env, &new_root),
            fr_from_bytes(&env, &nullifier_a),
            fr_from_bytes(&env, &nullifier_b),
            fr_from_bytes(&env, &out_commitment_a),
            fr_from_bytes(&env, &out_commitment_b),
        ];
        Self::verify(&env, Circuit::Transfer, &proof, signals)?;

        Self::spend(&env, &nullifier_a);
        Self::spend(&env, &nullifier_b);
        Self::advance_root(&env, &new_root);
        Self::bump_leaf(&env, 2);

        env.events().publish(
            (TOPIC, symbol_short!("transfer")),
            (nullifier_a, nullifier_b, out_commitment_a, out_commitment_b, new_root),
        );
        Ok(())
    }

    /// Unshield: spend one note, send `amount` public tokens to `recipient`,
    /// and re-shield the remainder into `change_commitment`.
    ///
    /// `recipient.require_auth()` plus the in-circuit binding of
    /// `recipient_field` prevents withdrawal front-running / recipient
    /// substitution.
    pub fn withdraw(
        env: Env,
        recipient: Address,
        amount: i128,
        nullifier: BytesN<32>,
        change_commitment: BytesN<32>,
        old_root: BytesN<32>,
        new_root: BytesN<32>,
        proof: Proof,
    ) -> Result<(), Error> {
        recipient.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        Self::require_current_root(&env, &old_root)?;
        Self::require_unspent(&env, &nullifier)?;

        let recipient_tag: BytesN<32> = recipient.clone().to_xdr_id(&env);
        let signals = vec![
            &env,
            fr_from_bytes(&env, &old_root),
            fr_from_bytes(&env, &new_root),
            fr_from_bytes(&env, &nullifier),
            fr_from_bytes(&env, &change_commitment),
            fr_from_amount(&env, amount),
            fr_from_tag(&env, &recipient_tag),
        ];
        Self::verify(&env, Circuit::Withdraw, &proof, signals)?;

        Self::spend(&env, &nullifier);
        Self::advance_root(&env, &new_root);
        Self::bump_leaf(&env, 1);
        Self::sub_shielded(&env, amount);
        Self::token_client(&env).transfer(&env.current_contract_address(), &recipient, &amount);

        env.events().publish(
            (TOPIC, symbol_short!("withdraw")),
            (recipient, amount, nullifier, change_commitment, new_root),
        );
        Ok(())
    }

    /// Private (ZK) swap: spend a shielded note worth `amount` (+ change),
    /// proven in zero knowledge with the **Withdraw** statement (note ∈ tree,
    /// nullifier valid, value conserved, recipient bound), then route `amount` of
    /// the shielded asset through the configured AMM and deliver the swapped
    /// output token to `recipient`. Returns the output amount.
    ///
    /// What's hidden: the trader's identity, *which* note funded the swap, and
    /// their remaining balance — there is no public account linking the spender
    /// to the trade. What's public (unavoidably, for a constant-product AMM):
    /// the swap `amount` and the output, since the pool reserves must move.
    pub fn private_swap(
        env: Env,
        recipient: Address,
        amount: i128,
        nullifier: BytesN<32>,
        change_commitment: BytesN<32>,
        old_root: BytesN<32>,
        new_root: BytesN<32>,
        min_out: i128,
        proof: Proof,
    ) -> Result<i128, Error> {
        recipient.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        Self::require_current_root(&env, &old_root)?;
        Self::require_unspent(&env, &nullifier)?;

        // Resolve the swap venue up front so a misconfiguration fails before any
        // state mutation.
        let factory: Address = env.storage().instance().get(&DataKey::SwapFactory).ok_or(Error::SwapVenueNotSet)?;
        let pool_id: u32 = env.storage().instance().get(&DataKey::SwapPoolId).ok_or(Error::SwapVenueNotSet)?;
        let token_out: Address = env.storage().instance().get(&DataKey::SwapTokenOut).ok_or(Error::SwapVenueNotSet)?;
        let token_in: Address = env.storage().instance().get(&DataKey::Token).unwrap();

        // Identical ZK statement to `withdraw` — reuses the Withdraw verifying key.
        let recipient_tag: BytesN<32> = recipient.clone().to_xdr_id(&env);
        let signals = vec![
            &env,
            fr_from_bytes(&env, &old_root),
            fr_from_bytes(&env, &new_root),
            fr_from_bytes(&env, &nullifier),
            fr_from_bytes(&env, &change_commitment),
            fr_from_amount(&env, amount),
            fr_from_tag(&env, &recipient_tag),
        ];
        Self::verify(&env, Circuit::Withdraw, &proof, signals)?;

        // Burn the note (same bookkeeping as withdraw).
        Self::spend(&env, &nullifier);
        Self::advance_root(&env, &new_root);
        Self::bump_leaf(&env, 1);
        Self::sub_shielded(&env, amount);

        // Route the unshielded `amount` through the AMM to the recipient.
        let me = env.current_contract_address();

        // Pre-authorize the AMM pulling `amount` of token_in from this contract.
        let transfer_args: Vec<Val> = (me.clone(), factory.clone(), amount).into_val(&env);
        env.authorize_as_current_contract(vec![
            &env,
            InvokerContractAuthEntry::Contract(SubContractInvocation {
                context: ContractContext {
                    contract: token_in.clone(),
                    fn_name: Symbol::new(&env, "transfer"),
                    args: transfer_args,
                },
                sub_invocations: vec![&env],
            }),
        ]);

        let amm = AmmClient::new(&env, &factory);
        let amount_out = amm.swap(&pool_id, &me, &token_in, &amount, &min_out);

        // The AMM sent the output token to us; forward it to the recipient.
        token::TokenClient::new(&env, &token_out).transfer(&me, &recipient, &amount_out);

        env.events().publish(
            (TOPIC, symbol_short!("zkswap")),
            (recipient, amount, amount_out, nullifier, new_root),
        );
        Ok(amount_out)
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    pub fn current_root(env: Env) -> BytesN<32> {
        env.storage().instance().get(&DataKey::CurrentRoot).unwrap()
    }

    pub fn root_history(env: Env) -> Vec<BytesN<32>> {
        env.storage()
            .persistent()
            .get(&DataKey::RootHistory)
            .unwrap_or(Vec::new(&env))
    }

    pub fn next_leaf(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::NextLeaf).unwrap_or(0)
    }

    pub fn total_shielded(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalShielded).unwrap_or(0)
    }

    pub fn is_spent(env: Env, nullifier: BytesN<32>) -> bool {
        env.storage().persistent().has(&DataKey::Nullifier(nullifier))
    }

    pub fn token(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Token).unwrap()
    }

    pub fn verifier(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Verifier).unwrap()
    }

    // ---------------------------------------------------------------------
    // Internal helpers
    // ---------------------------------------------------------------------

    fn admin(env: &Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    fn token_client(env: &Env) -> token::TokenClient {
        let token: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        token::TokenClient::new(env, &token)
    }

    fn require_current_root(env: &Env, old_root: &BytesN<32>) -> Result<(), Error> {
        let cur: BytesN<32> = env.storage().instance().get(&DataKey::CurrentRoot).unwrap();
        if &cur != old_root {
            return Err(Error::StaleRoot);
        }
        Ok(())
    }

    fn require_unspent(env: &Env, n: &BytesN<32>) -> Result<(), Error> {
        if env.storage().persistent().has(&DataKey::Nullifier(n.clone())) {
            return Err(Error::NullifierAlreadyUsed);
        }
        Ok(())
    }

    fn spend(env: &Env, n: &BytesN<32>) {
        env.storage()
            .persistent()
            .set(&DataKey::Nullifier(n.clone()), &true);
    }

    fn verify(
        env: &Env,
        circuit: Circuit,
        proof: &Proof,
        signals: Vec<zk_interface::Fr>,
    ) -> Result<(), Error> {
        let vk: VerificationKey = env
            .storage()
            .persistent()
            .get(&DataKey::Vk(circuit))
            .ok_or(Error::VkNotSet)?;
        let verifier: Address = env.storage().instance().get(&DataKey::Verifier).unwrap();
        let ok = VerifierClient::new(env, &verifier).verify_proof(&vk, proof, &signals);
        if !ok {
            return Err(Error::InvalidProof);
        }
        Ok(())
    }

    fn advance_root(env: &Env, new_root: &BytesN<32>) {
        env.storage().instance().set(&DataKey::CurrentRoot, new_root);
        let mut hist: Vec<BytesN<32>> = env
            .storage()
            .persistent()
            .get(&DataKey::RootHistory)
            .unwrap_or(Vec::new(env));
        hist.push_back(new_root.clone());
        while hist.len() > ROOT_HISTORY {
            hist.pop_front();
        }
        env.storage().persistent().set(&DataKey::RootHistory, &hist);
    }

    fn bump_leaf(env: &Env, by: u32) {
        let n: u32 = env.storage().instance().get(&DataKey::NextLeaf).unwrap_or(0);
        env.storage().instance().set(&DataKey::NextLeaf, &(n + by));
    }

    fn add_shielded(env: &Env, amount: i128) {
        let t: i128 = env.storage().instance().get(&DataKey::TotalShielded).unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalShielded, &(t + amount));
    }

    fn sub_shielded(env: &Env, amount: i128) {
        let t: i128 = env.storage().instance().get(&DataKey::TotalShielded).unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalShielded, &(t - amount));
    }
}

/// Local extension to derive a stable 32-byte identifier from an `Address`
/// using only host functions (`to_xdr` + keccak256). The withdraw circuit
/// binds the same value as a public input, so the recipient cannot be
/// substituted after proving.
trait ToXdrId {
    fn to_xdr_id(self, env: &Env) -> BytesN<32>;
}

impl ToXdrId for Address {
    fn to_xdr_id(self, env: &Env) -> BytesN<32> {
        use soroban_sdk::xdr::ToXdr;
        let bytes = self.to_xdr(env);
        env.crypto().keccak256(&bytes).to_bytes()
    }
}

mod test;
