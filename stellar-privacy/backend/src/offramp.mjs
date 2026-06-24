// Sandbox off-ramp: shielded USDC -> fiat, modeled on the Midnight off-ramp SDK
// (rail adapters + intent lifecycle + Ed25519 settlement oracle), adapted to
// Stellar. Lifecycle: quote -> initiate -> lock(on-chain shielded withdraw to
// the operator) -> settle(oracle attests the fiat payout) -> done | refund.
//
// Rails are SANDBOX (deterministic rates/fees, simulated payout). With real
// provider credentials the same RailAdapter interface swaps in live HTTP calls.
import { generateKeyPairSync, sign as edSign, randomUUID } from "node:crypto";

// Ed25519 settlement oracle — signs canonical attestations binding a rail
// payout to an intent so the on-chain/edge side can verify settlement.
const oracle = generateKeyPairSync("ed25519");
const oraclePubB64 = oracle.publicKey.export({ type: "spki", format: "der" }).toString("base64");

function attest(payload) {
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  const sig = edSign(null, Buffer.from(canonical), oracle.privateKey).toString("base64");
  return { canonical, signature: sig, oracle: oraclePubB64 };
}

// Sandbox rail rate cards (USDC is 1:1 with USD pre-fees).
const RAILS = {
  cashapp:  { rate: { USD: 1.0, EUR: 0.92, GBP: 0.79, INR: 83.2, NGN: 1480 }, feeBps: 75, successRate: 0.97 },
  wise:     { rate: { USD: 1.0, EUR: 0.92, GBP: 0.79, INR: 83.0, NGN: 1475 }, feeBps: 40, successRate: 0.98 },
  revolut:  { rate: { USD: 1.0, EUR: 0.92, GBP: 0.79, INR: 83.1, NGN: 1470 }, feeBps: 30, successRate: 0.96 },
};
const CCY = (c) => String(c || "USD").toUpperCase();

function quote(rail, usdcAmount, currency) {
  const r = RAILS[rail];
  if (!r) throw new Error("unknown rail");
  const ccy = CCY(currency);
  const rate = r.rate[ccy];
  if (!rate) throw new Error("unsupported currency");
  const gross = Number(usdcAmount) * rate;
  const fee = (gross * r.feeBps) / 10000;
  const fiatOut = Math.max(0, gross - fee);
  return {
    rail, currency: ccy, usdcAmount: String(usdcAmount), rate,
    feeBps: r.feeBps, fee: fee.toFixed(2), fiatOut: fiatOut.toFixed(2),
    quotedAt: Math.floor(Date.now() / 1000),
  };
}

export function registerOfframp(app, { intents, ready }) {
  const guard = (res) => (ready() ? false : (res.status(503).json({ error: "DB not connected" }), true));

  app.get("/offramp/rails", (_req, res) =>
    res.json({ oracle: oraclePubB64, rails: Object.entries(RAILS).map(([id, r]) => ({ id, feeBps: r.feeBps, currencies: Object.keys(r.rate) })) }));

  app.post("/offramp/quote", (req, res) => {
    try { res.json(quote(req.body.rail, req.body.usdcAmount, req.body.currency)); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });

  // Initiate: lock a quote into an intent (status INITIATED).
  app.post("/offramp/initiate", async (req, res) => {
    if (guard(res)) return;
    const { rail, usdcAmount, currency, payoutHandle } = req.body || {};
    let q; try { q = quote(rail, usdcAmount, currency); } catch (e) { return res.status(400).json({ error: e.message }); }
    const id = randomUUID();
    const doc = { id, status: "INITIATED", quote: q, payoutHandle: payoutHandle || null, createdAt: new Date(), events: [{ status: "INITIATED", at: new Date() }] };
    await intents().insertOne(doc);
    res.json({ intentId: id, quote: q });
  });

  // Lock: the user has performed the on-chain shielded withdraw to the operator.
  app.post("/offramp/lock", async (req, res) => {
    if (guard(res)) return;
    const { intentId, stellarTx } = req.body || {};
    const upd = await intents().findOneAndUpdate(
      { id: intentId, status: "INITIATED" },
      { $set: { status: "LOCKED", stellarTx: stellarTx || null }, $push: { events: { status: "LOCKED", stellarTx, at: new Date() } } },
      { returnDocument: "after" });
    if (!upd) return res.status(409).json({ error: "intent not in INITIATED state" });
    res.json({ ok: true, status: "LOCKED" });
  });

  // Settle: the rail (sandbox) executes the fiat payout; the oracle attests it.
  app.post("/offramp/settle", async (req, res) => {
    if (guard(res)) return;
    const it = await intents().findOne({ id: req.body?.intentId });
    if (!it) return res.status(404).json({ error: "not found" });
    if (it.status !== "LOCKED") return res.status(409).json({ error: `cannot settle from ${it.status}` });
    const ok = Math.random() < RAILS[it.quote.rail].successRate;
    const railTxRef = `${it.quote.rail}_${randomUUID().slice(0, 8)}`;
    const status = ok ? "SETTLED" : "FAILED";
    const attestation = attest({ intentId: it.id, rail: it.quote.rail, railTxRef, fiatOut: it.quote.fiatOut, currency: it.quote.currency, status });
    await intents().updateOne({ id: it.id }, { $set: { status, railTxRef, attestation }, $push: { events: { status, railTxRef, at: new Date() } } });
    res.json({ status, railTxRef, attestation });
  });

  app.get("/offramp/intent/:id", async (req, res) => {
    if (guard(res)) return;
    const it = await intents().findOne({ id: req.params.id }, { projection: { _id: 0 } });
    if (!it) return res.status(404).json({ error: "not found" });
    res.json(it);
  });

  console.log("off-ramp routes mounted (oracle pubkey published at /offramp/rails)");
}
