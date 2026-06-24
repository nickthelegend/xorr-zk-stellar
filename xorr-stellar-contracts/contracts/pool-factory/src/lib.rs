#![no_std]
//! XORR Pool Factory — a multi-pool constant-product AMM in a single contract.
//!
//! Anyone can `create_pool(token_a, token_b, fee_bps, confidential)`; each pool
//! keeps its own reserves/LP shares. This powers the in-app **Swap pool creator**.
//!
//! `confidential` is a flag describing how the pool is *used*: a confidential
//! pool is entered/exited from the XORR shielded balance (withdraw → swap →
//! deposit), so a trader's swaps are unlinkable to their identity. The on-chain
//! math is identical; the flag drives the UI flow and lets indexers/LPs opt in.
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, Env,
};

const BPS_DENOM: i128 = 10_000;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    ZeroAmount = 1,
    InsufficientLiquidity = 2,
    UnknownToken = 3,
    SlippageExceeded = 4,
    InsufficientShares = 5,
    BadFee = 6,
    IdenticalTokens = 7,
    PoolExists = 8,
    NoSuchPool = 9,
    ImbalancedDeposit = 10,
}

#[contracttype]
#[derive(Clone)]
pub struct Pool {
    pub token_a: Address,
    pub token_b: Address,
    pub fee_bps: u32,
    pub reserve_a: i128,
    pub reserve_b: i128,
    pub total_shares: i128,
    pub confidential: bool,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Count,
    Pool(u32),
    Pair(Address, Address),
    Shares(u32, Address),
}

#[contract]
pub struct PoolFactory;

#[contractimpl]
impl PoolFactory {
    pub fn __constructor(env: Env) {
        env.storage().instance().set(&DataKey::Count, &0u32);
    }

    /// Create a new pool for `token_a`/`token_b`. Returns the pool id.
    pub fn create_pool(
        env: Env,
        creator: Address,
        token_a: Address,
        token_b: Address,
        fee_bps: u32,
        confidential: bool,
    ) -> Result<u32, Error> {
        creator.require_auth();
        if token_a == token_b {
            return Err(Error::IdenticalTokens);
        }
        if fee_bps >= BPS_DENOM as u32 {
            return Err(Error::BadFee);
        }
        if Self::find_pool(env.clone(), token_a.clone(), token_b.clone()).is_some() {
            return Err(Error::PoolExists);
        }
        let id: u32 = env.storage().instance().get(&DataKey::Count).unwrap_or(0);
        let pool = Pool {
            token_a: token_a.clone(),
            token_b: token_b.clone(),
            fee_bps,
            reserve_a: 0,
            reserve_b: 0,
            total_shares: 0,
            confidential,
        };
        env.storage().persistent().set(&DataKey::Pool(id), &pool);
        env.storage().persistent().set(&DataKey::Pair(token_a.clone(), token_b.clone()), &id);
        env.storage().persistent().set(&DataKey::Pair(token_b, token_a), &id);
        env.storage().instance().set(&DataKey::Count, &(id + 1));
        env.events().publish((symbol_short!("new_pool"),), (id, creator, confidential));
        Ok(id)
    }

    pub fn add_liquidity(
        env: Env,
        pool_id: u32,
        from: Address,
        amount_a: i128,
        amount_b: i128,
    ) -> Result<i128, Error> {
        from.require_auth();
        if amount_a <= 0 || amount_b <= 0 {
            return Err(Error::ZeroAmount);
        }
        let mut p = Self::load(&env, pool_id)?;

        let minted = if p.total_shares == 0 {
            isqrt(amount_a.checked_mul(amount_b).ok_or(Error::InsufficientLiquidity)?)
        } else {
            let expect_b = amount_a.checked_mul(p.reserve_b).ok_or(Error::InsufficientLiquidity)? / p.reserve_a;
            if (expect_b - amount_b).abs() > 1 + expect_b / 1000 {
                return Err(Error::ImbalancedDeposit);
            }
            let sa = amount_a.checked_mul(p.total_shares).ok_or(Error::InsufficientLiquidity)? / p.reserve_a;
            let sb = amount_b.checked_mul(p.total_shares).ok_or(Error::InsufficientLiquidity)? / p.reserve_b;
            sa.min(sb)
        };
        if minted <= 0 {
            return Err(Error::InsufficientLiquidity);
        }

        token::TokenClient::new(&env, &p.token_a).transfer(&from, &env.current_contract_address(), &amount_a);
        token::TokenClient::new(&env, &p.token_b).transfer(&from, &env.current_contract_address(), &amount_b);

        p.reserve_a += amount_a;
        p.reserve_b += amount_b;
        p.total_shares += minted;
        Self::save(&env, pool_id, &p);
        let bal = Self::shares(env.clone(), pool_id, from.clone());
        env.storage().persistent().set(&DataKey::Shares(pool_id, from), &(bal + minted));
        Ok(minted)
    }

