import { useEffect, useMemo, useState } from "react";
import {
  ASSET_SYMBOL,
  NETWORK,
  POOL_ID,
  VERIFIER_ID,
  TOKEN_ID,
  isConfigured,
} from "./config";
import { connect, currentAddress } from "./lib/wallet";
import { setSimAccount } from "./lib/stellar";
import {
  WalletState,
  loadWallet,
  saveWallet,
  shieldedBalance,
  initCrypto,
  resetWallet,
  Note,
} from "./lib/notes";
import * as pool from "./lib/pool";
import { myShieldedAddress, registerAddress } from "./lib/delivery";
import { generateDisclosure, verifyDisclosure, type DisclosureBundle } from "./lib/compliance";
import { hasUsdcTrustline, addUsdcTrustline, faucetUsdc, faucetEth, fundXlm } from "./lib/faucet";
import { deliveryEnabled, ETH_LOCK } from "./config";
import { LOCK_ABI } from "./evm";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useWriteContract } from "wagmi";
import { parseEther } from "viem";
import { artifactsAvailable } from "./lib/prover";
import { fmt, parseAmount, short } from "./lib/format";

type Tab = "dashboard" | "faucet" | "deposit" | "send" | "receive" | "withdraw" | "offramp" | "bridge" | "compliance";
const TABS: Tab[] = ["dashboard", "faucet", "deposit", "send", "receive", "withdraw", "offramp", "bridge", "compliance"];
const expl = (id: string) => `https://stellar.expert/explorer/testnet/contract/${id}`;

