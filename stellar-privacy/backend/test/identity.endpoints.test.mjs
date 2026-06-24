// Integration test for the real /identity/* HTTP endpoints with the Privy
// provider wired in. Uses in-memory collections (no MongoDB) and the LIVE Privy
// API. Run:
//   IDENTITY_PROVIDER=privy PRIVY_APP_ID=… PRIVY_APP_SECRET=… \
//   SERVICE_SECRET=… EMAIL_PEPPER=… node --test test/identity.endpoints.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { SignJWT } from "jose";
import { registerIdentity } from "../src/identity.mjs";
import { privyConfigured } from "../src/privy.mjs";

const SKIP = !(privyConfigured() && process.env.SERVICE_SECRET && process.env.EMAIL_PEPPER);
const skip = SKIP ? "needs IDENTITY_PROVIDER=privy + PRIVY creds + SERVICE_SECRET + EMAIL_PEPPER" : false;

// Tiny in-memory Mongo-ish collection.
function mem() {
  const docs = [];
  const match = (d, q) => Object.entries(q).every(([k, v]) => d[k] === v);
  return {
    _docs: docs,
    async findOne(q) { return docs.find((d) => match(d, q)) || null; },
    async updateOne(filter, update, opts = {}) {
      let d = docs.find((x) => match(x, filter));
      const inserting = !d;
      if (!d) { if (!opts.upsert) return; d = { ...filter }; docs.push(d); }
      if (update.$set) Object.assign(d, update.$set);
      if (update.$setOnInsert && inserting) for (const [k, v] of Object.entries(update.$setOnInsert)) if (!(k in d)) d[k] = v;
    },
  };
}

let server, base, Addresses, Wallets;
const SVC = process.env.SERVICE_SECRET || "x";

async function token(claims) {
  return new SignJWT(claims).setProtectedHeader({ alg: "HS256" })
    .setIssuer("xorr-next").setAudience("xorr-backend")
    .setIssuedAt().setExpirationTime("2m").sign(new TextEncoder().encode(SVC));
}
async function call(path, claims, body) {
  const headers = { "content-type": "application/json" };
  if (claims) headers.authorization = `Bearer ${await token(claims)}`;
  const r = await fetch(`${base}${path}`, { method: "POST", headers, body: JSON.stringify(body || {}) });
  return { status: r.status, json: await r.json().catch(() => ({})) };
}

before(async () => {
  if (SKIP) return;
  Addresses = mem(); Wallets = mem();
  const app = express();
  app.use(express.json());
  registerIdentity(app, { addresses: () => Addresses, wallets: () => Wallets, ready: () => true });
  await new Promise((res) => { server = app.listen(0, res); });
  base = `http://localhost:${server.address().port}`;
});
after(() => server && server.close());

test("rejects calls without a service token", { skip }, async () => {
  const r = await call("/identity/resolve", null, { recipient: "bob@gmail.com" });
  assert.equal(r.status, 401);
});

test("resolve creates+returns a deliverable encPub for an email (pre-login)", { skip }, async () => {
  const r = await call("/identity/resolve", { routingUid: "email:sender@x.com", role: "send" }, { recipient: "bob@gmail.com" });
  assert.equal(r.status, 200);
  assert.match(r.json.encPub, /^[A-Za-z0-9+/]{43}=$/);
  assert.equal(r.json.routeKey.length, 64);
  assert.equal(r.json.exists, false, "not provisioned yet");
  assert.equal(r.json.uidNorm, "email:bob@gmail.com");
});

test("THE INVARIANT: recipient's provisioned encPub == sender's resolved encPub", { skip }, async () => {
  // Sender resolves bob's key…
  const resolved = await call("/identity/resolve", { routingUid: "email:sender@x.com", role: "send" }, { recipient: "B.OB+promo@gmail.com" });
  // …bob logs in (normalized identity) and provisions his own wallet.
  const provisioned = await call("/identity/provision", { routingUid: "email:bob@gmail.com", emailNorm: "bob@gmail.com", role: "recv" });
  assert.equal(provisioned.status, 200);
  assert.equal(resolved.json.encPub, provisioned.json.encPub, "sender and recipient derive the SAME encryption key");
  assert.match(provisioned.json.stellarPub, /^G[A-Z2-7]{55}$/);
  assert.ok(provisioned.json.master, "client receives master to decrypt");
});

test("resolve now reports exists:true after provisioning", { skip }, async () => {
  const r = await call("/identity/resolve", { routingUid: "email:sender@x.com", role: "send" }, { recipient: "bob@gmail.com" });
  assert.equal(r.json.exists, true);
});

test("two identities are unlinkable (different encPub + Stellar account)", { skip }, async () => {
  const a = await call("/identity/provision", { routingUid: "email:alice@gmail.com", emailNorm: "alice@gmail.com", role: "recv" });
  const b = await call("/identity/provision", { routingUid: "handle:carol", role: "recv" });
  assert.notEqual(a.json.encPub, b.json.encPub);
  assert.notEqual(a.json.stellarPub, b.json.stellarPub);
});

test("sign-tx refuses a tx whose source is not the caller's account", { skip }, async () => {
  // A minimal, well-formed XDR for a DIFFERENT account → must be refused (403).
  const { TransactionBuilder, Operation, Networks, BASE_FEE } = await import("@stellar/stellar-sdk");
  const fake = { accountId: () => "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", sequenceNumber: () => "1", incrementSequenceNumber() {} };
  const tx = new TransactionBuilder(fake, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.bumpSequence({ bumpTo: "2" })).setTimeout(60).build();
  const r = await call("/identity/sign-tx", { routingUid: "email:bob@gmail.com", role: "recv" }, { xdr: tx.toXDR() });
  assert.equal(r.status, 403);
});
