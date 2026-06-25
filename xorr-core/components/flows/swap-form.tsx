"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import * as pools from "@/lib/pools";
import * as pool from "@/lib/pool";
import type { PoolInfo } from "@/lib/pools";
import { useWallet } from "@/components/stellar-wallet-provider";
import { Banner } from "@/components/wallet/scaffold";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  poolsEnabled, SWAP_TOKEN_A, SWAP_TOKEN_B, SWAP_TOKEN_A_SYMBOL, SWAP_TOKEN_B_SYMBOL, SHIELDED_SYMBOL,
} from "@/lib/config";
import { fmt, parseAmount, short } from "@/lib/format";
import { AmountCard, TokenChip, SwapDivider } from "@/components/wallet/fields";
import { toast } from "sonner";

const labelCls = "font-mono text-[10px] uppercase tracking-wider text-muted-foreground";

function sym(a: string): string {
  if (a === SWAP_TOKEN_A) return SWAP_TOKEN_A_SYMBOL;
  if (a === SWAP_TOKEN_B) return SWAP_TOKEN_B_SYMBOL;
  return short(a);
}

export function SwapForm() {
  const { address, wallet, balance, busy, run, pushLog } = useWallet();
  const [poolList, setPoolList] = useState<PoolInfo[]>([]);
  const [poolId, setPoolId] = useState(0);
  const [dir, setDir] = useState<"AtoB" | "BtoA">("AtoB");
  const [amt, setAmt] = useState("");
  const [out, setOut] = useState<bigint | null>(null);
  const [slippage, setSlippage] = useState("1.0");
  const [zk, setZk] = useState(false);

  const pinfo = poolList.find((p) => p.id === poolId) ?? null;
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
    <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
      {!poolsEnabled() ? (
        <Banner tone="warn">Pool factory not configured — set <code>NEXT_PUBLIC_POOL_FACTORY_ID</code>.</Banner>
      ) : (
        <>
          {/* ZK toggle */}
          <button
            onClick={() => { setZk((z) => !z); setOut(null); }}
            className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 transition-colors ${zk ? "border-primary/50 bg-primary/10" : "border-border bg-muted/50"}`}
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
                  className="h-9 rounded-md bg-muted/50 border border-border px-2 text-sm"
                >
                  {poolList.map((p) => (
                    <option key={p.id} value={p.id}>#{p.id} {sym(p.tokenA)}/{sym(p.tokenB)} {p.confidential ? "🔒" : ""}</option>
                  ))}
                </select>
              </div>
              <Link href="/explore" className="text-[11px] text-primary hover:underline">Explore pools</Link>
            </div>
          )}

          <div className="space-y-1.5">
            <AmountCard
              label="You pay"
              right={zk ? <span className="text-[10px] text-muted-foreground">shielded: {fmt(balance)} {SHIELDED_SYMBOL}</span> : undefined}
              token={<TokenChip symbol={inSym} primary={zk} color="#2775ca" />}
              value={amt}
              onChange={setAmt}
              placeholder="0.0"
            />
            <SwapDivider onClick={!zk ? () => { setDir((d) => (d === "AtoB" ? "BtoA" : "AtoB")); setOut(null); } : undefined} />
            <AmountCard
              accent
              label="You receive"
              token={<TokenChip symbol={outSym} />}
              value={out != null ? fmt(out) : ""}
              placeholder="—"
              readOnly
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{zk ? "spends a shielded note · output sent to your wallet" : "public AMM swap"}</span>
            <span className="flex items-center gap-1">
              slippage
              <Input value={slippage} onChange={(e) => setSlippage(e.target.value)} className="h-7 w-14 bg-muted/50 border-border text-center" />%
            </span>
          </div>

          <Button
            disabled={busy || !address || parseAmount(amt) <= 0n || out == null || (zk && !shieldedNote)}
            onClick={submit}
            className="w-full h-12 rounded-xl text-sm font-medium"
          >
            {busy ? (zk ? "Proving & swapping…" : "Swapping…") : zk ? `🔒 ZK swap ${inSym} → ${outSym}` : `Swap ${inSym} → ${outSym}`}
          </Button>
          {!address && <p className="text-[11px] text-muted-foreground">Connect a wallet (or sign in) to swap.</p>}
          {zk && !shieldedNote && parseAmount(amt) > 0n && (
            <p className="text-[11px] text-amber-400/90">No shielded note ≥ {amt} {SHIELDED_SYMBOL} — deposit first.</p>
          )}

          <p className="text-[11px] text-muted-foreground leading-relaxed border-t border-border pt-3">
            <b className="text-foreground">How ZK swap works:</b> a Groth16 proof spends a shielded {SHIELDED_SYMBOL} note
            (note ∈ Merkle tree, nullifier valid) and routes it through the AMM — so the trade has <b>no on-chain link</b> to
            your identity or balance. The swap amount itself is public (the AMM needs it to price).
          </p>
        </>
      )}
    </div>
  );
}