export default function App() {
  const [pk, setPk] = useState<string | null>(null);
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [busyMsg, setBusyMsg] = useState("");
  const [ready, setReady] = useState(false);
  const [proofReady, setProofReady] = useState(false);
  const [chain, setChain] = useState<{ total: bigint; root: string } | null>(null);
  const [disclosure, setDisclosure] = useState<DisclosureBundle | null>(null);

  async function refreshChain() {
    if (!isConfigured()) return;
    try {
      const total = await pool.totalShielded();
      const rootBytes = await pool.onChainRoot();
      const root = Array.from(rootBytes, (b) => b.toString(16).padStart(2, "0")).join("");
      setChain({ total, root });
    } catch { /* ignore */ }
  }

  const pushLog = (m: string) =>
    setLog((l) => [`${new Date().toLocaleTimeString()}  ${m}`, ...l].slice(0, 60));

  useEffect(() => {
    (async () => {
      await initCrypto();
      setWallet(loadWallet());
      setReady(true);
      currentAddress().then((a) => { if (a) { setPk(a); setSimAccount(a); refreshChain(); } });
      setProofReady(await artifactsAvailable("deposit"));
    })();
  }, []);

  const refresh = () => wallet && setWallet({ ...wallet });

  async function onConnect() {
    try {
      const a = await connect();
      setPk(a); setSimAccount(a);
      pushLog(`Connected ${short(a)}`);
      refreshChain();
    } catch (e: any) { pushLog(`⚠ ${e.message}`); }
  }

  async function run(label: string, fn: () => Promise<void>) {
    if (!pk || !wallet) return pushLog("⚠ Connect a wallet first");
    setBusy(true); setBusyMsg(label);
    try { await fn(); refresh(); refreshChain(); }
    catch (e: any) { pushLog(`⚠ ${e.message ?? e}`); }
    finally { setBusy(false); setBusyMsg(""); }
  }

  if (!ready) return <div className="center">✦ initializing zero-knowledge wallet…</div>;

  const balance = wallet ? shieldedBalance(wallet) : 0n;
  const notes = wallet ? wallet.notes : [];
  const unspent = notes.filter((n) => !n.spent);

  return (
    <div className="app">
      <header>
        <div className="brand">
          <div className="logo">🛡️</div>
          <div>
            <h1>ShieldedBridge</h1>
            <small>Private {ASSET_SYMBOL} on Stellar · UTXO notes + ZK bridge</small>
          </div>
        </div>
        <div className="conn">
          <span className="net">{NETWORK}</span>
          {pk
            ? <span className="pill"><span className="dot" />{short(pk)}</span>
            : <button onClick={onConnect}>Connect Freighter</button>}
          <ConnectButton chainStatus="icon" accountStatus="address" showBalance={false} label="EVM (bridge)" />
        </div>
      </header>

      <section className="hero">
        <h2>Private-by-default money on Stellar.</h2>
        <p>
          Shield public {ASSET_SYMBOL} into a constellation of unlinkable UTXO notes, pay privately
          with amounts and counterparties hidden, and prove every spend in zero knowledge —
          verified on-chain by a BN254 Groth16 contract. Private, <em>not</em> anonymous: disclose a
          view key for compliance when you choose.
        </p>
        <div className="chips">
          <span className="chip">⚡ <b>BN254</b> Groth16 on Soroban</span>
          <span className="chip">🌳 Poseidon <b>UTXO</b> notes</span>
          <span className="chip">🔭 unlinkable <b>constellation</b></span>
          <span className="chip">🪙 ETH→Stellar <b>ZK bridge</b></span>
          <span className="chip">🔎 view-key <b>compliance</b></span>
        </div>
      </section>

      {!isConfigured() && (
        <div className="banner warn">⚠ Contracts not configured — set <code>VITE_POOL_ID</code> / <code>VITE_TOKEN_ID</code> (or run <code>scripts/deploy_testnet.sh</code>).</div>
      )}
      {isConfigured() && (
        <div className="banner ok">✓ Connected to a live testnet deployment. Pool <code>{short(POOL_ID, 5)}</code>.</div>
      )}
      {!proofReady && (
        <div className="banner info">ℹ Proving artifacts not in <code>/public/circuits/</code> — build with <code>cd circuits &amp;&amp; pnpm build</code> &amp; copy <code>*.wasm</code>/<code>*.zkey</code>. Note management still works.</div>
      )}

      <nav>
        {TABS.map((t) => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{t}</button>
        ))}
      </nav>

      <main>
        <div>
          {tab === "dashboard" && (
            <section className="grid">
              <div className="card stat">
                <h4>Shielded balance</h4>
                <div className="big grad tnum">{fmt(balance)}</div>
                <small>{ASSET_SYMBOL} · {unspent.length} private note(s)</small>
              </div>
              <div className="card stat">
                <h4>UTXO constellation</h4>
                <div className="big tnum">{notes.length}</div>
                <small>{unspent.length} active · {notes.length - unspent.length} spent</small>
              </div>
              <div className="card stat span">
                <h4>Live on-chain pool state {chain && <span className="dot" />}</h4>
                {chain ? (
                  <div className="kv" style={{ borderBottom: 0, paddingBottom: 0 }}>
                    <span>Total shielded (on-chain)</span>
                    <code className="tnum">{fmt(chain.total)} {ASSET_SYMBOL}</code>
                  </div>
                ) : <small className="muted">connect to read the live contract…</small>}
                {chain && <div className="kv" style={{ borderBottom: 0 }}><span>Merkle root</span><code className="mono">{short(chain.root, 8)}</code></div>}
              </div>
              <div className="card span">
                <h3 style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  Your notes
                  <button className="ghost" style={{ fontSize: 12, padding: "5px 10px" }}
                    onClick={() => { if (confirm("Reset local wallet for this pool? (clears notes + tree mirror)")) { setWallet(resetWallet()); pushLog("Wallet reset for this pool"); } }}>
                    Reset wallet
                  </button>
                </h3>
                <Constellation notes={notes} />
              </div>
            </section>
          )}

          {tab === "faucet" && (
            <FaucetForm busy={busy} stellarConnected={!!pk}
              onXlm={() => run("Funding test XLM", async () => {
                await fundXlm(pk!); pushLog(`Funded ${short(pk!)} with test XLM (friendbot)`); refreshChain();
              })}
              onUsdc={() => run("Funding mock USDC", async () => {
                pushLog("Ensuring account is funded (XLM)…");
                await fundXlm(pk!);
                if (!(await hasUsdcTrustline(pk!))) { pushLog("Adding USDC trustline (Freighter)…"); await addUsdcTrustline(pk!); }
                await faucetUsdc(pk!); pushLog(`+100 mock USDC → ${short(pk!)}`); refreshChain();
              })}
              onEth={(addr) => run("Funding Sepolia ETH", async () => {
                const r = await faucetEth(addr); pushLog(`+0.005 Sepolia ETH → ${short(addr)} · ${String(r.txHash).slice(0, 12)}…`);
              })} />
          )}

          {tab === "deposit" && (
            <Action title="Deposit — shield public tokens"
              help={`Pull public ${ASSET_SYMBOL} from your account into a fresh hidden note. A ZK proof binds the note's secret value to the deposited amount; only a commitment is published on-chain.`}
              cta="Shield" busy={busy}
              onSubmit={(amt) => run("Generating deposit proof", () => pool.deposit(pk!, wallet!, parseAmount(amt), pushLog))} />
          )}

          {tab === "send" && (
            <PayForm notes={unspent} busy={busy}
              onPay={(addrStr, amt) => run("Generating private payment proof", () => pool.payTo(pk!, wallet!, addrStr, parseAmount(amt), pushLog))} />
          )}

          {tab === "receive" && wallet && (
            <ReceiveForm wallet={wallet} busy={busy}
              onScan={() => run("Scanning for incoming notes", async () => { await pool.scanIncoming(wallet!, pushLog); })}
              pushLog={pushLog} />
          )}

          {tab === "withdraw" && (
            <WithdrawForm notes={unspent} busy={busy} defaultRecipient={pk ?? ""}
              onWithdraw={(note, to, amt) => run("Generating withdraw proof", () => pool.withdraw(pk!, wallet!, note, to, amt, pushLog))} />
          )}

          {tab === "offramp" && (
            <OfframpForm busy={busy}
              onOfframp={(rail, ccy, amt, handle) => run("Off-ramping to fiat", () =>
                pool.offramp(pk!, wallet!, { rail, currency: ccy, usdcAmount: parseAmount(amt), payoutHandle: handle, operator: pk! }, pushLog).then(() => {}))} />
          )}

          {tab === "bridge" && (
            <BridgeForm busy={busy} pushLog={pushLog}
              onBridge={(nonce, amt) => run("Bridging from Ethereum", () => pool.bridgeIn(pk!, wallet!, nonce, amt, pushLog))} />
          )}

          {tab === "compliance" && wallet && (
            <Compliance wallet={wallet} busy={busy} disclosure={disclosure}
              onGenerate={(label) => run("Generating disclosure proofs", async () => {
                const b = await generateDisclosure(BigInt(wallet!.master), wallet!.notes.filter((n) => !n.spent), label, pushLog);
                setDisclosure(b);
                pushLog(`Disclosure ready: ${b.items.length} note(s), total ${fmt(BigInt(b.total))} ${ASSET_SYMBOL}`);
              })}
              onVerify={() => run("Auditor verifying disclosure", async () => {
                if (!disclosure) return pushLog("⚠ generate a disclosure first");
                const r = await verifyDisclosure(disclosure, new Set(wallet!.leaves));
                pushLog(`Auditor: ${r.verified}/${disclosure.items.length} proofs valid · total ${fmt(r.total)} ${ASSET_SYMBOL}${r.onChain ? " · commitments on-chain ✓" : ""}`);
              })} />
          )}
        </div>

        <aside>
          <div className="card log">
            <h3>Activity {busy && <span className="spinner" />}</h3>
            {busy && <div className="working"><span className="spinner" /><span className="shimmer">{busyMsg}…</span></div>}
            {log.length === 0
              ? <p className="muted">No activity yet. Connect &amp; make a deposit.</p>
              : log.map((l, i) => <div key={i} className="logline">{l}</div>)}
          </div>
        </aside>
      </main>

      <footer>
        Testnet demo · proofs verified on-chain via BN254 Groth16 · not audited.<br />
        {POOL_ID && <a className="link" href={expl(POOL_ID)} target="_blank">pool</a>}{" · "}
        {VERIFIER_ID && <a className="link" href={expl(VERIFIER_ID)} target="_blank">verifier</a>}{" · "}
        {TOKEN_ID && <a className="link" href={expl(TOKEN_ID)} target="_blank">USDC</a>}
      </footer>
    </div>
  );
}

