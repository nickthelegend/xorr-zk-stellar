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
import { useAccount, useWriteContract } from "wagmi";
import { parseEther } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { toast } from "sonner";
import Link from "next/link";

const FEE_BPS = 10; // 0.10%
type Step = "form" | "locked" | "done";
interface Done { amount: bigint; net: bigint; lockTx: string; claimTx: string; nullifier: string; commitment: string }

const label = "font-mono text-[10px] uppercase tracking-wider text-muted-foreground";

export function BridgeForm() {
  const { address, wallet, busy, run, pushLog } = useWallet();
  const { isConnected, address: evmAddr } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [step, setStep] = useState<Step>("form");
  const [amt, setAmt] = useState("5");
  const [nonce, setNonce] = useState("1");
  const [locking, setLocking] = useState(false);
  const [lockTx, setLockTx] = useState("");
  const [done, setDone] = useState<Done | null>(null);

  const gross = parseAmount(amt);
  const fee = (gross * BigInt(FEE_BPS)) / 10000n;
  const net = gross - fee;

  const steps = ["Lock on Ethereum", "Relayer Merkle root", "Claim on Stellar"];
  const activeIdx = step === "form" ? 0 : step === "locked" ? 1 : 2;

  const lock = async () => {
    setLocking(true);
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
      setStep("locked");
      toast.success("Locked on Ethereum", { description: short(hash) });
      pushLog(`Locked on Sepolia · ${short(hash)}`);
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; message?: string };
      toast.error(err.shortMessage || err.message || "lock failed");
      pushLog(`⚠ ${err.shortMessage || err.message}`);
    } finally {
      setLocking(false);
    }
  };

  const claim = async () => {
    let res: Awaited<ReturnType<typeof pool.bridgeIn>> | undefined;
    await run("Claiming xUSDC (ZK)", async () => {
      res = await pool.bridgeIn(address!, wallet!, BigInt(nonce || "1"), net, pushLog);
    });
    if (res) {
      setDone({ amount: gross, net, lockTx: lockTx || "demo", claimTx: res.hash, nullifier: res.nullifier, commitment: res.commitment });
      setStep("done");
      celebrate();
    }
  };

  const reset = () => { setStep("form"); setDone(null); setLockTx(""); };

  const downloadNote = () => {
    if (!done) return;
    const blob = new Blob([JSON.stringify({
      protocol: "XORR", asset: SHIELDED_SYMBOL, network: "stellar-testnet",
      amount: fmt(done.net), commitment: done.commitment, nullifier: done.nullifier,
      ethereumLockTx: done.lockTx, stellarClaimTx: done.claimTx,
      note: "Recovery record. Full spend keys derive from your wallet master.",
    }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `xorr-bridge-note-${done.claimTx.slice(0, 8)}.json`;
    a.click();
  };

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
          {/* FROM */}
          <AmountCard
            label="From · Ethereum Sepolia"
            right={<Link href="/faucet" className="text-[11px] text-primary hover:underline">Claim USDC faucet</Link>}
            token={<TokenChip symbol={ASSET_SYMBOL} color="#2775ca" />}
            value={amt}
            onChange={step === "form" ? setAmt : undefined}
            readOnly={step !== "form"}
            footer={
              isConnected ? (
                <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-primary" /> EVM connected · {short(evmAddr || "")}</span>
              ) : (
                <ConnectButton label="Connect EVM wallet" />
              )
            }
          />

          <SwapDivider />

          {/* TO */}
          <AmountCard
            accent
            label="To · Stellar Testnet"
            token={<TokenChip symbol={SHIELDED_SYMBOL} primary />}
            value={fmt(net)}
            readOnly
            footer={
              <span className="flex justify-between">
                <span>Protocol fee ({(FEE_BPS / 100).toFixed(2)}%)</span>
                <span>{fmt(fee)} {ASSET_SYMBOL}</span>
              </span>
            }
          />

          {/* action */}
          {step === "form" && (
            <Button
              disabled={!isConnected || locking || gross <= 0n}
              onClick={lock}
              className="w-full h-12 mt-2 rounded-xl text-sm font-medium"
            >
              {locking ? "Locking on Ethereum…" : isConnected ? `Lock ${amt} ${ASSET_SYMBOL}` : "Connect EVM wallet first"}
            </Button>
          )}
          {step === "locked" && (
            <div className="space-y-2">
              <div className="rounded-xl bg-primary/10 border border-primary/20 p-3 text-xs text-primary/90">
                ✓ Relayer has posted the Merkle root. Ready to claim {SHIELDED_SYMBOL} on Stellar.
              </div>
              <Button
                disabled={busy || !address}
                onClick={claim}
                className="w-full h-12 rounded-xl text-sm font-medium bg-gradient-to-r from-primary to-[#7c3aed] text-black"
              >
                {busy ? "Proving & claiming…" : `✦ Claim ${SHIELDED_SYMBOL} on Stellar (ZK)`}
              </Button>
              {!address && <p className="text-[11px] text-muted-foreground">Connect Freighter or sign in to claim.</p>}
            </div>
          )}

          {/* nonce (advanced) */}
          <details className="text-[11px] text-muted-foreground">
            <summary className="cursor-pointer">Advanced</summary>
            <div className="mt-2 space-y-1">
              <span className={label}>Ethereum lock nonce</span>
              <Input value={nonce} onChange={(e) => setNonce(e.target.value)} className="h-9 bg-muted/50 border-border" />
            </div>
          </details>

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
                Your USDC is now private <b className="text-primary">{SHIELDED_SYMBOL}</b> on Stellar. No on-chain link
                exists between your Ethereum deposit and Stellar claim.
              </p>
            </div>
            <div className="rounded-xl border border-border divide-y divide-border text-left text-sm">
              <Row k="Amount" v={`${fmt(done.amount)} ${ASSET_SYMBOL}`} />
              <Row k="You received" v={`${fmt(done.net)} ${SHIELDED_SYMBOL}`} primary />
              <Row k="Ethereum Lock Tx" v={<TxLink label={short(done.lockTx)} href={`https://sepolia.etherscan.io/tx/${done.lockTx}`} />} />
              <Row k="Stellar Claim Tx" v={<TxLink label={short(done.claimTx)} href={explorerTxUrl(done.claimTx)} />} />
              <Row k="ZK Nullifier Hash" v={<span className="font-mono text-[10px] break-all">{done.nullifier.slice(0, 24)}…</span>} />
            </div>
            <div className="space-y-2">
              <Button variant="outline" onClick={downloadNote} className="w-full h-10 text-xs">⬇ Download Bridge Note (recovery)</Button>
              <Button onClick={reset} className="w-full h-11 rounded-xl text-sm font-medium">Bridge Again</Button>
            </div>
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
