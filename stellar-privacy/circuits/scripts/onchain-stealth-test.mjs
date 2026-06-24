// LIVE two-wallet stealth payment on testnet, end to end:
//   1. deploy fresh pool (deposit + transfer VKs)
//   2. Wallet A deposits two notes (on-chain), posts leaves to the indexer
//   3. A pays B via STEALTH: output minted under a one-time key, transfer proof
//      verified on-chain, encrypted opening delivered to B via the backend
//   4. B SCANS the delivery layer, decrypts, finds the note in the global tree
//   5. B SPENDS the received note on-chain (deposit + transfer) -> proves control
// Requires: backend running (MongoDB connected) + stellar/snarkjs CLIs.
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { createHash as hash } from "node:crypto";
import { buildPoseidon } from "circomlibjs";
import { convertProof } from "./export-vk.mjs";
import nacl from "tweetnacl";
import util from "tweetnacl-util";

const NET = "testnet", SRC = "shieldedbridge";
const TOKEN = "CB2JO4FJH5NUU7Y2PHQ27H35DIOHQZDMCLFP6BSHGVZA2VDM4472MQXA";
const VERIFIER = "CCHSKQ2ZAEVIZ5KXZIB4NJI363NHFIARIUWJP47KSCY6CTENSPL33IQW";
const API = "http://localhost:8787";
const DEPTH = 20;
const sh = (c) => execSync(c, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const inv = (id, fn, args) => sh(`stellar contract invoke --id ${id} --source ${SRC} --network ${NET} -- ${fn} ${args}`);

const P = await buildPoseidon();
const H = (xs) => P.F.toObject(P(xs));
const hex = (x) => BigInt(x).toString(16).padStart(64, "0");
const dsk = (m, i) => H([m, BigInt(i)]);
const pk = (sk) => H([sk]);
const commit = (a, p, b) => H([a, p, b]);
const nul = (c, sk) => H([c, sk]);
const rand = () => { const b = nacl.randomBytes(31); let v = 0n; for (const x of b) v = (v << 8n) | BigInt(x); return v; };
const toBytes32 = (x) => { const o = new Uint8Array(32); let v = x; for (let i = 31; i >= 0; i--) { o[i] = Number(v & 0xffn); v >>= 8n; } return o; };

// X25519 view keypair + stealth address helpers (mirror frontend/lib/delivery.ts)
const encKp = (m) => nacl.box.keyPair.fromSecretKey(nacl.hash(new Uint8Array([...util.decodeUTF8("sb-enc-v1"), ...toBytes32(m)])).slice(0, 32));
const routeKey = (pubBytes) => hash("sha256").update(Buffer.from(pubBytes)).digest("hex");
const encryptTo = (recipPub, payload) => { const e = nacl.box.keyPair(), n = nacl.randomBytes(24); const ct = nacl.box(util.decodeUTF8(JSON.stringify(payload)), n, recipPub, e.secretKey); return { ephemeralPub: util.encodeBase64(e.publicKey), nonce: util.encodeBase64(n), ciphertext: util.encodeBase64(ct) }; };
const decrypt = (blob, sk) => { const o = nacl.box.open(util.decodeBase64(blob.ciphertext), util.decodeBase64(blob.nonce), util.decodeBase64(blob.ephemeralPub), sk); return o ? JSON.parse(util.encodeUTF8(o)) : null; };

class Tree {
  constructor() { this.z = []; this.f = []; this.leaves = []; let z = 0n; for (let i = 0; i < DEPTH; i++) { this.z[i] = z; this.f[i] = z; z = H([z, z]); } this.root = z; }
  static from(commitments) { const t = new Tree(); for (const c of commitments) t.insert(BigInt(c)); return t; }
  insert(leaf) { const index = this.leaves.length, oldRoot = this.root; const pe = [], pi = []; let cur = leaf, idx = index;
    for (let i = 0; i < DEPTH; i++) { const r = idx & 1; pi.push(r); if (r === 0) { pe.push(this.z[i]); this.f[i] = cur; cur = H([cur, this.z[i]]); } else { pe.push(this.f[i]); cur = H([this.f[i], cur]); } idx >>= 1; }
    this.leaves.push(leaf); this.root = cur; return { index, pe, pi, oldRoot, newRoot: cur }; }
  proof(index) { const pe = [], pi = []; let layer = [...this.leaves], idx = index;
    for (let i = 0; i < DEPTH; i++) { const r = idx & 1, s = r ? idx - 1 : idx + 1; pi.push(r); pe.push(s < layer.length ? layer[s] : this.z[i]);
      const nx = []; for (let j = 0; j < layer.length; j += 2) nx.push(H([layer[j], j + 1 < layer.length ? layer[j + 1] : this.z[i]])); layer = nx; idx >>= 1; } return { pe, pi }; }
}

function prove(circuit, tag, input) {
  writeFileSync(`build/${tag}.input.json`, JSON.stringify(input, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
  sh(`npx snarkjs wtns calculate build/${circuit}_js/${circuit}.wasm build/${tag}.input.json build/${tag}.wtns`);
  sh(`npx snarkjs groth16 prove build/${circuit}.zkey build/${tag}.wtns build/${tag}.proof.json build/${tag}.public.json`);
  const p = convertProof(JSON.parse(sh(`cat build/${tag}.proof.json`)));
  writeFileSync(`build/${tag}.scval.json`, JSON.stringify({ a: p.a, b: p.b, c: p.c }));
  return `build/${tag}.scval.json`;
}

const api = async (m, p, body) => (await fetch(`${API}${p}`, body ? { method: m, headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {})).json();
const postLeaves = (pool, leaves) => api("POST", "/leaves", { pool, leaves });
const getLeaves = (pool) => api("GET", `/leaves/${pool}`);

const log = (...a) => console.log(...a);
const ADMIN = sh(`stellar keys address ${SRC}`);

// ---- health ----
const h = await api("GET", "/health");
if (!h.mongo) { console.log("BACKEND/MONGO NOT READY:", JSON.stringify(h)); process.exit(1); }

// ---- deploy fresh pool ----
const t0 = new Tree();
const POOL = sh(`stellar contract deploy --wasm ../contracts/target/wasm32v1-none/release/privacy_pool.wasm --source ${SRC} --network ${NET} -- --admin ${ADMIN} --token ${TOKEN} --verifier ${VERIFIER} --empty_root ${hex(t0.root)}`).split("\n").pop();
log("pool =", POOL);
inv(POOL, "set_vk", `--circuit 0 --vk-file-path build/deposit.vk.soroban.json`);
inv(POOL, "set_vk", `--circuit 1 --vk-file-path build/transfer.vk.soroban.json`);
log("VKs set (deposit, transfer)");

// helper: on-chain deposit for `master` index `idx`, posts the leaf to the indexer
async function deposit(master, idx, amount, tag) {
  const tree = Tree.from((await getLeaves(POOL)).map((l) => l.commitment));
  const sk = dsk(master, idx), bl = BigInt(idx) * 7919n + 11n, c = commit(amount, pk(sk), bl);
  const ins = tree.insert(c);
  const pf = prove("deposit", tag, { oldRoot: ins.oldRoot, newRoot: ins.newRoot, commitment: c, amount, sk, blinding: bl, pathElements: ins.pe, pathIndices: ins.pi });
  inv(POOL, "deposit", `--from ${ADMIN} --amount ${amount} --commitment ${hex(c)} --old_root ${hex(ins.oldRoot)} --new_root ${hex(ins.newRoot)} --proof-file-path ${pf}`);
  await postLeaves(POOL, [{ index: ins.index, commitment: c.toString() }]);
  log(`  deposit ${amount} (idx ${idx}) -> leaf ${ins.index}`);
  return { sk, bl, amount, c, leaf: ins.index };
}

// ===== Wallet A funds itself, then pays Wallet B by stealth =====
const A = 111111n, B = 222222n;
const Benc = encKp(B); // B's X25519 view keypair; address = its pubkey
log("\n== A deposits two notes ==");
const a1 = await deposit(A, 1, 600000n, "sA1");
const a2 = await deposit(A, 2, 400000n, "sA2");

log("\n== A -> B  STEALTH PAYMENT (0.5) ==");
{
  const tree = Tree.from((await getLeaves(POOL)).map((l) => l.commitment));
  const memA = tree.proof(a1.leaf), memB = tree.proof(a2.leaf), oldRoot = tree.root;
  const payAmt = 500000n, changeAmt = 1000000n - payAmt;
  const oneTimeSk = rand(), blOut = rand();         // one-time stealth key for B
  const outCmtA = commit(payAmt, pk(oneTimeSk), blOut);
  const skChg = dsk(A, 3), blChg = rand(), outCmtB = commit(changeAmt, pk(skChg), blChg);
  const insA = tree.insert(outCmtA), insB = tree.insert(outCmtB);
  const nfA = nul(a1.c, a1.sk), nfB = nul(a2.c, a2.sk);
  const pf = prove("transfer", "sXfer", {
    oldRoot, newRoot: insB.newRoot, nullifierA: nfA, nullifierB: nfB, outCommitmentA: outCmtA, outCommitmentB: outCmtB,
    inAmountA: a1.amount, inSkA: a1.sk, inBlindingA: a1.bl, inPathElementsA: memA.pe, inPathIndicesA: memA.pi,
    inAmountB: a2.amount, inSkB: a2.sk, inBlindingB: a2.bl, inPathElementsB: memB.pe, inPathIndicesB: memB.pi,
    outAmountA: payAmt, outPkA: pk(oneTimeSk), outBlindingA: blOut, outInsPathElementsA: insA.pe, outInsPathIndicesA: insA.pi,
    outAmountB: changeAmt, outPkB: pk(skChg), outBlindingB: blChg, outInsPathElementsB: insB.pe, outInsPathIndicesB: insB.pi,
  });
  inv(POOL, "transfer", `--nullifier_a ${hex(nfA)} --nullifier_b ${hex(nfB)} --out_commitment_a ${hex(outCmtA)} --out_commitment_b ${hex(outCmtB)} --old_root ${hex(oldRoot)} --new_root ${hex(insB.newRoot)} --proof-file-path ${pf}`);
  await postLeaves(POOL, [{ index: insA.index, commitment: outCmtA.toString() }, { index: insB.index, commitment: outCmtB.toString() }]);
  // deliver encrypted opening (incl. one-time key) to B's route
  const blob = encryptTo(Benc.publicKey, { amount: payAmt.toString(), blinding: blOut.toString(), sk: oneTimeSk.toString() });
  await api("POST", "/notes", { to: routeKey(Benc.publicKey), ...blob, commitment: outCmtA.toString() });
  log("  transfer verified on-chain ✓; encrypted note delivered to B");
}

// ===== Wallet B scans, recovers, and SPENDS the received note =====
log("\n== B scans delivery layer ==");
const leavesNow = (await getLeaves(POOL)).map((l) => l.commitment);
const blobs = await api("GET", `/notes/${routeKey(Benc.publicKey)}`);
let recv = null;
for (const blob of blobs) {
  const pl = decrypt(blob, Benc.secretKey);
  if (!pl) continue;
  const c = commit(BigInt(pl.amount), pk(BigInt(pl.sk)), BigInt(pl.blinding));
  const leaf = leavesNow.indexOf(c.toString());
  if (leaf >= 0) { recv = { sk: BigInt(pl.sk), bl: BigInt(pl.blinding), amount: BigInt(pl.amount), c, leaf }; break; }
}
if (!recv) { console.log("B_SCAN_FAILED: no spendable incoming note"); process.exit(1); }
log(`  B recovered note: ${recv.amount} at leaf ${recv.leaf} (controls one-time key) ✓`);

log("\n== B deposits, then SPENDS the received note (proves control) ==");
const b1 = await deposit(B, 5, 300000n, "sB1"); // B's own note so it has 2 inputs
{
  const tree = Tree.from((await getLeaves(POOL)).map((l) => l.commitment));
  const memR = tree.proof(recv.leaf), memO = tree.proof(b1.leaf), oldRoot = tree.root;
  const out1 = recv.amount + b1.amount, out2 = 0n;
  const sk1 = dsk(B, 6), bl1 = rand(), oc1 = commit(out1, pk(sk1), bl1);
  const sk2 = dsk(B, 7), bl2 = rand(), oc2 = commit(out2, pk(sk2), bl2);
  const insA = tree.insert(oc1), insB = tree.insert(oc2);
  const nfR = nul(recv.c, recv.sk), nfO = nul(b1.c, b1.sk);
  const pf = prove("transfer", "sBspend", {
    oldRoot, newRoot: insB.newRoot, nullifierA: nfR, nullifierB: nfO, outCommitmentA: oc1, outCommitmentB: oc2,
    inAmountA: recv.amount, inSkA: recv.sk, inBlindingA: recv.bl, inPathElementsA: memR.pe, inPathIndicesA: memR.pi,
    inAmountB: b1.amount, inSkB: b1.sk, inBlindingB: b1.bl, inPathElementsB: memO.pe, inPathIndicesB: memO.pi,
    outAmountA: out1, outPkA: pk(sk1), outBlindingA: bl1, outInsPathElementsA: insA.pe, outInsPathIndicesA: insA.pi,
    outAmountB: out2, outPkB: pk(sk2), outBlindingB: bl2, outInsPathElementsB: insB.pe, outInsPathIndicesB: insB.pi,
  });
  inv(POOL, "transfer", `--nullifier_a ${hex(nfR)} --nullifier_b ${hex(nfO)} --out_commitment_a ${hex(oc1)} --out_commitment_b ${hex(oc2)} --old_root ${hex(oldRoot)} --new_root ${hex(insB.newRoot)} --proof-file-path ${pf}`);
  await postLeaves(POOL, [{ index: insA.index, commitment: oc1.toString() }, { index: insB.index, commitment: oc2.toString() }]);
  log("  B spent the received note on-chain ✓");
  log("  received-note nullifier spent on-chain:", inv(POOL, "is_spent", `--nullifier ${hex(nfR)}`));
}
log("\nSTEALTH_PAYMENT_E2E=SUCCESS pool=" + POOL);
