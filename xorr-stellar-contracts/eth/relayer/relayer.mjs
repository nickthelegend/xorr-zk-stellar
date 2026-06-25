// XORR bridge relayer — autonomous, like Zephyr's.
//
// Continuously: watches Sepolia `Locked` events, maintains the ETH deposit
// Merkle tree (keccak256), and posts its root to the Stellar bridge
// (`set_eth_root`). On /bridge-in it verifies the lock tx, builds the ETH
// membership proof (index + path) for the commitment, and submits `bridge_in`
// — which now verifies BOTH the shielded-note Groth16 proof AND ETH-tree
// membership on-chain. So a mint is gated by the real Ethereum deposit set.
//
// env (relayer/.env): XORR_SECRET, ETH_ESCROW, BRIDGE_ID, SEPOLIA_RPC, STELLAR_RPC,
//   NETWORK_PASSPHRASE, FROM_BLOCK, PORT
import http from "node:http";
import { ethers } from "ethers";
import { rpc, Contract, Address, TransactionBuilder, BASE_FEE, Keypair, nativeToScVal, xdr } from "@stellar/stellar-sdk";
import { config as dotenv } from "dotenv";
dotenv({ path: new URL("./.env", import.meta.url) });

const PORT = Number(process.env.PORT || 8790);
// Comma-separated RPC pool — tried in order with fallback so one flaky/rate-
// limited endpoint can't stall the relayer. drpc + tenderly serve Sepolia
// *archive* logs without a token (most free RPCs reject old eth_getLogs).
const SEPOLIA_RPCS = (process.env.SEPOLIA_RPC || "https://sepolia.drpc.org,https://sepolia.gateway.tenderly.co")
  .split(",").map((s) => s.trim()).filter(Boolean);
const STELLAR_RPC = process.env.STELLAR_RPC || "https://soroban-testnet.stellar.org";
const PASSPHRASE = process.env.NETWORK_PASSPHRASE || "Test SDF Network ; September 2015";
const ETH_ESCROW = req("ETH_ESCROW");
const BRIDGE_ID = req("BRIDGE_ID");
const POOL_ID = process.env.POOL_ID || ""; // pool to unshield into on a bridge-out
const FROM_BLOCK = Number(process.env.FROM_BLOCK || 0);
const kp = Keypair.fromSecret(req("XORR_SECRET"));
function req(k) { const v = process.env[k]; if (!v) throw new Error(`missing env ${k}`); return v; }

const providers = SEPOLIA_RPCS.map((u) => new ethers.JsonRpcProvider(u));
// ETH signer for the reverse leg (must be the escrow's authorized `relayer`).
const EVM_PK = process.env.EVM_PRIVATE_KEY || "";
const RELEASE_ABI = ["function release(address to, uint256 amount, bytes32 nullifier)"];
const escrowIface = new ethers.Interface([
  "event Locked(uint256 indexed nonce, uint256 amount, bytes32 commitment, address indexed from)",
]);
const LOCKED_TOPIC = escrowIface.getEvent("Locked").topicHash;
const server = new rpc.Server(STELLAR_RPC, { allowHttp: STELLAR_RPC.startsWith("http://") });

// Try each RPC in the pool until one answers; throw only if all fail.
async function tryRpc(fn) {
  let lastErr;
  for (const p of providers) {
    try { return await fn(p); } catch (e) { lastErr = e; }
  }
  throw lastErr;
}
const getHead = () => tryRpc((p) => p.getBlockNumber());
async function getLockedLogs(from, to) {
  const params = [{ address: ETH_ESCROW, topics: [LOCKED_TOPIC],
    fromBlock: "0x" + from.toString(16), toBlock: "0x" + to.toString(16) }];
  const raw = await tryRpc((p) => p.send("eth_getLogs", params));
  return raw.map((l) => {
    const d = escrowIface.parseLog(l);
    return { nonce: Number(d.args.nonce), commitment: d.args.commitment, tx: l.transactionHash };
  });
}

const bytesN32 = (hex) => xdr.ScVal.scvBytes(Buffer.from(hex.replace(/^0x/, ""), "hex"));
const proofScVal = (p) => xdr.ScVal.scvMap(["a", "b", "c"].map((k) =>
  new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol(k), val: xdr.ScVal.scvBytes(Buffer.from(p[k].replace(/^0x/, ""), "hex")) })));

