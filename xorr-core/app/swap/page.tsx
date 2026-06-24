"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import * as pools from "@/lib/pools";
import * as pool from "@/lib/pool";
import type { PoolInfo } from "@/lib/pools";
import { useWallet } from "@/components/stellar-wallet-provider";
import { WalletScaffold, Banner } from "@/components/wallet/scaffold";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  poolsEnabled, SWAP_TOKEN_A, SWAP_TOKEN_B, SWAP_TOKEN_A_SYMBOL, SWAP_TOKEN_B_SYMBOL, SHIELDED_SYMBOL,
} from "@/lib/config";
import { fmt, parseAmount, short } from "@/lib/format";
import { toast } from "sonner";

const labelCls = "font-mono text-[10px] uppercase tracking-wider text-muted-foreground";
const inputCls = "bg-background/50 border-white/10 h-11";

function sym(a: string): string {
  if (a === SWAP_TOKEN_A) return SWAP_TOKEN_A_SYMBOL;
  if (a === SWAP_TOKEN_B) return SWAP_TOKEN_B_SYMBOL;
  return short(a);
}

export default function SwapPage() {
  const { address, wallet, balance, busy, run, pushLog } = useWallet();
  const [poolList, setPoolList] = useState<PoolInfo[]>([]);
  const [poolId, setPoolId] = useState(0);
  const [dir, setDir] = useState<"AtoB" | "BtoA">("AtoB");
  const [amt, setAmt] = useState("");
  const [out, setOut] = useState<bigint | null>(null);
  const [slippage, setSlippage] = useState("1.0");
  const [zk, setZk] = useState(false);

  const pinfo = poolList.find((p) => p.id === poolId) ?? null;
  // In ZK mode the venue is fixed to the wired USDC→XLM pool (#0).
  const effPoolId = zk ? 0 : poolId;
  const inAddr = zk ? SWAP_TOKEN_A : pinfo ? (dir === "AtoB" ? pinfo.tokenA : pinfo.tokenB) : SWAP_TOKEN_A;
  const inSym = zk ? SHIELDED_SYMBOL : pinfo ? sym(inAddr) : SWAP_TOKEN_A_SYMBOL;
  const outSym = zk ? SWAP_TOKEN_B_SYMBOL : pinfo ? sym(dir === "AtoB" ? pinfo.tokenB : pinfo.tokenA) : SWAP_TOKEN_B_SYMBOL;

  const shieldedNote = useMemo(
    () => (wallet?.notes ?? []).find((n) => !n.spent && n.leafIndex != null && BigInt(n.amount) >= parseAmount(amt)),
    [wallet, amt],
  );

  useEffect(() => {
    if (poolsEnabled()) pools.listPools().then(setPoolList).catch(() => setPoolList([]));
  }, []);

  useEffect(() => {
    const v = parseAmount(amt);
    if (!poolsEnabled() || v <= 0n) { setOut(null); return; }
    let live = true;
    const t = setTimeout(() => {
      pools.quote(effPoolId, inAddr, v).then((o) => live && setOut(o)).catch(() => live && setOut(null));
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [amt, inAddr, effPoolId]);

  const submit = () => {
    const v = parseAmount(amt);
    const slipBps = Math.round(parseFloat(slippage || "1") * 100);
    const minOut = out ? (out * BigInt(10000 - slipBps)) / 10000n : 0n;

    if (zk) {
      if (!shieldedNote) { toast.error(`No shielded ${SHIELDED_SYMBOL} note ≥ amount — deposit first`); return; }
      run(`Private ZK swap ${amt} ${SHIELDED_SYMBOL} → ${outSym}`, async () => {
        const { amountOut } = await pool.privateSwap(address!, wallet!, shieldedNote, address!, v, minOut, pushLog);
        pushLog(`🔒 ZK swap → ${fmt(amountOut)} ${outSym} (no account link)`);
      });
      return;
    }
    run(`Swapping ${amt} ${inSym} → ${outSym}`, async () => {
      const hash = await pools.swap(address!, effPoolId, inAddr, v, minOut);
      pushLog(`Swapped ${amt} ${inSym} → ~${fmt(out ?? 0n)} ${outSym} · ${short(hash)}`);
      pools.listPools().then(setPoolList).catch(() => {});
    });
  };

  return (
    <WalletScaffold
      eyebrow="Swap"
      title="Swap"
      description="Constant-product AMM on Soroban. Toggle ZK to spend from your shielded balance with no public account link."
    >
      <div className="glass-card rounded-2xl p-6 max-w-lg space-y-4">
        {!poolsEnabled() ? (
          <Banner tone="warn">Pool factory not configured — set <code>NEXT_PUBLIC_POOL_FACTORY_ID</code>.</Banner>
        ) : (
          <>
            {/* ZK toggle */}
            <button
              onClick={() => { setZk((z) => !z); setOut(null); }}
              className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 transition-colors ${zk ? "border-primary/50 bg-primary/10" : "border-white/10 bg-background/40"}`}
            >
              <span className="text-sm font-medium">🔒 Private (ZK) swap</span>
              <span className={`text-xs ${zk ? "text-primary" : "text-muted-foreground"}`}>
                {zk ? "ON — spend a shielded note" : "OFF — public swap"}
              </span>
            </button>

            {!zk && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className={labelCls}>Pool</Label>
                  <select
                    value={poolId}
                    onChange={(e) => { setPoolId(Number(e.target.value)); setOut(null); }}
                    className="h-9 rounded-md bg-background/60 border border-white/10 px-2 text-sm"
                  >
                    {poolList.map((p) => (
                      <option key={p.id} value={p.id}>#{p.id} {sym(p.tokenA)}/{sym(p.tokenB)} {p.confidential ? "🔒" : ""}</option>
                    ))}
                  </select>
                </div>
                <Link href="/pools" className="text-[11px] text-primary hover:underline">+ Create pool</Link>
              </div>
            )}

            <div className="rounded-2xl border border-white/10 bg-[#0a0f18]/60 p-4 space-y-3">
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className={labelCls}>You pay</Label>
                    {zk && <span className="text-[10px] text-muted-foreground">shielded: {fmt(balance)} {SHIELDED_SYMBOL}</span>}
                  </div>
                  <Input value={amt} onChange={(e) => setAmt(e.target.value)} className={`${inputCls} tabular-nums`} placeholder="10.0" inputMode="decimal" />
                </div>
                <div className="rounded-full bg-white/5 px-3 h-11 flex items-center font-semibold shrink-0">{inSym}</div>
              </div>
              {!zk && (
                <div className="flex justify-center">
                  <button onClick={() => { setDir((d) => (d === "AtoB" ? "BtoA" : "AtoB")); setOut(null); }} className="h-8 w-8 rounded-full border border-white/10 bg-background/60 hover:border-primary/40" aria-label="Flip">⇅</button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label className={labelCls}>You receive</Label>
                  <div className="h-11 rounded-md bg-background/30 border border-white/10 flex items-center px-3 tabular-nums text-primary/90">
                    {out != null ? fmt(out) : "—"}
                  </div>
                </div>
                <div className="rounded-full bg-primary/10 px-3 h-11 flex items-center font-semibold text-primary shrink-0">{outSym}</div>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{zk ? "spends a shielded note · output sent to your wallet" : "public AMM swap"}</span>
              <span className="flex items-center gap-1">
                slippage
                <Input value={slippage} onChange={(e) => setSlippage(e.target.value)} className="h-7 w-14 bg-background/50 border-white/10 text-center" />%
              </span>
            </div>

            <Button
              disabled={busy || !address || parseAmount(amt) <= 0n || out == null || (zk && !shieldedNote)}
              onClick={submit}
              className="w-full h-12 font-mono uppercase tracking-widest text-xs"
            >
              {busy ? (zk ? "Proving & swapping…" : "Swapping…") : zk ? `🔒 ZK swap ${inSym} → ${outSym}` : `Swap ${inSym} → ${outSym}`}
            </Button>
            {!address && <p className="text-[11px] text-muted-foreground">Connect a wallet (or sign in) to swap.</p>}
            {zk && !shieldedNote && parseAmount(amt) > 0n && (
              <p className="text-[11px] text-amber-400/90">No shielded note ≥ {amt} {SHIELDED_SYMBOL} — deposit first on the Deposit page.</p>
            )}

            <p className="text-[11px] text-muted-foreground leading-relaxed border-t border-white/5 pt-3">
              <b className="text-foreground">How ZK swap works:</b> a Groth16 proof spends a shielded {SHIELDED_SYMBOL} note
              (note ∈ Merkle tree, nullifier valid) and routes it through the AMM — so the trade has <b>no on-chain link</b> to
              your identity or balance. The swap amount itself is public (the AMM needs it to price).
            </p>
          </>
        )}
      </div>
    </WalletScaffold>
  );
}