function Constellation({ notes }: { notes: Note[] }) {
  if (notes.length === 0) return <p className="empty">No notes yet — make a deposit to mint your first shielded UTXO.</p>;
  return (
    <div className="notes-grid">
      {notes.map((n, i) => (
        <div key={i} className={`note-card ${n.spent ? "spent" : ""}`}>
          <span className={`tag ${n.spent ? "spent" : "active"}`}>{n.spent ? "spent" : "active"}</span>
          <div className="amt tnum">{fmt(BigInt(n.amount))} <span>{ASSET_SYMBOL}</span></div>
          <div className="meta">leaf #{n.leafIndex ?? "—"} · key {n.keyIndex}</div>
          <div className="meta">{short(BigInt(n.commitment).toString(16), 7)}</div>
        </div>
      ))}
    </div>
  );
}

function Action({ title, help, cta, busy, onSubmit }:
  { title: string; help: string; cta: string; busy: boolean; onSubmit: (amt: string) => void }) {
  const [amt, setAmt] = useState("");
  return (
    <section className="form card">
      <h3>{title}</h3>
      <p className="help">{help}</p>
      <label>Amount ({ASSET_SYMBOL})
        <input value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="10.0" inputMode="decimal" />
      </label>
      <button disabled={busy || !amt} onClick={() => onSubmit(amt)}>{cta}</button>
    </section>
  );
}

