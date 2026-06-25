#![cfg(test)]
use super::*;
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{token, Address, Env};

const E7: i128 = 10_000_000; // 1.0 token (7 decimals)

#[allow(dead_code)]
struct Setup {
    env: Env,
    admin: Address,
    usdc: Address,
    xlm: Address,
    client: LendingClient<'static>,
}

fn token_pair(env: &Env, admin: &Address) -> (Address, token::StellarAssetClient<'static>) {
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let id = sac.address();
    (id.clone(), token::StellarAssetClient::new(env, &id))
}

fn setup() -> (Setup, token::StellarAssetClient<'static>, token::StellarAssetClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1_000_000);
    let admin = Address::generate(&env);
    let (usdc, usdc_admin) = token_pair(&env, &admin);
    let (xlm, xlm_admin) = token_pair(&env, &admin);
    let id = env.register(Lending, (admin.clone(),));
    let client = LendingClient::new(&env, &id);
    // USDC: $1, 80% LTV.  XLM: $0.11, 70% LTV.
    client.add_market(&usdc, &8000, &1000, &200, &2000, &E7);
    client.add_market(&xlm, &7000, &1000, &200, &3000, &1_100_000);
    (Setup { env, admin, usdc, xlm, client }, usdc_admin, xlm_admin)
}

#[test]
fn supply_borrow_repay_withdraw() {
    let (s, usdc_admin, xlm_admin) = setup();
    let alice = Address::generate(&s.env); // supplier of USDC liquidity
    let bob = Address::generate(&s.env); // borrower: XLM collateral, USDC debt
    usdc_admin.mint(&alice, &(2000 * E7));
    xlm_admin.mint(&bob, &(20000 * E7));

    s.client.supply(&s.usdc, &alice, &(1000 * E7));
    s.client.supply(&s.xlm, &bob, &(10000 * E7)); // collateral $1100 * 0.7 = $770

    // borrow 500 USDC ($500) against $770 borrowing power → healthy
    s.client.borrow(&s.usdc, &bob, &(500 * E7));
    let (coll, borrow, health) = s.client.account(&bob);
    assert_eq!(borrow, 500 * E7); // $500
    assert!(coll >= borrow);
    assert!(health > 10_000); // > 1.0

    let usdc = token::TokenClient::new(&s.env, &s.usdc);
    assert_eq!(usdc.balance(&bob), 500 * E7); // received the borrow

    // repay full
    s.client.repay(&s.usdc, &bob, &(500 * E7));
    let (_, debt) = s.client.position(&s.usdc, &bob);
    assert_eq!(debt, 0);

    // alice withdraws her USDC (now fully available again)
    s.client.withdraw(&s.usdc, &alice, &(1000 * E7));
    let (supplied, _) = s.client.position(&s.usdc, &alice);
    assert!(supplied <= 1); // dust from rounding at most
}

#[test]
fn interest_accrues_over_time() {
    let (s, usdc_admin, xlm_admin) = setup();
    let alice = Address::generate(&s.env);
    let bob = Address::generate(&s.env);
    usdc_admin.mint(&alice, &(1000 * E7));
    xlm_admin.mint(&bob, &(20000 * E7));
    s.client.supply(&s.usdc, &alice, &(1000 * E7));
    s.client.supply(&s.xlm, &bob, &(15000 * E7));
    s.client.borrow(&s.usdc, &bob, &(500 * E7));

    // jump one year; debt must grow (utilization 50% → rate = 2% + 20%*0.5 = 12%)
    s.env.ledger().set_timestamp(1_000_000 + YEAR as u64);
    let (_, debt) = s.client.position(&s.usdc, &bob);
    // 50% utilization → 2% base + 20% slope*0.5 = 12% APR → 500 + 60 = 560
    assert!(debt >= 559 * E7 && debt <= 561 * E7, "debt = {}", debt);

    // supplier's balance also grew (earned interest)
    let (supplied, _) = s.client.position(&s.usdc, &alice);
    assert!(supplied > 1000 * E7, "supplied = {}", supplied);
}

#[test]
fn borrow_blocked_when_undercollateralized() {
    let (s, usdc_admin, xlm_admin) = setup();
    let alice = Address::generate(&s.env);
    let bob = Address::generate(&s.env);
    usdc_admin.mint(&alice, &(1000 * E7));
    xlm_admin.mint(&bob, &(1000 * E7));
    s.client.supply(&s.usdc, &alice, &(1000 * E7));
    s.client.supply(&s.xlm, &bob, &(1000 * E7)); // $110 * 0.7 = $77 power

    // try to borrow $100 → should fail (over $77 power)
    let r = s.client.try_borrow(&s.usdc, &bob, &(100 * E7));
    assert!(r.is_err());
}

#[test]
fn liquidation_seizes_collateral() {
    let (s, usdc_admin, xlm_admin) = setup();
    let alice = Address::generate(&s.env);
    let bob = Address::generate(&s.env); // borrower
    let liq = Address::generate(&s.env); // liquidator
    usdc_admin.mint(&alice, &(1000 * E7));
    usdc_admin.mint(&liq, &(1000 * E7));
    xlm_admin.mint(&bob, &(10000 * E7));
    s.client.supply(&s.usdc, &alice, &(1000 * E7));
    s.client.supply(&s.xlm, &bob, &(10000 * E7)); // $1100 * 0.7 = $770 power
    s.client.borrow(&s.usdc, &bob, &(700 * E7)); // healthy at $700

    // XLM crashes to $0.05 → collateral $500, power $350 < $700 debt → underwater
    s.client.set_price(&s.xlm, &500_000);
    let (_, _, health) = s.client.account(&bob);
    assert!(health < 10_000, "should be underwater, health = {}", health);

    // liquidator repays 200 USDC, seizes XLM + 5% bonus
    let seized = s.client.liquidate(&liq, &bob, &s.xlm, &s.usdc, &(200 * E7));
    assert!(seized > 0);
    let (liq_xlm, _) = s.client.position(&s.xlm, &liq);
    assert!(liq_xlm > 0); // liquidator now holds seized XLM collateral
    let (_, bob_debt) = s.client.position(&s.usdc, &bob);
    assert_eq!(bob_debt, 500 * E7); // 700 - 200 repaid
}
