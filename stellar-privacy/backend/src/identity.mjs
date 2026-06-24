// Custodial identity endpoints for pay-to-email private payments.
//
// TRUST MODEL: these endpoints are server-to-server only — they are called by
// the Next.js app's API routes, never directly by a browser. The Next app holds
// the user's verified SSO session (Auth.js) and mints a short-lived HS256
// service token (signed with the shared SERVICE_SECRET) carrying the *verified*
// routing identity. This backend re-verifies that token and NEVER trusts a
// client-supplied uid/email.
//
// PROVIDER (IDENTITY_PROVIDER):
//   privy      — keys live in Privy's TEE; identities map to app-owned Stellar
//                wallets (Wallets collection). Shielded master is derived from a
//                deterministic Privy raw_sign; signing is Privy raw_sign. No root
//                key in our env. (Verified live — see test/privy.test.mjs.)
//   selfhosted — keys derived locally from KMS_MASTER (see derive.mjs).
//
// Endpoints:
//   POST /identity/resolve   sender → recipient's deliverable encPub (pre-login OK)
//   POST /identity/provision recipient → their {master, encPub, stellarPub}
//   POST /identity/claim     recipient → fund Stellar account + USDC trustline
//   POST /identity/sign-tx   recipient → sign a Soroban tx for THEIR OWN account
//   POST /identity/notify    sender → email the recipient "payment waiting"
import { jwtVerify } from "jose";
import {
  Horizon, Keypair, TransactionBuilder, Operation, Asset, BASE_FEE, Networks,
} from "@stellar/stellar-sdk";
import {
  recipientToUid, normalizeEmail, isEmail,
  deriveIdentity, deriveStellar, emailHash, loadKmsMaster, loadEmailPepper,
} from "./derive.mjs";
import {
  privyConfigured, createStellarWallet, deriveIdentityViaPrivy, signStellarTx,
} from "./privy.mjs";
import { getMailer } from "./mailer.mjs";

const ISSUER = "xorr-next";
const AUDIENCE = "xorr-backend";
const APP_URL = process.env.APP_URL || "http://localhost:3000";
const HORIZON_URL = process.env.HORIZON_URL || "https://horizon-testnet.stellar.org";
const FRIENDBOT_URL = process.env.FRIENDBOT_URL || "https://friendbot.stellar.org";
const NET_PASSPHRASE = process.env.STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET;
const USDC_CODE = process.env.USDC_CODE || "USDC";
const USDC_ISSUER = process.env.USDC_ISSUER || "";
const PROVIDER = (process.env.IDENTITY_PROVIDER || "selfhosted").toLowerCase();

const hits = new Map();
function rateLimit(key, max, windowMs, res) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { res.status(429).json({ error: "rate limited — slow down" }); return false; }
  arr.push(now); hits.set(key, arr); return true;
}

