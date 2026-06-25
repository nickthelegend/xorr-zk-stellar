// Compile (solc-js) + deploy the XORR ShieldedBridge testnet stack to Sepolia:
//   1. TestUSDC          — mintable USDC-shaped ERC-20 (open faucet)
//   2. ShieldedBridgeEscrow(token, relayer) — two-way lock/release escrow
// Mints a starting balance to the deployer and writes deployed.bridge.json.
//
//   node scripts/deploy-bridge.mjs
import solc from "solc";
import { ethers } from "ethers";
import { readFileSync, writeFileSync } from "node:fs";
import { config as dotenv } from "dotenv";
dotenv({ path: new URL("../.env", import.meta.url) });

const RPC = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const PK = process.env.EVM_PRIVATE_KEY;
if (!PK) throw new Error("EVM_PRIVATE_KEY missing in eth/.env");

// --- compile ---------------------------------------------------------------
const src = readFileSync(new URL("../contracts/BridgeTestnet.sol", import.meta.url), "utf8");
const input = {
  language: "Solidity",
  sources: { "B.sol": { content: src } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: "paris",
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
  },
};
const out = JSON.parse(solc.compile(JSON.stringify(input)));
const errs = (out.errors || []).filter((e) => e.severity === "error");
if (errs.length) throw new Error(errs.map((e) => e.formattedMessage).join("\n"));
const USDC = out.contracts["B.sol"]["TestUSDC"];
const ESCROW = out.contracts["B.sol"]["ShieldedBridgeEscrow"];

// --- deploy ----------------------------------------------------------------
const provider = new ethers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(PK, provider);
const relayer = process.env.RELAYER_EVM || wallet.address; // EVM relayer for reverse release()
const bal = await provider.getBalance(wallet.address);
console.log("deployer:", wallet.address);
console.log("balance :", ethers.formatEther(bal), "ETH");
if (bal === 0n) throw new Error("deployer has 0 ETH — fund it on Sepolia first");

const usdcFactory = new ethers.ContractFactory(USDC.abi, USDC.evm.bytecode.object, wallet);
const usdc = await usdcFactory.deploy();
await usdc.waitForDeployment();
const usdcAddr = await usdc.getAddress();
console.log("TestUSDC          :", usdcAddr);

const escrowFactory = new ethers.ContractFactory(ESCROW.abi, ESCROW.evm.bytecode.object, wallet);
const escrow = await escrowFactory.deploy(usdcAddr, relayer);
await escrow.waitForDeployment();
const escrowAddr = await escrow.getAddress();
console.log("ShieldedBridgeEscrow:", escrowAddr, "(relayer", relayer + ")");

// seed the deployer with 100,000 test USDC (6 decimals)
const mintTx = await usdc.mint(wallet.address, 100_000_000_000n);
await mintTx.wait();
console.log("minted 100,000 USDC to deployer");

const deployed = {
  network: "sepolia",
  usdc: usdcAddr,
  escrow: escrowAddr,
  relayerEvm: relayer,
  deployer: wallet.address,
};
writeFileSync(new URL("../deployed.bridge.json", import.meta.url), JSON.stringify(deployed, null, 2));
console.log("\nwrote eth/deployed.bridge.json:\n", JSON.stringify(deployed, null, 2));
console.log("\nNEXT_PUBLIC_ETH_USDC=" + usdcAddr);
console.log("NEXT_PUBLIC_ETH_ESCROW=" + escrowAddr);