function PayForm({ notes, busy, onPay }:
  { notes: Note[]; busy: boolean; onPay: (address: string, amt: string) => void }) {
  const [to, setTo] = useState("");
  const [amt, setAmt] = useState("");
  const total = notes.reduce((s, n) => s + BigInt(n.amount), 0n);
  return (
    <section className="form card">
      <h3>Private Send — pay a shielded address</h3>
      <p className="help">
        Spends two of your notes and creates a hidden note for the recipient (+ your change),
        then delivers the encrypted opening so only they can find & spend it. Amounts and the
        sender↔receiver link stay hidden on-chain. Spendable balance: <b>{fmt(total)} {ASSET_SYMBOL}</b>.
      </p>
      {!deliveryEnabled() && <p className="banner warn">Delivery layer off — set <code>VITE_DELIVERY_URL</code> and run the backend.</p>}
      {notes.length < 2 && <p className="banner warn" style={{ marginTop: 12 }}>Need ≥2 active notes — deposit a couple of times first.</p>}
      <label>Recipient shielded address<input value={to} onChange={(e) => setTo(e.target.value)} placeholder="sb1:…" /></label>
      <label>Amount ({ASSET_SYMBOL})<input value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="5.0" inputMode="decimal" /></label>
      <button disabled={busy || !to || !amt || notes.length < 2} onClick={() => onPay(to, amt)}>Send privately</button>
    </section>
  );
}

function ReceiveForm({ wallet, busy, onScan, pushLog }:
  { wallet: WalletState; busy: boolean; onScan: () => void; pushLog: (m: string) => void }) {
  const address = useMemo(() => myShieldedAddress(BigInt(wallet.master)), [wallet.master]);
  const [handle, setHandle] = useState("");
  const copy = () => { navigator.clipboard?.writeText(address); pushLog("Address copied"); };
  const register = async () => {
    if (!handle) return;
    try { await registerAddress(address, address.split(":")[2], handle); pushLog(`Registered @${handle}`); }
    catch (e: any) { pushLog(`⚠ ${e.message}`); }
  };
  return (
    <section className="form card">
      <h3>Receive — your shielded address</h3>
      <p className="help">Share this with anyone to receive private payments. It encodes your receive key + an X25519 encryption key; senders encrypt the note opening to it.</p>
      <div className="kv" style={{ alignItems: "center" }}>
        <code className="mono" style={{ wordBreak: "break-all", fontSize: 12 }}>{address}</code>
      </div>
      <button className="ghost" onClick={copy} style={{ marginTop: 10 }}>Copy address</button>
      <label style={{ marginTop: 16 }}>Claim a handle (optional)<input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="alice" /></label>
      <button className="ghost" onClick={register} disabled={!handle || !deliveryEnabled()}>Register @handle</button>
      <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "18px 0" }} />
      <p className="help">Pull incoming payments others sent you (decrypts &amp; adds spendable notes).</p>
      <button onClick={onScan} disabled={busy || !deliveryEnabled()}>Scan for incoming notes</button>
    </section>
  );
}

