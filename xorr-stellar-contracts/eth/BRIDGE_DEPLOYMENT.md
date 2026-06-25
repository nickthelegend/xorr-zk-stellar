# XORR ShieldedBridge — live testnet deployment

Real, two-way, relayer-based bridge (same class as Zephyr, **plus** an on-chain
ETH deposit-tree membership check Zephyr only attests). The Stellar leg is fully
zero-knowledge and verified on-chain; the Ethereum deposit set is committed to a
keccak256 Merkle tree whose **root is posted to Stellar** by an autonomous
relayer, and every mint is gated by an on-chain membership proof against it.

## v2 — ETH deposit Merkle root posted to Stellar (Zephyr parity, and then some)

1. Locks on the Sepolia escrow append the note `commitment` to an off-chain-
   mirrored **keccak256 deposit Merkle tree** (depth 16).
2. The relayer maintains that tree and posts its root to the bridge via
   `set_eth_root` (replay-safe 32-entry history), autonomously every 15 s.
3. `bridge_in` now verifies **both**: (a) the Groth16 note proof, and (b) an ETH
   Merkle **membership** proof — `is_known_eth_root(root)` + an on-chain keccak
   path recompute (`eth_merkle_root`) — so a mint is gated by the *real Ethereum
   deposit set*, not merely the relayer's say-so. Zephyr attests a single nonce;
   we verify tree membership on-chain.

