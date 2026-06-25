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

## Operational layer — live oracle + liquidation keeper (`eth/lending-keeper`)
The keeper is the money market's backbone (same pattern as the bridge relayer):
1. **Price relay** — fetches the real XLM/USD spot (median of Binance/Coinbase/Kraken)
   and posts it on-chain via `set_price` every 30s. ✅ verified: pushed live $0.1747
   on-chain (`get_market` read it back). USDC pinned to $1. *(Centralized relay;
   Reflector's on-chain oracle is the decentralized drop-in — same data, read trustlessly.)*
2. **Auto-liquidation** — tracks borrowers from `borrow` events, reads each account's
   health, and liquidates any underwater position. Repay is capped by the borrower's
   actual collateral (handles deeply-underwater / bad-debt positions).
   - `GET /health` (status, live prices, recent liquidations) · `POST /check` (one pass now)

### ✅ Verified real liquidation (no mocks) — `eth/lending-keeper/liquidation-demo.mjs`
A fresh borrower supplied 3000 XLM, borrowed 350 USDC (health 1.05). XLM "crashed" to
$0.08 → health **0.48 (underwater)**. The keeper liquidated it on-chain — repaid
**173.25 USDC**, seized XLM at a 5% bonus, dropping the debt $350 → **$176.75**.
- Stellar tx: https://stellar.expert/explorer/testnet/tx/bbc58189ddd8fad9e0873a34d765263c9cc6d25abe6120d04d497296697620c4

## App wiring
- `xorr-core/lib/lending.ts` — client (markets, position, account, rates, supply/withdraw/borrow/repay, keeperHealth).
- Home **Lend** tab (`components/flows/lend-form.tsx`) + **Markets** page (`app/explore/page.tsx`)
  with a live "Keeper live — oracle relay + auto-liquidations" strip.
- `NEXT_PUBLIC_LENDING_ID` / `NEXT_PUBLIC_KEEPER_URL` override the contract id / keeper URL.

## Run / redeploy
- `scripts/deploy_lending.sh` — build wasm, deploy, add the USDC/XLM markets, seed liquidity.
- `./dev-stack.sh` (repo root) — boots the keeper (:8791) alongside the relayer + delivery backend.

## Remaining hardening (noted, not faked)
- **Storage TTL** — persistent entries aren't TTL-extended yet; a long-lived mainnet
  deployment must bump them so positions don't archive.
- **Private positions** — amounts are public on-chain today; hidden collateral/debt with
  ZK solvency proofs is a research-grade upgrade.
