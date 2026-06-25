# XORR Lending — live testnet deployment

A real Compound-style money market on Soroban. Suppliers earn interest; borrowers
post collateral and borrow against it. Interest accrues per second from a
utilization-based rate model; each asset has a collateral factor (LTV); an account
stays solvent while `collateral_value ≥ borrow_value`; undercollateralized accounts
are liquidatable for a 5% bonus.

## Deployed (testnet)
| What | Address |
|---|---|
| Lending money market (admin/oracle = `xorr`) | `CAA65A76UFS5Q6NUEECGV232SDQ7HST5PSAWB6Y4FOZWA5TVZFJIOCL4` |
| USDC market — 85% LTV, 2% base + 20% slope, $1.00 | `CAD7OEAESCGR5XV2BA2AHZCWM6EVJEYBYOOCA3D3ZG4TCOBWWHMZVFIV` |
| XLM market — 70% LTV, 2% base + 30% slope, $0.11 | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |

## ✅ Verified on-chain (no mocks)
1. Supplied **2000 USDC** as liquidity + collateral.
2. **Borrowed 1000 USDC** against it — `borrow` succeeded, the USDC was sent out.
3. State reads back correct:
   - market: cash 1000, **total_borrows 1000**, `borrow_index` advancing as interest accrues, reserves accruing.
   - position: supplied **2000.0001** (earning), debt **1000.0001** (owing) — interest on both sides.
   - account: collateral $1700 (2000 × 85%), borrow $1000, **health 1.70**.
   - rates: **supply 5.40% APY / borrow 12.00% APY** at 50% utilization (exactly base 2% + slope 20% × 0.5).

`contracts/lending` — 4 cargo tests pass (supply/borrow/repay/withdraw, interest
accrual = exact 12% APR over a year, undercollateralized-borrow rejection, liquidation).

## Model (fixed-point, base units = 7 decimals)
- `borrow_index` (1e9) grows with interest; debt = `principal × borrow_index / index_at_borrow`.
- suppliers hold **shares**; exchange rate = `(cash + total_borrows − reserves) / total_shares`.
- prices = USD (7-dec) **per whole token**, set by the admin oracle (`set_price`).
  Reflector / Charli3 is the production oracle upgrade.
- views (`get_market`, `position`, `account`, `rates`) accrue interest to *now*
  without a transaction, so the UI shows live balances.

## App wiring
- `xorr-core/lib/lending.ts` — client (markets, position, account, rates, supply/withdraw/borrow/repay).
- Home **Lend** tab (`components/flows/lend-form.tsx`) + **Markets** page (`app/explore/page.tsx`).
- `NEXT_PUBLIC_LENDING_ID` overrides the contract id (default = the deployment above).

## Redeploy
`scripts/deploy_lending.sh` — build wasm, deploy, add the USDC/XLM markets, seed liquidity.