    pub fn remove_liquidity(env: Env, pool_id: u32, from: Address, shares: i128) -> Result<(i128, i128), Error> {
        from.require_auth();
        if shares <= 0 {
            return Err(Error::ZeroAmount);
        }
        let bal = Self::shares(env.clone(), pool_id, from.clone());
        if shares > bal {
            return Err(Error::InsufficientShares);
        }
        let mut p = Self::load(&env, pool_id)?;
        let out_a = p.reserve_a * shares / p.total_shares;
        let out_b = p.reserve_b * shares / p.total_shares;
        p.reserve_a -= out_a;
        p.reserve_b -= out_b;
        p.total_shares -= shares;
        Self::save(&env, pool_id, &p);
        env.storage().persistent().set(&DataKey::Shares(pool_id, from.clone()), &(bal - shares));

        token::TokenClient::new(&env, &p.token_a).transfer(&env.current_contract_address(), &from, &out_a);
        token::TokenClient::new(&env, &p.token_b).transfer(&env.current_contract_address(), &from, &out_b);
        Ok((out_a, out_b))
    }

    pub fn swap(
        env: Env,
        pool_id: u32,
        from: Address,
        token_in: Address,
        amount_in: i128,
        min_out: i128,
    ) -> Result<i128, Error> {
        from.require_auth();
        if amount_in <= 0 {
            return Err(Error::ZeroAmount);
        }
        let mut p = Self::load(&env, pool_id)?;
        if p.reserve_a == 0 || p.reserve_b == 0 {
            return Err(Error::InsufficientLiquidity);
        }
        let in_is_a = token_in == p.token_a;
        if !in_is_a && token_in != p.token_b {
            return Err(Error::UnknownToken);
        }
        let (reserve_in, reserve_out) = if in_is_a {
            (p.reserve_a, p.reserve_b)
        } else {
            (p.reserve_b, p.reserve_a)
        };
        let amount_out = amount_out(p.fee_bps, amount_in, reserve_in, reserve_out)?;
        if amount_out < min_out {
            return Err(Error::SlippageExceeded);
        }
        if amount_out >= reserve_out {
            return Err(Error::InsufficientLiquidity);
        }
        let out_token = if in_is_a { p.token_b.clone() } else { p.token_a.clone() };
        token::TokenClient::new(&env, &token_in).transfer(&from, &env.current_contract_address(), &amount_in);
        token::TokenClient::new(&env, &out_token).transfer(&env.current_contract_address(), &from, &amount_out);
        if in_is_a {
            p.reserve_a += amount_in;
            p.reserve_b -= amount_out;
        } else {
            p.reserve_b += amount_in;
            p.reserve_a -= amount_out;
        }
        Self::save(&env, pool_id, &p);
        env.events().publish((symbol_short!("swap"),), (pool_id, from, amount_in, amount_out));
        Ok(amount_out)
    }

    // ── views ────────────────────────────────────────────────────────────────
    pub fn quote(env: Env, pool_id: u32, token_in: Address, amount_in: i128) -> Result<i128, Error> {
        if amount_in <= 0 {
            return Err(Error::ZeroAmount);
        }
        let p = Self::load(&env, pool_id)?;
        let (reserve_in, reserve_out) = if token_in == p.token_a {
            (p.reserve_a, p.reserve_b)
        } else if token_in == p.token_b {
            (p.reserve_b, p.reserve_a)
        } else {
            return Err(Error::UnknownToken);
        };
        amount_out(p.fee_bps, amount_in, reserve_in, reserve_out)
    }

    pub fn get_pool(env: Env, pool_id: u32) -> Result<Pool, Error> {
        Self::load(&env, pool_id)
    }

    pub fn pool_count(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Count).unwrap_or(0)
    }

    pub fn find_pool(env: Env, token_a: Address, token_b: Address) -> Option<u32> {
        env.storage().persistent().get(&DataKey::Pair(token_a, token_b))
    }

    pub fn shares(env: Env, pool_id: u32, who: Address) -> i128 {
        env.storage().persistent().get(&DataKey::Shares(pool_id, who)).unwrap_or(0)
    }

    // ── internals ─────────────────────────────────────────────────────────────
    fn load(env: &Env, pool_id: u32) -> Result<Pool, Error> {
        env.storage().persistent().get(&DataKey::Pool(pool_id)).ok_or(Error::NoSuchPool)
    }
    fn save(env: &Env, pool_id: u32, p: &Pool) {
        env.storage().persistent().set(&DataKey::Pool(pool_id), p);
    }
}

fn amount_out(fee_bps: u32, amount_in: i128, reserve_in: i128, reserve_out: i128) -> Result<i128, Error> {
    let after_fee = amount_in
        .checked_mul(BPS_DENOM - fee_bps as i128)
        .ok_or(Error::InsufficientLiquidity)?
        / BPS_DENOM;
    let num = reserve_out.checked_mul(after_fee).ok_or(Error::InsufficientLiquidity)?;
    let den = reserve_in.checked_add(after_fee).ok_or(Error::InsufficientLiquidity)?;
    Ok(num / den)
}

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
