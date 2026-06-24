// Backend mirror of xorr-core/lib/identity/derive.ts (+ normalize.ts).
//
// This file holds the custodial root secret `KMS_MASTER` and the email pepper.
// It MUST stay byte-for-byte compatible with the frontend derivation: the X25519
// `encPub` derived here (so a sender can route a note by email) has to equal the
// one the recipient's browser derives after SSO, or the payment is undeliverable.
// Any change to the derivation math here must be mirrored in derive.ts (and vice
// versa); test/identity.derive.test.ts pins known-answer vectors that guard it.
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";
import { hmac } from "@noble/hashes/hmac";
import { Keypair } from "@stellar/stellar-sdk";
import nacl from "tweetnacl";
import util from "tweetnacl-util";

export const FIELD =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

const HKDF_INFO_MASTER = "xorr-shielded-master-v1";
const HKDF_INFO_STELLAR = "xorr-stellar-ed25519-v1";

const utf8 = (s) => new TextEncoder().encode(s);

function beToBigInt(b) {
  let v = 0n;
  for (const byte of b) v = (v << 8n) | BigInt(byte);
  return v;
}

// Big-endian 32-byte encoding — mirror of poseidon.ts:toBytes32.
function toBytes32(x) {
  const out = new Uint8Array(32);
  let v = x;
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}
const toHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

// ── normalization (mirror of lib/identity/normalize.ts) ────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmail = (s) => EMAIL_RE.test(String(s).trim());

export function normalizeEmail(raw) {
  const e = String(raw).trim().toLowerCase();
  if (!isEmail(e)) throw new Error("invalid email address");
  const at = e.lastIndexOf("@");
  let local = e.slice(0, at);
  let domain = e.slice(at + 1);
  const plus = local.indexOf("+");
  if (plus >= 0) local = local.slice(0, plus);
  const isGmail = domain === "gmail.com" || domain === "googlemail.com";
  if (isGmail) {
    local = local.replace(/\./g, "");
    domain = "gmail.com";
  }
  if (!local) throw new Error("invalid email address");
  return `${local}@${domain}`;
}

export const normalizeHandle = (raw) =>
  String(raw).trim().toLowerCase().replace(/^@+/, "");

export function recipientToUid(recipient) {
  const r = String(recipient).trim();
  if (isEmail(r)) return `email:${normalizeEmail(r)}`;
  return `handle:${normalizeHandle(r)}`;
}

// ── derivation (mirror of lib/identity/derive.ts) ──────────────────────────
export function deriveMaster(kmsMaster, uid) {
  const okm = hkdf(sha256, kmsMaster, sha256(utf8(uid)), HKDF_INFO_MASTER, 32);
  return beToBigInt(okm) % FIELD;
}

// Mirror of delivery.ts:encKeyPair — deterministic X25519 keypair from master.
export function encKeyPair(master) {
  const seedInput = new Uint8Array([...util.decodeUTF8("sb-enc-v1"), ...toBytes32(master)]);
  const seed = nacl.hash(seedInput).slice(0, 32);
  return nacl.box.keyPair.fromSecretKey(seed);
}
export const encPubB64 = (kp) => util.encodeBase64(kp.publicKey);
export const deriveEncPub = (master) => encPubB64(encKeyPair(master));

// Mirror of delivery.ts:routeKey.
export const routeKey = (encPub) => toHex(sha256(util.decodeBase64(encPub)));

export function deriveStellar(kmsMaster, uid) {
  const seed = hkdf(sha256, kmsMaster, sha256(utf8(uid)), HKDF_INFO_STELLAR, 32);
  return Keypair.fromRawEd25519Seed(Buffer.from(seed));
}

export function deriveIdentity(kmsMaster, uid) {
  const master = deriveMaster(kmsMaster, uid);
  const kp = deriveStellar(kmsMaster, uid);
  const encPub = deriveEncPub(master);
  return {
    uid,
    master: master.toString(),
    encPub,
    routeKey: routeKey(encPub),
    stellarPub: kp.publicKey(),
    stellarSecret: kp.secret(),
  };
}

// Salted, non-reversible tag for an email — the ONLY email-derived value ever
// persisted (plaintext emails are used transiently and discarded).
export function emailHash(pepper, normEmail) {
  return toHex(hmac(sha256, utf8(pepper), utf8(normEmail)));
}

// ── env loaders (fail loud if misconfigured) ───────────────────────────────
export function loadKmsMaster() {
  const b64 = process.env.KMS_MASTER;
  if (!b64) throw new Error("KMS_MASTER missing in backend/.env (32+ random bytes, base64)");
  const bytes = Buffer.from(b64, "base64");
  if (bytes.length < 32) throw new Error("KMS_MASTER too short — need ≥32 bytes of entropy");
  return new Uint8Array(bytes);
}
export function loadEmailPepper() {
  const p = process.env.EMAIL_PEPPER;
  if (!p || p.length < 16) throw new Error("EMAIL_PEPPER missing/short in backend/.env (≥16 chars)");
  return p;
}
