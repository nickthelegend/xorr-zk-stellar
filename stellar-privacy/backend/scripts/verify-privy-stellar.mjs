// End-to-end proof that a Privy-managed Stellar wallet can transact on testnet:
//   friendbot-fund → build a real tx → sign via Privy server API → submit on-chain.
// Run with PRIVY_APP_ID / PRIVY_APP_SECRET set. Optionally PRIVY_WALLET_ID/ADDRESS
// to reuse a wallet; otherwise a fresh Stellar wallet is created.
import {
  Horizon, TransactionBuilder, Operation, Networks, BASE_FEE,
} from "@stellar/stellar-sdk";

const APP_ID = process.env.PRIVY_APP_ID;
const APP_SECRET = process.env.PRIVY_APP_SECRET;
if (!APP_ID || !APP_SECRET) { console.error("set PRIVY_APP_ID / PRIVY_APP_SECRET"); process.exit(1); }

const headers = {
  authorization: `Basic ${Buffer.from(`${APP_ID}:${APP_SECRET}`).toString("base64")}`,
  "privy-app-id": APP_ID,
  "content-type": "application/json",
};
const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");

async function privy(method, path, body) {
  const r = await fetch(`https://api.privy.io${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, json: await r.json().catch(() => ({})) };
}

(async () => {
  // 1) wallet
  let walletId = process.env.PRIVY_WALLET_ID;
  let address = process.env.PRIVY_ADDRESS;
  if (!walletId) {
    const c = await privy("POST", "/v1/wallets", { chain_type: "stellar" });
    walletId = c.json.id; address = c.json.address;
    console.log(`created wallet ${walletId} → ${address}`);
  } else {
    console.log(`reusing wallet ${walletId} → ${address}`);
  }

  // 2) fund via friendbot (idempotent)
  let account;
  try { account = await horizon.loadAccount(address); console.log("already funded"); }
  catch {
    console.log("funding via friendbot…");
    const fb = await fetch(`https://friendbot.stellar.org/?addr=${encodeURIComponent(address)}`);
    console.log("friendbot:", fb.status);
    account = await horizon.loadAccount(address);
  }
  console.log("XLM balance:", account.balances.find((b) => b.asset_type === "native")?.balance);

  // 3) build a real on-chain tx (manageData — no extra funds, a clear state change)
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.manageData({ name: "xorr-privy-proof", value: "ok" }))
    .setTimeout(120)
    .build();
  const xdr = tx.toXDR();
  console.log("\nunsigned XDR:", xdr.slice(0, 48) + "…");

  // 4) sign via Privy: extended chains (Stellar) use raw_sign over the tx hash.
  const hashHex = tx.hash().toString("hex");
  const sign = await privy("POST", `/v1/wallets/${walletId}/raw_sign`, {
    params: { hash: "0x" + hashHex },
  });
  console.log("raw_sign status:", sign.status);
  if (sign.status >= 300) { console.error("sign failed:", JSON.stringify(sign.json)); process.exit(2); }
  const sigHex = (sign.json.data || sign.json).signature.replace(/^0x/, "");
  const sigB64 = Buffer.from(sigHex, "hex").toString("base64");
  console.log(`signature: ${Buffer.from(sigHex, "hex").length} bytes (ed25519)`);

  // 5) attach the decorated signature (validates against address + hash) and submit
  tx.addSignature(address, sigB64);
  const res = await horizon.submitTransaction(tx);
  console.log("\n✅ SUBMITTED on testnet");
  console.log("   hash:", res.hash);
  console.log("   explorer: https://stellar.expert/explorer/testnet/tx/" + res.hash);
})().catch((e) => {
  console.error("ERROR:", e?.response?.data ? JSON.stringify(e.response.data) : e.message || e);
  process.exit(3);
});
