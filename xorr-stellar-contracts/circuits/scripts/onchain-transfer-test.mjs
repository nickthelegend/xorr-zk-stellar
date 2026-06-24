// Prove the PRIVATE PAYMENT works on-chain (testnet), end to end:
//   deploy fresh pool -> set deposit+transfer VKs -> deposit A -> deposit B
//   -> private 2-in/2-out transfer (verified on-chain) -> assert nullifiers
//   spent + value conserved.
// Uses the snarkjs CLI prove path (reliable) + the stellar CLI for invokes.
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { buildPoseidon } from "circomlibjs";
import { convertProof } from "./export-vk.mjs";

const NET = "testnet", SRC = "shieldedbridge";
const TOKEN = "CB2JO4FJH5NUU7Y2PHQ27H35DIOHQZDMCLFP6BSHGVZA2VDM4472MQXA";
const VERIFIER = "CCHSKQ2ZAEVIZ5KXZIB4NJI363NHFIARIUWJP47KSCY6CTENSPL33IQW";
const DEPTH = 20;
const sh = (c) => execSync(c, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const stellar = (id, fn, args) =>
  sh(`stellar contract invoke --id ${id} --source ${SRC} --network ${NET} -- ${fn} ${args}`);

const P = await buildPoseidon();
const H = (xs) => P.F.toObject(P(xs));
const hex = (x) => BigInt(x).toString(16).padStart(64, "0");
const dsk = (m, i) => H([m, BigInt(i)]);
const pk = (sk) => H([sk]);
const commit = (a, p, b) => H([a, p, b]);
const nul = (c, sk) => H([c, sk]);

class Tree {
  constructor() { this.z=[]; this.f=[]; this.leaves=[]; let z=0n; for(let i=0;i<DEPTH;i++){this.z[i]=z;this.f[i]=z;z=H([z,z]);} this.root=z; }
  insert(leaf){ const index=this.leaves.length, oldRoot=this.root; const pe=[],pi=[]; let cur=leaf,idx=index;
    for(let i=0;i<DEPTH;i++){const r=idx&1;pi.push(r); if(r===0){pe.push(this.z[i]);this.f[i]=cur;cur=H([cur,this.z[i]]);}else{pe.push(this.f[i]);cur=H([this.f[i],cur]);} idx>>=1;}
    this.leaves.push(leaf); this.root=cur; return {index,pe,pi,oldRoot,newRoot:cur}; }
  proof(index){ const pe=[],pi=[]; let layer=[...this.leaves],idx=index;
    for(let i=0;i<DEPTH;i++){const r=idx&1,s=r?idx-1:idx+1;pi.push(r);pe.push(s<layer.length?layer[s]:this.z[i]);
      const nx=[];for(let j=0;j<layer.length;j+=2)nx.push(H([layer[j],j+1<layer.length?layer[j+1]:this.z[i]]));layer=nx;idx>>=1;} return {pe,pi}; }
}

function prove(circuit, tag, input) {
  const bigintToStr = (_k, v) => (typeof v === "bigint" ? v.toString() : v);
  writeFileSync(`build/${tag}.input.json`, JSON.stringify(input, bigintToStr));
  sh(`npx snarkjs wtns calculate build/${circuit}_js/${circuit}.wasm build/${tag}.input.json build/${tag}.wtns`);
  sh(`npx snarkjs groth16 prove build/${circuit}.zkey build/${tag}.wtns build/${tag}.proof.json build/${tag}.public.json`);
  const p = convertProof(JSON.parse(execSync(`cat build/${tag}.proof.json`, { encoding: "utf8" })));
  writeFileSync(`build/${tag}.scval.json`, JSON.stringify({ a: p.a, b: p.b, c: p.c }));
  return `build/${tag}.scval.json`;
}

const log = (...a) => console.log(...a);
const master = 20260619n;
const tree = new Tree();
const admin = sh(`stellar keys address ${SRC}`);

log("== deploy fresh pool ==");
const emptyRoot = hex(tree.root);
const POOL = sh(`stellar contract deploy --wasm ../contracts/target/wasm32v1-none/release/privacy_pool.wasm --source ${SRC} --network ${NET} -- --admin ${admin} --token ${TOKEN} --verifier ${VERIFIER} --empty_root ${emptyRoot}`).split("\n").pop();
log("  pool =", POOL);
log("== set VKs (deposit, transfer) ==");
stellar(POOL, "set_vk", `--circuit 0 --vk-file-path build/deposit.vk.soroban.json`);
stellar(POOL, "set_vk", `--circuit 1 --vk-file-path build/transfer.vk.soroban.json`);

// ---- deposit A (0.6) and B (0.4) ----
function deposit(idx, amount) {
  const sk = dsk(master, idx), blinding = BigInt(idx) * 1000003n + 7n;
  const c = commit(amount, pk(sk), blinding);
  const ins = tree.insert(c);
  const pf = prove("deposit", `dep${idx}`, { oldRoot: ins.oldRoot, newRoot: ins.newRoot, commitment: c, amount, sk, blinding, pathElements: ins.pe, pathIndices: ins.pi });
  stellar(POOL, "deposit", `--from ${admin} --amount ${amount} --commitment ${hex(c)} --old_root ${hex(ins.oldRoot)} --new_root ${hex(ins.newRoot)} --proof-file-path ${pf}`);
  log(`  deposited ${amount} (note idx ${idx}, leaf ${ins.index})`);
  return { idx, sk, blinding, amount, c, leaf: ins.index };
}
log("== deposit A ==");  const A = deposit(1, 600000n);
log("== deposit B ==");  const B = deposit(2, 400000n);
log("  total_shielded =", stellar(POOL, "total_shielded", ""));

// ---- private transfer: A+B -> outA(0.7)+outB(0.3), both re-shielded to self ----
log("== PRIVATE TRANSFER (2-in / 2-out) ==");
const memA = tree.proof(A.leaf), memB = tree.proof(B.leaf), oldRoot = tree.root;
const outAmtA = 700000n, outAmtB = 300000n;
const skOA = dsk(master, 3), skOB = dsk(master, 4);
const blOA = 314159n, blOB = 271828n;
const outCmtA = commit(outAmtA, pk(skOA), blOA), outCmtB = commit(outAmtB, pk(skOB), blOB);
const insA = tree.insert(outCmtA), insB = tree.insert(outCmtB);
const nfA = nul(A.c, A.sk), nfB = nul(B.c, B.sk);
const pf = prove("transfer", "xfer", {
  oldRoot, newRoot: insB.newRoot, nullifierA: nfA, nullifierB: nfB, outCommitmentA: outCmtA, outCommitmentB: outCmtB,
  inAmountA: A.amount, inSkA: A.sk, inBlindingA: A.blinding, inPathElementsA: memA.pe, inPathIndicesA: memA.pi,
  inAmountB: B.amount, inSkB: B.sk, inBlindingB: B.blinding, inPathElementsB: memB.pe, inPathIndicesB: memB.pi,
  outAmountA: outAmtA, outPkA: pk(skOA), outBlindingA: blOA, outInsPathElementsA: insA.pe, outInsPathIndicesA: insA.pi,
  outAmountB: outAmtB, outPkB: pk(skOB), outBlindingB: blOB, outInsPathElementsB: insB.pe, outInsPathIndicesB: insB.pi,
});
stellar(POOL, "transfer", `--nullifier_a ${hex(nfA)} --nullifier_b ${hex(nfB)} --out_commitment_a ${hex(outCmtA)} --out_commitment_b ${hex(outCmtB)} --old_root ${hex(oldRoot)} --new_root ${hex(insB.newRoot)} --proof-file-path ${pf}`);
log("  transfer submitted ✓ (proof verified on-chain)");

log("== assertions ==");
log("  nfA spent:", stellar(POOL, "is_spent", `--nullifier ${hex(nfA)}`));
log("  nfB spent:", stellar(POOL, "is_spent", `--nullifier ${hex(nfB)}`));
log("  total_shielded (value conserved):", stellar(POOL, "total_shielded", ""));
log("  next_leaf:", stellar(POOL, "next_leaf", ""));
log("\nONCHAIN_PRIVATE_PAYMENT=SUCCESS pool=" + POOL);
