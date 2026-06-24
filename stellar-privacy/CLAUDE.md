# CLAUDE.md — ShieldedBridge

Guidance for AI agents (and humans) working in this repo. Read this first.

## What we're building
**ShieldedBridge** — a private-by-default USDC wallet on **Stellar** with
**Moonlight-style UTXO notes** and a **ZK ETH↔Stellar bridge**, for the
*Stellar Hacks: Real-World ZK* hackathon. Every spend is proven in zero
knowledge and **verified on-chain** by a Soroban contract.

Privacy model = **private, not anonymous** (à la Moonlight): amounts, senders,
receivers and balances are hidden on-chain, but a holder can disclose a
**view key** to an auditor for compliance.

## Architecture (key decisions)
- **Curve: BN254** (CAP-0074, live on Stellar since Protocol 25 / Jan 2026).
  Chosen so circom/snarkjs/circomlibjs and the on-chain verifier all share one
  field — no cross-field Poseidon mismatch. (Earlier BLS12-381 design was pivoted.)
- **The contracts never hash.** All Poseidon/Merkle work lives in the circuits;
  contracts only (1) verify a Groth16 proof (`env.crypto().bn254().pairing_check`)
  and (2) do bookkeeping (root, nullifier set, value accounting, token custody).
- Each op proves its transition against the **current root** (`old_root ==
  current_root`, enforced like a nonce) and submits `new_root`.
- **UTXO accounts (Moonlight/Nethermind-aligned):** one master key → a
  constellation of unlinkable notes, each under a derived key
  `spendKey(i) = Poseidon(master, i)`; separate `viewKey = Poseidon(master, 0)`.
  Recoverable from the master alone. `pk = Poseidon(sk)` matches Nethermind's
  `keypair.circom`.

### Note scheme
```
pk         = Poseidon(sk)
commitment = Poseidon(amount, pk, blinding)   # in the Merkle tree
nullifier  = Poseidon(commitment, sk)         # revealed on spend (unlinkable)
```

### Cross-user private payments (stealth notes + MongoDB delivery)
- **Stealth notes:** to pay someone, the sender mints the output under a *fresh
  one-time* note key `sk` and delivers `{amount, blinding, sk}` ENCRYPTED to the
  recipient's X25519 view key (NaCl box). So a recipient's reusable shielded
  address (`sb1:<x25519Pub>`) never appears on-chain — every received note is
  unlinkable. The recipient scans, decrypts, and can spend (they hold `sk`).
- **Delivery + indexer = `backend/` (Express + MongoDB):** stores E2E-encrypted
  note blobs (routed by `routeKey = hex(sha256(encPub))`) and a global commitment
  index so any wallet rebuilds the tree and proves membership of received notes.
  The server only sees ciphertext + routing key + public commitments.
- Tradeoff: centralized + leaks delivery metadata; decentralized upgrade = emit
  the ciphertext on-chain (`ext_data`). On-chain note unlinkability already holds.

### Private remittance corridor (off-ramp)
Sandbox off-ramp modeled on the **Midnight off-ramp SDK** (cloned to
`references/midnight-offramp`): `quote → initiate → lock (on-chain shielded
withdraw to operator) → settle`. Rail adapters (Wise/Cash App/Revolut) are
sandbox; an **Ed25519 settlement oracle** signs a canonical attestation binding
the fiat payout to the `intentId`. Corridor = deposit (on-ramp) → private
transfer → off-ramp, amounts hidden throughout. Compliance proofs at the edges
are the next step (selective disclosure).

### Public-signal layouts (contract Vec<Fr> ⇄ circuit public inputs)
| op | signals |
|----|---------|
| deposit / bridge | `[old_root, new_root, commitment, amount]` |
| transfer | `[old_root, new_root, nf_a, nf_b, out_cmt_a, out_cmt_b]` |
| withdraw | `[old_root, new_root, nullifier, change_commitment, amount, recipient_field]` |

## Layout
- `contracts/` — Rust/Soroban workspace: `verifier` (BN254 Groth16),
  `privacy-pool` (deposit/transfer/withdraw/mint_note), `bridge`,
  `zk-interface`, `mock-verifier`. `cargo test` = 14 tests.
- `circuits/` — Circom (`note`, `merkle`, `deposit`, `transfer`, `withdraw`,
  `disclose` for selective disclosure) +
  snarkjs pipeline (`scripts/build.sh`) + Soroban VK exporter
  (`scripts/export-vk.mjs`) + tests (`test/*.test.mjs`).