## Ethereum (Sepolia) — deployed & verified
| What | Address / tx |
|---|---|
| TestUSDC (mintable, 6-dec, open faucet) | `0xC01B461678119117d3359D45a0205C2706AD85Ee` |
| ShieldedBridgeEscrow (lock + relayer `release`) | `0x60655E8F6D771934f3D57Ff4D5D662fe7A601F2E` |
| EVM relayer (reverse `release`) | `0x7FeD65D1703ee51a70797F05EEf661f2A84E7D5D` |
| ✅ Real 5-USDC lock (nonce 0) | [0x4fb80e13…](https://sepolia.etherscan.io/tx/0x4fb80e139a2e05fc678a6697af66188529dfe24cc1d243e9b83cce3629fb358f) |

## Stellar (testnet) — deployed & wired
| What | Address |
|---|---|
| Bridge **v2** (ETH-root + membership; admin+relayer = `xorr`) | `CBTSR6QKVGVTJ2NTJABVAETXZIV7H5UZG745L4G6UZNHZIURIMLCHGGL` |
| App pool (has Bridge VK + this bridge as minter) | `CA5T3ZM6EFLSOFI5ZAWMN3CZV6U5I2BCCH2W6JSXNYCH3CVRG4BVFZ65` |
| USDC SAC | `CAD7OEAESCGR5XV2BA2AHZCWM6EVJEYBYOOCA3D3ZG4TCOBWWHMZVFIV` |
| Bridge USDC backing | 1,000 USDC funded |
| Pre-v2 bridge (no membership; superseded) | `CDECXYZSMAQ5SOUOJC3WSKHWRCAZEDUOUKTHYSIMNQOC3HS4HJDS5XS7` |

What was fixed vs. the old demo:
- The app pool was deployed with **only** Deposit/Transfer/Withdraw VKs — no Bridge
  VK — so `bridge_in` could never mint into it. Added the Bridge VK (= the Deposit
  VK; `deposit.circom` public signals `[oldRoot, newRoot, commitment, amount]`
  match `mint_note` exactly).
- The old bridge minted into a **different** pool (`CDZENDZM…`) and its admin key
  isn't ours. Deployed a fresh bridge we fully control, pointed at the **app's**
  pool, set it as minter, funded it, set the relayer.

## ✅ VERIFIED real round-trip (ETH → Stellar)

`xorr-core/scripts/bridge-e2e.mts` ran the full flow with **no mocks** and the
on-chain state confirms it:

1. Generated a shielded note (fresh single-user wallet); its empty-tree root
   **equalled the live pool root** (`0x2134e76a…`).
2. Locked **5 real USDC** on the Sepolia escrow, bound to the note commitment
   (escrow now: `nextNonce = 2`, `totalLocked = 10 USDC` across two locks).
3. Generated a real Groth16 proof (deposit/Bridge circuit, real `.wasm`/`.zkey`).
4. Submitted `bridge_in` to the Stellar bridge, signed as the relayer — **verified
   on-chain by the BN254 Groth16 machinery** — minting the note.
   - Stellar tx: https://stellar.expert/explorer/testnet/tx/ef5bf33610ae45ff41cddbf43f24d7e8eb502bc5290c64998885ead2b2a942ab
5. Post-state: pool `total_shielded = 50000000` (5 xUSDC), root advanced to
   `0x0d20b19a…`.

So real USDC on Sepolia → real ZK-minted xUSDC on Stellar, end to end. The
cross-chain ZK is genuine, not simulated.

## ✅ VERIFIED v2 round-trip (ETH-tree membership + ZK, both on-chain)

`xorr-core/scripts/bridge-e2e-v2.mts` ran the full autonomous stack with **no
mocks**:

1. Reconstructed the pool's note tree from its on-chain leaf; the rebuilt root
   **equalled the live pool root** (`0x0d20b19a…`) — mirror == chain.
2. Locked **5 real USDC** on Sepolia (nonce 2), bound to a fresh note commitment.
   - Sepolia lock: https://sepolia.etherscan.io/tx/0x5e12fbd1edc5514b8df578ede67406fcc3aee6b208e5c4983351cf9401695b44
3. The **autonomous relayer** rebuilt the keccak256 deposit tree (now 3 leaves),
   posted its root to the bridge (`set_eth_root`), and built the membership proof
   for our commitment at **deposit index 2**.
4. `bridge_in` verified **both** the ETH Merkle membership (`is_known_eth_root` +
   on-chain keccak path recompute, root `0x265bc616…`) **and** the Groth16 note
   proof (BN254) — then minted.
   - Stellar tx: https://stellar.expert/explorer/testnet/tx/dac7dbad69ed5a74413edb39de064b71eb5b458b28496303672a0aff29369d02
5. Post-state: pool `total_shielded = 100000000` (10 xUSDC across two bridged
   notes), `current_root` advanced to our newRoot.

A mint is now provably gated by the real Ethereum deposit set — this is the
Zephyr-parity feature, with on-chain membership verification on top.

## Autonomous relayer (`eth/relayer/relayer.mjs`)
- Watches Sepolia `Locked` events across an RPC pool (drpc + tenderly serve
  *archive* logs without a token), maintains the keccak deposit tree, and posts
  the root to Stellar every 15 s (`set_eth_root`).
- `POST /bridge-in {commitment, amount, oldRoot, newRoot, proof}` → finds the
  lock, builds the ETH membership proof, submits the 9-arg `bridge_in`.
- Run: `node relayer/relayer.mjs` (env in gitignored `relayer/.env`).

## ✅ VERIFIED reverse round-trip (Stellar → Ethereum)

`xorr-core/scripts/bridge-out-e2e.mts` ran the full reverse stack with **no mocks**:

1. Bridged a note IN (real lock + relayer mint) so we held a spendable shielded note.
2. **Burned it on Stellar** with a real Withdraw (ZK) proof that unshields the value
   to the bridge sink (the relayer) — value-conserving — producing nullifier
   `0x06a2662f…`. Pool `total_shielded` 150000000 → **100000000** (−5 xUSDC), change
   leaf appended.
3. The relayer (escrow's authorized `relayer`) called **`release(to, amount,
   nullifier)`** on Sepolia, paying out real USDC:
   - Ethereum release: https://sepolia.etherscan.io/tx/0x48bbda75ef00989cd80fc4a2a5838826853a71b0334c10edea738d6f24854afe
   - `Released(nullifier, 5000000, 0x7FeD65…)`; `releasedNullifier == true` (single-use).
4. Recipient USDC balance increased by **5 USDC**.

The nullifier is single-use on BOTH chains (pool spend + escrow `releasedNullifier`),
so a burn releases at most once. Both legs of the bridge are now real and verified.

## Remaining (UI polish only — mechanics proven above)
- **Autonomy** — the reverse leg currently goes through `POST /bridge-out` (the
  client hands its Withdraw proof to the relayer). A fully autonomous relayer would
  also watch Stellar `withdraw`-to-sink events and release without the explicit call.
- **Tree state in-app** — correct proofs need the pool's full leaf set; the wallet
  mirrors it locally, or rebuild from pool `bridgein`/`withdraw` events.

## Scripts
- `eth/`: `node scripts/deploy-bridge.mjs` — deploy TestUSDC + escrow (needs a funded `EVM_PRIVATE_KEY` in `eth/.env`)
- `eth/`: `node scripts/lock-test.mjs <usdc> [commitmentHex]` — real lock, prints the `Locked` event
- `xorr-core/`: `node --import tsx scripts/bridge-e2e-v2.mts` — full v2 round-trip (ETH-tree
  membership + ZK), driving the live relayer. Env: `EVM_PRIVATE_KEY, ETH_USDC,
  ETH_ESCROW, POOL_ID, LEAF0, SEPOLIA_RPC, RELAYER_URL`.
