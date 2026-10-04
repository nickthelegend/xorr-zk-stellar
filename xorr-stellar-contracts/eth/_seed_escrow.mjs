// TEMP: diagnose + (with --seed) seed the Sepolia escrow with USDC liquidity so
// bridge-OUT release() stops reverting "over-release" (amount <= totalLocked).
// Reads config from relayer/.env. Delete after use.
import { ethers } from "ethers";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("./relayer/.env", import.meta.url), "utf8")
    .split("\n").filter((l) => l.trim() && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const RPCS = env.SEPOLIA_RPC.split(",").map((s) => s.trim());
const ESCROW = env.ETH_ESCROW;
const PK = env.EVM_PRIVATE_KEY;
const SEED = process.argv.includes("--seed");
const SEED_USDC = 1_000_000_000n; // 1000 USDC (6 decimals)

const provider = new ethers.JsonRpcProvider(RPCS[0], 11155111, { batchMaxCount: 1, staticNetwork: true });
const wallet = new ethers.Wallet(PK, provider);

const ESCROW_ABI = [
  "function token() view returns (address)",
  "function relayer() view returns (address)",
  "function totalLocked() view returns (uint256)",
  "function lock(uint256 amount, bytes32 commitment) returns (uint256)",
];
const USDC_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function mint(address to, uint256 amount)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

const escrow = new ethers.Contract(ESCROW, ESCROW_ABI, wallet);
const usdcAddr = await escrow.token();
const usdc = new ethers.Contract(usdcAddr, USDC_ABI, wallet);

const u = (x) => (Number(x) / 1e6).toFixed(2);
const me = wallet.address;
const [relayerAddr, totalLocked, ethBal, myUsdc, escrowUsdc] = await Promise.all([
  escrow.relayer(), escrow.totalLocked(), provider.getBalance(me),
  usdc.balanceOf(me), usdc.balanceOf(ESCROW),
]);

console.log("── escrow state ──────────────────────────────");
console.log("escrow      ", ESCROW);
console.log("usdc token  ", usdcAddr);
console.log("relayer     ", relayerAddr);
console.log("my wallet   ", me, me.toLowerCase() === relayerAddr.toLowerCase() ? "(== relayer ✓)" : "(NOT relayer)");
console.log("my ETH gas  ", ethers.formatEther(ethBal), "ETH");
console.log("my USDC     ", u(myUsdc), "USDC");
console.log("escrow USDC ", u(escrowUsdc), "USDC (release liquidity)");
console.log("totalLocked ", u(totalLocked), "USDC  ← release requires amount <= this");
console.log("──────────────────────────────────────────────");

if (!SEED) {
  console.log("\nDiagnosis: bridge-OUT release(amount) reverts when amount > totalLocked.");
  console.log(`Re-run with --seed to mint ${u(SEED_USDC)} USDC and lock() it into the escrow.`);
  process.exit(0);
}

if (ethBal === 0n) { console.error("\n✗ wallet has 0 Sepolia ETH — cannot pay gas. Fund it from a faucet first."); process.exit(1); }

console.log(`\n▶ seeding escrow with ${u(SEED_USDC)} USDC …`);
if (myUsdc < SEED_USDC) {
  console.log("  mint (topping up wallet) …");
  await (await usdc.mint(me, SEED_USDC)).wait();
} else {
  console.log("  mint skipped — wallet already holds enough USDC");
}
console.log("  approve …");
await (await usdc.approve(ESCROW, SEED_USDC)).wait();
console.log("  lock (bumps totalLocked + funds escrow) …");
const commitment = ethers.keccak256(ethers.toUtf8Bytes("xorr-escrow-seed-liquidity"));
await (await escrow.lock(SEED_USDC, commitment)).wait();

const [tl2, eu2] = await Promise.all([escrow.totalLocked(), usdc.balanceOf(ESCROW)]);
console.log("\n✓ done");
console.log("  totalLocked ", u(tl2), "USDC");
console.log("  escrow USDC ", u(eu2), "USDC");
console.log(`\nbridge-OUT up to ${u(tl2)} USDC will now pass the over-release check.`);
