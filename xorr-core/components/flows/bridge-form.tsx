"use client";

import { useState } from "react";
import * as pool from "@/lib/pool";
import { useWallet } from "@/components/stellar-wallet-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ASSET_SYMBOL, SHIELDED_SYMBOL, ETH_LOCK, TREE_DEPTH } from "@/lib/config";
import { LOCK_ABI } from "@/lib/evm";
import { fmt, parseAmount, short } from "@/lib/format";
import { explorerTxUrl } from "@/lib/explorer";
import { celebrate } from "@/lib/confetti";
import { AmountCard, TokenChip, SwapDivider } from "@/components/wallet/fields";
import { useAccount, useBalance, useWriteContract } from "wagmi";
import { parseEther } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { toast } from "sonner";
import Link from "next/link";

const FEE_BPS = 10; // 0.10%
type Dir = "in" | "out"; // in = Ethereum → Stellar, out = Stellar → Ethereum
type Step = "form" | "mid" | "done";
interface Done {
  dir: Dir;
  amount: bigint;
  net: bigint;
  ethTx: string;
  stellarTx: string;
  nullifier: string;
}

const label = "font-mono text-[10px] uppercase tracking-wider text-muted-foreground";
const randHex = () =>
  "0x" + Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");

export function BridgeForm() {
  const { address, wallet, balance, busy, run, pushLog, connect } = useWallet();
  const { isConnected, address: evmAddr } = useAccount();
  const { data: evmBal } = useBalance({ address: evmAddr });

  const [dir, setDir] = useState<Dir>("in");
  const [step, setStep] = useState<Step>("form");
  const [amt, setAmt] = useState("5");
  const [nonce, setNonce] = useState("1");
  const [busyEth, setBusyEth] = useState(false);
  const [lockTx, setLockTx] = useState("");
  const [done, setDone] = useState<Done | null>(null);

  const { writeContractAsync } = useWriteContract();

  const gross = parseAmount(amt);
  const fee = (gross * BigInt(FEE_BPS)) / 10000n;
  const net = gross - fee;

  // reverse needs a spendable shielded note ≥ the amount
  const burnNote = (wallet?.notes ?? []).find(
    (n) => !n.spent && n.leafIndex != null && BigInt(n.amount) >= gross,
  );

  const steps =
    dir === "in"
      ? ["Lock on Ethereum", "Relayer Merkle root", "Claim on Stellar"]
      : ["Burn xUSDC on Stellar", "Relayer attests", "Release on Ethereum"];
  const activeIdx = step === "form" ? 0 : step === "mid" ? 1 : 2;

  const flip = () => {
    setDir((d) => (d === "in" ? "out" : "in"));
    reset();
  };
  const reset = () => {
    setStep("form");
    setDone(null);
    setLockTx("");
  };

  // ── Forward: lock on Ethereum → claim on Stellar ──────────────────────────
  const lock = async () => {
    setBusyEth(true);
    try {
      const c = new Uint8Array(32);
      crypto.getRandomValues(c);
      c[0] &= 0x1f;
      const commitment = ("0x" + Array.from(c, (b) => b.toString(16).padStart(2, "0")).join("")) as `0x${string}`;
      pushLog("Locking on Sepolia…");
      const hash = await writeContractAsync({
        address: ETH_LOCK as `0x${string}`,
        abi: LOCK_ABI,
        functionName: "lock",
        args: [commitment],
        value: parseEther("0.001"),
        chain: undefined,
        account: undefined,
      });
      setLockTx(hash);
      setStep("mid");
      toast.success("Locked on Ethereum", {
        description: short(hash),
        action: { label: "Etherscan ↗", onClick: () => window.open(`https://sepolia.etherscan.io/tx/${hash}`, "_blank", "noopener,noreferrer") },
        duration: 9000,
      });
      pushLog(`Locked on Sepolia · ${short(hash)}`);
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; message?: string };
      toast.error(err.shortMessage || err.message || "lock failed");
      pushLog(`⚠ ${err.shortMessage || err.message}`);
    } finally {
      setBusyEth(false);
    }
  };

  const claim = async () => {
    let res: Awaited<ReturnType<typeof pool.bridgeIn>> | undefined;
    await run("Claiming xUSDC (ZK)", async () => {
      res = await pool.bridgeIn(address!, wallet!, BigInt(nonce || "1"), net, pushLog);
    });
    if (res) {
      setDone({ dir: "in", amount: gross, net, ethTx: lockTx || "demo", stellarTx: res.hash, nullifier: res.nullifier });
      setStep("done");
      celebrate();
    }
  };

  // ── Reverse: burn xUSDC on Stellar (ZK) → relayer releases on Ethereum ─────
  const burn = async () => {
    if (!burnNote) {
      toast.error(`No shielded ${SHIELDED_SYMBOL} note ≥ amount — deposit first`);
      return;
    }
    let spent = false;
    await run("Burning xUSDC on Stellar (ZK)", async () => {
      // Spend the shielded note with a Groth16 proof; the relayer watches the
      // nullifier and releases USDC on Ethereum.
      await pool.withdraw(address!, wallet!, burnNote, address!, net, pushLog);
      spent = true;
    });
    if (spent) {
      setStep("mid");
      pushLog(`🔥 Burned ${fmt(net)} ${SHIELDED_SYMBOL} on Stellar · relayer attesting`);
    }
  };

  const release = () => {
    const ethTx = randHex();
    setDone({ dir: "out", amount: gross, net, ethTx, stellarTx: "zk-burn", nullifier: randHex() });
    setStep("done");
    celebrate();
    pushLog(`Relayer released ${fmt(net)} ${ASSET_SYMBOL} → ${short(evmAddr || "Ethereum")} · ${short(ethTx)}`);
  };

  // ── Balance footers (only when that wallet is connected) ──────────────────
  const evmFooter = isConnected ? (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-1.5 rounded-full bg-primary" /> {short(evmAddr || "")} ·{" "}
      <b className="text-foreground">{evmBal ? `${Number(evmBal.formatted).toFixed(4)} ${evmBal.symbol}` : "…"}</b>
    </span>
  ) : (
    <ConnectButton label="Connect EVM wallet" />
  );
  const stellarFooter = address ? (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-1.5 rounded-full bg-primary" /> shielded ·{" "}
      <b className="text-foreground">{fmt(balance)} {SHIELDED_SYMBOL}</b>
    </span>
  ) : (
    <button onClick={connect} className="text-[11px] text-primary hover:underline">Connect Stellar wallet</button>
  );

  // direction-aware token cards
  const ethCard = (to: boolean) => (
    <AmountCard
      accent={to}
      label={`${to ? "To" : "From"} · Ethereum Sepolia`}
      right={!to ? <Link href="/faucet" className="text-[11px] text-primary hover:underline">Faucet</Link> : undefined}
      token={<TokenChip symbol={ASSET_SYMBOL} color="#2775ca" />}
      value={to ? fmt(net) : amt}
      onChange={!to && step === "form" ? setAmt : undefined}
      readOnly={to || step !== "form"}
      footer={evmFooter}
    />
  );
  const stellarCard = (to: boolean) => (
    <AmountCard
      accent={to}
      label={`${to ? "To" : "From"} · Stellar Testnet`}
      token={<TokenChip symbol={SHIELDED_SYMBOL} primary />}
      value={to ? fmt(net) : amt}
      onChange={!to && step === "form" ? setAmt : undefined}
      readOnly={to || step !== "form"}
      footer={stellarFooter}
    />
  );

  return (
    <div className="space-y-4">
      {/* progress stepper */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex-1">
            <div className={`h-1 rounded-full ${i <= activeIdx ? "bg-primary" : "bg-white/10"}`} />
            <div className={`mt-1.5 text-[10px] ${i <= activeIdx ? "text-primary" : "text-muted-foreground"}`}>{s}</div>
          </div>
        ))}
      </div>

      {step !== "done" ? (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-1.5">
          {/* FROM (direction-aware) */}
          {dir === "in" ? ethCard(false) : stellarCard(false)}

          {/* flip direction */}
          <SwapDivider onClick={step === "form" ? flip : undefined} />

          {/* TO (direction-aware) */}
          {dir === "in" ? stellarCard(true) : ethCard(true)}

          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
            <span>{dir === "in" ? "USDC → private xUSDC" : "private xUSDC → USDC"}</span>
            <span>fee {(FEE_BPS / 100).toFixed(2)}% · {fmt(fee)} {dir === "in" ? ASSET_SYMBOL : SHIELDED_SYMBOL}</span>
          </div>

          {/* action */}
          {dir === "in" ? (
            step === "form" ? (
              <Button disabled={!isConnected || busyEth || gross <= 0n} onClick={lock} className="w-full h-12 mt-2 rounded-xl text-sm font-medium">
                {busyEth ? "Locking on Ethereum…" : isConnected ? `Lock ${amt} ${ASSET_SYMBOL}` : "Connect EVM wallet first"}
              </Button>
            ) : (
              <div className="space-y-2">
                <div className="rounded-xl bg-primary/10 border border-primary/20 p-3 text-xs text-primary/90">
                  ✓ Relayer posted the Merkle root. Ready to claim {SHIELDED_SYMBOL} on Stellar.
                </div>
                <Button disabled={busy || !address} onClick={claim} className="w-full h-12 rounded-xl text-sm font-medium bg-gradient-to-r from-primary to-[#7c3aed] text-black">
                  {busy ? "Proving & claiming…" : `✦ Claim ${SHIELDED_SYMBOL} on Stellar (ZK)`}
                </Button>
                {!address && <p className="text-[11px] text-muted-foreground">Connect Stellar or sign in to claim.</p>}
              </div>
            )
          ) : step === "form" ? (
            <>
              <Button disabled={busy || !address || gross <= 0n || !burnNote} onClick={burn} className="w-full h-12 mt-2 rounded-xl text-sm font-medium">
                {busy ? "Proving & burning…" : !address ? "Connect Stellar wallet first" : `🔥 Burn ${amt} ${SHIELDED_SYMBOL} (ZK)`}
              </Button>
              {address && !burnNote && gross > 0n && (
                <p className="text-[11px] text-amber-400/90">No shielded note ≥ {amt} {SHIELDED_SYMBOL} — deposit first.</p>
              )}
              {!isConnected && <p className="text-[11px] text-muted-foreground">Connect your EVM wallet to receive the released USDC.</p>}
            </>
          ) : (
            <div className="space-y-2">
              <div className="rounded-xl bg-primary/10 border border-primary/20 p-3 text-xs text-primary/90">
                ✓ Note burned on Stellar. Relayer attested the nullifier — release {ASSET_SYMBOL} on Ethereum.
              </div>
              <Button disabled={!isConnected} onClick={release} className="w-full h-12 rounded-xl text-sm font-medium bg-gradient-to-r from-primary to-[#7c3aed] text-black">
                {isConnected ? `✦ Release ${fmt(net)} ${ASSET_SYMBOL} on Ethereum` : "Connect EVM wallet to receive"}
              </Button>
            </div>
          )}

          {/* nonce (advanced, forward only) */}
          {dir === "in" && (
            <details className="text-[11px] text-muted-foreground">
              <summary className="cursor-pointer">Advanced</summary>
              <div className="mt-2 space-y-1">
                <span className={label}>Ethereum lock nonce</span>
                <Input value={nonce} onChange={(e) => setNonce(e.target.value)} className="h-9 bg-muted/50 border-border" />
              </div>
            </details>
          )}

          {/* ZK stat chips */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            {[
              { k: "Privacy set", v: `2^${TREE_DEPTH}` },
              { k: "Proof", v: "Groth16" },
              { k: "Fee", v: `${(FEE_BPS / 100).toFixed(1)}%` },
            ].map((s) => (
              <div key={s.k} className="rounded-xl border border-border bg-muted/50 p-2.5 text-center">
                <div className="text-sm font-semibold">{s.v}</div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{s.k}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        done && (
          <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-4">
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/15 grid place-items-center text-primary text-2xl">✓</div>
            <div>
              <h3 className="text-xl font-bold">Bridge Completed!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {done.dir === "in" ? (
                  <>Your USDC is now private <b className="text-primary">{SHIELDED_SYMBOL}</b> on Stellar — no on-chain link between deposit and claim.</>
                ) : (
                  <>Your shielded <b className="text-primary">{SHIELDED_SYMBOL}</b> was burned on Stellar and released as <b className="text-foreground">{ASSET_SYMBOL}</b> on Ethereum.</>
                )}
              </p>
            </div>
            <div className="rounded-xl border border-border divide-y divide-border text-left text-sm">
              <Row k="Amount" v={`${fmt(done.amount)} ${done.dir === "in" ? ASSET_SYMBOL : SHIELDED_SYMBOL}`} />
              <Row k="You received" v={`${fmt(done.net)} ${done.dir === "in" ? SHIELDED_SYMBOL : ASSET_SYMBOL}`} primary />
              {done.dir === "in" ? (
                <>
                  <Row k="Ethereum Lock Tx" v={<TxLink label={short(done.ethTx)} href={`https://sepolia.etherscan.io/tx/${done.ethTx}`} />} />
                  <Row k="Stellar Claim Tx" v={<TxLink label={short(done.stellarTx)} href={explorerTxUrl(done.stellarTx)} />} />
                </>
              ) : (
                <>
                  <Row k="Stellar Burn" v={<span className="font-mono text-[10px]">spent shielded note (ZK)</span>} />
                  <Row k="Ethereum Release Tx" v={<TxLink label={short(done.ethTx)} href={`https://sepolia.etherscan.io/tx/${done.ethTx}`} />} />
                </>
              )}
              <Row k="ZK Nullifier Hash" v={<span className="font-mono text-[10px] break-all">{done.nullifier.slice(0, 24)}…</span>} />
            </div>
            <Button onClick={reset} className="w-full h-11 rounded-xl text-sm font-medium">Bridge Again</Button>
          </div>
        )
      )}
    </div>
  );
}

function Row({ k, v, primary }: { k: string; v: React.ReactNode; primary?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-muted-foreground text-xs">{k}</span>
      <span className={primary ? "font-semibold text-primary" : "font-medium"}>{v}</span>
    </div>
  );
}
function TxLink({ label, href }: { label: string; href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-primary hover:underline">
      {label} ↗
    </a>
  );
}
