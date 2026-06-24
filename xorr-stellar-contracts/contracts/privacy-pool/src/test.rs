#![cfg(test)]
//! Exhaustive tests of the pool's *application* logic (auth, accounting,
//! nullifier set, root transitions, token custody). The proof check is routed
//! to `mock-verifier`, whose result we toggle to simulate valid/invalid proofs.
//! Real cryptographic verification is covered by the circuit test vectors.

extern crate std;

use super::*;
use mock_verifier::{MockVerifier, MockVerifierClient};
use pool_factory::{PoolFactory, PoolFactoryClient};
use soroban_sdk::{
    crypto::bn254::{Bn254G1Affine, Bn254G2Affine},
    testutils::Address as _,
    token::StellarAssetClient,
    Address, BytesN, Env,
};

const SUPPLY: i128 = 1_000_000;

struct Fixture {
    env: Env,
    pool: PrivacyPoolClient<'static>,
    verifier: MockVerifierClient<'static>,
    token_admin: StellarAssetClient<'static>,
    token: soroban_sdk::token::TokenClient<'static>,
    user: Address,
    empty_root: BytesN<32>,
}

fn root(env: &Env, b: u8) -> BytesN<32> {
    BytesN::from_array(env, &[b; 32])
}

fn dummy_vk(env: &Env) -> VerificationKey {
    let g1 = Bn254G1Affine::from_bytes(BytesN::from_array(env, &[0u8; 64]));
    let g2 = Bn254G2Affine::from_bytes(BytesN::from_array(env, &[0u8; 128]));
    let mut ic = Vec::new(env);
    ic.push_back(g1.clone());
    VerificationKey {
        alpha: g1.clone(),
        beta: g2.clone(),
        gamma: g2.clone(),
        delta: g2,
        ic,
    }
}

fn dummy_proof(env: &Env) -> Proof {
    let g1 = Bn254G1Affine::from_bytes(BytesN::from_array(env, &[0u8; 64]));
    let g2 = Bn254G2Affine::from_bytes(BytesN::from_array(env, &[0u8; 128]));
    Proof { a: g1.clone(), b: g2, c: g1 }
}

fn setup() -> Fixture {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token_addr = sac.address();
    let token_admin = StellarAssetClient::new(&env, &token_addr);
    let token = soroban_sdk::token::TokenClient::new(&env, &token_addr);
    token_admin.mint(&user, &SUPPLY);

    let verifier_id = env.register(MockVerifier, ());
    let verifier = MockVerifierClient::new(&env, &verifier_id);
    verifier.set_result(&true);

    let empty_root = root(&env, 0);
    let pool_id = env.register(
        PrivacyPool,
        (admin.clone(), token_addr.clone(), verifier_id.clone(), empty_root.clone()),
    );
    let pool = PrivacyPoolClient::new(&env, &pool_id);

    // Install verifying keys for every circuit.
    pool.set_vk(&Circuit::Deposit, &dummy_vk(&env));
    pool.set_vk(&Circuit::Transfer, &dummy_vk(&env));
    pool.set_vk(&Circuit::Withdraw, &dummy_vk(&env));

    Fixture { env, pool, verifier, token_admin, token, user, empty_root }
}

// Fund the pool's custody (via a deposit), stand up a USDC/XLM AMM pool with
// liquidity, and point the pool's swap venue at it. Returns (factory, xlm token).
fn setup_amm(f: &Fixture) -> (PoolFactoryClient<'static>, soroban_sdk::token::TokenClient<'static>) {
    // deposit 1000 USDC so the pool holds backing it can route through the AMM
    f.pool.deposit(&f.user, &1000, &root(&f.env, 11), &f.empty_root, &root(&f.env, 1), &dummy_proof(&f.env));

    let admin2 = Address::generate(&f.env);
    let xlm_sac = f.env.register_stellar_asset_contract_v2(admin2);
    let xlm_addr = xlm_sac.address();
    let xlm = soroban_sdk::token::TokenClient::new(&f.env, &xlm_addr);

    let lp = Address::generate(&f.env);
    f.token_admin.mint(&lp, &100_000);
    StellarAssetClient::new(&f.env, &xlm_addr).mint(&lp, &500_000);

    let fac_id = f.env.register(PoolFactory, ());
    let fac = PoolFactoryClient::new(&f.env, &fac_id);
    fac.create_pool(&lp, &f.token.address, &xlm_addr, &30u32, &false);
    fac.add_liquidity(&0u32, &lp, &10_000, &50_000);

    f.pool.set_swap_venue(&fac_id, &0u32, &xlm_addr);
    (fac, xlm)
}

