// XORR lending keeper — the operational backbone for the money market.
//
// Two jobs, on a tick (like the bridge relayer):
//   1. PRICE RELAY: fetch the real XLM/USD spot (median of CEX feeds) and post it
//      to the lending contract via `set_price`. (USDC is pinned to $1.) This is a
//      centralized price relay; Reflector's on-chain oracle is the decentralized
//      upgrade — same data, read trustlessly.
//   2. LIQUIDATIONS: track borrowers (from `borrow` events), read each account's
//      health, and liquidate any underwater position (health < 1.0) for the bonus.
//
// GET  /health      → keeper status, live prices, tracked borrowers, recent liquidations
// POST /check       → run one scan+liquidation pass now (used by the demo), returns result
//
// env (lending-keeper/.env): XORR_SECRET, LENDING_ID, USDC, XLM, STELLAR_RPC, PORT, FROM_LEDGER
import http from "node:http";
import { rpc, Contract, Address, TransactionBuilder, BASE_FEE, Keypair, nativeToScVal, scValToNative } from "@stellar/stellar-sdk";
import { config as dotenv } from "dotenv";
dotenv({ path: new URL("./.env", import.meta.url) });

const PORT = Number(process.env.PORT || 8791);
const RPC = process.env.STELLAR_RPC || "https://soroban-testnet.stellar.org";
const PASS = process.env.NETWORK_PASSPHRASE || "Test SDF Network ; September 2015";
const LENDING = req("LENDING_ID");
const USDC = req("USDC");
const XLM = req("XLM");
const RELAY_PRICE = process.env.RELAY_PRICE !== "0"; // set 0 to freeze price (demo)
const kp = Keypair.fromSecret(req("XORR_SECRET"));
function req(k) { const v = process.env[k]; if (!v) throw new Error(`missing env ${k}`); return v; }

const server = new rpc.Server(RPC);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const i128 = (v) => nativeToScVal(BigInt(v), { type: "i128" });
const addr = (a) => new Address(a).toScVal();

async function build(method, args) {
  const acct = await server.getAccount(kp.publicKey());
  return new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: PASS })
    .addOperation(new Contract(LENDING).call(method, ...args)).setTimeout(120).build();
}
async function simulate(method, ...args) {
  const sim = await server.simulateTransaction(await build(method, args));
  if (rpc.Api.isSimulationError(sim)) throw new Error(`${method} sim: ${sim.error}`);
  return scValToNative(sim.result.retval);
}
async function submit(method, ...args) {
  const tx = await build(method, args);
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(`${method} sim: ${sim.error}`);
  const prepared = rpc.assembleTransaction(tx, sim).build();
  prepared.sign(kp);
  const sent = await server.sendTransaction(prepared);
  if (sent.status === "ERROR") throw new Error(`${method} send: ${JSON.stringify(sent.errorResult)}`);
  let got = await server.getTransaction(sent.hash);
  for (let i = 0; i < 40 && got.status === "NOT_FOUND"; i++) { await sleep(1000); got = await server.getTransaction(sent.hash); }
  if (got.status !== "SUCCESS") throw new Error(`${method} ${sent.hash} status=${got.status}`);
  return sent.hash;
}

// ── price relay ────────────────────────────────────────────────────────────
const lastPrices = {};
async function xlmUsd() {
  const sources = [
    ["https://api.binance.com/api/v3/ticker/price?symbol=XLMUSDT", (j) => parseFloat(j.price)],
    ["https://api.coinbase.com/v2/prices/XLM-USD/spot", (j) => parseFloat(j?.data?.amount)],
    ["https://api.kraken.com/0/public/Ticker?pair=XLMUSD", (j) => parseFloat(Object.values(j.result)[0]?.c?.[0])],
  ];
  const ps = [];
  for (const [url, pick] of sources) {
    try { const r = await fetch(url, { signal: AbortSignal.timeout(6000) }); ps.push(pick(await r.json())); } catch { /* skip */ }
  }
  const valid = ps.filter((p) => p > 0).sort((a, b) => a - b);
  return valid.length ? valid[Math.floor(valid.length / 2)] : null; // median
}
async function updatePrices() {
  if (!RELAY_PRICE) return;
  try {
    const xlm = await xlmUsd();
    if (xlm) {
      await submit("set_price", addr(XLM), i128(Math.round(xlm * 1e7)));
      lastPrices.XLM = xlm;
      console.log(`[keeper] XLM → $${xlm.toFixed(4)} (median of CEX feeds) posted on-chain`);
    }
    lastPrices.USDC = 1;
  } catch (e) { console.error("[keeper] price:", e.message); }
}