function WithdrawForm({ notes, busy, defaultRecipient, onWithdraw }:
  { notes: Note[]; busy: boolean; defaultRecipient: string; onWithdraw: (note: Note, to: string, amt: bigint) => void }) {
  const [idx, setIdx] = useState(0);
  const [to, setTo] = useState(defaultRecipient);
  const [amt, setAmt] = useState("");
  useEffect(() => setTo(defaultRecipient), [defaultRecipient]);
  return (
    <section className="form card">
      <h3>Withdraw — unshield to a public address</h3>
      <p className="help">Spends one note, pays a public amount to the recipient, and re-shields the change into a fresh note. The recipient is cryptographically bound into the proof, so it can't be front-run.</p>
      {notes.length === 0
        ? <p className="banner warn" style={{ marginTop: 12 }}>No active notes.</p>
        : (<>
          <label>Note<select value={idx} onChange={(e) => setIdx(+e.target.value)}>
            {notes.map((n, i) => <option key={i} value={i}>#{n.leafIndex} · {fmt(BigInt(n.amount))} {ASSET_SYMBOL}</option>)}
          </select></label>
          <label>Recipient (G… address)<input value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <label>Amount ({ASSET_SYMBOL})<input value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="3.0" inputMode="decimal" /></label>
          <button disabled={busy || !amt || !to} onClick={() => onWithdraw(notes[idx], to, parseAmount(amt))}>Withdraw</button>
        </>)}
    </section>
  );
}

function FaucetForm({ busy, stellarConnected, onXlm, onUsdc, onEth }:
  { busy: boolean; stellarConnected: boolean; onXlm: () => void; onUsdc: () => void; onEth: (addr: string) => void }) {
  const { address: evm, isConnected } = useAccount();
  return (
    <section className="form card">
      <h3>Faucet — testnet tokens</h3>
      <p className="help">Grab tokens to try every flow. Demo-only, rate-limited per address.</p>
      {!stellarConnected && <p className="banner warn">Connect Freighter (top-right) first.</p>}
      <div className="kv">
        <span>Test XLM (Stellar) — creates/funds your account</span>
        <button className="ghost" disabled={busy || !stellarConnected} onClick={onXlm}>Get test XLM</button>
      </div>
      <div className="kv">
        <span>Mock {ASSET_SYMBOL} (Stellar)</span>
        <button disabled={busy || !stellarConnected} onClick={onUsdc}>Get 100 {ASSET_SYMBOL}</button>
      </div>
      <p className="help" style={{ fontSize: 12, marginTop: 6 }}>USDC auto-funds XLM if needed, adds a {ASSET_SYMBOL} trustline (Freighter), then mints 100 {ASSET_SYMBOL}.</p>
      <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "16px 0" }} />
      <div className="kv">
        <span>Sepolia ETH (EVM)</span>
        {isConnected ? <button disabled={busy} onClick={() => onEth(evm!)}>Get 0.005 ETH</button> : <ConnectButton label="Connect EVM" />}
      </div>
      <p className="help" style={{ fontSize: 12, marginTop: 6 }}>Sends 0.005 Sepolia ETH to your connected EVM wallet (gas + native locking).</p>
    </section>
  );
}

