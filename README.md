# XORR — Private-by-default money on Stellar

**Shield USDC into unlinkable UTXO notes, pay privately with amounts and counterparties hidden, bridge ETH into shielded notes, and prove every spend in zero knowledge — each one verified on-chain by a BN254 Groth16 contract on Soroban.** Private, *not* anonymous: disclose a view key to an auditor, or prove your reserves clear a threshold, without revealing balances.

Built for the **Real-World ZK on Stellar** hackathon. The ZK is load-bearing: no valid Groth16 proof → no state change. Every shielded action is gated by an on-chain pairing check using Stellar's **Protocol 25 / CAP-0074 native BN254 host functions**.

### What makes XORR a consumer app
- **Pay by email or social handle.** Recipients sign in with Google / X / GitHub / email; a custodial Stellar wallet is generated for them via **Privy** (keys in a TEE) and a **Resend** email lets them claim — no seed phrase, no extension.
- **ETH → Stellar ZK bridge** into private **xUSDC**: lock on Ethereum, claim on Stellar with a Groth16 proof; no on-chain link between deposit and claim.
- **Swaps + pool creator**: a constant-product AMM and a multi-pool factory (including **confidential pools** entered from shielded balances), live on testnet.
- **Consumer UX**: confetti on success, transaction toasts that deep-link to stellar.expert, and on-chain identity (X avatars) — built so an ordinary person can actually use it.

---

## ✅ Proven on-chain (Stellar testnet)

These are **real transactions** where a Groth16 proof was generated off-chain (snarkjs) and **verified on-chain** by our Soroban verifier. Click through:

