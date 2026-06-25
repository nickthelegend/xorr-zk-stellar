// XORR bridge relayer — the real cross-chain attestation service.
//
// Forward (ETH → Stellar): the frontend locks USDC on Sepolia + generates the
// note proof client-side, then POSTs the proof here. The relayer verifies the
// on-chain `Locked` event matches, then submits `bridge_in` to the Stellar
// bridge signed with the relayer key (the only key the pool's minter accepts).
//
// env (relayer/.env): XORR_SECRET, EVM_RELAYER_PK (optional, reverse), ETH_ESCROW,
//   BRIDGE_ID, SEPOLIA_RPC, STELLAR_RPC, NETWORK_PASSPHRASE, PORT
import http from "node:http";
import { ethers } from "ethers";
import {
  rpc, Contract, TransactionBuilder, BASE_FEE, Keypair, Address, nativeToScVal, xdr,
} from "@stellar/stellar-sdk";
import { config as dotenv } from "dotenv";
dotenv({ path: new URL("./.env", import.meta.url) });

const PORT = Number(process.env.PORT || 8790);
const SEPOLIA_RPC = process.env.SEPOLIA_RPC || "https://1rpc.io/sepolia";
const STELLAR_RPC = process.env.STELLAR_RPC || "https://soroban-testnet.stellar.org";
const PASSPHRASE = process.env.NETWORK_PASSPHRASE || "Test SDF Network ; September 2015";
const ETH_ESCROW = req("ETH_ESCROW");
const BRIDGE_ID = req("BRIDGE_ID");
const kp = Keypair.fromSecret(req("XORR_SECRET"));
function req(k) { const v = process.env[k]; if (!v) throw new Error(`missing env ${k}`); return v; }

const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
const escrow = new ethers.Contract(ETH_ESCROW, [
  "event Locked(uint256 indexed nonce, uint256 amount, bytes32 commitment, address indexed from)",
], provider);
const server = new rpc.Server(STELLAR_RPC, { allowHttp: STELLAR_RPC.startsWith("http://") });

const bytesN32 = (hex) => xdr.ScVal.scvBytes(Buffer.from(hex.replace(/^0x/, ""), "hex"));
const proofScVal = (p) => xdr.ScVal.scvMap(["a", "b", "c"].map((k) =>
  new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol(k), val: xdr.ScVal.scvBytes(Buffer.from(p[k].replace(/^0x/, ""), "hex")) })));

/** Verify a Sepolia lock tx really emitted Locked(commitment); return its nonce. */
async function verifyLock(ethTx, commitmentHex) {
  const rcpt = await provider.getTransactionReceipt(ethTx);
  if (!rcpt) throw new Error(`lock tx ${ethTx} not found`);
  if (rcpt.to?.toLowerCase() !== ETH_ESCROW.toLowerCase()) throw new Error("tx is not to the escrow");
  const ev = rcpt.logs.map((l) => { try { return escrow.interface.parseLog(l); } catch { return null; } }).find((e) => e && e.name === "Locked");
  if (!ev) throw new Error("no Locked event in tx");
  if (ev.args.commitment.toLowerCase() !== commitmentHex.toLowerCase()) throw new Error("commitment mismatch vs on-chain lock");
  return { nonce: ev.args.nonce, ethAmount: ev.args.amount.toString() };
}

/** Submit bridge_in to the Stellar bridge, signed as the relayer. */
async function submitBridgeIn({ ethNonce, amount, commitment, oldRoot, newRoot, proof }) {
  const src = await server.getAccount(kp.publicKey());
  const op = new Contract(BRIDGE_ID).call(
    "bridge_in",
    nativeToScVal(BigInt(ethNonce), { type: "u64" }),
    nativeToScVal(BigInt(amount), { type: "i128" }),
    bytesN32(commitment), bytesN32(oldRoot), bytesN32(newRoot), proofScVal(proof),
  );
  const tx = new TransactionBuilder(src, { fee: BASE_FEE, networkPassphrase: PASSPHRASE })
    .addOperation(op).setTimeout(120).build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error("simulation failed: " + sim.error);
  const prepared = rpc.assembleTransaction(tx, sim).build();
  prepared.sign(kp);
  const sent = await server.sendTransaction(prepared);
  if (sent.status === "ERROR") throw new Error("send failed: " + JSON.stringify(sent.errorResult));
  let got = await server.getTransaction(sent.hash);
  for (let i = 0; i < 40 && got.status === "NOT_FOUND"; i++) { await new Promise((r) => setTimeout(r, 1000)); got = await server.getTransaction(sent.hash); }
  if (got.status !== "SUCCESS") throw new Error(`bridge_in ${sent.hash} status=${got.status}`);
  return sent.hash;
}

http.createServer(async (rq, rs) => {
  rs.setHeader("Access-Control-Allow-Origin", "*");
  rs.setHeader("Access-Control-Allow-Headers", "content-type");
  rs.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  if (rq.method === "OPTIONS") return rs.end();
  if (rq.url === "/health") return rs.end(JSON.stringify({ ok: true, relayer: kp.publicKey() }));
  if (rq.method !== "POST" || rq.url !== "/bridge-in") { rs.statusCode = 404; return rs.end("not found"); }
  let body = "";
  rq.on("data", (c) => (body += c));
  rq.on("end", async () => {
    try {
      const p = JSON.parse(body);
      const { nonce } = await verifyLock(p.ethTx, p.commitment);
      console.log(`lock verified (nonce ${nonce}) → submitting bridge_in…`);
      const stellarTx = await submitBridgeIn({ ...p, ethNonce: nonce });
      console.log(`✓ minted on Stellar: ${stellarTx}`);
      rs.setHeader("content-type", "application/json");
      rs.end(JSON.stringify({ stellarTx, ethTx: p.ethTx }));
    } catch (e) {
      console.error("bridge-in error:", e.message);
      rs.statusCode = 400;
      rs.end(JSON.stringify({ error: e.message }));
    }
  });
}).listen(PORT, () => console.log(`XORR relayer on :${PORT}  relayer=${kp.publicKey()}`));
