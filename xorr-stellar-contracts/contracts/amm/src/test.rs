#![cfg(test)]
use crate::{Amm, AmmClient, Error};
use soroban_sdk::{
    testutils::Address as _,
    token::{StellarAssetClient, TokenClient},
    Address, Env,
};

struct F {
    env: Env,
    amm: AmmClient<'static>,
    token_a: TokenClient<'static>,
    token_b: TokenClient<'static>,
    a_addr: Address,
    b_addr: Address,
    user: Address,
}

fn setup(fee_bps: u32) -> F {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let sac_a = env.register_stellar_asset_contract_v2(admin.clone());
    let sac_b = env.register_stellar_asset_contract_v2(admin.clone());
    let a_addr = sac_a.address();
    let b_addr = sac_b.address();
    StellarAssetClient::new(&env, &a_addr).mint(&user, &10_000_000);
    StellarAssetClient::new(&env, &b_addr).mint(&user, &10_000_000);

    let amm_id = env.register(Amm, (a_addr.clone(), b_addr.clone(), fee_bps));
    let amm = AmmClient::new(&env, &amm_id);

    let token_a = TokenClient::new(&env, &a_addr);
    let token_b = TokenClient::new(&env, &b_addr);
    F { env, amm, token_a, token_b, a_addr, b_addr, user }
}

#[test]
fn add_liquidity_sets_reserves_and_shares() {
    let f = setup(30);
    let minted = f.amm.add_liquidity(&f.user, &1_000_000, &1_000_000);
    assert_eq!(minted, 1_000_000, "first LP mint = sqrt(a*b)");
    assert_eq!(f.amm.get_reserves(), (1_000_000, 1_000_000));
    assert_eq!(f.amm.shares(&f.user), 1_000_000);
    // tokens actually moved into the pool
    assert_eq!(f.token_a.balance(&f.user), 9_000_000);
}

#[test]
fn swap_matches_quote_and_grows_k() {
    let f = setup(30); // 0.30% fee
    f.amm.add_liquidity(&f.user, &1_000_000, &1_000_000);
    let (ra0, rb0) = f.amm.get_reserves();
    let k0 = ra0 * rb0;

    let quoted = f.amm.quote(&f.a_addr, &100_000);
    let b_before = f.token_b.balance(&f.user);
    let a_before = f.token_a.balance(&f.user);

    let out = f.amm.swap(&f.user, &f.a_addr, &100_000, &0);
    assert_eq!(out, quoted, "swap output equals the quote");
    assert!(out > 0);

    // balances reflect the trade
    assert_eq!(f.token_b.balance(&f.user), b_before + out);
    assert_eq!(f.token_a.balance(&f.user), a_before - 100_000);

    // constant-product invariant: k must not decrease (fee accrues to LPs)
    let (ra1, rb1) = f.amm.get_reserves();
    assert!(ra1 * rb1 >= k0, "k must be non-decreasing");
    assert_eq!(ra1, ra0 + 100_000);
    assert_eq!(rb1, rb0 - out);
}

#[test]
fn slippage_guard_reverts() {
    let f = setup(30);
    f.amm.add_liquidity(&f.user, &1_000_000, &1_000_000);
    // demand more out than possible → SlippageExceeded
    let res = f.amm.try_swap(&f.user, &f.a_addr, &100_000, &99_999_999);
    assert_eq!(res, Err(Ok(Error::SlippageExceeded)));
}

#[test]
fn unknown_token_rejected() {
    let f = setup(30);
    f.amm.add_liquidity(&f.user, &1_000_000, &1_000_000);
    let bogus = Address::generate(&f.env);
    let res = f.amm.try_swap(&f.user, &bogus, &1_000, &0);
    assert_eq!(res, Err(Ok(Error::UnknownToken)));
}

#[test]
fn remove_liquidity_returns_funds() {
    let f = setup(30);
    let minted = f.amm.add_liquidity(&f.user, &1_000_000, &2_000_000);
    let (out_a, out_b) = f.amm.remove_liquidity(&f.user, &minted);
    // Get back approximately what was put in (no swaps happened).
    assert_eq!(out_a, 1_000_000);
    assert_eq!(out_b, 2_000_000);
    assert_eq!(f.amm.shares(&f.user), 0);
    assert_eq!(f.amm.get_reserves(), (0, 0));
}

#[test]
fn second_lp_must_match_ratio() {
    let f = setup(30);
    f.amm.add_liquidity(&f.user, &1_000_000, &1_000_000);
    // wildly imbalanced second deposit is rejected
    let res = f.amm.try_add_liquidity(&f.user, &1_000_000, &10);
    assert_eq!(res, Err(Ok(Error::ImbalancedDeposit)));
}

#[test]
fn price_moves_against_size() {
    // Bigger trades get a worse rate (slippage) — sanity of the curve.
    let f = setup(0); // no fee, isolate curve behavior
    f.amm.add_liquidity(&f.user, &1_000_000, &1_000_000);
    let small = f.amm.quote(&f.a_addr, &1_000);
    let big = f.amm.quote(&f.a_addr, &500_000);
    // marginal rate: small trade ~1:1, big trade noticeably worse per unit
    assert!(small * 500 > big, "large trade has higher slippage per unit");
}