| What | Evidence |
|------|----------|
| **Shielded deposit** — proof verified, pool state changed (`total_shielded 0 → 0.1 USDC`, `next_leaf 0 → 1`) | [tx `99ac87b1…`](https://stellar.expert/explorer/testnet/tx/99ac87b17b11ed0dbac33d627827640df8b0c15011dee4889deed3b494d1a93b) |
| **Proof of Solvency** (our novel feature) — proves *balance ≥ 0.05 USDC* with the amount hidden; verifier returns `true` | [tx `0dea9e49…`](https://stellar.expert/explorer/testnet/tx/0dea9e498d4aa995c53c8dbd3f394565ab17011a3c676dbe9ebdf12c92aae99c) |
| Verifying keys installed (Deposit / Transfer / Withdraw) | [`ecc0218c`](https://stellar.expert/explorer/testnet/tx/ecc0218c8601177f1b85c98b6aa8c286cc5b959da2499931fa80dba8c4e18b43) · [`183e555c`](https://stellar.expert/explorer/testnet/tx/183e555c81ae53e90c8be07c5916d3fb62579696f6d4c3c114b66a496303fafc) · [`9e1653ce`](https://stellar.expert/explorer/testnet/tx/9e1653cedcfa79f330d2116ebd023487567c55a47571560c6ac38c62402c8a03) |

If the proof were invalid the pool returns `Error::InvalidProof` and nothing changes — so the state transition **is** the proof of verification.

## Live deployment (our own keys)

| Contract | ID |
|----------|----|
| Privacy pool (deposit/transfer/withdraw, VKs installed) | `CCOAVXD4JBF4OKR34H3WNL54GJNK7UCSOJSPU3C44OIKIVW2YOFD7TPX` |
| BN254 Groth16 verifier (generic, stateless) | `CC46C65SFSA2QNNGZRRXAYTDB4S6V4MB52MGDBZC5A6NI3QG5H4L2FO2` |
| Test USDC (Stellar Asset Contract) | `CAD7OEAESCGR5XV2BA2AHZCWM6EVJEYBYOOCA3D3ZG4TCOBWWHMZVFIV` |
| **AMM** (constant-product swaps, USDC↔XLM) | `CD6W7BAZ7DBZB7ZAKLNCSQYQOAFKV36PGZZEGZAUSG3QIFYR3356VL4N` |
| **Pool factory** (multi-pool + confidential pools) | `CADU5RQBNEDPIRLGWOEC62EIGAV6V54KGITMGJ52R2ODT6EUBM66NP55` |
| Admin / depositor | `GBKZC3N4UVFZ54CAM7I26NWIDQLQJVPPUVDNLDBAS5PC3BAUA3GYOYXR` |

**Live swap proof:** seeded the AMM (100 USDC + 500 XLM) and executed an on-chain swap of 10 USDC → 45.33 XLM — [tx `b58d466f…`](https://stellar.expert/explorer/testnet/tx/b58d466fb276769366f2378dee5144b147e4279447ce419a83fdb681da9f1b41) (deploy [`fd4dcf83…`](https://stellar.expert/explorer/testnet/tx/fd4dcf8314fb2d3bb16d31d28e91ba32c15727f695c769a929942414973da909)). 7 `cargo test` cases cover the curve, slippage guard, and k-invariant.

---

## The three projects

| Project | What | Stack |
|---------|------|-------|
| [`xorr-core`](./xorr-core) | The shielded wallet: dashboard, deposit, send, receive, withdraw, bridge, off-ramp, compliance, **solvency**, faucet. | Next.js · Freighter · wagmi · snarkjs · circomlibjs |
| [`xorr-stellar-contracts`](./xorr-stellar-contracts) | On-chain side — Soroban contracts (BN254 verifier, privacy pool, bridge) + Circom circuits (`deposit`, `transfer`, `withdraw`, `disclose`, **`solvency`**). | Rust/Soroban · Circom · snarkjs |
| [`xorr-landing-page`](./xorr-landing-page) | Marketing site — the story, bento features, an interactive ZK-prover sandbox. | Next.js · Tailwind · Framer Motion |

## How the ZK works

```
deposit   : prove a commitment opens to a public amount, inserted old_root → new_root   (amount public, owner hidden)
transfer  : prove 2 inputs ∈ tree, nullifiers valid, value conserved, 2 outputs inserted (amounts + link hidden)
withdraw  : prove 1 input ∈ tree, nullifier valid, in == amount + change, recipient bound
solvency  : prove ownership of a note ∈ tree worth ≥ threshold, WITHOUT revealing the amount   ← new
```

**The contract never hashes.** All Poseidon / Merkle work lives in the Circom circuits; the Soroban contracts only (1) verify a Groth16 proof via `env.crypto().bn254().pairing_check`, and (2) keep the books — Merkle root, nullifier set, value accounting, token custody.

Note scheme (UTXO):

```
pk         = Poseidon(sk)
commitment = Poseidon(amount, pk, blinding)   # stored in the Merkle tree
nullifier  = Poseidon(commitment, sk)         # revealed on spend, unlinkable
```

## 🌟 Novel feature: Proof of Solvency

A **confidential "proof of funds"** for real-world finance — an OTC desk, loan collateral, or an accredited-investor gate. The holder proves they control a shielded note worth **at least a threshold** without revealing the actual amount or which note. Public signals are only `[root, threshold, nullifier]`; the amount stays inside the circuit.

- Circuit: [`circuits/src/solvency.circom`](./xorr-stellar-contracts/circuits/src/solvency.circom) — reuses the same note / Merkle templates as the pool, adds a `GreaterEqThan(amount, threshold)` constraint.
- On-chain: calls the **existing generic verifier directly** (`verify_proof(vk, proof, pub_signals)`) — no pool change, no extra contract. Verified live in [tx `0dea9e49`](https://stellar.expert/explorer/testnet/tx/0dea9e498d4aa995c53c8dbd3f394565ab17011a3c676dbe9ebdf12c92aae99c).
- In-app: the [Solvency page](./xorr-core/app/solvency/page.tsx) generates the proof in-browser and verifies it on-chain (read-only simulation, no gas).

## Quickstart

```bash
# 1. The app — already wired to the live testnet deployment (xorr-core/.env.local)
cd xorr-core && npm install --legacy-peer-deps && npm run dev   # http://localhost:3000
#    npm test          → 26 unit tests (note scheme / Merkle / NaCl crypto)
#    npm run typecheck → tsc --noEmit (clean)

# 2. Reproduce the ZK pipeline from scratch (needs circom 2.x + stellar CLI)
cd xorr-stellar-contracts/circuits && pnpm install && pnpm build   # circuits + trusted setup
cd .. && scripts/deploy_xorr.sh                                    # deploy under your key + set VKs
#    then: bash scripts/deploy_and_test.sh   # real deposit proof verified on-chain
```

The wallet needs the **Freighter** extension (Stellar). Proving artifacts are committed under [`xorr-core/public/circuits/`](./xorr-core/public/circuits) so in-browser proving works out of the box.

## What we built vs. what we reused (honest attribution)

This project is a **mix** — assembled from existing work and substantially extended during the hackathon. Being explicit:

**Reused as a base (credit to the original authors):**
- The wallet/landing **UI shells** originate from the `nickthelegend/xorr-*` repos (design system, components).
- The **ShieldedBridge** Soroban contracts + core Circom circuits (`deposit`/`transfer`/`withdraw`/`disclose`) and the wallet's crypto lib come from the `stellar-privacy` reference implementation.

**Built / done by us for this submission:**
- A **fresh, reproducible deployment under our own keys** (new verifier + pool + USDC, VKs installed) — see the tx evidence above. Earlier deployments belonged to a collaborator; this stack is ours.
- The **Proof-of-Solvency** feature end-to-end: the [`solvency.circom`](./xorr-stellar-contracts/circuits/src/solvency.circom) circuit, its trusted-setup wiring, the [`lib/solvency.ts`](./xorr-core/lib/solvency.ts) prover + on-chain verifier call, and the [Solvency app page](./xorr-core/app/solvency/page.tsx).
- Porting the Vite wallet lib into **Next.js** (`xorr-core`), Node polyfills for snarkjs/circomlibjs/stellar-sdk, shared wallet provider, and all 9 wallet pages.
- A **26-test unit suite** + clean `tsc` typecheck, QR receive codes, persisted activity log, and the fetch-based [`deploy_xorr.sh`](./xorr-stellar-contracts/scripts/deploy_xorr.sh).

Nothing here claims the underlying ShieldedBridge cryptography as original work — our contribution is the Stellar deployment we own, the solvency feature, the Next.js app, and the tests.

## 2–3 min demo script

1. **Open the app** → dashboard: "shielded USDC on Stellar, every spend proven in ZK, verified on-chain by a BN254 Groth16 contract." Note the live pool card.
2. **Deposit** → connect Freighter, faucet some test USDC, shield `0.1`. The browser generates a Groth16 proof (snarkjs) and submits `pool.deposit`. Open the tx on stellar.expert → show `verify_proof` ran and `total_shielded` increased. *The ZK is doing real work.*
3. **Proof of Solvency** → set threshold `0.05`, click *Prove & verify on-chain*. The app proves `balance ≥ 0.05` with the amount hidden, and the BN254 verifier returns `true`. Explain the real-world hook: confidential proof-of-funds for regulated finance.
4. **Why Stellar** → the verifier uses Protocol 25's native BN254 host functions (`env.crypto().bn254().pairing_check`), making on-chain SNARK verification cheap — the exact capability this hackathon exists to showcase.

## Submission checklist

- [x] **Open-source repo** with a clear README (this).
- [x] **ZK + Stellar, load-bearing** — Groth16 proofs verified in a Soroban contract; state changes gated on `verify_proof`. Evidence txs above.
- [x] Live on testnet with reproducible deploy scripts.
- [ ] **2–3 min demo video** (script above) — record before the June 29 deadline.

_Stellar · Protocol 25 (CAP-0074 BN254 + Poseidon host functions) · testnet, not audited._
