#![no_std]
//! XORR AMM — a minimal constant-product (x·y=k) market maker for two Stellar
//! Asset Contract (SAC) tokens, used to power **swaps** in the XORR app.
//!
//! It is intentionally small and audited-by-reading: the contract only does
//! token custody + the constant-product math. Privacy in XORR comes from the
//! shielded pool; a *private swap* in the UI is `pool.withdraw → amm.swap →
//! pool.deposit`, so the AMM hop is the only public step (like any privacy
//! pool's interaction with an external venue). The pool/circuits are unchanged.
//!
//! Invariant: after a fee-bearing swap, k = reserve_a · reserve_b never
//! decreases (the fee accrues to LPs). `swap` enforces a caller-supplied
//! `min_out` for slippage protection.
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, Env,
};

const BPS_DENOM: i128 = 10_000;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    AlreadySeeded = 1,
    ZeroAmount = 2,
    InsufficientLiquidity = 3,
    UnknownToken = 4,
    SlippageExceeded = 5,
    InsufficientShares = 6,
    BadFee = 7,
    ImbalancedDeposit = 8,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    TokenA,
    TokenB,
    FeeBps,
    ReserveA,
    ReserveB,
    TotalShares,
    Shares(Address),
}

#[contract]
pub struct Amm;

#[contractimpl]
impl Amm {
    /// * `token_a`, `token_b` — the two SAC token addresses (token_a != token_b).
    /// * `fee_bps`            — swap fee in basis points (e.g. 30 = 0.30%).
    pub fn __constructor(env: Env, token_a: Address, token_b: Address, fee_bps: u32) {
        if fee_bps >= BPS_DENOM as u32 {
            panic_with(&env, Error::BadFee);
        }
        let s = env.storage().instance();
        s.set(&DataKey::TokenA, &token_a);
        s.set(&DataKey::TokenB, &token_b);
        s.set(&DataKey::FeeBps, &fee_bps);
        s.set(&DataKey::ReserveA, &0i128);
        s.set(&DataKey::ReserveB, &0i128);
        s.set(&DataKey::TotalShares, &0i128);
    }

    /// Add liquidity. The first provider sets the price (any ratio); subsequent
    /// providers must match the current reserve ratio within rounding. Returns
    /// the LP shares minted to `from`.
    pub fn add_liquidity(
        env: Env,
        from: Address,
        amount_a: i128,
        amount_b: i128,
    ) -> Result<i128, Error> {
        from.require_auth();
        if amount_a <= 0 || amount_b <= 0 {
            return Err(Error::ZeroAmount);
        }
        let (ra, rb) = Self::reserves(&env);
        let total = Self::total_shares(&env);

        let minted = if total == 0 {
            // First deposit: shares = sqrt(a·b).
            isqrt(amount_a.checked_mul(amount_b).ok_or(Error::InsufficientLiquidity)?)
        } else {
            // Proportional; require the deposit to match the pool ratio (±1 unit)
            // so a provider can't shift the price for free.
            let expect_b = amount_a.checked_mul(rb).ok_or(Error::InsufficientLiquidity)? / ra;
            let diff = (expect_b - amount_b).abs();
            if diff > 1 + expect_b / 1000 {
                return Err(Error::ImbalancedDeposit);
            }
            let sa = amount_a.checked_mul(total).ok_or(Error::InsufficientLiquidity)? / ra;
            let sb = amount_b.checked_mul(total).ok_or(Error::InsufficientLiquidity)? / rb;
            sa.min(sb)
        };
        if minted <= 0 {
            return Err(Error::InsufficientLiquidity);
        }

        Self::token(&env, DataKey::TokenA).transfer(&from, &env.current_contract_address(), &amount_a);
        Self::token(&env, DataKey::TokenB).transfer(&from, &env.current_contract_address(), &amount_b);

        Self::set_reserves(&env, ra + amount_a, rb + amount_b);
        Self::set_total_shares(&env, total + minted);
        let bal = Self::shares(env.clone(), from.clone());
        env.storage().persistent().set(&DataKey::Shares(from.clone()), &(bal + minted));

        env.events().publish((symbol_short!("add_liq"),), (from, amount_a, amount_b, minted));
        Ok(minted)
    }

    /// Burn `shares` LP and withdraw the proportional amounts of both tokens.
    pub fn remove_liquidity(env: Env, from: Address, shares: i128) -> Result<(i128, i128), Error> {
        from.require_auth();
        if shares <= 0 {
            return Err(Error::ZeroAmount);
        }
        let bal = Self::shares(env.clone(), from.clone());
        if shares > bal {
            return Err(Error::InsufficientShares);
        }
        let (ra, rb) = Self::reserves(&env);
        let total = Self::total_shares(&env);
        let out_a = ra * shares / total;
        let out_b = rb * shares / total;

        Self::set_reserves(&env, ra - out_a, rb - out_b);
        Self::set_total_shares(&env, total - shares);
        env.storage().persistent().set(&DataKey::Shares(from.clone()), &(bal - shares));

        Self::token(&env, DataKey::TokenA).transfer(&env.current_contract_address(), &from, &out_a);
        Self::token(&env, DataKey::TokenB).transfer(&env.current_contract_address(), &from, &out_b);

        env.events().publish((symbol_short!("rem_liq"),), (from, out_a, out_b, shares));
        Ok((out_a, out_b))
    }