- `frontend/` — Vite/React shielded wallet (Freighter, Poseidon/Merkle note
  manager `src/lib/notes.ts`, snarkjs prover `src/lib/prover.ts`, orchestration
  `src/lib/pool.ts`).
- `eth/` — `ShieldedBridgeLock.sol` (ERC-20) + `ShieldedBridgeLockNative.sol`
  (native, used for the live demo) + deploy scripts.
- `backend/` — Express + MongoDB: encrypted note delivery, address registry,
  global commitment index, and the sandbox off-ramp (rails + Ed25519 oracle).
  `MONGODB_URI` in `backend/.env` (gitignored). Resilient to Atlas IP allow-list.
- `scripts/` — `install-tools.sh`, `deploy_testnet.sh`, `deploy_and_test.sh`,
  `deploy_full.sh`; `circuits/scripts/onchain-transfer-test.mjs` (private payment on-chain).
- `packages/` / `references/` — **gitignored** reference clones (Nethermind
  stellar-private-payments; Nucastio Midnight off-ramp SDK).

## Status — what works (live on testnet)
- ✅ On-chain Groth16 verification: real proof → `true`, tampered → `false`.
- ✅ **Full shielded deposit on Stellar testnet** (token pulled in → proof
  verified on-chain → note inserted). `total_shielded` advanced.
- ✅ **Private payment (transfer) on-chain**: deposit A + deposit B → 2-in/2-out
  `pool.transfer` with the proof verified on-chain; both input nullifiers marked
  spent, value conserved (`total_shielded` unchanged), 2 new notes inserted.
  Pool `CC3RRJJ7UK2PWYV5CS574Y74XZ5PMSL6FDJKC4B7IUPSJC37R55O46U3`. Repro:
  `cd circuits && node scripts/onchain-transfer-test.mjs`.
- ✅ **Full ETH→Stellar bridge on-chain**: real ETH lock on Sepolia → `bridge_in`
  on Stellar verified the proof on-chain and minted the shielded note; replayed
  nonce correctly rejected (NonceAlreadyUsed).
- ✅ **Timed e2e ZK tests** (`circuits/test/e2e.test.mjs`): UTXO accounts
  (deterministic/unlinkable/recoverable), private 2-in/2-out transfer, withdraw —
  real proofs. Timing: prove ~2.3s / 5.7s / 3.3s (deposit/transfer/withdraw),
  verify ~20–33 ms.
- ✅ 14 Rust contract tests; frontend builds; browser proving artifacts in
  `frontend/public/circuits/`.

### Live deployment (testnet)
- Pool (all 4 VKs + bridge) `CDZENDZMVLPGVBPQXWIWIJJED3GD5AH33SIWCU2GFUEHGM5GIS5S6WYU`
- Bridge `CB72RP6QVTRBOYMBR7TA6M2QIGQSNBTS4NNVOQH777C6TGBW5MX3CRLB`
- Verifier `CCHSKQ2ZAEVIZ5KXZIB4NJI363NHFIARIUWJP47KSCY6CTENSPL33IQW`
- USDC SAC `CB2JO4FJH5NUU7Y2PHQ27H35DIOHQZDMCLFP6BSHGVZA2VDM4472MQXA`
- Deposit-demo pool `CBR4YTVHFZAGDUESF2LQU5TIOYDB5XGYLMNH65L4V6T3TX44H4HKTRE6`
  (deposit tx `9f46c1a3…`)
- ETH lock `0x3E48BDF44BD676D3F8cCb796138bBDcDA17e4F25` (Sepolia), tx `0x10809c89…`,
  nonce 0, commitment `0x1c484cca…`
- Stellar account `GA2YFLS6…` · EVM relayer `0x84ECed7bf82E9D586B6B9D5eD4F5509055e96f6B`

(Contract IDs also in `deploy.testnet.env` / `frontend/.env.local`.)

### Frontend note (single-user tree mirror)
The wallet mirrors the on-chain tree from its own notes, so a clean UI
deposit demo needs a wallet+pool that start empty together (the live pool
`CDZENDZ…` already has the bridged note at leaf 0). For a from-scratch UI demo,
deploy a fresh pool with `scripts/deploy_full.sh`. Production would replace the
mirror with an event indexer.