#[test]
fn private_swap_happy_path() {
    let f = setup();
    let (_fac, xlm) = setup_amm(&f);
    let cur = f.pool.current_root();

    let recipient = Address::generate(&f.env);
    let pool_usdc_before = f.token.balance(&f.pool.address);

    let out = f.pool.private_swap(
        &recipient, &100,
        &root(&f.env, 77),  // nullifier
        &root(&f.env, 88),  // change commitment
        &cur,               // old_root == current
        &root(&f.env, 2),   // new_root
        &0,                 // min_out
        &dummy_proof(&f.env),
    );

    assert!(out > 0, "recipient receives swapped output");
    assert_eq!(xlm.balance(&recipient), out, "recipient got XLM, not USDC (no account link)");
    assert_eq!(f.token.balance(&f.pool.address), pool_usdc_before - 100, "pool routed 100 USDC into the AMM");
    assert!(f.pool.is_spent(&root(&f.env, 77)), "note nullifier marked spent");
    assert_eq!(f.pool.current_root(), root(&f.env, 2));
    assert_eq!(f.pool.total_shielded(), 900, "shielded backing reduced by the swapped amount");
}

#[test]
fn private_swap_double_spend_rejected() {
    let f = setup();
    let (_fac, _xlm) = setup_amm(&f);
    let recipient = Address::generate(&f.env);
    f.pool.private_swap(&recipient, &100, &root(&f.env, 77), &root(&f.env, 88),
        &f.pool.current_root(), &root(&f.env, 2), &0, &dummy_proof(&f.env));
    // reusing the same nullifier must fail
    let res = f.pool.try_private_swap(&recipient, &100, &root(&f.env, 77), &root(&f.env, 99),
        &f.pool.current_root(), &root(&f.env, 3), &0, &dummy_proof(&f.env));
    assert_eq!(res, Err(Ok(Error::NullifierAlreadyUsed)));
}

#[test]
fn private_swap_rejects_invalid_proof() {
    let f = setup();
    let (_fac, _xlm) = setup_amm(&f);
    f.verifier.set_result(&false);
    let res = f.pool.try_private_swap(&Address::generate(&f.env), &100, &root(&f.env, 77),
        &root(&f.env, 88), &f.pool.current_root(), &root(&f.env, 2), &0, &dummy_proof(&f.env));
    assert_eq!(res, Err(Ok(Error::InvalidProof)));
}

#[test]
fn private_swap_requires_venue() {
    let f = setup();
    // fund custody but DON'T set a swap venue
    f.pool.deposit(&f.user, &1000, &root(&f.env, 11), &f.empty_root, &root(&f.env, 1), &dummy_proof(&f.env));
    let res = f.pool.try_private_swap(&Address::generate(&f.env), &100, &root(&f.env, 77),
        &root(&f.env, 88), &f.pool.current_root(), &root(&f.env, 2), &0, &dummy_proof(&f.env));
    assert_eq!(res, Err(Ok(Error::SwapVenueNotSet)));
}

#[test]
fn deposit_happy_path() {
    let f = setup();
    let cmt = root(&f.env, 11);
    let new_root = root(&f.env, 1);

    f.pool.deposit(&f.user, &100, &cmt, &f.empty_root, &new_root, &dummy_proof(&f.env));

    assert_eq!(f.pool.total_shielded(), 100);
    assert_eq!(f.pool.current_root(), new_root);
    assert_eq!(f.pool.next_leaf(), 1);
    assert_eq!(f.token.balance(&f.pool.address), 100);
    assert_eq!(f.token.balance(&f.user), SUPPLY - 100);
}

#[test]
fn deposit_rejects_stale_root() {
    let f = setup();
    let res = f.pool.try_deposit(
        &f.user,
        &100,
        &root(&f.env, 11),
        &root(&f.env, 9), // wrong old_root
        &root(&f.env, 1),
        &dummy_proof(&f.env),
    );
    assert_eq!(res, Err(Ok(Error::StaleRoot)));
}

#[test]
fn deposit_rejects_invalid_proof() {
    let f = setup();
    f.verifier.set_result(&false);
    let res = f.pool.try_deposit(
        &f.user,
        &100,
        &root(&f.env, 11),
        &f.empty_root,
        &root(&f.env, 1),
        &dummy_proof(&f.env),
    );
    assert_eq!(res, Err(Ok(Error::InvalidProof)));
}

#[test]
fn deposit_rejects_nonpositive_amount() {
    let f = setup();
    let res = f.pool.try_deposit(
        &f.user,
        &0,
        &root(&f.env, 11),
        &f.empty_root,
        &root(&f.env, 1),
        &dummy_proof(&f.env),
    );
    assert_eq!(res, Err(Ok(Error::InvalidAmount)));
}

