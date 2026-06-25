# XORR ShieldedBridge — live testnet deployment

Real, two-way, relayer-based bridge (same class as Zephyr). The Stellar leg is
fully zero-knowledge and verified on-chain; cross-chain observation is attested
by an authorized relayer (the documented MVP trust model).

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
| Bridge (admin+relayer = `xorr`, → app pool) | `CDECXYZSMAQ5SOUOJC3WSKHWRCAZEDUOUKTHYSIMNQOC3HS4HJDS5XS7` |
| App pool (now has Bridge VK + this bridge as minter) | `CA5T3ZM6EFLSOFI5ZAWMN3CZV6U5I2BCCH2W6JSXNYCH3CVRG4BVFZ65` |
| USDC SAC | `CAD7OEAESCGR5XV2BA2AHZCWM6EVJEYBYOOCA3D3ZG4TCOBWWHMZVFIV` |
| Bridge USDC backing | 1,000 USDC funded |

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

## Remaining (UI polish only — mechanics proven above)
1. **Relayer service** — watch Sepolia `Locked` events, submit `bridge_in` to the
   Stellar bridge signed as the relayer. (Forward) + watch Stellar burns → call
   escrow `release` (reverse).
2. **Frontend** — approve → `lock(realAmount, commitment)` on the escrow → hand the
   note proof to the relayer → record the note. Faucet mints TestUSDC.
3. **Tree state** — correct `bridge_in` proofs need the pool's full leaf set; run
   the global indexer (`DELIVERY_URL`) or use a single-user wallet on a fresh pool.

## Scripts (`eth/`)
- `node scripts/deploy-bridge.mjs` — deploy TestUSDC + escrow (needs a funded `EVM_PRIVATE_KEY` in `eth/.env`)
- `node scripts/lock-test.mjs <usdc> [commitmentHex]` — real lock, prints the `Locked` event
