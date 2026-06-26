# Xorr — Stellar Contracts

**Private-by-default USDC on Stellar — Moonlight-style shielded UTXO notes + a ZK ETH↔Stellar bridge, with on-chain BN254 Groth16 verification on Soroban.**

Xorr lets you shield public USDC into hidden notes, send value privately (amounts
and the sender↔receiver link hidden), bridge ETH-locked value into shielded
Stellar notes, and unshield back to a public address — while still supporting
**compliant selective disclosure** via a viewing key. Every spend is proven in
zero knowledge and **verified on-chain** by a Soroban contract.

Privacy model = **private, not anonymous** (à la Moonlight): amounts, senders,
receivers, and balances are hidden on-chain, but a holder can disclose a **view
key** to an auditor for compliance.

> This repository is **contracts-only**: the Soroban (Rust) contracts, the Circom
> ZK circuits + snarkjs pipeline, and the Ethereum lock contract. There is no web
> UI here.

---

## Why this is real ZK on Stellar

As of **Protocol 25** (live on testnet Jan 2026), Stellar ships **CAP-0074 (BN254
elliptic-curve host functions)** and **CAP-0075 (Poseidon host functions)** —
feature parity with Ethereum's BN254 precompiles. Xorr is built squarely on these:

- The on-chain **Groth16 verifier** uses `env.crypto().bn254().pairing_check(...)`.
- Circuits compile to **BN254** (circom's default), so the **same Poseidon and the
  same field** are used by the circuits, the client-side tree-builder, and the
  on-chain verifier. No cross-field conversion — the proof pipeline lines up
  end-to-end.

This was a deliberate design decision: an earlier BLS12-381 design (the curve of
the older official example) forces a Poseidon field mismatch between circom/snarkjs
(BN254-native) and the verifier. BN254 removes that entire class of bugs.

## Core idea — the contract never hashes

All Poseidon/Merkle work lives **inside the circuits**. The Soroban contracts only:

1. **verify a Groth16 proof** over BN254 (host-accelerated pairing), and
2. enforce **application bookkeeping**: the current Merkle root, the nullifier set
   (double-spend protection), value accounting, and token custody.

Every state-changing op proves its transition against the **current root**
(`old_root == current_root`, enforced like a nonce) and submits the resulting
`new_root`. This keeps circuits small enough for in-browser proving and keeps the
contract cheap and auditable. (A `RootHistory` window is tracked for indexing/UX;
production would decouple membership roots from the insertion root via a rolling
window.)

```
 deposit   : prove  commitment opens to a public `amount`, inserted old_root→new_root
 transfer  : prove  2 inputs ∈ tree, nullifiers valid, in==out, 2 outputs inserted   (amounts hidden)
 withdraw  : prove  1 input ∈ tree, nullifier valid, in == amount+change, recipient bound
 bridge_in : relayer-attested ETH lock → same statement as deposit, backed by bridge liquidity
```

## Note scheme (UTXO model, Moonlight / Nethermind-aligned)

A **note** is `(amount, sk, blinding)`, owned by spend key `sk`:

```
pk         = Poseidon(sk)                       # matches Nethermind keypair.circom
commitment = Poseidon(amount, pk, blinding)     # stored in the commitment Merkle tree
nullifier  = Poseidon(commitment, sk)           # revealed on spend (unlinkable)
```

Only `commitment`s ever enter the tree; spends publish only the `nullifier`, and
the on-chain nullifier set guarantees each note is spent at most once.

**UTXO accounts:** a single master key controls a *constellation* of unlinkable
notes, each under a freshly derived key `spendKey(i) = Poseidon(master, i)`, with a
separate `viewKey = Poseidon(master, 0)` for compliance disclosure. The whole
wallet is recoverable from the master alone.

## Public-signal layouts (contract `Vec<Fr>` ⇄ circuit public inputs)

The contract builds these `Vec<Fr>` from its typed arguments in **exactly** this
order and passes them to the verifier; the circuit declares the same public inputs.

| Op | Public signals (in order) |
|----|---------------------------|
| `deposit` / `bridge` | `[old_root, new_root, commitment, amount]` |
| `transfer` | `[old_root, new_root, nullifier_a, nullifier_b, out_cmt_a, out_cmt_b]` |
| `withdraw` | `[old_root, new_root, nullifier, change_commitment, amount, recipient_field]` |

`recipient_field` binds the withdraw recipient: `fr_from_tag(keccak256(addr.to_xdr))`
with the top byte masked to 251 bits so the result is always `< r` (the BN254 scalar
field order). The contract and the circuit apply the identical mask, so the recipient
cannot be substituted after proving.

### Point / field encodings (BN254, CAP-0074)

| Type | Bytes | Layout |
|------|-------|--------|
| `Bn254Fp` / `Fr` | 32 | big-endian |
| `Bn254G1Affine` | 64 | `be(X) ‖ be(Y)` |
| `Bn254G2Affine` | 128 | `be(X) ‖ be(Y)`, each `Fp2 = be(c1) ‖ be(c0)` (imaginary first, EIP-197 order; snarkjs lists `[c0,c1]` so the exporter swaps) |

## Repository layout

| Path | What |
|------|------|
| `contracts/verifier` | BN254 Groth16 verifier (CAP-0074). Single-purpose, audit-isolated. |
| `contracts/privacy-pool` | The shielded pool: `deposit` / `transfer` / `withdraw` / `mint_note`, nullifier set, root history, accounting, token custody. |
| `contracts/bridge` | ETH→Stellar bridge: relayer-attested, nonce replay-protected, mints into the pool. |
| `contracts/amm` | Constant-product AMM (`x·y=k`) — public swaps + the venue a `private_swap` routes through. |
| `contracts/pool-factory` | Multi-pool factory: create + index any token pair, including **confidential pools**. |
| `contracts/lending` | Compound-style money market: supply/borrow/repay/withdraw/liquidate, utilization interest, health factor, price oracle. |
| `contracts/zk-interface` | Shared `Proof` / `VerificationKey` types + the `#[contractclient]` verifier and minter interfaces + `Fr` encoding helpers. |
| `contracts/mock-verifier` | Test double (configurable `verify_proof` result) for deterministic contract tests. |
| `circuits/src` | Circom circuits: `note`, `merkle`, `deposit`, `transfer`, `withdraw`, `disclose` (selective disclosure). |
| `circuits/scripts` | snarkjs build/setup (`build.sh`), Soroban VK exporter (`export-vk.mjs`), empty-root + input/arg helpers, an on-chain transfer test. |
| `circuits/test` | Crypto + e2e proof tests (`merkle`, `e2e`, `disclose`). |
| `eth/contracts` | `ShieldedBridgeLock.sol` (ERC-20) + `ShieldedBridgeLockNative.sol` (native ETH); each emits `Locked(nonce, amount, commitment, from)`. |
| `eth/script`, `eth/scripts` | Foundry deploy script + a solc-js deploy-and-lock script. |
| `scripts/` | `install-tools.sh`, `deploy_testnet.sh`, `deploy_and_test.sh`, `deploy_full.sh`. |

> Note: the Soroban contract crate names (`verifier`, `privacy-pool`, `bridge`,
> `zk-interface`, `mock-verifier`), the Solidity contract names
> (`ShieldedBridgeLock`, `ShieldedBridgeLockNative`), and all module/struct/function
> identifiers are kept exactly as in the source so the circuit/contract wiring and
> ABI are unchanged. Only human-facing prose is branded "Xorr".

## Contracts at a glance

- **`verifier`** — `verify_proof(vk, proof, pub_signals) -> bool`. Computes
  `vk_x = ic[0] + Σ pub_signals[i]·ic[i+1]` and returns
  `e(-A, B)·e(alpha, beta)·e(vk_x, gamma)·e(C, delta) == 1` via the host pairing
  check. Errors if `pub_signals.len() + 1 != vk.ic.len()`.
- **`privacy-pool`** — constructor takes `(admin, token, verifier, empty_root)`.
  Admin installs per-circuit verifying keys (`set_vk`) and authorizes the bridge
  minter (`set_minter`). Ops: `deposit`, `transfer`, `withdraw`, `mint_note`, and
  `private_swap` (spend a shielded note and route it through the AMM venue set via
  `set_swap_venue`). Enforces `old_root == current_root` (stale-root rejection),
  per-nullifier double-spend rejection, value accounting (`total_shielded`), and SAC
  token flow.
- **`bridge`** — constructor `(admin, pool, token)`. `set_relayer` authorizes the
  cross-chain relayer; `bridge_in(eth_nonce, amount, commitment, old_root, new_root,
  proof)` marks the Ethereum `nonce` single-use, moves the bridge's pre-funded
  liquidity into the pool, then calls `pool.mint_note` (proof verified on-chain).
- **`amm`** — a constant-product (`x·y=k`) AMM: `swap` (with a `min_out` slippage
  guard + the `k`-invariant enforced) and `add_liquidity`. Powers public swaps and is
  the venue a shielded `private_swap` routes through.
- **`pool-factory`** — deploys and indexes many AMM pools over arbitrary token pairs,
  including **confidential pools**; backs the wallet's pool creator + swap UI.
- **`lending`** — a Compound-style money market: `supply` / `withdraw` / `borrow` /
  `repay` / `liquidate`, per-second utilization interest, per-asset collateral factor,
  a real-time health factor, and an admin/oracle `set_price`. An off-chain keeper
  relays CEX prices and liquidates underwater positions on-chain.

## Build / test / deploy

```bash
# 0. Tools — Rust + wasm32v1-none target, Stellar CLI, circom
make tools

# 1. Build + test the Soroban contracts (no external services needed)
cd contracts && cargo test                       # contract + bookkeeping tests
cargo build --target wasm32v1-none --release     # verifier / pool / bridge wasm

# 2. Circuit crypto test (BN254 Poseidon Merkle — no circom needed)
cd ../circuits && pnpm install && pnpm test

# 3. Compile circuits + trusted setup (needs circom), then export Soroban VKs
pnpm build      # -> build/*.zkey, build/*_js/*.wasm, build/*.vk.soroban.json

# 4. Build the Ethereum lock (needs Foundry)
cd ../eth && forge install OpenZeppelin/openzeppelin-contracts foundry-rs/forge-std
forge build

# 5. Deploy to Stellar testnet + wire verifier/pool/bridge + install VKs
cd .. && scripts/deploy_testnet.sh
```

Top-level `make` targets: `tools`, `build`, `test`, `wasm`, `circuits`,
`eth-build`, `deploy`, `clean`.

### Regenerating circuit artifacts (not committed)

`*.ptau`, `*.zkey`, `*.r1cs`, compiled `*_js/` witness generators, and the build
directory are **not** committed (they are large and reproducible). Regenerate them:

```bash
cd circuits && pnpm install && pnpm build
```

`pnpm build` compiles each circuit with circom over BN254 (`bn128`), runs a demo
Groth16 trusted setup (Phase-1 powers-of-tau + per-circuit Phase-2), and writes the
Soroban-encoded verifying keys via `scripts/export-vk.mjs`. The JS `powersoftau`
for `2^17` is slow — for the larger `transfer`/`withdraw` circuits prefer the Hermez
ceremony ptau (`powersOfTau28_hez_final_17.ptau`) dropped into `build/` as
`pot_final.ptau`.

### Deploy scripts

- `scripts/deploy_testnet.sh [identity]` — full wiring: deploy `verifier` →
  `privacy-pool` → `bridge`, deploy a test USDC SAC, install all four VKs, fund the
  bridge, set minter + relayer.
- `scripts/deploy_and_test.sh` — deploy + verify a **real** Groth16 proof on-chain
  by running the deposit proof through `pool.deposit` (token pulled in → proof
  verified on-chain → note inserted).
- `scripts/deploy_full.sh` — fresh pool + bridge + all four VKs + liquidity, then a
  real `bridge_in` for a Sepolia lock (closes the ETH→Stellar loop on-chain).
- `circuits/scripts/onchain-transfer-test.mjs` — deploy a fresh pool, deposit A +
  deposit B, then a 2-in/2-out `transfer` verified on-chain (asserts nullifiers
  spent + value conserved).

> The deploy scripts use a Stellar CLI identity named `shieldedbridge` and write a
> `frontend/.env.local` for the companion wallet UI (which lives outside this
> contracts-only repo); those writes are harmless no-ops here.

## Security model (honest)

- **Soundness**: value can't be created — deposits add backing, transfers conserve
  value in-circuit, withdrawals decrement backing; the on-chain nullifier set
  prevents double-spends; insertions enforce `oldLeaf == 0` so notes can't be
  overwritten.
- **Privacy**: amounts and the input/output linkage are hidden by the commitments;
  spends reveal only an unlinkable nullifier.
- **Bridge trust**: cross-chain *observation* is attested by a relayer in this MVP;
  *shielded-note correctness* is fully ZK on Stellar. The relayer is replaceable by
  a trustless Ethereum state proof verified by the same Groth16 machinery — the
  `bridge_in` interface doesn't change.
- **Compliance**: a holder can disclose a **viewing key** to an auditor (ASP-style
  selective disclosure, `circuits/src/disclose.circom`) without exposing spend
  authority or deanonymizing the pool.
- Not audited. Testnet only.

## Acknowledgements / references

Inspired by **Moonlight** (UTXO notes on Stellar) and **Nethermind's
stellar-private-payments** (privacy pool + ASP compliance). Built on the official
Stellar ZK skill, `soroban-examples/groth16_verifier`, CAP-0074 / CAP-0075, circom,
and snarkjs.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for diagrams and data flow.

_License: Apache-2.0._
