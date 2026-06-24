// ShieldedBridge — encrypted note delivery layer.
//
// Cross-user private payments need the recipient to learn the secret opening
// (amount, blinding) of the note created for them. We deliver that as an
// END-TO-END ENCRYPTED blob: the sender encrypts it to the recipient's X25519
// key (NaCl box) and posts it here, routed only by the recipient's shielded
// address. This server (and MongoDB) only ever see ciphertext + a routing key
// + the already-public commitment — never amounts, blindings, or spend keys.
//
// Tradeoff vs. on-chain `ext_data`: centralized (availability/censorship) and
// leaks delivery *metadata* (which address got a blob, when). The decentralized
// upgrade is to emit the same ciphertext on-chain from `transfer`.
import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import { config as dotenv } from "dotenv";
import { registerOfframp } from "./offramp.mjs";
import { registerFaucet } from "./faucet.mjs";
import { registerIdentity } from "./identity.mjs";
dotenv({ path: new URL("../.env", import.meta.url) });

const PORT = process.env.PORT || 8787;
const URI = process.env.MONGODB_URI;
if (!URI) throw new Error("MONGODB_URI missing in backend/.env");

const client = new MongoClient(URI, { serverSelectionTimeoutMS: 8000 });
let Notes = null, Addresses = null, Leaves = null, Intents = null, Wallets = null, mongoReady = false;

async function connectMongo() {
  try {
    await client.connect();
    const db = client.db("shieldedbridge");
    Notes = db.collection("notes");
    Addresses = db.collection("addresses");
    Leaves = db.collection("leaves");
    Intents = db.collection("intents");
    Wallets = db.collection("wallets"); // identity uid → Privy wallet (pay-to-email)
    await Notes.createIndex({ to: 1, createdAt: 1 });
    await Addresses.createIndex({ handle: 1 }, { unique: true, sparse: true });
    await Addresses.createIndex({ emailHash: 1 }, { unique: true, sparse: true });
    await Addresses.createIndex({ encPub: 1 }, { sparse: true });
    await Leaves.createIndex({ pool: 1, index: 1 }, { unique: true });
    await Intents.createIndex({ id: 1 }, { unique: true });
    await Wallets.createIndex({ identityKey: 1 }, { unique: true });
    mongoReady = true;
    console.log("connected to MongoDB; collections ready");
  } catch (e) {
    mongoReady = false;
    console.error("MongoDB connect failed (is this IP allow-listed in Atlas?):", e.message.slice(0, 160));
    setTimeout(connectMongo, 10000); // retry — works as soon as the IP is allow-listed
  }
}
connectMongo();
const requireMongo = (res) => (mongoReady ? false : (res.status(503).json({ error: "delivery DB not connected yet (allow-list this IP in Atlas)" }), true));

const app = express();
app.use(cors());
app.use(express.json({ limit: "256kb" }));

app.get("/health", (_req, res) => res.json({ ok: true, mongo: mongoReady, ts: Date.now() }));

// Register/lookup a human handle -> shielded address (addrPk + encPub).
app.post("/address", async (req, res) => {
  if (requireMongo(res)) return;
  const { handle, address, encPub } = req.body || {};
  if (!address || !encPub) return res.status(400).json({ error: "address + encPub required" });
  await Addresses.updateOne(
    { address },
    { $set: { handle: handle || null, address, encPub, updatedAt: new Date() } },
    { upsert: true },
  );
  res.json({ ok: true });
});

app.get("/address/:handle", async (req, res) => {
  if (requireMongo(res)) return;
  const a = await Addresses.findOne({ handle: req.params.handle });
  if (!a) return res.status(404).json({ error: "not found" });
  res.json({ address: a.address, encPub: a.encPub, handle: a.handle });
});

// Post an encrypted note blob for a recipient (routed by `to` = addr pubkey).
app.post("/notes", async (req, res) => {
  if (requireMongo(res)) return;
  const { to, ephemeralPub, nonce, ciphertext, commitment } = req.body || {};
  if (!to || !ephemeralPub || !nonce || !ciphertext) {
    return res.status(400).json({ error: "to, ephemeralPub, nonce, ciphertext required" });
  }
  await Notes.insertOne({ to, ephemeralPub, nonce, ciphertext, commitment, createdAt: new Date() });
  res.json({ ok: true });
});

// Fetch encrypted blobs addressed to `to` (recipient scans + decrypts locally).
app.get("/notes/:to", async (req, res) => {
  if (requireMongo(res)) return;
  const blobs = await Notes.find({ to: req.params.to }).sort({ createdAt: 1 }).limit(500).toArray();
  res.json(blobs.map((b) => ({
    ephemeralPub: b.ephemeralPub, nonce: b.nonce, ciphertext: b.ciphertext,
    commitment: b.commitment, createdAt: b.createdAt,
  })));
});

// --- Global commitment index (shared Merkle tree) ---------------------------
// Every shielded op appends its new commitments here in insertion order, so any
// wallet can rebuild the exact on-chain tree and prove membership of notes it
// received from others. Commitments are public (they're on-chain); this is a
// convenience indexer, not a privacy leak.
app.post("/leaves", async (req, res) => {
  if (requireMongo(res)) return;
  const { pool, leaves } = req.body || {}; // leaves: [{ index, commitment }]
  if (!pool || !Array.isArray(leaves)) return res.status(400).json({ error: "pool + leaves[] required" });
  for (const l of leaves) {
    await Leaves.updateOne(
      { pool, index: l.index },
      { $setOnInsert: { pool, index: l.index, commitment: l.commitment, at: new Date() } },
      { upsert: true },
    );
  }
  res.json({ ok: true, count: leaves.length });
});

app.get("/leaves/:pool", async (req, res) => {
  if (requireMongo(res)) return;
  const rows = await Leaves.find({ pool: req.params.pool }).sort({ index: 1 }).toArray();
  res.json(rows.map((r) => ({ index: r.index, commitment: r.commitment })));
});

registerOfframp(app, { intents: () => Intents, ready: () => mongoReady });
registerFaucet(app);
// Custodial pay-to-email identity layer (server-to-server; see identity.mjs).
registerIdentity(app, { addresses: () => Addresses, wallets: () => Wallets, ready: () => mongoReady });

app.listen(PORT, () => console.log(`delivery layer on http://localhost:${PORT}`));
