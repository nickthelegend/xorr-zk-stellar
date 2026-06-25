#![no_std]
//! Xorr — Lending / Borrowing money market (Compound-style)
//! ========================================================
//! A multi-asset money market on Soroban. Suppliers earn interest; borrowers
//! post collateral and borrow against it. Interest accrues per second from a
//! utilization-based rate model; each asset has a collateral factor (LTV); an
//! account stays solvent while `collateral_value >= borrow_value`. Undercollateral-
//! ized accounts can be liquidated for a bonus.
//!
//! Accounting (all fixed-point, base units = 7 decimals like the asset SACs):
//! * `borrow_index` (scale 1e9) grows with accrued interest; a borrower's debt is
//!   `principal * borrow_index / index_at_borrow` (Compound's snapshot model).
//! * suppliers hold **shares**; the share→underlying exchange rate is
//!   `(cash + total_borrows - reserves) / total_shares`, so supply grows as
//!   borrowers pay interest.
//! * prices are USD with 7 decimals **per whole token** (1e7 base units); set by
//!   the admin oracle (Reflector/Charli3 is the production upgrade).

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, Env, Symbol,
    Vec,
};

const INDEX_SCALE: i128 = 1_000_000_000; // 1e9 fixed-point for indexes / exchange rate
const BPS: i128 = 10_000;
const YEAR: i128 = 31_536_000; // seconds
const PRICE_SCALE: i128 = 10_000_000; // 1e7 — assets + prices are 7-decimal
const LIQ_BONUS_BPS: i128 = 500; // 5% collateral bonus to liquidators
const CLOSE_FACTOR_BPS: i128 = 5_000; // at most 50% of a debt repaid per liquidation
const TOPIC: Symbol = symbol_short!("lending");

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotAdmin = 1,
    MarketExists = 2,
    NoMarket = 3,
    BadAmount = 4,
    Insufficient = 5,    // not enough shares / cash
    Undercollateralized = 6,
    Healthy = 7,         // liquidation target is still solvent
    NoDebt = 8,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Markets,              // Vec<Address> of listed assets
    Market(Address),      // Market
    Supply(Address, Address), // (asset, user) -> shares
    Borrow(Address, Address), // (asset, user) -> Debt
}

#[contracttype]
#[derive(Clone)]
pub struct Market {
    pub cash: i128,             // underlying held + lendable
    pub total_borrows: i128,    // underlying owed by borrowers
    pub total_reserves: i128,   // protocol reserves (excluded from supplier value)
    pub total_shares: i128,     // supplier shares
    pub borrow_index: i128,     // 1e9, grows with interest
    pub last_accrual: u64,      // unix ts of last accrual
    pub collateral_factor: u32, // bps (LTV), e.g. 8000 = 80%
    pub reserve_factor: u32,    // bps of interest kept as reserves
    pub base_rate: u32,         // bps annual at 0% utilization
    pub slope: u32,             // bps annual added at 100% utilization
    pub price: i128,            // USD (7-dec) per whole token
}

#[contracttype]
#[derive(Clone)]
pub struct Debt {
    pub principal: i128, // underlying at the snapshot index
    pub index: i128,     // borrow_index when last updated
}

#[contract]
pub struct Lending;

