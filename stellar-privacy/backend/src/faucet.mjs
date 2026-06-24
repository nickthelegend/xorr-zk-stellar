// Testnet faucet: mock USDC on Stellar (issuer-minted) + Sepolia ETH (from the
// relayer). Demo-only, rate-limited in-memory.
import { execSync } from "node:child_process";
import { ethers } from "ethers";
import { config as dotenv } from "dotenv";

// Reuse the EVM relayer key from eth/.env for the Sepolia ETH faucet.
dotenv({ path: new URL("../../eth/.env", import.meta.url) });

const TOKEN = process.env.FAUCET_TOKEN || "CB2JO4FJH5NUU7Y2PHQ27H35DIOHQZDMCLFP6BSHGVZA2VDM4472MQXA";
const ISSUER_IDENT = process.env.FAUCET_ISSUER_IDENT || "sbissuer";
const NET = "testnet";
const SEPOLIA_RPC = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const ETH_AMOUNT = "0.005";
const USDC_AMOUNT = "1000000000"; // 100 USDC (7 decimals)

const lastHit = new Map(); // key -> ts (simple per-key cooldown)
const COOLDOWN_MS = 6 * 60 * 60 * 1000;
function cooled(key, res) {
  const now = Date.now(), prev = lastHit.get(key) || 0;
  if (now - prev < COOLDOWN_MS) { res.status(429).json({ error: "faucet cooldown — try later" }); return false; }
  lastHit.set(key, now); return true;
}

export function registerFaucet(app) {
  // Mock USDC -> a Stellar G-address (needs a USDC trustline first).
  app.post("/faucet/usdc", (req, res) => {
    const to = String(req.body?.address || "");
    if (!/^G[A-Z2-7]{55}$/.test(to)) return res.status(400).json({ error: "valid Stellar G-address required" });
    if (!cooled(`usdc:${to}`, res)) return;
    try {
      const out = execSync(
        `stellar contract invoke --id ${TOKEN} --source ${ISSUER_IDENT} --network ${NET} -- mint --to ${to} --amount ${USDC_AMOUNT}`,
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      res.json({ ok: true, asset: "USDC", amount: USDC_AMOUNT, to, raw: out.trim().slice(-80) });
    } catch (e) {
      lastHit.delete(`usdc:${to}`);
      const msg = String(e.stderr || e.message);
      res.status(500).json({ error: msg.includes("trustline") || msg.includes("Trust") ? "add a USDC trustline first" : msg.slice(0, 200) });
    }
  });

  // Sepolia ETH -> an EVM address (gas + native locking).
  app.post("/faucet/eth", async (req, res) => {
    const to = String(req.body?.address || "");
    if (!/^0x[0-9a-fA-F]{40}$/.test(to)) return res.status(400).json({ error: "valid 0x address required" });
    const pk = process.env.EVM_PRIVATE_KEY;
    if (!pk) return res.status(500).json({ error: "faucet relayer key not configured" });
    if (!cooled(`eth:${to}`, res)) return;
    try {
      const wallet = new ethers.Wallet(pk, new ethers.JsonRpcProvider(SEPOLIA_RPC));
      const tx = await wallet.sendTransaction({ to, value: ethers.parseEther(ETH_AMOUNT) });
      await tx.wait();
      res.json({ ok: true, asset: "ETH", amount: ETH_AMOUNT, to, txHash: tx.hash });
    } catch (e) {
      lastHit.delete(`eth:${to}`);
      res.status(500).json({ error: String(e.message).slice(0, 200) });
    }
  });

  console.log("faucet routes mounted (/faucet/usdc, /faucet/eth)");
}
