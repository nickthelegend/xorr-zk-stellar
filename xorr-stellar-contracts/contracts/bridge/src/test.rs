#![cfg(test)]
extern crate std;

use super::*;
use mock_verifier::{MockVerifier, MockVerifierClient};
use privacy_pool::{Circuit, PrivacyPool, PrivacyPoolClient};
use soroban_sdk::{
    crypto::bn254::{Bn254G1Affine, Bn254G2Affine},
    testutils::Address as _,
    token::{StellarAssetClient, TokenClient},
    Address, BytesN, Env, Vec,
};
use zk_interface::{Proof, VerificationKey};

fn root(env: &Env, b: u8) -> BytesN<32> {
    BytesN::from_array(env, &[b; 32])
}

fn dummy_vk(env: &Env) -> VerificationKey {
    let g1 = Bn254G1Affine::from_bytes(BytesN::from_array(env, &[0u8; 64]));
    let g2 = Bn254G2Affine::from_bytes(BytesN::from_array(env, &[0u8; 128]));
    let mut ic = Vec::new(env);
    ic.push_back(g1.clone());
    VerificationKey { alpha: g1.clone(), beta: g2.clone(), gamma: g2.clone(), delta: g2, ic }
}

fn dummy_proof(env: &Env) -> Proof {
    let g1 = Bn254G1Affine::from_bytes(BytesN::from_array(env, &[0u8; 64]));
    let g2 = Bn254G2Affine::from_bytes(BytesN::from_array(env, &[0u8; 128]));
    Proof { a: g1.clone(), b: g2, c: g1 }
}

struct Fixture {
    env: Env,
    bridge: BridgeClient<'static>,
    pool: PrivacyPoolClient<'static>,
    token: TokenClient<'static>,
    bridge_addr: Address,
    empty_root: BytesN<32>,
}

fn setup() -> Fixture {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let relayer = Address::generate(&env);

    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token_addr = sac.address();
    let token = TokenClient::new(&env, &token_addr);

    let verifier_id = env.register(MockVerifier, ());
    MockVerifierClient::new(&env, &verifier_id).set_result(&true);

    let empty_root = root(&env, 0);
    let pool_id = env.register(
        PrivacyPool,
        (admin.clone(), token_addr.clone(), verifier_id, empty_root.clone()),
    );
    let pool = PrivacyPoolClient::new(&env, &pool_id);
    pool.set_vk(&Circuit::Bridge, &dummy_vk(&env));

    let bridge_id = env.register(Bridge, (admin.clone(), pool_id.clone(), token_addr.clone()));
    let bridge = BridgeClient::new(&env, &bridge_id);
    bridge.set_relayer(&relayer);

    // Register the bridge as the pool's minter and pre-fund its liquidity.
    pool.set_minter(&bridge_id);
    StellarAssetClient::new(&env, &token_addr).mint(&bridge_id, &100);

    Fixture { env, bridge, pool, token, bridge_addr: bridge_id, empty_root }
}

#[test]
fn bridge_in_mints_shielded_note() {
    let f = setup();
    let cmt = root(&f.env, 7);
    let new_root = root(&f.env, 1);

    f.bridge.bridge_in(&1u64, &100, &cmt, &f.empty_root, &new_root, &dummy_proof(&f.env));

    assert!(f.bridge.is_nonce_used(&1u64));
    assert_eq!(f.pool.total_shielded(), 100);
    assert_eq!(f.pool.current_root(), new_root);
    assert_eq!(f.pool.next_leaf(), 1);
    assert_eq!(f.token.balance(&f.pool.address), 100);
    assert_eq!(f.token.balance(&f.bridge_addr), 0);
}

#[test]
fn bridge_in_rejects_replayed_nonce() {
    let f = setup();
    f.bridge.bridge_in(&1u64, &100, &root(&f.env, 7), &f.empty_root, &root(&f.env, 1), &dummy_proof(&f.env));

    let res = f.bridge.try_bridge_in(
        &1u64,
        &100,
        &root(&f.env, 8),
        &root(&f.env, 1),
        &root(&f.env, 2),
        &dummy_proof(&f.env),
    );
    assert_eq!(res, Err(Ok(Error::NonceAlreadyUsed)));
}

#[test]
fn bridge_in_rejects_nonpositive_amount() {
    let f = setup();
    let res = f.bridge.try_bridge_in(
        &2u64,
        &0,
        &root(&f.env, 7),
        &f.empty_root,
        &root(&f.env, 1),
        &dummy_proof(&f.env),
    );
    assert_eq!(res, Err(Ok(Error::InvalidAmount)));
}