    /// Swap `amount_in` of `token_in` for the other token. Reverts unless the
    /// output is at least `min_out` (slippage guard). Returns the output amount.
    pub fn swap(
        env: Env,
        from: Address,
        token_in: Address,
        amount_in: i128,
        min_out: i128,
    ) -> Result<i128, Error> {
        from.require_auth();
        if amount_in <= 0 {
            return Err(Error::ZeroAmount);
        }
        let a = Self::addr(&env, DataKey::TokenA);
        let b = Self::addr(&env, DataKey::TokenB);
        let (ra, rb) = Self::reserves(&env);
        if ra == 0 || rb == 0 {
            return Err(Error::InsufficientLiquidity);
        }

        let (in_addr, reserve_in, reserve_out, in_is_a) = if token_in == a {
            (a.clone(), ra, rb, true)
        } else if token_in == b {
            (b.clone(), rb, ra, false)
        } else {
            return Err(Error::UnknownToken);
        };

        let amount_out = Self::amount_out_inner(&env, amount_in, reserve_in, reserve_out)?;
        if amount_out < min_out {
            return Err(Error::SlippageExceeded);
        }
        if amount_out >= reserve_out {
            return Err(Error::InsufficientLiquidity);
        }

        let out_addr = if in_is_a { b } else { a };
        token::TokenClient::new(&env, &in_addr).transfer(&from, &env.current_contract_address(), &amount_in);
        token::TokenClient::new(&env, &out_addr).transfer(&env.current_contract_address(), &from, &amount_out);

        if in_is_a {
            Self::set_reserves(&env, ra + amount_in, rb - amount_out);
        } else {
            Self::set_reserves(&env, ra - amount_out, rb + amount_in);
        }

        env.events().publish((symbol_short!("swap"),), (from, in_addr, amount_in, amount_out));
        Ok(amount_out)
    }

    // ── read-only views ─────────────────────────────────────────────────────

    /// Quote the output for `amount_in` of `token_in` without executing.
    pub fn quote(env: Env, token_in: Address, amount_in: i128) -> Result<i128, Error> {
        if amount_in <= 0 {
            return Err(Error::ZeroAmount);
        }
        let a = Self::addr(&env, DataKey::TokenA);
        let b = Self::addr(&env, DataKey::TokenB);
        let (ra, rb) = Self::reserves(&env);
        let (reserve_in, reserve_out) = if token_in == a {
            (ra, rb)
        } else if token_in == b {
            (rb, ra)
        } else {
            return Err(Error::UnknownToken);
        };
        Self::amount_out_inner(&env, amount_in, reserve_in, reserve_out)
    }

    pub fn get_reserves(env: Env) -> (i128, i128) {
        Self::reserves(&env)
    }

    pub fn shares(env: Env, who: Address) -> i128 {
        env.storage().persistent().get(&DataKey::Shares(who)).unwrap_or(0)
    }

    pub fn fee_bps(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::FeeBps).unwrap()
    }

    pub fn tokens(env: Env) -> (Address, Address) {
        (Self::addr(&env, DataKey::TokenA), Self::addr(&env, DataKey::TokenB))
    }

    // ── internals ───────────────────────────────────────────────────────────

    fn amount_out_inner(env: &Env, amount_in: i128, reserve_in: i128, reserve_out: i128) -> Result<i128, Error> {
        let fee: u32 = env.storage().instance().get(&DataKey::FeeBps).unwrap();
        let amount_in_after_fee = amount_in
            .checked_mul(BPS_DENOM - fee as i128)
            .ok_or(Error::InsufficientLiquidity)?
            / BPS_DENOM;
        let numerator = reserve_out
            .checked_mul(amount_in_after_fee)
            .ok_or(Error::InsufficientLiquidity)?;
        let denominator = reserve_in
            .checked_add(amount_in_after_fee)
            .ok_or(Error::InsufficientLiquidity)?;
        Ok(numerator / denominator)
    }

    fn reserves(env: &Env) -> (i128, i128) {
        let s = env.storage().instance();
        (
            s.get(&DataKey::ReserveA).unwrap_or(0),
            s.get(&DataKey::ReserveB).unwrap_or(0),
        )
    }
    fn set_reserves(env: &Env, a: i128, b: i128) {
        let s = env.storage().instance();
        s.set(&DataKey::ReserveA, &a);
        s.set(&DataKey::ReserveB, &b);
    }
    fn total_shares(env: &Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalShares).unwrap_or(0)
    }
    fn set_total_shares(env: &Env, v: i128) {
        env.storage().instance().set(&DataKey::TotalShares, &v);
    }
    fn addr(env: &Env, key: DataKey) -> Address {
        env.storage().instance().get(&key).unwrap()
    }
    fn token(env: &Env, key: DataKey) -> token::TokenClient<'_> {
        token::TokenClient::new(env, &Self::addr(env, key))
    }
}

fn panic_with(env: &Env, e: Error) -> ! {
    soroban_sdk::panic_with_error!(env, e)
}

/// Integer square root (Newton's method) for the initial LP-share mint.
fn isqrt(n: i128) -> i128 {
    if n <= 0 {
        return 0;
    }
    let mut x = n;
    let mut y = (x + 1) / 2;
    while y < x {
        x = y;
        y = (x + n / x) / 2;
    }
    x
}

mod test;
