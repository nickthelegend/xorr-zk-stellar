// Privy custodial-wallet provider (server-side).
//
// Verified against the live Privy API (see scripts/verify-privy*.mjs):
//   - POST /v1/wallets { chain_type:'stellar' }      → a real Stellar account
//   - POST /v1/wallets/{id}/raw_sign { params:{hash}} → ed25519 over a 32B hash,
//     DETERMINISTIC (RFC 8032) — same wallet+hash ⇒ same signature.
//
// Two things the rest of the app needs come from those primitives:
//   1. A Stellar account that signs pool/withdraw txs (sign the tx HASH).
//   2. A shielded encryption identity. NaCl-box note delivery needs a key the
//      recipient can use to DECRYPT, and Privy never exposes the raw ed25519
//      secret. So we derive the shielded master from a DETERMINISTIC raw_sign of
//      a fixed domain-separation hash: HKDF(rawSign(wallet, FIXED)) → master.
//      The signing key lives in Privy's TEE (not in our env), but app
//      credentials can reproduce the signature — see AUDIT.md for the custody
//      analysis. The derived master then feeds the EXISTING encKeyPair() so the
//      X25519 encPub is byte-identical to what the frontend computes.
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";
import { TransactionBuilder } from "@stellar/stellar-sdk";
import { FIELD, encKeyPair, encPubB64, routeKey } from "./derive.mjs";

const BASE = process.env.PRIVY_API_URL || "https://api.privy.io";

// Fixed hash whose deterministic signature seeds the shielded identity.
const SHIELD_HASH =
  "0x" + Buffer.from(sha256(new TextEncoder().encode("xorr-shielded-identity-v1"))).toString("hex");

function headers() {
  const id = process.env.PRIVY_APP_ID, secret = process.env.PRIVY_APP_SECRET;
  if (!id || !secret) throw new Error("PRIVY_APP_ID / PRIVY_APP_SECRET missing in backend/.env");
  return {
    authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
    "privy-app-id": id,
    "content-type": "application/json",
  };
}

export function privyConfigured() {
  return Boolean(process.env.PRIVY_APP_ID && process.env.PRIVY_APP_SECRET);
}

async function api(method, path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method, headers: headers(), body: body ? JSON.stringify(body) : undefined,
  });
  const json = await r.json().catch(() => ({}));
  if (r.status >= 300) throw new Error(`privy ${path} ${r.status}: ${JSON.stringify(json).slice(0, 200)}`);
  return json;
}

/** Create a fresh app-owned Stellar wallet. */
export async function createStellarWallet() {
  const w = await api("POST", "/v1/wallets", { chain_type: "stellar" });
  return { walletId: w.id, address: w.address, publicKeyHex: w.public_key };
}

/** Deterministic ed25519 raw signature (hex, no 0x) over a 32-byte hash. */
export async function rawSign(walletId, hashHex) {
  const hash = hashHex.startsWith("0x") ? hashHex : "0x" + hashHex;
  const j = await api("POST", `/v1/wallets/${walletId}/raw_sign`, { params: { hash } });
  const sig = (j.data || j).signature;
  if (!sig) throw new Error("privy raw_sign: no signature in response");
  return sig.replace(/^0x/, "");
}

/** Shielded master (BN254 field element) seeded by the wallet's TEE key. */
export async function deriveShieldedMaster(walletId) {
  const sigHex = await rawSign(walletId, SHIELD_HASH);
  const okm = hkdf(
    sha256,
    Buffer.from(sigHex, "hex"),
    sha256(new TextEncoder().encode("xorr-shielded-salt")),
    "xorr-shielded-master-privy-v1",
    32,
  );
  let v = 0n;
  for (const b of okm) v = (v << 8n) | BigInt(b);
  return v % FIELD;
}

/** Full custodial identity bundle from a Privy wallet. */
export async function deriveIdentityViaPrivy(walletId, address) {
  const master = await deriveShieldedMaster(walletId);
  const encPub = encPubB64(encKeyPair(master));
  return { master: master.toString(), encPub, routeKey: routeKey(encPub), stellarPub: address };
}

/**
 * Sign a Stellar tx XDR with the Privy wallet and return the signed XDR.
 * Refuses to sign if the tx source isn't the wallet's own account.
 */
export async function signStellarTx(walletId, address, xdr, networkPassphrase) {
  const tx = TransactionBuilder.fromXDR(xdr, networkPassphrase);
  if (tx.source !== address) throw new Error("refusing to sign: tx source is not this wallet's account");
  const sigHex = await rawSign(walletId, tx.hash().toString("hex"));
  tx.addSignature(address, Buffer.from(sigHex, "hex").toString("base64")); // validates sig vs hash+address
  return tx.toXDR();
}