// ── keccak256 ETH deposit Merkle tree (must mirror Bridge::eth_merkle_root) ──
const DEPTH = 16;
const ZERO = "0x" + "00".repeat(32);
const Z = [ZERO];
for (let i = 1; i <= DEPTH; i++) Z[i] = ethers.keccak256(ethers.concat([Z[i - 1], Z[i - 1]]));

function buildTree(leaves) {
  const layers = [leaves.slice()];
  for (let d = 0; d < DEPTH; d++) {
    const cur = layers[d], next = [];
    for (let i = 0; i < cur.length; i += 2) {
      const l = cur[i], r = i + 1 < cur.length ? cur[i + 1] : Z[d];
      next.push(ethers.keccak256(ethers.concat([l, r])));
    }
    layers.push(next.length ? next : [Z[d + 1]]);
  }
  return { layers, root: layers[DEPTH][0] };
}
function pathFor(layers, index) {
  const path = [];
  let idx = index;
  for (let d = 0; d < DEPTH; d++) {
    const layer = layers[d], sib = idx ^ 1;
    path.push(sib < layer.length ? layer[sib] : Z[d]);
    idx >>= 1;
  }
  return path;
}

let lastRoot = null;
let scannedTo = 0;
const leafCache = new Map(); // nonce -> {nonce, commitment, tx}
// Incremental, 50-block-chunked scan (public RPCs cap eth_getLogs at 50 blocks).
async function fetchLeaves() {
  const cur = await getHead();
  let from = scannedTo ? scannedTo + 1 : (FROM_BLOCK || cur - 800);
  while (from <= cur) {
    const to = Math.min(from + 49, cur);
    for (const l of await getLockedLogs(from, to)) leafCache.set(l.nonce, l);
    from = to + 1;
  }
  scannedTo = cur;
  return [...leafCache.values()].sort((a, b) => a.nonce - b.nonce);
}

async function submitOn(contractId, method, ...args) {
  const src = await server.getAccount(kp.publicKey());
  const tx = new TransactionBuilder(src, { fee: BASE_FEE, networkPassphrase: PASSPHRASE })
    .addOperation(new Contract(contractId).call(method, ...args)).setTimeout(120).build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(`${method} sim failed: ${sim.error}`);
  const prepared = rpc.assembleTransaction(tx, sim).build();
  prepared.sign(kp);
  const sent = await server.sendTransaction(prepared);
  if (sent.status === "ERROR") throw new Error(`${method} send failed: ${JSON.stringify(sent.errorResult)}`);
  let got = await server.getTransaction(sent.hash);
  for (let i = 0; i < 40 && got.status === "NOT_FOUND"; i++) { await new Promise((r) => setTimeout(r, 1000)); got = await server.getTransaction(sent.hash); }
  if (got.status !== "SUCCESS") throw new Error(`${method} ${sent.hash} status=${got.status}`);
  return sent.hash;
}
const submitStellar = (method, ...args) => submitOn(BRIDGE_ID, method, ...args);