function BridgeForm({ busy, pushLog, onBridge }:
  { busy: boolean; pushLog: (m: string) => void; onBridge: (nonce: bigint, amt: bigint) => void }) {
  const [nonce, setNonce] = useState("1");
  const [amt, setAmt] = useState("");
  const [ethAmt, setEthAmt] = useState("0.001");
  const { isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const lockOnSepolia = async () => {
    try {
      const c = new Uint8Array(32); crypto.getRandomValues(c); c[0] &= 0x1f;
      const commitment = ("0x" + Array.from(c, (b) => b.toString(16).padStart(2, "0")).join("")) as `0x${string}`;
      pushLog("Locking on Sepolia (EVM wallet)…");
      const hash = await writeContractAsync({
        address: ETH_LOCK as `0x${string}`, abi: LOCK_ABI, functionName: "lock",
        args: [commitment], value: parseEther(ethAmt || "0.001"),
      });
      pushLog(`Locked on Sepolia · tx ${hash.slice(0, 12)}…  commitment ${commitment.slice(0, 12)}…`);
    } catch (e: any) { pushLog(`⚠ ${e.shortMessage || e.message}`); }
  };

  return (
    <section className="form card">
      <h3>Bridge — Ethereum (Sepolia) → shielded Stellar note</h3>
      <ol className="steps">
        <li>Lock ETH in <code>ShieldedBridgeLock</code> on Sepolia (your EVM wallet) — emits <code>Locked(nonce, amount, commitment)</code>.</li>
        <li>The relayer observes the event and submits a ZK proof to Stellar.</li>
        <li>The bridge mints your shielded note, pulling matching liquidity so supply stays backed.</li>
      </ol>

      <h4 style={{ marginTop: 14 }}>1 · Lock on Sepolia (EVM)</h4>
      <label>ETH to lock<input value={ethAmt} onChange={(e) => setEthAmt(e.target.value)} inputMode="decimal" /></label>
      {isConnected
        ? <button disabled={busy} onClick={lockOnSepolia}>Lock on Sepolia</button>
        : <ConnectButton label="Connect EVM to lock" />}

      <h4 style={{ marginTop: 18 }}>2 · Mint shielded note on Stellar (relayer)</h4>
      <p className="help">Demo: the connected Freighter wallet acts as the relayer.</p>
      <label>Ethereum lock nonce<input value={nonce} onChange={(e) => setNonce(e.target.value)} /></label>
      <label>Amount ({ASSET_SYMBOL})<input value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="10.0" inputMode="decimal" /></label>
      <button disabled={busy || !amt} onClick={() => onBridge(BigInt(nonce), parseAmount(amt))}>Bridge in</button>
    </section>
  );
}

function OfframpForm({ busy, onOfframp }:
  { busy: boolean; onOfframp: (rail: string, currency: string, amt: string, handle: string) => void }) {
  const [rail, setRail] = useState("wise");
  const [ccy, setCcy] = useState("USD");
  const [amt, setAmt] = useState("");
  const [handle, setHandle] = useState("");
  return (
    <section className="form card">
      <h3>Off-ramp — shielded {ASSET_SYMBOL} → fiat</h3>
      <p className="help">
        The fiat edge of a <b>private remittance corridor</b>: unshield on-chain to the off-ramp
        operator (ZK-verified), then a payment rail settles fiat. Amounts stay private in the pool;
        an Ed25519 <b>settlement oracle</b> attests the payout. Rails are sandbox (no real money moves).
      </p>
      {!deliveryEnabled() && <p className="banner warn">Off-ramp service off — set <code>VITE_DELIVERY_URL</code> + run the backend.</p>}
      <label>Rail<select value={rail} onChange={(e) => setRail(e.target.value)}>
        <option value="wise">Wise</option><option value="cashapp">Cash App</option><option value="revolut">Revolut</option>
      </select></label>
      <label>Payout currency<select value={ccy} onChange={(e) => setCcy(e.target.value)}>
        {["USD", "EUR", "GBP", "INR", "NGN"].map((c) => <option key={c} value={c}>{c}</option>)}
      </select></label>
      <label>Amount ({ASSET_SYMBOL})<input value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="25.0" inputMode="decimal" /></label>
      <label>Payout handle / IBAN (sandbox)<input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="$alice / GB..." /></label>
      <button disabled={busy || !amt || !handle} onClick={() => onOfframp(rail, ccy, amt, handle)}>Off-ramp to {ccy}</button>
    </section>
  );
}

function Compliance({ wallet, busy, disclosure, onGenerate, onVerify }:
  { wallet: WalletState; busy: boolean; disclosure: DisclosureBundle | null;
    onGenerate: (label: string) => void; onVerify: () => void }) {
  const [label, setLabel] = useState("auditor-2026");
  const total = shieldedBalance(wallet);
  const active = wallet.notes.filter((n) => !n.spent).length;
  return (
    <section className="form card">
      <h3>Compliance — ZK selective disclosure (proof of funds)</h3>
      <p className="help">
        Privacy ≠ opacity. A holder generates <b>zero-knowledge proofs</b> that they own specific
        on-chain notes worth specific amounts — for an auditor — <b>without</b> revealing spend keys,
        blindings, or any other notes. The auditor verifies the bundle and that the commitments are
        on-chain. Spend authority is never exposed.
      </p>
      <div className="kv"><span>Active notes</span><code>{active}</code></div>
      <div className="kv"><span>Balance to disclose</span><code className="tnum">{fmt(total)} {ASSET_SYMBOL}</code></div>
      <label>Auditor / session label<input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="auditor-2026" /></label>
      <button disabled={busy || active === 0} onClick={() => onGenerate(label)}>Generate disclosure proofs</button>
      {disclosure && (<>
        <div className="banner ok" style={{ marginTop: 14 }}>
          ✓ Disclosure bundle: {disclosure.items.length} proof(s), total {fmt(BigInt(disclosure.total))} {ASSET_SYMBOL}.
        </div>
        <button className="ghost" disabled={busy} onClick={onVerify}>Verify as auditor</button>
        <button className="ghost" style={{ marginLeft: 8 }}
          onClick={() => navigator.clipboard?.writeText(JSON.stringify(disclosure))}>Copy bundle</button>
      </>)}
    </section>
  );
}
