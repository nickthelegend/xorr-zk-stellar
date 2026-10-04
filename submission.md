# XORR — Private money, made real

**Private-by-default money on Stellar.** Shield USDC into unlinkable zero-knowledge notes, pay anyone by email, bridge in from Ethereum, prove compliance without revealing a cent, and cash out to real fiat — every spend proven in zero knowledge and verified **on-chain** with BN254 Groth16 on Soroban.

> 🔗 **Live app:** https://shield.xorr.finance  ·  **Landing:** https://stellar.xorr.finance
> 🎥 **Demo video:** _(attach here)_  ·  💻 **Code:** _(repo link)_
> ⛓️ **Network:** Stellar Testnet + Ethereum Sepolia

---

## 🩸 The problem

Every payment on a public blockchain is exactly that — **public**. Your balance, who you pay, how much, and how often are traceable forever by anyone. For real money — payroll, savings, business flows — that's a non-starter. Existing "privacy" tools are either isolated mixers with no real utility, or they break compliance entirely.

**XORR fixes both:** true on-chain privacy *and* selective, provable compliance — as a full consumer money app, not a science project.

---

## ✨ What XORR does

| Feature | What it means for a user |
|---|---|
| 🛡️ **Shield** | Deposit USDC and it becomes a **zero-knowledge note** — only a commitment ever touches the chain. The amount is invisible; your balance is private. |
| ✉️ **Pay by email** | Send to anyone with just their email — no wallet required. They receive a **claim link**. |
| 🔑 **Frictionless claim** | The recipient connects Freighter *or* gets a wallet spun up in-browser, and the payment arrives as an **encrypted note only they can open** (NaCl-box to their key). |
| 📥 **Receive privately** | Share an **encrypted shielded address or QR** — anyone can pay you with no link back to your identity. |
| 💸 **Withdraw** | Unshield a note to any Stellar account, anytime. |
| 🔬 **Provable, private** | Every claim/spend is a **Groth16 proof verified on-chain** — provably valid, with the amount never revealed. See it live on Stellar Expert. |
| 🌉 **Two-way bridge** | Bring USDC from **Ethereum → Stellar** (lock on Sepolia → private note on Stellar), and go **Stellar → Ethereum** (shield → burn → release), each carried by a ZK proof + on-chain ETH deposit-tree membership. |
| 🔁 **Private swap** | Swap shielded USDC → XLM through an on-chain AMM — the amount stays hidden, the proof is verified on-chain. |
| 🏦 **Private lending** | Supply assets to a shielded lending pool and **earn yield privately**. |
| 🧾 **Compliance, on your terms** | From any shielded note, generate a **selective-disclosure report** that proves you own the funds — to an auditor or an exchange — **without revealing your balance**. Privacy *and* compliance. |
| 🏧 **Real off-ramp** | Cash out through a live **SEP-24 anchor**, taking shielded funds all the way toward fiat. |

---

## 🔐 How it works (the ZK core)

XORR is a **UTXO privacy pool** on Soroban, mirroring the design that secures billions on Ethereum — rebuilt natively for Stellar.

- **Notes.** A note is `(amount, pk, blinding)` with `commitment = Poseidon(amount, pk, blinding)`. Every note lives at a leaf of an **incremental Poseidon Merkle tree (depth 20)**. Spending publishes a `nullifier = Poseidon(commitment, sk)` — single-use, so a note can never be double-spent, yet the nullifier is unlinkable to the commitment.
- **On-chain verification.** Proofs are **Groth16 over BN254**, verified **inside the Soroban contract** using the CAP-0074 BN254 host functions — the same field the Circom circuits compile to, so the whole pipeline (witness → proof → on-chain verify) lines up with zero cross-field conversion. Circuits: `deposit`, `transfer`, `withdraw`, `bridge`, `solvency`, `disclose`.
- **In-browser proving.** All proofs are generated **client-side** (snarkjs/WebAssembly) — secrets never leave the device.
- **Encrypted delivery.** Cross-user payments encrypt the note's opening to the recipient's **X25519 key (NaCl box)**; only ciphertext + a routing key ever leave the sender. The recipient scans, decrypts, and can spend — unlinkable on-chain even if the address is reused.
- **Two-way bridge.** The Ethereum side locks USDC in an escrow and emits a commitment; a relayer posts the **keccak deposit-tree root** to Stellar, and the mint is gated by *both* a Groth16 note proof *and* on-chain ETH-membership verification. The reverse leg burns the shielded note (publishing a nullifier) and releases the backing USDC on Sepolia.

