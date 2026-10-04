// Rebuild the pool's leaf set from chain events, PROVE the Poseidon root matches
// the on-chain current_root, reconcile the indexer, and locate the stuck-note
// withdraw event. Read-only except the indexer POST. Delete after use.
import { rpc, Contract, TransactionBuilder, Networks, scValToNative, nativeToScVal } from "@stellar/stellar-sdk";
import { buildPoseidon } from "circomlibjs";

const POOL = "CCU37JVI545XRYJ2EQIKJANEAZPQMDIC7B3HF2ABN7PNG4SH5HTLFFJO";
const DELIVERY = "http://localhost:8787";
const SOURCE = "GBKZC3N4UVFZ54CAM7I26NWIDQLQJVPPUVDNLDBAS5PC3BAUA3GYOYXR";
const RPC = "https://soroban-testnet.stellar.org";
const TREE_DEPTH = 20;
const STUCK_NULLIFIER = "1b7819163fc8c1a16b3ed08ef4cb4fccff9e8ec57b8be427361f92ec59809fb3";
const DO_POST = process.argv.includes("--post");

const s = new rpc.Server(RPC);
const P = await buildPoseidon();
const poseidon = (ins) => P.F.toObject(P(ins.map((x) => BigInt(x))));
const beHex = (u) => Buffer.from(u).toString("hex");
const beDec = (u) => { let v = 0n; for (const b of u) v = (v << 8n) | BigInt(b); return v; };

// --- incremental tree (exact mirror of lib/notes.ts MerkleTree) ---
function makeTree(depth = TREE_DEPTH) {
  const zeros = [], filled = [];
  let cur = 0n;
  for (let i = 0; i < depth; i++) { zeros[i] = cur; filled[i] = cur; cur = poseidon([cur, cur]); }
  let root = cur; const leaves = [];
  return {
    insert(leaf) {
      let c = leaf, idx = leaves.length;
      for (let i = 0; i < depth; i++) {
        if ((idx & 1) === 0) { filled[i] = c; c = poseidon([c, zeros[i]]); }
        else { c = poseidon([filled[i], c]); }
        idx >>= 1;
      }
      leaves.push(leaf); root = c;
    },
    get root() { return root; },
  };
}

async function sim(fn, ...args) {
  const acct = await s.getAccount(SOURCE);
  const tx = new TransactionBuilder(acct, { fee: "1000", networkPassphrase: Networks.TESTNET })
    .addOperation(new Contract(POOL).call(fn, ...args)).setTimeout(30).build();
  const r = await s.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(r)) throw new Error(`${fn}: ${r.error}`);
  return scValToNative(r.result.retval);
}

const chainRoot = beHex(await sim("current_root"));
const nextLeaf = Number(await sim("next_leaf"));
console.log("chain current_root", chainRoot, "| next_leaf", nextLeaf);

// --- scan every leaf-inserting event in insertion order ---
const LEAF_FIELDS = { deposit: [0], bridgein: [0], transfer: [2, 3], withdraw: [3] };
const latest = (await s.getLatestLedger()).sequence;
let cursor, startLedger = latest - 8000;
const inserted = [];       // {commitment} in ledger order
const withdrawals = [];    // {recipient, amount, nullifier}
const kinds = {};
for (let page = 0; page < 60; page++) {
  const res = await s.getEvents({ startLedger: cursor ? undefined : startLedger, cursor, filters: [{ type: "contract", contractIds: [POOL] }], limit: 100 });
  for (const ev of res.events || []) {
    const topics = (ev.topic || []).map((t) => { try { return scValToNative(t); } catch { return null; } });
    const kind = topics[1];
    kinds[kind] = (kinds[kind] || 0) + 1;
    const data = scValToNative(ev.value);
    if (kind === "withdraw") withdrawals.push({ recipient: data[0], amount: data[1]?.toString?.() ?? String(data[1]), nullifier: beHex(new Uint8Array(data[2])) });
    const fields = LEAF_FIELDS[kind];
    if (!fields) continue;
    for (const i of fields) inserted.push(beDec(new Uint8Array(data[i])).toString());
  }
  cursor = res.cursor;
  if (!res.events || res.events.length < 100) break;
}
console.log(`scanned ${inserted.length} inserted leaf/leaves from events (expect ${nextLeaf}) | event kinds:`, kinds);

// --- rebuild tree, PROVE root ---
const tree = makeTree();
inserted.forEach((c) => tree.insert(BigInt(c)));
const rebuiltRoot = beHex((() => { const o = new Uint8Array(32); let v = tree.root; for (let i = 31; i >= 0; i--) { o[i] = Number(v & 0xffn); v >>= 8n; } return o; })());
console.log("rebuilt root     ", rebuiltRoot);
const ROOT_OK = rebuiltRoot === chainRoot && inserted.length === nextLeaf;
console.log("ROOT MATCHES CHAIN:", ROOT_OK ? "✓ YES — leaf set is correct & complete" : "✗ NO — extraction incomplete (widen window / check fields)");

// --- stuck note ---
console.log("\n── stuck-note recovery ──");
const stuck = withdrawals.find((w) => w.nullifier === STUCK_NULLIFIER);
if (stuck) {
  const ethAmt = BigInt(stuck.amount) / 10n;
  console.log(`withdraw burning ${STUCK_NULLIFIER.slice(0, 12)}… → recipient(sink)=${stuck.recipient}`);
  console.log(`  stellar amount ${stuck.amount} (7-dec) → ETH release ${ethAmt} (6-dec) = ${(Number(ethAmt) / 1e6).toFixed(2)} USDC owed`);
} else {
  console.log(`no withdraw event found for ${STUCK_NULLIFIER.slice(0, 12)}… in window (may be older than 60k ledgers)`);
}

// --- reconcile indexer ---
if (ROOT_OK && DO_POST) {
  const leaves = inserted.map((commitment, index) => ({ index, commitment }));
  const r = await fetch(`${DELIVERY}/leaves`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pool: POOL, leaves }) });
  console.log(`\nPOST /leaves -> ${r.status}`);
  const back = await (await fetch(`${DELIVERY}/leaves/${POOL}`)).json();
  const got = (Array.isArray(back) ? back : back.leaves || []).length;
  console.log(`indexer now holds ${got} leaves (want ${nextLeaf}) ${got === nextLeaf ? "✓" : "✗"}`);
} else if (!DO_POST) {
  console.log("\n(dry run — re-run with --post to reconcile the indexer)");
}