#[test]
fn transfer_spends_nullifiers_and_advances() {
    let f = setup();
    f.pool.deposit(&f.user, &100, &root(&f.env, 11), &f.empty_root, &root(&f.env, 1), &dummy_proof(&f.env));

    let nf_a = root(&f.env, 21);
    let nf_b = root(&f.env, 22);
    f.pool.transfer(
        &nf_a, &nf_b,
        &root(&f.env, 31), &root(&f.env, 32),
        &root(&f.env, 1), &root(&f.env, 2),
        &dummy_proof(&f.env),
    );

    assert!(f.pool.is_spent(&nf_a));
    assert!(f.pool.is_spent(&nf_b));
    assert_eq!(f.pool.current_root(), root(&f.env, 2));
    assert_eq!(f.pool.next_leaf(), 3); // 1 from deposit + 2 outputs
    // No tokens moved on a private transfer.
    assert_eq!(f.token.balance(&f.pool.address), 100);
}

#[test]
fn transfer_rejects_double_spend() {
    let f = setup();
    f.pool.deposit(&f.user, &100, &root(&f.env, 11), &f.empty_root, &root(&f.env, 1), &dummy_proof(&f.env));
    let nf_a = root(&f.env, 21);
    let nf_b = root(&f.env, 22);
    f.pool.transfer(&nf_a, &nf_b, &root(&f.env, 31), &root(&f.env, 32), &root(&f.env, 1), &root(&f.env, 2), &dummy_proof(&f.env));

    // Re-use nf_a in a later transfer.
    let res = f.pool.try_transfer(
        &nf_a, &root(&f.env, 23),
        &root(&f.env, 41), &root(&f.env, 42),
        &root(&f.env, 2), &root(&f.env, 3),
        &dummy_proof(&f.env),
    );
    assert_eq!(res, Err(Ok(Error::NullifierAlreadyUsed)));
}

#[test]
fn transfer_rejects_duplicate_nullifier() {
    let f = setup();
    f.pool.deposit(&f.user, &100, &root(&f.env, 11), &f.empty_root, &root(&f.env, 1), &dummy_proof(&f.env));
    let nf = root(&f.env, 21);
    let res = f.pool.try_transfer(
        &nf, &nf,
        &root(&f.env, 31), &root(&f.env, 32),
        &root(&f.env, 1), &root(&f.env, 2),
        &dummy_proof(&f.env),
    );
    assert_eq!(res, Err(Ok(Error::DuplicateNullifier)));
}

#[test]
fn withdraw_pays_recipient_and_unshields() {
    let f = setup();
    f.pool.deposit(&f.user, &100, &root(&f.env, 11), &f.empty_root, &root(&f.env, 1), &dummy_proof(&f.env));

    let recipient = Address::generate(&f.env);
    let nf = root(&f.env, 50);
    f.pool.withdraw(
        &recipient, &40, &nf,
        &root(&f.env, 60), // change commitment
        &root(&f.env, 1), &root(&f.env, 2),
        &dummy_proof(&f.env),
    );

    assert!(f.pool.is_spent(&nf));
    assert_eq!(f.token.balance(&recipient), 40);
    assert_eq!(f.token.balance(&f.pool.address), 60);
    assert_eq!(f.pool.total_shielded(), 60);
    assert_eq!(f.pool.next_leaf(), 2); // deposit + change note
}

#[test]
fn withdraw_rejects_spent_nullifier() {
    let f = setup();
    f.pool.deposit(&f.user, &100, &root(&f.env, 11), &f.empty_root, &root(&f.env, 1), &dummy_proof(&f.env));
    let recipient = Address::generate(&f.env);
    let nf = root(&f.env, 50);
    f.pool.withdraw(&recipient, &40, &nf, &root(&f.env, 60), &root(&f.env, 1), &root(&f.env, 2), &dummy_proof(&f.env));

    let res = f.pool.try_withdraw(
        &recipient, &10, &nf, &root(&f.env, 61),
        &root(&f.env, 2), &root(&f.env, 3),
        &dummy_proof(&f.env),
    );
    assert_eq!(res, Err(Ok(Error::NullifierAlreadyUsed)));
}

#[test]
fn rejects_op_when_vk_missing() {
    // Fresh pool without any VK installed.
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    StellarAssetClient::new(&env, &sac.address()).mint(&user, &SUPPLY);
    let verifier_id = env.register(MockVerifier, ());
    let empty_root = root(&env, 0);
    let pool_id = env.register(
        PrivacyPool,
        (admin, sac.address(), verifier_id, empty_root.clone()),
    );
    let pool = PrivacyPoolClient::new(&env, &pool_id);

    let res = pool.try_deposit(&user, &100, &root(&env, 11), &empty_root, &root(&env, 1), &dummy_proof(&env));
    assert_eq!(res, Err(Ok(Error::VkNotSet)));
}

#[test]
fn root_history_records_transitions() {
    let f = setup();
    f.pool.deposit(&f.user, &100, &root(&f.env, 11), &f.empty_root, &root(&f.env, 1), &dummy_proof(&f.env));
    let hist = f.pool.root_history();
    assert_eq!(hist.get(0).unwrap(), f.empty_root);
    assert_eq!(hist.get(1).unwrap(), root(&f.env, 1));
}