#[contractimpl]
impl Lending {
    pub fn __constructor(env: Env, admin: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Markets, &Vec::<Address>::new(&env));
    }

    // ── Admin: market listing + oracle ────────────────────────────────────
    pub fn add_market(
        env: Env,
        asset: Address,
        collateral_factor: u32,
        reserve_factor: u32,
        base_rate: u32,
        slope: u32,
        price: i128,
    ) -> Result<(), Error> {
        Self::admin(&env).require_auth();
        if env.storage().persistent().has(&DataKey::Market(asset.clone())) {
            return Err(Error::MarketExists);
        }
        let m = Market {
            cash: 0, total_borrows: 0, total_reserves: 0, total_shares: 0,
            borrow_index: INDEX_SCALE, last_accrual: env.ledger().timestamp(),
            collateral_factor, reserve_factor, base_rate, slope, price,
        };
        env.storage().persistent().set(&DataKey::Market(asset.clone()), &m);
        let mut list: Vec<Address> = env.storage().instance().get(&DataKey::Markets).unwrap();
        list.push_back(asset.clone());
        env.storage().instance().set(&DataKey::Markets, &list);
        env.events().publish((TOPIC, symbol_short!("market")), (asset, collateral_factor, price));
        Ok(())
    }

    /// Admin oracle: set the USD (7-dec) price of one whole token.
    pub fn set_price(env: Env, asset: Address, price: i128) -> Result<(), Error> {
        Self::admin(&env).require_auth();
        let mut m = Self::market(&env, &asset)?;
        m.price = price;
        env.storage().persistent().set(&DataKey::Market(asset.clone()), &m);
        env.events().publish((TOPIC, symbol_short!("price")), (asset, price));
        Ok(())
    }

    // ── Supply / Withdraw ─────────────────────────────────────────────────
    pub fn supply(env: Env, asset: Address, from: Address, amount: i128) -> Result<i128, Error> {
        from.require_auth();
        if amount <= 0 { return Err(Error::BadAmount); }
        let mut m = Self::accrue(&env, &asset)?;
        let er = Self::exchange_rate(&m);
        let shares = amount.checked_mul(INDEX_SCALE).unwrap() / er;
        token::TokenClient::new(&env, &asset).transfer(&from, &env.current_contract_address(), &amount);
        m.cash += amount;
        m.total_shares += shares;
        Self::save_market(&env, &asset, &m);
        Self::add_shares(&env, &asset, &from, shares);
        env.events().publish((TOPIC, symbol_short!("supply")), (asset, from, amount, shares));
        Ok(shares)
    }

    pub fn withdraw(env: Env, asset: Address, from: Address, amount: i128) -> Result<(), Error> {
        from.require_auth();
        if amount <= 0 { return Err(Error::BadAmount); }
        let mut m = Self::accrue(&env, &asset)?;
        if m.cash < amount { return Err(Error::Insufficient); }
        let er = Self::exchange_rate(&m);
        let shares = amount.checked_mul(INDEX_SCALE).unwrap() / er;
        let have = Self::shares_of(&env, &asset, &from);
        if have < shares { return Err(Error::Insufficient); }
        m.cash -= amount;
        m.total_shares -= shares;
        Self::save_market(&env, &asset, &m);
        Self::add_shares(&env, &asset, &from, -shares);
        // must stay solvent after pulling collateral
        Self::require_healthy(&env, &from)?;
        token::TokenClient::new(&env, &asset).transfer(&env.current_contract_address(), &from, &amount);
        env.events().publish((TOPIC, symbol_short!("withdraw")), (asset, from, amount));
        Ok(())
    }

    // ── Borrow / Repay ────────────────────────────────────────────────────
    pub fn borrow(env: Env, asset: Address, from: Address, amount: i128) -> Result<(), Error> {
        from.require_auth();
        if amount <= 0 { return Err(Error::BadAmount); }
        let mut m = Self::accrue(&env, &asset)?;
        if m.cash < amount { return Err(Error::Insufficient); }
        let debt = Self::debt_now(&env, &asset, &from, &m);
        Self::set_debt(&env, &asset, &from, debt + amount, m.borrow_index);
        m.cash -= amount;
        m.total_borrows += amount;
        Self::save_market(&env, &asset, &m);
        Self::require_healthy(&env, &from)?;
        token::TokenClient::new(&env, &asset).transfer(&env.current_contract_address(), &from, &amount);
        env.events().publish((TOPIC, symbol_short!("borrow")), (asset, from, amount));
        Ok(())
    }

    pub fn repay(env: Env, asset: Address, from: Address, amount: i128) -> Result<i128, Error> {
        from.require_auth();
        if amount <= 0 { return Err(Error::BadAmount); }
        let mut m = Self::accrue(&env, &asset)?;
        let debt = Self::debt_now(&env, &asset, &from, &m);
        if debt == 0 { return Err(Error::NoDebt); }
        let pay = if amount > debt { debt } else { amount };
        token::TokenClient::new(&env, &asset).transfer(&from, &env.current_contract_address(), &pay);
        m.cash += pay;
        m.total_borrows -= pay;
        Self::save_market(&env, &asset, &m);
        Self::set_debt(&env, &asset, &from, debt - pay, m.borrow_index);
        env.events().publish((TOPIC, symbol_short!("repay")), (asset, from, pay));
        Ok(pay)
    }

    /// Liquidate an undercollateralized `borrower`: repay `repay_amount` of their
    /// `debt_asset` and seize `collateral_asset` at a 5% bonus.
    pub fn liquidate(
        env: Env,
        liquidator: Address,
        borrower: Address,
        collateral_asset: Address,
        debt_asset: Address,
        repay_amount: i128,
    ) -> Result<i128, Error> {
        liquidator.require_auth();
        if repay_amount <= 0 { return Err(Error::BadAmount); }
        // both markets must be current
        let mut dm = Self::accrue(&env, &debt_asset)?;
        let cm = Self::accrue(&env, &collateral_asset)?;
        if Self::is_healthy(&env, &borrower)? { return Err(Error::Healthy); }

        let debt = Self::debt_now(&env, &debt_asset, &borrower, &dm);
        if debt == 0 { return Err(Error::NoDebt); }
        let max_repay = debt * CLOSE_FACTOR_BPS / BPS;
        let repay = if repay_amount > max_repay { max_repay } else { repay_amount };

        // collateral to seize = repay value * (1 + bonus), converted at collateral price
        let repay_value = repay.checked_mul(dm.price).unwrap() / PRICE_SCALE; // USD 7-dec
        let seize_value = repay_value * (BPS + LIQ_BONUS_BPS) / BPS;
        let seize_underlying = seize_value.checked_mul(PRICE_SCALE).unwrap() / cm.price;
        let cer = Self::exchange_rate(&cm);
        let seize_shares = seize_underlying.checked_mul(INDEX_SCALE).unwrap() / cer;
        if Self::shares_of(&env, &collateral_asset, &borrower) < seize_shares {
            return Err(Error::Insufficient);
        }

        // liquidator repays the debt
        token::TokenClient::new(&env, &debt_asset).transfer(&liquidator, &env.current_contract_address(), &repay);
        dm.cash += repay;
        dm.total_borrows -= repay;
        Self::save_market(&env, &debt_asset, &dm);
        Self::set_debt(&env, &debt_asset, &borrower, debt - repay, dm.borrow_index);

        // seize the borrower's collateral shares → liquidator
        Self::add_shares(&env, &collateral_asset, &borrower, -seize_shares);
        Self::add_shares(&env, &collateral_asset, &liquidator, seize_shares);
        Self::save_market(&env, &collateral_asset, &cm); // (accrual persisted)
        env.events().publish(
            (TOPIC, symbol_short!("liquidate")),
            (borrower, liquidator, repay, seize_shares),
        );
        Ok(seize_shares)
    }

    // ── Views ─────────────────────────────────────────────────────────────
    pub fn get_market(env: Env, asset: Address) -> Result<Market, Error> {
        Self::current(&env, &asset)
    }
    pub fn markets(env: Env) -> Vec<Address> {
        env.storage().instance().get(&DataKey::Markets).unwrap_or(Vec::new(&env))
    }
    /// (supplied_underlying, debt_underlying) for a user in one market.
    pub fn position(env: Env, asset: Address, user: Address) -> Result<(i128, i128), Error> {
        let m = Self::current(&env, &asset)?;
        let supplied = Self::shares_of(&env, &asset, &user).checked_mul(Self::exchange_rate(&m)).unwrap() / INDEX_SCALE;
        let debt = Self::debt_now(&env, &asset, &user, &m);
        Ok((supplied, debt))
    }
    /// (collateral_value, borrow_value, health_bps) in USD 7-dec; health_bps =
    /// collateral/borrow * 10000 (u32::MAX when no debt).
    pub fn account(env: Env, user: Address) -> (i128, i128, u32) {
        let (c, b) = Self::values(&env, &user);
        let health = if b == 0 { u32::MAX } else { (c.saturating_mul(BPS) / b).min(u32::MAX as i128) as u32 };
        (c, b, health)
    }
    /// (supply_apy_bps, borrow_apy_bps) at current utilization.
    pub fn rates(env: Env, asset: Address) -> Result<(u32, u32), Error> {
        let m = Self::current(&env, &asset)?;
        let util = Self::utilization(&m); // bps
        let borrow = m.base_rate as i128 + (m.slope as i128) * util / BPS;
        let supply = borrow * util / BPS * (BPS - m.reserve_factor as i128) / BPS;
        Ok((supply as u32, borrow as u32))
    }

    // ── internals ─────────────────────────────────────────────────────────
    fn admin(env: &Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }
    fn market(env: &Env, asset: &Address) -> Result<Market, Error> {
        env.storage().persistent().get(&DataKey::Market(asset.clone())).ok_or(Error::NoMarket)
    }
    fn save_market(env: &Env, asset: &Address, m: &Market) {
        env.storage().persistent().set(&DataKey::Market(asset.clone()), m);
    }
    fn shares_of(env: &Env, asset: &Address, user: &Address) -> i128 {
        env.storage().persistent().get(&DataKey::Supply(asset.clone(), user.clone())).unwrap_or(0)
    }
    fn add_shares(env: &Env, asset: &Address, user: &Address, delta: i128) {
        let v = Self::shares_of(env, asset, user) + delta;
        env.storage().persistent().set(&DataKey::Supply(asset.clone(), user.clone()), &v);
    }
    fn set_debt(env: &Env, asset: &Address, user: &Address, principal: i128, index: i128) {
        env.storage().persistent().set(&DataKey::Borrow(asset.clone(), user.clone()), &Debt { principal, index });
    }
    fn debt_now(env: &Env, asset: &Address, user: &Address, m: &Market) -> i128 {
        let d: Debt = env.storage().persistent().get(&DataKey::Borrow(asset.clone(), user.clone()))
            .unwrap_or(Debt { principal: 0, index: m.borrow_index });
        if d.principal == 0 { 0 } else { d.principal.checked_mul(m.borrow_index).unwrap() / d.index }
    }

    fn utilization(m: &Market) -> i128 {
        let total = m.cash + m.total_borrows;
        if total <= 0 { 0 } else { m.total_borrows.checked_mul(BPS).unwrap() / total }
    }
    fn exchange_rate(m: &Market) -> i128 {
        if m.total_shares <= 0 { return INDEX_SCALE; }
        (m.cash + m.total_borrows - m.total_reserves).checked_mul(INDEX_SCALE).unwrap() / m.total_shares
    }

    /// Interest accrued forward to `now` WITHOUT persisting — used by all view
    /// paths so balances reflect real-time interest between transactions.
    fn preview(m: &Market, now: u64) -> Market {
        let mut m = m.clone();
        let dt = now.saturating_sub(m.last_accrual) as i128;
        m.last_accrual = now;
        if dt > 0 && m.total_borrows > 0 {
            let util = Self::utilization(&m);
            let rate_bps = m.base_rate as i128 + (m.slope as i128) * util / BPS; // annual bps
            let interest = m.total_borrows.checked_mul(rate_bps).unwrap() * dt / (BPS * YEAR);
            if interest > 0 {
                let reserve = interest * (m.reserve_factor as i128) / BPS;
                m.borrow_index += m.borrow_index.checked_mul(interest).unwrap() / m.total_borrows;
                m.total_borrows += interest;
                m.total_reserves += reserve;
            }
        }
        m
    }
    /// Load a market accrued to now (view) — does not persist.
    fn current(env: &Env, asset: &Address) -> Result<Market, Error> {
        Ok(Self::preview(&Self::market(env, asset)?, env.ledger().timestamp()))
    }
    /// Accrue interest to now and persist; returns the updated market.
    fn accrue(env: &Env, asset: &Address) -> Result<Market, Error> {
        let m = Self::current(env, asset)?;
        Self::save_market(env, asset, &m);
        Ok(m)
    }

    /// (collateral_value, borrow_value) across all markets, USD 7-dec.
    fn values(env: &Env, user: &Address) -> (i128, i128) {
        let list = Self::markets(env.clone());
        let mut coll = 0i128;
        let mut borrow = 0i128;
        let now = env.ledger().timestamp();
        for asset in list.iter() {
            let m = match Self::market(env, &asset) { Ok(m) => Self::preview(&m, now), Err(_) => continue };
            let supplied = Self::shares_of(env, &asset, user).checked_mul(Self::exchange_rate(&m)).unwrap() / INDEX_SCALE;
            if supplied > 0 {
                let v = supplied.checked_mul(m.price).unwrap() / PRICE_SCALE;
                coll += v * (m.collateral_factor as i128) / BPS;
            }
            let debt = Self::debt_now(env, &asset, user, &m);
            if debt > 0 {
                borrow += debt.checked_mul(m.price).unwrap() / PRICE_SCALE;
            }
        }
        (coll, borrow)
    }
    fn is_healthy(env: &Env, user: &Address) -> Result<bool, Error> {
        let (c, b) = Self::values(env, user);
        Ok(b == 0 || c >= b)
    }
    fn require_healthy(env: &Env, user: &Address) -> Result<(), Error> {
        if Self::is_healthy(env, user)? { Ok(()) } else { Err(Error::Undercollateralized) }
    }
}

mod test;