// ── borrower tracking + liquidations ────────────────────────────────────────
const borrowers = new Set();
const liquidations = [];
let scannedLedger = Number(process.env.FROM_LEDGER || 0);
async function scanBorrowers() {
  try {
    const latest = (await server.getLatestLedger()).sequence;
    const start = scannedLedger || latest - 1000;
    const res = await server.getEvents({ startLedger: start, filters: [{ type: "contract", contractIds: [LENDING] }], limit: 200 });
    for (const e of res.events) {
      const topics = e.topic.map((t) => { try { return scValToNative(t); } catch { return null; } });
      if (String(topics).includes("borrow")) {
        const v = scValToNative(e.value); // (asset, from, amount)
        if (Array.isArray(v) && v[1]) borrowers.add(String(v[1]));
      }
    }
    scannedLedger = latest;
  } catch (e) { console.error("[keeper] scan:", e.message); }
}
async function checkLiquidations() {
  const done = [];
  for (const b of borrowers) {
    try {
      const acc = await simulate("account", addr(b));
      const borrow = BigInt(acc[1]);
      const health = Number(acc[2]);
      if (borrow <= 0n || health >= 10_000) continue; // solvent
      const [usdcSup, usdcDebt] = await simulate("position", addr(USDC), addr(b));
      const [xlmSup, xlmDebt] = await simulate("position", addr(XLM), addr(b));
      const collAsset = BigInt(xlmSup) >= BigInt(usdcSup) ? XLM : USDC;
      const debtAsset = BigInt(usdcDebt) >= BigInt(xlmDebt) ? USDC : XLM;
      const collUnderlying = collAsset === XLM ? BigInt(xlmSup) : BigInt(usdcSup);
      const debt = debtAsset === USDC ? BigInt(usdcDebt) : BigInt(xlmDebt);
      if (debt <= 0n || collUnderlying <= 0n) continue;
      // Cap the repay so the seized collateral (+5% bonus) never exceeds what the
      // borrower actually has — handles deeply-underwater (bad-debt) positions.
      const cM = await simulate("get_market", addr(collAsset));
      const dM = await simulate("get_market", addr(debtAsset));
      const collValue = (collUnderlying * BigInt(cM.price)) / 10_000_000n; // USD 7-dec
      const maxByColl = (((collValue * 10_000n) / 10_500n) * 10_000_000n) / BigInt(dM.price);
      let repay = debt / 2n; // close factor (50%)
      if (repay > maxByColl) repay = maxByColl;
      repay = (repay * 99n) / 100n; // safety margin for rounding
      if (repay <= 0n) continue;
      const hash = await submit("liquidate", addr(kp.publicKey()), addr(b), addr(collAsset), addr(debtAsset), i128(repay));
      const rec = { borrower: b, health: (health / 10_000).toFixed(2), repay: repay.toString(), hash, ts: Date.now() };
      liquidations.push(rec); done.push(rec);
      console.log(`[keeper] ⚡ liquidated ${b.slice(0, 6)}… (health ${rec.health}, repaid ${repay}) ${hash.slice(0, 8)}`);
    } catch (e) { console.error("[keeper] liquidate", b.slice(0, 6), e.message); }
  }
  return done;
}

async function tick() { await updatePrices(); await scanBorrowers(); await checkLiquidations(); }

http.createServer(async (rq, rs) => {
  rs.setHeader("Access-Control-Allow-Origin", "*");
  rs.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (rq.method === "OPTIONS") return rs.end();
  if (rq.url === "/health") {
    rs.setHeader("content-type", "application/json");
    return rs.end(JSON.stringify({ ok: true, keeper: kp.publicKey(), lendingId: LENDING, prices: lastPrices, borrowers: [...borrowers], liquidations: liquidations.slice(-10) }));
  }
  if (rq.method === "POST" && rq.url === "/check") {
    try { await scanBorrowers(); const done = await checkLiquidations(); rs.setHeader("content-type", "application/json"); return rs.end(JSON.stringify({ ok: true, liquidated: done })); }
    catch (e) { rs.statusCode = 500; return rs.end(JSON.stringify({ error: e.message })); }
  }
  rs.statusCode = 404; rs.end("not found");
}).listen(PORT, () => {
  console.log(`XORR lending keeper on :${PORT}  keeper=${kp.publicKey()}  relayPrice=${RELAY_PRICE}`);
  tick();
  setInterval(tick, 30000);
});
