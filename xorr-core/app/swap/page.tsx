"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import * as pools from "@/lib/pools";
import type { PoolInfo } from "@/lib/pools";
import { useWallet } from "@/components/stellar-wallet-provider";
import { WalletScaffold, Banner } from "@/components/wallet/scaffold";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  poolsEnabled, SWAP_TOKEN_A, SWAP_TOKEN_B, SWAP_TOKEN_A_SYMBOL, SWAP_TOKEN_B_SYMBOL,
} from "@/lib/config";
import { fmt, parseAmount, short } from "@/lib/format";

const labelCls = "font-mono text-[10px] uppercase tracking-wider text-muted-foreground";
const inputCls = "bg-background/50 border-white/10 h-11";

function sym(a: string): string {
  if (a === SWAP_TOKEN_A) return SWAP_TOKEN_A_SYMBOL;
  if (a === SWAP_TOKEN_B) return SWAP_TOKEN_B_SYMBOL;
  return short(a);
}

export default function SwapPage() {
  const { address, busy, run, pushLog } = useWallet();
  const [poolList, setPoolList] = useState<PoolInfo[]>([]);
  const [poolId, setPoolId] = useState(0);
  const [dir, setDir] = useState<"AtoB" | "BtoA">("AtoB");
  const [amt, setAmt] = useState("");
  const [out, setOut] = useState<bigint | null>(null);
  const [slippage, setSlippage] = useState("1.0");

  const pool = poolList.find((p) => p.id === poolId) ?? null;
  const inAddr = pool ? (dir === "AtoB" ? pool.tokenA : pool.tokenB) : SWAP_TOKEN_A;
  const inSym = pool ? sym(inAddr) : SWAP_TOKEN_A_SYMBOL;
  const outSym = pool ? sym(dir === "AtoB" ? pool.tokenB : pool.tokenA) : SWAP_TOKEN_B_SYMBOL;

  useEffect(() => {
    if (poolsEnabled()) pools.listPools().then(setPoolList).catch(() => setPoolList([]));
  }, []);

  useEffect(() => {
    const v = parseAmount(amt);
    if (!poolsEnabled() || v <= 0n || !pool) { setOut(null); return; }
    let live = true;
    const t = setTimeout(() => {
      pools.quote(poolId, inAddr, v).then((o) => live && setOut(o)).catch(() => live && setOut(null));
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [amt, inAddr, poolId, pool]);

  const price = pool && pool.reserveA > 0n && pool.reserveB > 0n
    ? dir === "AtoB" ? Number(pool.reserveB) / Number(pool.reserveA) : Number(pool.reserveA) / Number(pool.reserveB)
    : null;

  const submit = () => {
    const v = parseAmount(amt);
    const slipBps = Math.round(parseFloat(slippage || "1") * 100);
    const minOut = out ? (out * BigInt(10000 - slipBps)) / 10000n : 0n;
    run(`Swapping ${amt} ${inSym} → ${outSym}`, async () => {
      const hash = await pools.swap(address!, poolId, inAddr, v, minOut);
      pushLog(`Swapped ${amt} ${inSym} → ~${fmt(out ?? 0n)} ${outSym} · ${short(hash)}`);
      pools.listPools().then(setPoolList).catch(() => {});
    });
  };

  return (
    <WalletScaffold
      eyebrow="Swap"
      title="Swap"
      description="Constant-product AMM on Soroban. Swap any pool; pair with shield/unshield for confidential swaps."
    >
      <div className="glass-card rounded-2xl p-6 max-w-lg space-y-4">
        {!poolsEnabled() ? (
          <Banner tone="warn">Pool factory not configured — set <code>NEXT_PUBLIC_POOL_FACTORY_ID</code>.</Banner>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label className={labelCls}>Pool</Label>
                <select
                  value={poolId}
                  onChange={(e) => { setPoolId(Number(e.target.value)); setOut(null); }}
                  className="h-9 rounded-md bg-background/60 border border-white/10 px-2 text-sm"
                >
                  {poolList.map((p) => (
                    <option key={p.id} value={p.id}>
                      #{p.id} {sym(p.tokenA)}/{sym(p.tokenB)} {p.confidential ? "🔒" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <Link href="/pools" className="text-[11px] text-primary hover:underline">+ Create pool</Link>
            </div>

            {pool?.confidential && (
              <Banner tone="info">🔒 Confidential pool — enter from your shielded balance for unlinkable swaps.</Banner>
            )}

            <div className="rounded-2xl border border-white/10 bg-[#0a0f18]/60 p-4 space-y-3">
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label className={labelCls}>You pay</Label>
                  <Input value={amt} onChange={(e) => setAmt(e.target.value)} className={`${inputCls} tabular-nums`} placeholder="10.0" inputMode="decimal" />
                </div>
                <div className="rounded-full bg-white/5 px-3 h-11 flex items-center font-semibold shrink-0">{inSym}</div>
              </div>
              <div className="flex justify-center">
                <button onClick={() => { setDir((d) => (d === "AtoB" ? "BtoA" : "AtoB")); setOut(null); }} className="h-8 w-8 rounded-full border border-white/10 bg-background/60 hover:border-primary/40" aria-label="Flip">⇅</button>
              </div>
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
              <span>{price != null ? `1 ${inSym} ≈ ${price.toFixed(4)} ${outSym}` : "no liquidity"}</span>
              <span className="flex items-center gap-1">
                slippage
                <Input value={slippage} onChange={(e) => setSlippage(e.target.value)} className="h-7 w-14 bg-background/50 border-white/10 text-center" />%
              </span>
            </div>

            <Button
              disabled={busy || !address || parseAmount(amt) <= 0n || out == null}
              onClick={submit}
              className="w-full h-12 font-mono uppercase tracking-widest text-xs"
            >
              {busy ? "Swapping…" : `Swap ${inSym} → ${outSym}`}
            </Button>
            {!address && <p className="text-[11px] text-muted-foreground">Connect a wallet (or sign in) to swap.</p>}

            <p className="text-[11px] text-muted-foreground leading-relaxed border-t border-white/5 pt-3">
              <b className="text-foreground">Confidential swap:</b> withdraw shielded xUSDC → swap here → re-deposit,
              so only the AMM hop is public and your balance stays hidden.
            </p>
          </>
        )}
      </div>
    </WalletScaffold>
  );
}
