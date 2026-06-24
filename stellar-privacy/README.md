# 🛡️ ShieldedBridge

**Private-by-default USDC on Stellar — Moonlight-style shielded UTXO notes + a ZK ETH↔Stellar bridge, with on-chain Groth16 verification on Soroban.**

> Submission for **Stellar Hacks: Real-World ZK**. ShieldedBridge lets you shield
> public USDC into hidden notes, send value privately (amounts and the
> sender↔receiver link hidden), bridge ETH-locked value into shielded Stellar
> notes, and unshield back to a public address — while still supporting
> **compliant selective disclosure** via a viewing key. Every spend is proven in
> zero knowledge and **verified on-chain** by a Soroban contract.

---

## 🟢 Live on Stellar testnet (verified end-to-end)

A real Groth16 proof is verified **on-chain** by the deployed BN254 verifier, and a
full shielded **deposit** (token pulled in → proof verified → note inserted) has been
executed on testnet:

| Contract | ID |
|----------|----|
| Privacy pool (all 4 VKs + bridge) | [`CDZENDZMVLPGVBPQXWIWIJJED3GD5AH33SIWCU2GFUEHGM5GIS5S6WYU`](https://stellar.expert/explorer/testnet/contract/CDZENDZMVLPGVBPQXWIWIJJED3GD5AH33SIWCU2GFUEHGM5GIS5S6WYU) |
| ETH→Stellar bridge | [`CB72RP6QVTRBOYMBR7TA6M2QIGQSNBTS4NNVOQH777C6TGBW5MX3CRLB`](https://stellar.expert/explorer/testnet/contract/CB72RP6QVTRBOYMBR7TA6M2QIGQSNBTS4NNVOQH777C6TGBW5MX3CRLB) |
| Groth16 verifier (BN254) | [`CCHSKQ2ZAEVIZ5KXZIB4NJI363NHFIARIUWJP47KSCY6CTENSPL33IQW`](https://stellar.expert/explorer/testnet/contract/CCHSKQ2ZAEVIZ5KXZIB4NJI363NHFIARIUWJP47KSCY6CTENSPL33IQW) |
| Test USDC (SAC) | `CB2JO4FJH5NUU7Y2PHQ27H35DIOHQZDMCLFP6BSHGVZA2VDM4472MQXA` |
| ETH lock (Sepolia) | [`0x3E48BDF44BD676D3F8cCb796138bBDcDA17e4F25`](https://sepolia.etherscan.io/address/0x3E48BDF44BD676D3F8cCb796138bBDcDA17e4F25) |

- ✅ `verify_proof(real proof)` on-chain → **`true`**; tampered public signal → **`false`** (soundness).
- ✅ Deposit through the pool (tx [`9f46c1a3…`](https://stellar.expert/explorer/testnet/tx/9f46c1a36984bc35e0acce9867d10af8dcd7b4ae7272fc8ab2aa4ac673c882ee)):
  0.1 USDC shielded, proof verified on-chain.
- ✅ **Private payment on-chain**: deposit + deposit → 2-in/2-out `transfer` with the
  proof verified on-chain; both input nullifiers spent, value conserved, 2 new shielded
  notes created (pool `CC3RRJJ7…`). Repro: `cd circuits && node scripts/onchain-transfer-test.mjs`.
- ✅ **Full ETH→Stellar bridge**: real [Sepolia lock](https://sepolia.etherscan.io/tx/0x10809c8979a8757c83c12a7d56030234f862315664fe7b484ab95957824a0780)
  (0.001 ETH, nonce 0, commitment `0x1c484cca…`) → `bridge_in` on Stellar verified the
  proof on-chain and minted the note (`total_shielded = 1000000`, `next_leaf = 1`);
  replayed nonce rejected (`NonceAlreadyUsed`).
- ✅ **Timed e2e ZK test** (`cd circuits && node --test 'test/*.test.mjs'`): UTXO
  accounts + private 2-in/2-out transfer + withdraw with real proofs. Prove
  ~2.3 / 5.7 / 3.3 s; verify ~20–33 ms.

Reproduce: `scripts/deploy_and_test.sh` (deposit) and `scripts/deploy_full.sh` (pool+bridge+all VKs+bridge_in).

## UTXO accounts (Moonlight / Nethermind-aligned)

Studied from the cloned reference `packages/stellar-private-payments` (Nethermind):
pool + ASP membership/non-membership trees, `keypair.circom`
(`publicKey = Poseidon(privateKey)`), selective-disclosure circuit, Poseidon2.

ShieldedBridge implements the **UTXO account** model: a single master key controls a
*constellation* of unlinkable notes, each under a freshly derived key
(`spendKey(i) = Poseidon(master, i)`), with a separate `viewKey = Poseidon(master, 0)`
for compliance disclosure. The whole wallet is recoverable from the master alone.

---

## Why this is real ZK on Stellar

As of **Protocol 25 (live on testnet Jan 2026, mainnet Jan 2026)**, Stellar ships
**CAP-0074 (BN254 elliptic-curve host functions)** and **CAP-0075 (Poseidon
host functions)** — feature parity with Ethereum's BN254 precompiles. ShieldedBridge
is built squarely on these:

- The on-chain **Groth16 verifier** uses `env.crypto().bn254().pairing_check(...)`.
- Circuits compile to **BN254** (circom's default), so the **same Poseidon and
  the same field** are used by the circuits, the in-browser tree-builder, and
  the on-chain verifier. No cross-field conversion — the proof pipeline lines up
  end-to-end.

This was a deliberate design decision: an earlier BLS12-381 design (the curve of
the older official example) forces a Poseidon field mismatch between circom/snarkjs
(BN254-native) and the verifier. BN254 removes that entire class of bugs.

## Core idea — the contract never hashes

All Poseidon/Merkle work lives **inside the circuits**. The Soroban contracts only:

1. **verify a Groth16 proof** over BN254 (host-accelerated pairing), and
2. enforce **application bookkeeping**: the current Merkle root, the nullifier
   set (double-spend protection), value accounting, and token custody.

Every state-changing op proves its transition against the **current root**
(`old_root == current_root`, enforced like a nonce) and submits the resulting
`new_root`. This keeps circuits small enough for in-browser proving and keeps the
contract cheap and auditable. (Production note: a rolling window of historical
membership roots would decouple spending from insertion; the `RootHistory` is
already tracked.)

```
 deposit   : prove  commitment opens to a public `amount`, inserted old_root→new_root
 transfer  : prove  2 inputs ∈ tree, nullifiers valid, in==out, 2 outputs inserted   (amounts hidden)
 withdraw  : prove  1 input ∈ tree, nullifier valid, in == amount+change, recipient bound
 bridge_in : relayer-attested ETH lock → same statement as deposit, backed by bridge liquidity
```

## Repository layout

| Path | What |
|------|------|
| `contracts/verifier` | BN254 Groth16 verifier (CAP-0074). Audit-isolated. |
| `contracts/privacy-pool` | The shielded pool: deposit / transfer / withdraw / mint_note, nullifier set, root history, accounting. |
| `contracts/bridge` | ETH→Stellar bridge: relayer-attested, nonce replay-protected, mints into the pool. |
| `contracts/zk-interface` | Shared `Proof`/`VerificationKey` types + `#[contractclient]` verifier interface. |
| `contracts/mock-verifier` | Test double for deterministic contract tests. |
| `circuits/` | Circom circuits (`note`, `merkle`, `deposit`, `transfer`, `withdraw`) + snarkjs build/setup + Soroban VK exporter. |
| `frontend/` | Vite + React shielded wallet: Freighter, client-side Poseidon/Merkle note manager, snarkjs proving, contract calls. |
| `eth/` | `ShieldedBridgeLock.sol` — the Sepolia lock contract that emits `Locked(nonce, amount, commitment)`. |
| `scripts/` | `install-tools.sh`, `deploy_testnet.sh`. |

## Quickstart

```bash
# 0. Tools (Rust + wasm target, Stellar CLI, circom)
make tools

# 1. Build + test the contracts (no external services needed)
cd contracts && cargo test          # 14 tests
cargo build --target wasm32v1-none --release

# 2. Circuit crypto test (BN254 Poseidon Merkle — no circom needed)
cd ../circuits && pnpm install && pnpm test

# 3. Compile circuits + trusted setup (needs circom), then VKs + browser artifacts
pnpm build
cp build/*_js/*.wasm build/*.zkey ../frontend/public/circuits/   # for in-browser proving

# 4. Deploy to testnet + wire verifier/pool/bridge + VKs + write frontend/.env.local
cd .. && scripts/deploy_testnet.sh

# 5. Run the wallet
cd frontend && pnpm install && pnpm dev   # http://localhost:5173
```

## What's verified vs. what needs the toolchain

**Verified in this repo (no network needed):**
- ✅ `cargo test` — **14 contract tests** covering deposit/transfer/withdraw/bridge,
  double-spend rejection, stale-root rejection, value accounting, auth, token custody.
- ✅ `cargo build --target wasm32v1-none --release` — all four contracts compile to
  wasm (verifier 13 KB, pool 29 KB, bridge 34 KB — well under the 64 KB limit).
- ✅ `circuits: pnpm test` — BN254 Poseidon Merkle insert/membership round-trip +
  commitment/nullifier derivation, on the real circomlibjs Poseidon.
- ✅ **Circuits compile** (circom 2.2.3): deposit / transfer / withdraw with
  10.7k / 32k / 16k non-linear constraints and **4 / 6 / 6 public inputs that match
  the contract's `Vec<Fr>` layouts exactly**.
- ✅ **Full Groth16 proving loop for `deposit`**: trusted setup → witness → prove →
  `snarkjs groth16 verify` → **`OK!`**, with public signals emitted in the contract's
  order `[oldRoot, newRoot, commitment, amount]`. The empty-tree root computed three
  independent ways (deploy helper, witness generator, circuit) all agree.
- ✅ **VK exporter** emits correctly-sized Soroban BN254 points (G1 = 64 B, G2 = 128 B,
  `ic` length = nPublic + 1).
- ✅ `frontend: pnpm build` — the whole wallet type-checks and bundles.

**Needs a live testnet deploy (the one documented final step):**
- On-chain verification of a real proof. The local `snarkjs groth16 verify` above uses
  the *identical* Groth16/BN254 math the contract runs via `pairing_check`, and the VK
  bytes are in the exact host format, so this is wiring, not new cryptography. One
  binding to confirm against the live contract: the withdraw `recipient_field`
  (`keccak256(addr.to_xdr)` masked), matched in `frontend/src/lib/pool.ts`.

We deliberately **don't** overclaim: every layer that can be checked offline is
checked, including a real end-to-end ZK proof.

## Security model (honest)

- **Soundness**: value can't be created — deposits add backing, transfers conserve
  value in-circuit, withdrawals decrement backing; the on-chain nullifier set
  prevents double-spends; insertions enforce `oldLeaf == 0` so notes can't be overwritten.
- **Privacy**: amounts and the input/output linkage are hidden by the commitments;
  spends reveal only an unlinkable nullifier.
- **Bridge trust**: cross-chain *observation* is attested by a relayer in this MVP;
  *shielded-note correctness* is fully ZK on Stellar. The relayer is replaceable by
  a trustless Ethereum state proof verified by the same Groth16 machinery — the
  `bridge_in` interface doesn't change.
- **Compliance**: a holder can disclose a **viewing key** to an auditor (ASP-style
  selective disclosure) without exposing spend authority or deanonymizing the pool.
- Not audited. Testnet only.

## Acknowledgements / references
Inspired by **Moonlight** (UTXO notes on Stellar) and **Nethermind's
stellar-private-payments** (privacy pool + ASP compliance). Built on the official
Stellar ZK skill, `soroban-examples/groth16_verifier`, CAP-0074/0075, circom & snarkjs.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for diagrams and data flow.

_License: Apache-2.0._
