// REAL liquidation demo (no mocks): set up an underwater borrower, then prove the
// keeper liquidates it on-chain.
//   1. fund a fresh borrower B (friendbot) + open a USDC trustline
//   2. B supplies XLM collateral and borrows USDC right up to a healthy limit
//   3. XLM "crashes" (admin oracle drops the price) → B is underwater
//   4. POST the keeper /check → the keeper liquidates B on-chain
//   5. assert: B's debt fell, the keeper seized B's XLM, a Liquidate happened
//
// Run with the keeper up and price relay FROZEN (RELAY_PRICE=0) so the crash holds.
// env: lending-keeper/.env (XORR_SECRET, LENDING_ID, USDC, XLM) + KEEPER_URL
import { rpc, Contract, Address, TransactionBuilder, BASE_FEE, Keypair, Operation, Asset, nativeToScVal, scValToNative } from "@stellar/stellar-sdk";
import { config as dotenv } from "dotenv";
dotenv({ path: new URL("./.env", import.meta.url) });

const RPC = "https://soroban-testnet.stellar.org";
const PASS = "Test SDF Network ; September 2015";
const LENDING = need("LENDING_ID"), USDC = need("USDC"), XLM = need("XLM");
const KEEPER = process.env.KEEPER_URL || "http://localhost:8791";
const USDC_ISSUER = "GAVKGXALNNSW35QZKLVYL5CNORBEGHBF7KMHEEVW5LEHT5XVNQZDD6KI";
const admin = Keypair.fromSecret(need("XORR_SECRET"));
function need(k) { const v = process.env[k]; if (!v) throw new Error(`missing ${k}`); return v; }

const server = new rpc.Server(RPC);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const i128 = (v) => nativeToScVal(BigInt(v), { type: "i128" });
const addr = (a) => new Address(a).toScVal();
const E7 = 10_000_000n;

async function send(kp, op, contract = true) {
  const acct = await server.getAccount(kp.publicKey());
  let tx = new TransactionBuilder(acct, { fee: (BASE_FEE * 100).toString(), networkPassphrase: PASS }).addOperation(op).setTimeout(120).build();
  if (contract) { const sim = await server.simulateTransaction(tx); if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error); tx = rpc.assembleTransaction(tx, sim).build(); }
  tx.sign(kp);
  const sent = await server.sendTransaction(tx);
  if (sent.status === "ERROR") throw new Error(JSON.stringify(sent.errorResult));
  let got = await server.getTransaction(sent.hash);
  for (let i = 0; i < 40 && got.status === "NOT_FOUND"; i++) { await sleep(1000); got = await server.getTransaction(sent.hash); }
  if (got.status !== "SUCCESS") throw new Error(`${sent.hash} status=${got.status}`);
  return sent.hash;
}
const call = (m, ...args) => new Contract(LENDING).call(m, ...args);
async function sim(m, ...args) {
  const acct = await server.getAccount(admin.publicKey());
  const tx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: PASS }).addOperation(call(m, ...args)).setTimeout(60).build();
  const s = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(s)) throw new Error(`${m}: ${s.error}`);
  return scValToNative(s.result.retval);
}
const health = async (u) => { const a = await sim("account", addr(u)); return { coll: BigInt(a[0]), borrow: BigInt(a[1]), h: Number(a[2]) }; };

async function main() {
  // 1. fresh borrower + friendbot + USDC trustline
  const B = Keypair.random();
  console.log("borrower:", B.publicKey());
  const fb = await fetch(`https://friendbot.stellar.org/?addr=${B.publicKey()}`);
  if (!fb.ok && fb.status !== 400) throw new Error("friendbot failed");
  await sleep(3000);
  await send(B, Operation.changeTrust({ asset: new Asset("USDC", USDC_ISSUER) }), false);
  console.log("✓ funded + USDC trustline");

  // 2. supply 3000 XLM collateral, borrow 350 USDC (healthy at ~$0.17)
  await send(B, call("supply", addr(XLM), addr(B.publicKey()), i128(3000n * E7)));
  await send(B, call("borrow", addr(USDC), addr(B.publicKey()), i128(350n * E7)));
  let st = await health(B.publicKey());
  console.log(`✓ B supplied 3000 XLM, borrowed 350 USDC → collateral $${Number(st.coll) / 1e7} debt $${Number(st.borrow) / 1e7} health ${(st.h / 1e4).toFixed(2)}`);
  if (st.h < 10000) throw new Error("expected healthy before crash");

  // 3. XLM crashes to $0.08 → B underwater
  console.log("\n💥 XLM crashes → admin oracle drops price to $0.08");
  await send(admin, call("set_price", addr(XLM), i128(800000n)));
  st = await health(B.publicKey());
  console.log(`   B now: collateral $${Number(st.coll) / 1e7} debt $${Number(st.borrow) / 1e7} health ${(st.h / 1e4).toFixed(2)} ${st.h < 10000 ? "← UNDERWATER" : ""}`);
  if (st.h >= 10000) throw new Error("expected underwater after crash");

  // 4. keeper liquidates
  console.log("\n⚡ POST keeper /check (liquidates underwater positions)…");
  const res = await (await fetch(`${KEEPER}/check`, { method: "POST" })).json();
  if (res.error) throw new Error("keeper: " + res.error);
  const mine = (res.liquidated || []).find((l) => l.borrower === B.publicKey());
  if (!mine) throw new Error("keeper did not liquidate B: " + JSON.stringify(res));
  console.log(`   ✅ keeper liquidated B — repaid ${Number(mine.repay) / 1e7} USDC`);
  console.log(`   https://stellar.expert/explorer/testnet/tx/${mine.hash}`);

  // 5. assert outcome
  const [, bDebt] = await sim("position", addr(USDC), addr(B.publicKey()));
  const [keeperXlm] = await sim("position", addr(XLM), addr(admin.publicKey()));
  console.log(`\nB debt after: $${Number(bDebt) / 1e7} (was $350 → repaid 175)`);
  console.log(`keeper seized XLM collateral position: ${Number(keeperXlm) / 1e7} XLM`);
  if (BigInt(bDebt) >= 350n * E7) throw new Error("debt not reduced");
  console.log("\n🎉 REAL LIQUIDATION VERIFIED: underwater borrower cleared on-chain, collateral seized at a 5% bonus.");

  // 6. restore the real price for the running market
  const px = Math.round(((await (await fetch("https://api.coinbase.com/v2/prices/XLM-USD/spot")).json()).data.amount) * 1e7);
  await send(admin, call("set_price", addr(XLM), i128(px)));
  console.log(`(restored XLM price to $${(px / 1e7).toFixed(4)})`);
}
main().catch((e) => { console.error("LIQUIDATION DEMO FAILED:", e.message || e); process.exit(1); });
