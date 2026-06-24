// Compile (solc-js) + deploy ShieldedBridgeLockNative to Sepolia, then do a real
// lock() tx with a note commitment. Prints the contract address, tx hash, and
// the Locked event the Stellar relayer consumes.
//   node scripts/deploy-and-lock.mjs <commitmentHex> <ethAmount>
import solc from "solc";
import { ethers } from "ethers";
import { readFileSync } from "node:fs";
import { config as dotenv } from "dotenv";
dotenv({ path: new URL("../.env", import.meta.url) });

const RPC = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const PK = process.env.EVM_PRIVATE_KEY;
if (!PK) throw new Error("EVM_PRIVATE_KEY missing in eth/.env");

const commitmentHex = (process.argv[2] || "").replace(/^0x/, "").padStart(64, "0");
const ethAmount = process.argv[3] || "0.001";

const src = readFileSync(new URL("../contracts/ShieldedBridgeLockNative.sol", import.meta.url), "utf8");
const input = {
  language: "Solidity",
  sources: { "Lock.sol": { content: src } },
  settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } },
};
const out = JSON.parse(solc.compile(JSON.stringify(input)));
if (out.errors?.some((e) => e.severity === "error")) throw new Error(JSON.stringify(out.errors, null, 2));
const C = out.contracts["Lock.sol"]["ShieldedBridgeLockNative"];

const provider = new ethers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(PK, provider);
console.log("deployer:", wallet.address);
console.log("balance :", ethers.formatEther(await provider.getBalance(wallet.address)), "ETH");

const factory = new ethers.ContractFactory(C.abi, C.evm.bytecode.object, wallet);
const lock = await factory.deploy();
await lock.waitForDeployment();
const addr = await lock.getAddress();
console.log("ShieldedBridgeLockNative deployed:", addr);

const commitment = "0x" + commitmentHex;
console.log(`lock(${commitment}) with ${ethAmount} ETH …`);
const tx = await lock.lock(commitment, { value: ethers.parseEther(ethAmount) });
const rcpt = await tx.wait();
console.log("lock tx:", rcpt.hash);
console.log("etherscan:", `https://sepolia.etherscan.io/tx/${rcpt.hash}`);

const ev = rcpt.logs.map((l) => { try { return lock.interface.parseLog(l); } catch { return null; } }).find((p) => p?.name === "Locked");
if (ev) console.log("Locked event -> nonce:", ev.args.nonce.toString(), "amount(wei):", ev.args.amount.toString(), "commitment:", ev.args.commitment);
console.log("\nLOCK_ADDR=" + addr);
console.log("LOCK_NONCE=" + (ev ? ev.args.nonce.toString() : "0"));