export function registerIdentity(app, { addresses, wallets, ready }) {
  let KMS = null, PEPPER, SERVICE_KEY;
  try {
    const s = process.env.SERVICE_SECRET;
    if (!s || s.length < 16) throw new Error("SERVICE_SECRET missing/short in backend/.env (≥16 chars)");
    SERVICE_KEY = new TextEncoder().encode(s);
    PEPPER = loadEmailPepper();
    if (PROVIDER === "privy") {
      if (!privyConfigured()) throw new Error("IDENTITY_PROVIDER=privy but PRIVY_APP_ID/SECRET missing");
      console.log("identity layer: provider=privy (keys in Privy TEE) + EMAIL_PEPPER + SERVICE_SECRET");
    } else {
      KMS = loadKmsMaster();
      console.log("identity layer: provider=selfhosted (KMS_MASTER) + EMAIL_PEPPER + SERVICE_SECRET");
    }
  } catch (e) {
    console.error("identity layer DISABLED:", e.message);
    const off = (_req, res) => res.status(503).json({ error: "identity layer not configured" });
    for (const p of ["/identity/resolve", "/identity/provision", "/identity/claim", "/identity/sign-tx", "/identity/notify"]) app.post(p, off);
    return;
  }

  const horizon = new Horizon.Server(HORIZON_URL, { allowHttp: HORIZON_URL.startsWith("http://") });
  const requireMongo = (res) => (ready() ? false : (res.status(503).json({ error: "delivery DB not connected yet" }), true));

  // Map an identity uid → an app-owned Privy Stellar wallet (get-or-create, race-safe).
  async function getOrCreateWallet(uid) {
    const found = await wallets().findOne({ identityKey: uid });
    if (found) return { walletId: found.walletId, address: found.address };
    const w = await createStellarWallet();
    await wallets().updateOne(
      { identityKey: uid },
      { $setOnInsert: { identityKey: uid, walletId: w.walletId, address: w.address, createdAt: new Date() } },
      { upsert: true },
    );
    const saved = await wallets().findOne({ identityKey: uid }); // resolve a possible upsert race
    return { walletId: saved.walletId, address: saved.address };
  }

  // Provider-agnostic identity bundle for a uid: { master, encPub, routeKey, stellarPub, walletId? }.
  async function identityFor(uid) {
    if (PROVIDER === "privy") {
      const { walletId, address } = await getOrCreateWallet(uid);
      const id = await deriveIdentityViaPrivy(walletId, address);
      return { ...id, walletId };
    }
    return deriveIdentity(KMS, uid); // selfhosted
  }

  // Defense-in-depth: reject browser cross-origin calls (these are server-only).
  const blockBrowser = (req, res) => {
    const origin = req.headers.origin;
    if (origin && origin !== APP_URL) { res.status(403).json({ error: "forbidden origin" }); return true; }
    return false;
  };

  const requireService = async (req, res, next) => {
    if (blockBrowser(req, res)) return;
    try {
      const auth = req.headers.authorization || "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
      if (!token) return res.status(401).json({ error: "missing service token" });
      const { payload } = await jwtVerify(token, SERVICE_KEY, {
        algorithms: ["HS256"], issuer: ISSUER, audience: AUDIENCE,
      });
      req.svc = payload;
      next();
    } catch {
      return res.status(401).json({ error: "invalid service token" });
    }
  };

  // ── resolve: email/@handle → deliverable encPub (works pre-login) ─────────
  app.post("/identity/resolve", requireService, async (req, res) => {
    if (requireMongo(res)) return;
    if (!rateLimit(`resolve:${req.svc.routingUid}`, 60, 60_000, res)) return;
    const recipient = String(req.body?.recipient || "").trim();
    if (!recipient) return res.status(400).json({ error: "recipient required" });
    if (recipient.startsWith("sb1:")) return res.status(400).json({ error: "sb1 address needs no resolution" });
    let uid, normEmail = null;
    try {
      uid = recipientToUid(recipient);
      if (isEmail(recipient)) normEmail = normalizeEmail(recipient);
    } catch (e) { return res.status(400).json({ error: e.message }); }

    try {
      const id = await identityFor(uid);
      const emailHashHex = normEmail ? emailHash(PEPPER, normEmail) : null;
      const exists = !!(await addresses().findOne({ encPub: id.encPub }));
      res.json({ encPub: id.encPub, routeKey: id.routeKey, exists, emailHashHex, uidNorm: uid });
    } catch (e) {
      res.status(502).json({ error: `resolve failed: ${String(e.message).slice(0, 160)}` });
    }
  });

  // ── provision: recipient's own custodial identity (secrets cross here) ─────
  app.post("/identity/provision", requireService, async (req, res) => {
    if (requireMongo(res)) return;
    const { routingUid, emailNorm } = req.svc;
    if (!routingUid) return res.status(400).json({ error: "token missing routingUid" });
    try {
      const id = await identityFor(routingUid);
      const filter = emailNorm ? { emailHash: emailHash(PEPPER, emailNorm) } : { encPub: id.encPub };
      await addresses().updateOne(
        filter,
        { $set: { encPub: id.encPub, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
        { upsert: true },
      );
      res.set("Cache-Control", "no-store");
      // stellarSecret is NEVER returned (Privy: it doesn't exist outside the TEE;
      // selfhosted: signing is server-side). `master` is required client-side to decrypt.
      res.json({ master: id.master, encPub: id.encPub, stellarPub: id.stellarPub, routeKey: id.routeKey });
    } catch (e) {
      res.status(502).json({ error: `provision failed: ${String(e.message).slice(0, 160)}` });
    }
  });

  // ── claim: ensure the recipient's Stellar account exists + USDC trustline ──
  app.post("/identity/claim", requireService, async (req, res) => {
    if (requireMongo(res)) return;
    const { routingUid, emailNorm } = req.svc;
    if (!routingUid) return res.status(400).json({ error: "token missing routingUid" });

    let id;
    try { id = await identityFor(routingUid); } catch (e) {
      return res.status(502).json({ error: `claim derivation failed: ${String(e.message).slice(0, 120)}` });
    }
    const pub = id.stellarPub;
    const filter = emailNorm ? { emailHash: emailHash(PEPPER, emailNorm) } : { encPub: id.encPub };

    let funded = false, trustline = false, account = null;
    try { account = await horizon.loadAccount(pub); funded = true; } catch { /* not created yet */ }
    if (!funded) {
      try {
        const r = await fetch(`${FRIENDBOT_URL}/?addr=${encodeURIComponent(pub)}`);
        if (r.ok) { account = await horizon.loadAccount(pub); funded = true; }
      } catch (e) { return res.status(502).json({ error: `friendbot failed: ${String(e.message).slice(0, 120)}` }); }
    }

    if (funded && USDC_ISSUER) {
      const has = account.balances?.some((b) => b.asset_code === USDC_CODE && b.asset_issuer === USDC_ISSUER);
      if (has) trustline = true;
      else {
        try {
          const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NET_PASSPHRASE })
            .addOperation(Operation.changeTrust({ asset: new Asset(USDC_CODE, USDC_ISSUER) }))
            .setTimeout(60).build();
          const signedXdr = await signFor(routingUid, id, tx);
          await horizon.submitTransaction(TransactionBuilder.fromXDR(signedXdr, NET_PASSPHRASE));
          trustline = true;
        } catch (e) { console.warn("trustline add failed (non-fatal):", String(e.message).slice(0, 120)); }
      }
    }

    await addresses().updateOne(filter, { $set: { funded, trustline, claimedAt: new Date() } }, { upsert: true });
    res.set("Cache-Control", "no-store");
    res.json({ stellarPub: pub, funded, trustline });
  });

  // Sign a built/raw tx for the identity, via the active provider.
  async function signFor(uid, id, txOrXdr) {
    const xdr = typeof txOrXdr === "string" ? txOrXdr : txOrXdr.toXDR();
    if (PROVIDER === "privy") {
      const walletId = id?.walletId || (await getOrCreateWallet(uid)).walletId;
      const address = id?.stellarPub || (await getOrCreateWallet(uid)).address;
      return signStellarTx(walletId, address, xdr, NET_PASSPHRASE);
    }
    const kp = deriveStellar(KMS, uid);
    const tx = TransactionBuilder.fromXDR(xdr, NET_PASSPHRASE);
    if (tx.source !== kp.publicKey()) throw new Error("refusing to sign: tx source is not your account");
    tx.sign(kp);
    return tx.toXDR();
  }

  // ── sign-tx: sign a Soroban tx, but ONLY for the caller's own account ──────
  app.post("/identity/sign-tx", requireService, async (req, res) => {
    const { routingUid } = req.svc;
    const xdrStr = String(req.body?.xdr || "");
    if (!routingUid || !xdrStr) return res.status(400).json({ error: "routingUid + xdr required" });
    try {
      const id = await identityFor(routingUid);
      // signStellarTx / signFor both enforce that the tx source == this account.
      const signedXdr = await signFor(routingUid, id, xdrStr);
      res.set("Cache-Control", "no-store");
      res.json({ signedXdr });
    } catch (e) {
      const msg = String(e.message);
      const code = msg.includes("refusing to sign") ? 403 : msg.includes("invalid") ? 400 : 502;
      res.status(code).json({ error: msg.slice(0, 160) });
    }
  });

  // ── notify: email the recipient that a payment is waiting (no amount) ──────
  app.post("/identity/notify", requireService, async (req, res) => {
    if (!rateLimit(`notify:${req.svc.routingUid}`, 20, 60_000, res)) return;
    const email = String(req.body?.email || "").trim();
    if (!isEmail(email)) return res.status(400).json({ error: "valid email required" });
    try {
      const sent = await getMailer().sendClaim(email);
      res.json({ ok: true, id: sent?.id });
    } catch (e) {
      res.status(502).json({ error: `mail send failed: ${String(e.message).slice(0, 120)}` });
    }
  });
}
