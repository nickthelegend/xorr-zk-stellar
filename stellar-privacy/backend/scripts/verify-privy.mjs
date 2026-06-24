// Live smoke test for Privy server credentials + Stellar wallet support.
// Run: node scripts/verify-privy.mjs   (reads PRIVY_APP_ID / PRIVY_APP_SECRET from env)
//
// Proves end-to-end that the credentials work and that Privy can mint a Stellar
// (ed25519) wallet server-side — the same capability as the client
// useCreateWallet({chainType:'stellar'}) snippet, runnable headlessly.
const APP_ID = process.env.PRIVY_APP_ID;
const APP_SECRET = process.env.PRIVY_APP_SECRET;
if (!APP_ID || !APP_SECRET) {
  console.error("Set PRIVY_APP_ID and PRIVY_APP_SECRET in the environment.");
  process.exit(1);
}

const BASE = "https://api.privy.io";
const basic = Buffer.from(`${APP_ID}:${APP_SECRET}`).toString("base64");
const headers = {
  authorization: `Basic ${basic}`,
  "privy-app-id": APP_ID,
  "content-type": "application/json",
};
const redact = (s) => (s ? `${String(s).slice(0, 10)}…(${String(s).length} chars)` : s);

async function api(method, path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: r.status, json };
}

(async () => {
  console.log(`Privy app: ${APP_ID}  secret: ${redact(APP_SECRET)}`);

  // 1) Create a Stellar wallet (app-owned) server-side.
  console.log("\n[1] POST /v1/wallets { chain_type: 'stellar' } …");
  const create = await api("POST", "/v1/wallets", { chain_type: "stellar" });
  console.log("    status:", create.status);
  console.log("    body:  ", JSON.stringify(create.json));
  if (create.status >= 300) {
    console.error("\n❌ Stellar wallet creation failed — credentials or chain support issue.");
    process.exit(2);
  }
  const wallet = create.json;
  const address = wallet.address || wallet.public_key;
  const isStellar = typeof address === "string" && /^G[A-Z2-7]{55}$/.test(address);
  console.log(`\n✅ Created wallet id=${wallet.id}`);
  console.log(`   address=${address}  ${isStellar ? "(valid Stellar G-address)" : "(unexpected format!)"}`);

  // 2) Read it back to confirm persistence.
  console.log("\n[2] GET /v1/wallets/" + wallet.id + " …");
  const got = await api("GET", `/v1/wallets/${wallet.id}`);
  console.log("    status:", got.status, " address matches:", (got.json.address || got.json.public_key) === address);

  // 3) Bonus: try a server-side signature (proves we can sign Stellar txs without exposing the key).
  console.log("\n[3] POST /v1/wallets/" + wallet.id + "/rpc  (signMessage) …");
  const sign = await api("POST", `/v1/wallets/${wallet.id}/rpc`, {
    method: "signMessage",
    params: { message: "xorr-privy-verification" },
  });
  console.log("    status:", sign.status, " body:", JSON.stringify(sign.json).slice(0, 200));

  console.log("\n— summary —");
  console.log("credentials:        ✅ valid");
  console.log("stellar wallet:     " + (isStellar ? "✅ created" : "⚠️ created but address format off"));
  console.log("server signing:     " + (sign.status < 300 ? "✅ available" : `ℹ️ status ${sign.status} (method/shape may differ per chain)`));
})().catch((e) => { console.error("ERROR:", e); process.exit(3); });