## Build / test / deploy
```bash
make tools                       # rust + wasm target, stellar-cli, circom
cd contracts && cargo test       # 14 tests
cd circuits && pnpm install && pnpm test         # crypto + e2e proof tests
cd circuits && pnpm build        # compile circuits + trusted setup (or use Hermez ptau)
scripts/deploy_and_test.sh       # deploy + set VK + run a real deposit proof on-chain
cd frontend && pnpm dev          # the wallet UI
```
Trusted setup note: the JS `powersoftau` for 2^17 is very slow — prefer the
Hermez ceremony ptau (`powersOfTau28_hez_final_17.ptau`) for transfer/withdraw.

## Conventions / gotchas
- Stellar CLI: numeric contract enums take the **integer** (`--circuit 0`), not the name.
- Can't `mint` a Stellar asset to its **own issuer** — use a separate issuer + trustline.
- BN254 G2 encoding is `be(c1)||be(c0)` (EIP-197); snarkjs lists `[c0,c1]` so the
  exporter swaps. G1 = 64 B, G2 = 128 B, Fr/Fp = 32 B big-endian.
- Secrets: `eth/.env` (EVM key) and any seed phrases are gitignored. `packages/` too.

## Session summary (chronological)
1. Read Stellar ZK/Soroban/dapp skills + official Groth16 verifier.
2. Built Soroban workspace (verifier/pool/bridge/interface/mock) + 14 tests; wasm < 35 KB.
3. Wrote Circom circuits + snarkjs pipeline + Soroban VK exporter; verified a real
   deposit proof with snarkjs.
4. **Pivoted BLS12-381 → BN254** after confirming CAP-0074/0075 shipped in Protocol 25.
5. Built the React shielded wallet (Freighter, notes, prover, premium UI).
6. Cloned + studied Nethermind `stellar-private-payments`; implemented **UTXO accounts**
   (deterministic per-note keys + view key).
7. **Deployed to testnet**, verified a real proof on-chain, ran a full shielded deposit.
8. Generated an EVM account; **deployed a Sepolia lock + real lock tx** (bridge ETH side).
9. Added timed e2e ZK tests (`circuits/test/e2e.test.mjs`); switched transfer/
   withdraw setup to the Hermez ceremony ptau.
10. **Closed the bridge on-chain**: deployed+wired the Stellar `bridge`, ran
    `bridge_in` for the Sepolia lock — proof verified on-chain, note minted,
    replay rejected. Copied browser proving artifacts; wired `.env.local` to
    the full deployment.

## Remaining / next
- **Compliance:** selective disclosure DONE (`disclose.circom`). Next: ASP
  membership/non-membership trees (prove not-on-blocklist) to complete
  "compliant privacy" at the corridor edges.
- Verify withdraw + off-ramp `lock` on-chain end-to-end (deposit/transfer/stealth/
  bridge already proven on-chain; withdraw uses the same circuit).
- Tag-based delivery so the DB can't group blobs by recipient (full delivery-layer
  unlinkability); move the indexer to read chain events instead of app posts.
- Reverse bridge (Stellar burn → Ethereum release gated by a proof).

## Cross-user / off-ramp / compliance status (verified)
- ✅ **Two-wallet stealth payment on-chain (LIVE testnet):** A pays B by stealth
  (transfer proof verified on-chain), encrypted note delivered via MongoDB, B
  scans + decrypts + recovers from the global index, then **spends the received
  note on-chain** (its nullifier marked spent). Pool `CB7ZZ5NU…`. Repro:
  `cd circuits && node scripts/onchain-stealth-test.mjs` (backend must be running).
- ✅ Off-ramp lifecycle verified live against MongoDB: initiate → lock → settle
  (25 USDC → 2066.70 INR via Wise), Ed25519 oracle attestation, intent timeline.
- ✅ **Selective disclosure (compliance):** `disclose.circom` (852 constraints) +
  test — proves ownership + amount of an on-chain note to an auditor without
  revealing sk/blinding; a tampered amount is rejected. Frontend generates
  disclosure proofs in-browser; auditor verifies the bundle + on-chain commitments
  (`frontend/src/lib/compliance.ts`, Compliance tab).
- Run: `cd backend && npm start` + `cd frontend && pnpm dev`. Two browser profiles
  = real private payment between two wallets.

## Gotchas discovered
- snarkjs **in-process `groth16.fullProve` can hang** in this sandbox under load;
  the **CLI path** (`snarkjs wtns calculate` + `groth16 prove`) is reliable. The
  browser uses web-worker proving (separate). For scripts, prefer the CLI path
  (see `circuits/build` bridge proof generation).
- Background tasks can be killed when the session is interrupted; long testnet
  deploy scripts should be re-runnable/idempotent.
