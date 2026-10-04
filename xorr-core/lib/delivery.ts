// Encrypted note delivery + global-leaf index client.
//
// Cross-user private payments: the sender creates an output note under the
// recipient's shielded address and encrypts its secret opening (amount,
// blinding) to the recipient's X25519 key (NaCl box). Only ciphertext + a
// routing key leave the device. The recipient scans, decrypts, and — using the
// global leaf index to rebuild the tree — can spend the note.
import nacl from "tweetnacl";
import util from "tweetnacl-util";
import { sha256 } from "@noble/hashes/sha256";
import { DELIVERY_URL } from "./config";
import { toBytes32, toHex } from "./poseidon";

export interface EncKeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

/** Deterministic X25519 keypair derived from the wallet master (recoverable). */
export function encKeyPair(master: bigint): EncKeyPair {
  const seedInput = new Uint8Array([...util.decodeUTF8("sb-enc-v1"), ...toBytes32(master)]);
  const seed = nacl.hash(seedInput).slice(0, 32); // SHA-512 -> 32-byte secret
  return nacl.box.keyPair.fromSecretKey(seed);
}

export const encPubB64 = (kp: EncKeyPair) => util.encodeBase64(kp.publicKey);

export interface NoteBlob {
  ephemeralPub: string;
  nonce: string;
  ciphertext: string;
  commitment?: string;
}

/** Encrypt a JSON payload to a recipient's X25519 public key. */
export function encryptTo(recipientEncPubB64: string, payload: unknown): Omit<NoteBlob, "commitment"> {
  const eph = nacl.box.keyPair();
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const msg = util.decodeUTF8(JSON.stringify(payload));
  const box = nacl.box(msg, nonce, util.decodeBase64(recipientEncPubB64), eph.secretKey);
  return {
    ephemeralPub: util.encodeBase64(eph.publicKey),
    nonce: util.encodeBase64(nonce),
    ciphertext: util.encodeBase64(box),
  };
}

/** Decrypt a blob with the wallet's X25519 secret; null if not ours. */
export function decryptBlob<T = any>(blob: NoteBlob, secretKey: Uint8Array): T | null {
  try {
    const opened = nacl.box.open(
      util.decodeBase64(blob.ciphertext),
      util.decodeBase64(blob.nonce),
      util.decodeBase64(blob.ephemeralPub),
      secretKey,
    );
    if (!opened) return null;
    return JSON.parse(util.encodeUTF8(opened)) as T;
  } catch {
    return null;
  }
}

// ---- Stealth shielded address = the X25519 view key only -------------------
// With stealth notes, each payment is created under a *one-time* note key that
// the sender generates and delivers (encrypted). So the recipient's only public
// identity is their X25519 view key — every note they receive is unlinkable
// on-chain even if the address is reused or made public.
export function encodeAddress(encPub: string): string {
  return `sb1:${encPub}`;
}
export function parseAddress(addr: string): { encPub: string } {
  const m = addr.trim().match(/^sb1:(.+)$/);
  if (!m) throw new Error("invalid shielded address (expected sb1:<encPub>)");
  return { encPub: m[1] };
}

/** Stable URL-safe routing key for an address (hex of sha256(encPub)). */
export function routeKey(encPubB64: string): string {
  return toHex(sha256(util.decodeBase64(encPubB64)));
}

/** This wallet's shareable shielded address (X25519 view key). */
export function myShieldedAddress(master: bigint): string {
  return encodeAddress(encPubB64(encKeyPair(master)));
}

// ---- REST client -----------------------------------------------------------
const api = (p: string) => `${DELIVERY_URL.replace(/\/$/, "")}${p}`;

// Every delivery call goes through a timeout. A bare browser fetch() has NO
// default timeout, so a stalled connection (e.g. a flaky tunnel / cross-origin
// hiccup) would hang forever — and because sync()/scan() are awaited inside
// deposit/pay, that silently froze the whole action (button stuck, no logs).
// fetchT aborts after `ms` and turns a stall into a fast, catchable error.
async function fetchT(url: string, init?: RequestInit, ms = 12000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}
const jsonPost = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export async function health(): Promise<{ ok: boolean; mongo: boolean } | null> {
  try { return await (await fetchT(api("/health"), undefined, 6000)).json(); } catch { return null; }
}
export async function registerAddress(address: string, encPub: string, handle?: string) {
  try { await fetchT(api("/address"), jsonPost({ address, encPub, handle })); } catch { /* best-effort */ }
}
export async function lookupHandle(handle: string): Promise<{ address: string; encPub: string } | null> {
  try { const r = await fetchT(api(`/address/${encodeURIComponent(handle)}`)); return r.ok ? r.json() : null; } catch { return null; }
}
export async function postNote(to: string, blob: NoteBlob) {
  await fetchT(api("/notes"), jsonPost({ to, ...blob })); // caller relies on delivery — surface failure
}
export async function fetchNotes(to: string): Promise<NoteBlob[]> {
  try { const r = await fetchT(api(`/notes/${to}`)); return r.ok ? r.json() : []; } catch { return []; }
}
export async function postLeaves(pool: string, leaves: { index: number; commitment: string }[]) {
  // Retry hard — a dropped leaf here silently desyncs the GLOBAL index, which
  // makes every other wallet compute a stale root (→ on-chain StaleRoot #6).
  // (Fully recoverable via scripts/reconcile-indexer.mjs from chain events.)
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetchT(api("/leaves"), jsonPost({ pool, leaves }));
      if (r.ok) return;
    } catch { /* transient — retry */ }
    await new Promise((s) => setTimeout(s, 400 * (attempt + 1)));
  }
}
export async function fetchLeaves(pool: string): Promise<{ index: number; commitment: string }[]> {
  try { const r = await fetchT(api(`/leaves/${pool}`)); return r.ok ? r.json() : []; } catch { return []; }
}