// Resilient Sepolia receipt poll across the RPC pool (free tiers stall on .wait()).
async function waitEthReceipt(hash) {
  for (let i = 0; i < 90; i++) {
    for (const p of providers) { try { const r = await p.getTransactionReceipt(hash); if (r && r.blockNumber) return r; } catch { /* next */ } }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("eth receipt timeout " + hash);
}

/** Poll deposits, (re)build the tree, post the root if it changed. */
async function syncRoot() {
  try {
    const leaves = await fetchLeaves();
    const { root } = buildTree(leaves.map((l) => l.commitment));
    if (root !== lastRoot) {
      const h = await submitStellar("set_eth_root", bytesN32(root));
      lastRoot = root;
      console.log(`[relayer] ETH deposits: ${leaves.length} → posted root ${root.slice(0, 12)}…  (stellar ${h.slice(0, 8)})`);
    } else {
      console.log(`[relayer] ETH deposits: ${leaves.length} · root unchanged, skipping post`);
    }
  } catch (e) { console.error("[relayer] syncRoot:", e.message); }
}

async function bridgeIn(p) {
  const leaves = await fetchLeaves();
  const idx = leaves.findIndex((l) => l.commitment.toLowerCase() === p.commitment.toLowerCase());
  if (idx < 0) throw new Error("commitment not found among Sepolia locks");
  const lock = leaves[idx];
  const { layers, root } = buildTree(leaves.map((l) => l.commitment));
  if (root !== lastRoot) { await submitStellar("set_eth_root", bytesN32(root)); lastRoot = root; } // ensure posted
  const path = pathFor(layers, idx);
  const stellarTx = await submitStellar(
    "bridge_in",
    nativeToScVal(BigInt(lock.nonce), { type: "u64" }),
    nativeToScVal(BigInt(p.amount), { type: "i128" }),
    bytesN32(p.commitment), bytesN32(p.oldRoot), bytesN32(p.newRoot), proofScVal(p.proof),
    bytesN32(root), nativeToScVal(idx, { type: "u32" }), xdr.ScVal.scvVec(path.map(bytesN32)),
  );
  return { stellarTx, ethTx: lock.tx, ethRoot: root, ethIndex: idx };
}

// Reverse leg (Stellar → Ethereum): submit the user's Withdraw proof (burns the
// note, unshields the value to this relayer = the bound recipient), then release
// the equivalent USDC on Ethereum. The nullifier is single-use on both chains.
// Send escrow.release across the RPC pool — one rate-limited endpoint can't
// block the payout. Bails immediately if the nullifier was already released.
async function ethRelease(to, amount, nullifier) {
  let lastErr;
  for (const p of providers) {
    try {
      const escrow = new ethers.Contract(ETH_ESCROW, RELEASE_ABI, new ethers.Wallet(EVM_PK, p));
      const tx = await escrow.release(to, amount, nullifier);
      return await waitEthReceipt(tx.hash);
    } catch (e) { lastErr = e; if (/nullifier used/i.test(e.message || "")) throw e; }
  }
  throw lastErr;
}
async function bridgeOut(p) {
  if (!POOL_ID) throw new Error("relayer POOL_ID not configured");
  if (!EVM_PK) throw new Error("relayer EVM_PRIVATE_KEY not configured");
  // (1) burn on Stellar — unshield to the sink (we are the bound recipient, so we sign)
  const stellarTx = await submitOn(
    POOL_ID, "withdraw",
    new Address(p.recipient).toScVal(),
    nativeToScVal(BigInt(p.amount), { type: "i128" }),
    bytesN32(p.nullifier), bytesN32(p.changeCommitment),
    bytesN32(p.oldRoot), bytesN32(p.newRoot), proofScVal(p.proof),
  );
  // (2) release real USDC on Ethereum (7-dec Stellar amount → 6-dec USDC)
  const ethAmt = BigInt(p.amount) / 10n;
  const rcpt = await ethRelease(p.ethRecipient, ethAmt, p.nullifier);
  return { stellarTx, ethTx: rcpt.hash, ethAmount: ethAmt.toString() };
}

http.createServer(async (rq, rs) => {
  rs.setHeader("Access-Control-Allow-Origin", "*");
  rs.setHeader("Access-Control-Allow-Headers", "content-type");
  rs.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  if (rq.method === "OPTIONS") return rs.end();
  if (rq.url === "/health") {
    rs.setHeader("content-type", "application/json");
    return rs.end(JSON.stringify({ ok: true, relayer: kp.publicKey(), bridgeId: BRIDGE_ID, ethRoot: lastRoot, ethDeposits: leafCache.size }));
  }
  if (rq.method !== "POST" || (rq.url !== "/bridge-in" && rq.url !== "/bridge-out")) { rs.statusCode = 404; return rs.end("not found"); }
  const route = rq.url;
  let body = "";
  rq.on("data", (c) => (body += c));
  rq.on("end", async () => {
    try {
      const p = JSON.parse(body);
      const out = route === "/bridge-out" ? await bridgeOut(p) : await bridgeIn(p);
      console.log(route === "/bridge-out"
        ? `[relayer] ✓ released ${out.ethAmount} on Ethereum ${out.ethTx.slice(0, 10)} (burn ${out.stellarTx.slice(0, 8)})`
        : `[relayer] ✓ minted on Stellar ${out.stellarTx.slice(0, 8)} (eth idx ${out.ethIndex})`);
      rs.setHeader("content-type", "application/json");
      rs.end(JSON.stringify(out));
    } catch (e) {
      console.error(`[relayer] ${route.slice(1)}:`, e.message);
      rs.statusCode = 400;
      rs.end(JSON.stringify({ error: e.message }));
    }
  });
}).listen(PORT, () => {
  console.log(`XORR relayer on :${PORT}  relayer=${kp.publicKey()}`);
  syncRoot();
  setInterval(syncRoot, 15000); // autonomous root posting, like Zephyr
});
