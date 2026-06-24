#![cfg(test)]
use crate::{Error, PoolFactory, PoolFactoryClient};
use soroban_sdk::{
    testutils::Address as _,
    token::{StellarAssetClient, TokenClient},
    Address, Env,
};

struct F {
    env: Env,
    fac: PoolFactoryClient<'static>,
    a: Address,
    b: Address,
    c: Address,
    user: Address,
    tok_a: TokenClient<'static>,
    tok_b: TokenClient<'static>,
}

fn setup() -> F {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let mk = || {
        let sac = env.register_stellar_asset_contract_v2(admin.clone());
        let addr = sac.address();
        StellarAssetClient::new(&env, &addr).mint(&user, &100_000_000);
        addr
    };
    let a = mk();
    let b = mk();
    let c = mk();
    let fac_id = env.register(PoolFactory, ());
    let fac = PoolFactoryClient::new(&env, &fac_id);
    let tok_a = TokenClient::new(&env, &a);
    let tok_b = TokenClient::new(&env, &b);
    F { env, fac, a, b, c, user, tok_a, tok_b }
}

#[test]
fn create_and_find_pools() {
    let f = setup();
    let id0 = f.fac.create_pool(&f.user, &f.a, &f.b, &30, &false);
    assert_eq!(id0, 0);
    assert_eq!(f.fac.pool_count(), 1);
    // a confidential pool for a different pair
    let id1 = f.fac.create_pool(&f.user, &f.a, &f.c, &30, &true);
    assert_eq!(id1, 1);
    assert!(f.fac.get_pool(&id1).confidential);
    // lookup works both directions
    assert_eq!(f.fac.find_pool(&f.a, &f.b), Some(0));
    assert_eq!(f.fac.find_pool(&f.b, &f.a), Some(0));
}

#[test]
fn duplicate_pair_rejected() {
    let f = setup();
    f.fac.create_pool(&f.user, &f.a, &f.b, &30, &false);
    let res = f.fac.try_create_pool(&f.user, &f.b, &f.a, &30, &false);
    assert_eq!(res, Err(Ok(Error::PoolExists)));
}

#[test]
fn identical_tokens_rejected() {
    let f = setup();
    let res = f.fac.try_create_pool(&f.user, &f.a, &f.a, &30, &false);
    assert_eq!(res, Err(Ok(Error::IdenticalTokens)));
}

#[test]
fn add_liquidity_and_swap() {
    let f = setup();
    let id = f.fac.create_pool(&f.user, &f.a, &f.b, &30, &false);
    let minted = f.fac.add_liquidity(&id, &f.user, &1_000_000, &1_000_000);
    assert_eq!(minted, 1_000_000);

    let p0 = f.fac.get_pool(&id);
    let k0 = p0.reserve_a * p0.reserve_b;

    let quoted = f.fac.quote(&id, &f.a, &100_000);
    let b_before = f.tok_b.balance(&f.user);
    let out = f.fac.swap(&id, &f.user, &f.a, &100_000, &0);
    assert_eq!(out, quoted);
    assert_eq!(f.tok_b.balance(&f.user), b_before + out);

    let p1 = f.fac.get_pool(&id);
    assert!(p1.reserve_a * p1.reserve_b >= k0, "k non-decreasing");
}

#[test]
fn slippage_and_unknown_token() {
    let f = setup();
    let id = f.fac.create_pool(&f.user, &f.a, &f.b, &30, &false);
    f.fac.add_liquidity(&id, &f.user, &1_000_000, &1_000_000);
    assert_eq!(
        f.fac.try_swap(&id, &f.user, &f.a, &100_000, &99_999_999),
        Err(Ok(Error::SlippageExceeded))
    );
    assert_eq!(
        f.fac.try_swap(&id, &f.user, &f.c, &1_000, &0),
        Err(Ok(Error::UnknownToken))
    );
}

#[test]
fn swap_on_missing_pool_errors() {
    let f = setup();
    assert_eq!(f.fac.try_quote(&7, &f.a, &10), Err(Ok(Error::NoSuchPool)));
}