---

## 🏗️ Architecture

```
┌────────────────────────┐     ZK proof (BN254 Groth16)     ┌─────────────────────────┐
│  xorr-core (Next.js)   │ ───────────────────────────────► │  Soroban contracts       │
│  in-browser snarkjs    │                                  │  • PrivacyPool (verify)  │
│  Freighter / claim     │ ◄─── encrypted notes / leaves ── │  • BN254 Verifier        │
└──────────┬─────────────┘                                  │  • Bridge / AMM / Lending│
           │                                                └─────────────────────────┘
           │ REST                                                       ▲
           ▼                                                            │ set_eth_root / bridge_in
┌────────────────────────┐        lock/release (Sepolia)     ┌──────────┴──────────────┐
│  Delivery + Identity    │ ◄──── EVM relayer (ethers) ─────► │  ShieldedBridge Escrow   │
│  (Express + MongoDB)    │                                   │  + TestUSDC (Ethereum)   │
│  claim links · off-ramp │                                   └──────────────────────────┘
└────────────────────────┘
```

**Stack:** Next.js · TypeScript · Soroban (Rust) · Circom + snarkjs (BN254) · Poseidon/circomlib · Express + MongoDB · ethers v6 · Freighter · Stellar SDK · SEP-10/SEP-24.

---

## 📜 Deployed contracts (testnet — verifiable)

**Stellar (Testnet)** — `https://stellar.expert/explorer/testnet/contract/<id>`

| Contract | Address |
|---|---|
| Privacy Pool | `CCU37JVI545XRYJ2EQIKJANEAZPQMDIC7B3HF2ABN7PNG4SH5HTLFFJO` |
| BN254 Verifier | `CC46C65SFSA2QNNGZRRXAYTDB4S6V4MB52MGDBZC5A6NI3QG5H4L2FO2` |
| Two-way Bridge | `CCFCB2Y43SKFMWM33FOUFEHDJLFN77YRSHEDEQUHXW35N6VFJPCSJX3Z` |
| AMM (pool-factory) | `CADU5RQBNEDPIRLGWOEC62EIGAV6V54KGITMGJ52R2ODT6EUBM66NP55` |
| xUSDC token (SAC) | `CAD7OEAESCGR5XV2BA2AHZCWM6EVJEYBYOOCA3D3ZG4TCOBWWHMZVFIV` |

**Ethereum (Sepolia)**

| Contract | Address |
|---|---|
| Shielded Bridge Escrow | `0x60655E8F6D771934f3D57Ff4D5D662fe7A601F2E` |
| Test USDC | `0xC01B461678119117d3359D45a0205C2706AD85Ee` |

---

## 🧭 What makes XORR different

- **Not a mixer — a money app.** Pay, receive, bridge, swap, lend, off-ramp — privacy woven through the entire flow, not bolted on.
- **Privacy *and* compliance.** Selective-disclosure proofs let a user prove solvency/ownership to an auditor or exchange **without revealing balances** — solving the exact reason regulators fear privacy tech.
- **Verified on-chain, on Stellar.** Real BN254 Groth16 verification inside Soroban — not a trusted off-chain checker.
- **Pay anyone, even without a wallet.** Email → claim link → in-browser wallet → encrypted note. Onboarding that feels like Venmo, settling like ZK.
- **A working two-way ETH bridge** with on-chain deposit-tree membership — bringing Ethereum liquidity into a private Stellar economy and back.

---

## 🚀 Roadmap

- Mainnet deployment + a trusted-setup ceremony for the production proving keys
- Multi-asset shielded pools + shielded-to-shielded swaps
- Always-on hosted infrastructure (backend + relayer) and mobile app
- More anchors / off-ramp corridors and fiat on-ramps
- Auditor-facing compliance dashboard built on disclosure receipts

---

## 🙌 Try it

1. Open **https://shield.xorr.finance**
2. Faucet → get test **xUSDC**
3. **Shield** it → your balance goes private
4. **Pay by email**, **bridge from Sepolia**, **swap to XLM**, or generate a **compliance report**
5. Verify any proof yourself on **Stellar Expert**

**XORR — private money, made real.**
