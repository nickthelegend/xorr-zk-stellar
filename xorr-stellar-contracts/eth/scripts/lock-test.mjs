// Real round-trip proof (Ethereum leg): approve + lock N USDC into the escrow
// with a note commitment, and print the on-chain Locked event the relayer reads.
//   node scripts/lock-test.mjs <amountUSDC> [commitmentHex]
import { ethers } from "ethers";
import { readFileSync } from "node:fs";
import { config as dotenv } from "dotenv";
dotenv({ path: new URL("../.env", import.meta.url) });

const RPC = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const PK = process.env.EVM_PRIVATE_KEY;
const D = JSON.parse(readFileSync(new URL("../deployed.bridge.json", import.meta.url), "utf8"));

const amount = BigInt(Math.round(parseFloat(process.argv[2] || "5") * 1e6)); // 6-dec USDC
const commitment =
  process.argv[3] || "0x" + Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");

const provider = new ethers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(PK, provider);
const usdc = new ethers.Contract(D.usdc, ["function approve(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)"], wallet);
const escrow = new ethers.Contract(
  D.escrow,
  ["function lock(uint256,bytes32) returns (uint256)", "event Locked(uint256 indexed nonce, uint256 amount, bytes32 commitment, address indexed from)"],
  wallet,
);

console.log("locker  :", wallet.address);
console.log("USDC bal:", (await usdc.balanceOf(wallet.address)) / 1_000_000n, "USDC");
console.log(`approve ${Number(amount) / 1e6} USDC → escrow…`);
await (await usdc.approve(D.escrow, amount)).wait();
console.log(`lock(${Number(amount) / 1e6}, ${commitment.slice(0, 14)}…)…`);
const tx = await escrow.lock(amount, commitment);
const rcpt = await tx.wait();
const ev = rcpt.logs.map((l) => { try { return escrow.interface.parseLog(l); } catch { return null; } }).find((e) => e && e.name === "Locked");
console.log("\n✅ LOCKED on Sepolia");
console.log("  tx     :", "https://sepolia.etherscan.io/tx/" + tx.hash);
console.log("  nonce  :", ev.args.nonce.toString());
console.log("  amount :", ev.args.amount.toString(), "(6-dec USDC)");
console.log("  commit :", ev.args.commitment);
