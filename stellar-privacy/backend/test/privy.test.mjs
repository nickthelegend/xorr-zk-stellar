// Live integration tests for the Privy Stellar provider.
// Run: PRIVY_APP_ID=… PRIVY_APP_SECRET=… node --test test/privy.test.mjs
// Set PRIVY_LIVE_SUBMIT=1 to also fund + sign + submit a real testnet tx.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import {
  Horizon, TransactionBuilder, Operation, Networks, BASE_FEE,
} from "@stellar/stellar-sdk";
import {
  privyConfigured, createStellarWallet, rawSign,
  deriveShieldedMaster, deriveIdentityViaPrivy, signStellarTx,
} from "../src/privy.mjs";
import { FIELD, encKeyPair, encPubB64 } from "../src/derive.mjs";

const SKIP = !privyConfigured();
const skip = SKIP ? "PRIVY_APP_ID/SECRET not set" : false;

let wallet; // shared, created once
before(async () => { if (!SKIP) wallet = await createStellarWallet(); });

test("creates a real Stellar wallet", { skip }, () => {
  assert.match(wallet.address, /^G[A-Z2-7]{55}$/, "valid Stellar G-address");
  assert.ok(wallet.walletId, "has a wallet id");
});

test("raw_sign is deterministic (RFC 8032 ed25519)", { skip }, async () => {
  const h = "0x" + "5a".repeat(32);
  const a = await rawSign(wallet.walletId, h);
  const b = await rawSign(wallet.walletId, h);
  assert.equal(a, b);
  assert.equal(Buffer.from(a, "hex").length, 64, "64-byte signature");
});

test("shielded master is deterministic and a valid BN254 field element", { skip }, async () => {
  const m1 = await deriveShieldedMaster(wallet.walletId);
  const m2 = await deriveShieldedMaster(wallet.walletId);
  assert.equal(m1, m2);
  assert.ok(m1 > 0n && m1 < FIELD);
});

test("identity bundle: encPub matches encKeyPair(master) (delivery-layer invariant)", { skip }, async () => {
  const id = await deriveIdentityViaPrivy(wallet.walletId, wallet.address);
  assert.equal(id.encPub.length, 44, "base64 of 32-byte X25519 pubkey");
  assert.equal(id.routeKey.length, 64, "hex sha256");
  assert.equal(id.stellarPub, wallet.address);
  // The master we hand the client must reproduce the same encPub it was routed under.
  assert.equal(encPubB64(encKeyPair(BigInt(id.master))), id.encPub);
});

test("distinct wallets yield unlinkable identities", { skip }, async () => {
  const w2 = await createStellarWallet();
  const a = await deriveIdentityViaPrivy(wallet.walletId, wallet.address);
  const b = await deriveIdentityViaPrivy(w2.walletId, w2.address);
  assert.notEqual(a.master, b.master);
  assert.notEqual(a.encPub, b.encPub);
  assert.notEqual(a.stellarPub, b.stellarPub);
});

test("refuses to sign a tx for a different account", { skip }, async () => {
  // Build a tx whose source is NOT our wallet → signStellarTx must reject.
  const other = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
  const fakeAccount = { accountId: () => other, sequenceNumber: () => "1", incrementSequenceNumber() {} };
  const tx = new TransactionBuilder(fakeAccount, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.bumpSequence({ bumpTo: "2" })).setTimeout(60).build();
  await assert.rejects(() => signStellarTx(wallet.walletId, wallet.address, tx.toXDR(), Networks.TESTNET));
});

test("end-to-end: fund + Privy-sign + submit on testnet", {
  skip: SKIP ? skip : (process.env.PRIVY_LIVE_SUBMIT ? false : "set PRIVY_LIVE_SUBMIT=1 to run"),
}, async () => {
  const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
  const w = await createStellarWallet();
  await fetch(`https://friendbot.stellar.org/?addr=${encodeURIComponent(w.address)}`);
  const account = await horizon.loadAccount(w.address);
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.manageData({ name: "xorr-privy-test", value: "ok" }))
    .setTimeout(120).build();
  const signedXdr = await signStellarTx(w.walletId, w.address, tx.toXDR(), Networks.TESTNET);
  const res = await horizon.submitTransaction(TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET));
  assert.ok(res.successful, "tx applied on-chain");
  console.log("    on-chain tx:", res.hash);
});
