"use client";

import { useEffect, useMemo, useState } from "react";
import * as lending from "@/lib/lending";
import type { MarketInfo, KeeperStatus } from "@/lib/lending";
import { lendingEnabled, NETWORK, tokenSymbol } from "@/lib/config";
import { fmt, usdFmt } from "@/lib/format";
import { LendForm } from "@/components/flows/lend-form";

const scrollToLend = () => document.getElementById("lend-panel")?.scrollIntoView({ behavior: "smooth", block: "center" });

const NET = NETWORK === "public" ? "Mainnet" : "Testnet";
const pct = (bps: number) => `${(bps / 100).toFixed(2)}%`;

const ICON: Record<string, string> = {
  USDC: "linear-gradient(135deg,#2775ca,#4f9cf9)",
  XLM: "linear-gradient(135deg,#3a3a3a,#7d7d7d)",
  zUSD: "linear-gradient(135deg,#a855f7,#7c3aed)",
};
function AssetIcon({ s, size = 36 }: { s: string; size?: number }) {
  return (
    <span className="rounded-full grid place-items-center text-[11px] font-bold text-white shrink-0"
      style={{ width: size, height: size, background: ICON[s] ?? "linear-gradient(135deg,#e2a9f1,#a855f7)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.15)" }}>
      {s.slice(0, 1)}
    </span>
  );
}

export default function PoolsPage() {
  const [list, setList] = useState<MarketInfo[]>([]);
  const [keeper, setKeeper] = useState<KeeperStatus | null>(null);

  useEffect(() => {
    if (lendingEnabled()) lending.listMarkets().then(setList).catch(() => setList([]));
  }, []);

  useEffect(() => {
    let on = true;
    const poll = () => lending.keeperHealth().then((k) => on && setKeeper(k)).catch(() => {});
    poll();
    const id = setInterval(poll, 15000);
    return () => { on = false; clearInterval(id); };
  }, []);

  const { tvl, borrowed } = useMemo(() => {
    let tvl = 0n, borrowed = 0n;
    for (const m of list) {
      tvl += lending.usdValue(m.totalSupplied, m.price);
      borrowed += lending.usdValue(m.totalBorrows, m.price);
    }
    return { tvl, borrowed };
  }, [list]);

  return (
    <div className="w-full max-w-6xl mx-auto pt-4 pb-10 space-y-8">
      {/* Hero */}
      <div className="relative w-full overflow-hidden rounded-2xl p-8 md:p-10 gradient-card-dark border border-white/10">
        <div className="absolute -right-10 -top-10 h-64 w-64 rounded-full blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(168,85,247,0.45), transparent 70%)" }} />
        <div className="relative z-10 space-y-4 max-w-xl">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">XORR Money Market</h1>
          <p className="text-base text-white/70">
            Supply assets to earn interest, or borrow against your collateral. Utilization-based rates accrue every
            second; positions are protected by a real-time health factor and on-chain liquidations.
          </p>
          <div className="flex items-center gap-8 pt-2">
            <div>
              <p className="text-2xl font-bold text-white">${usdFmt(tvl)}</p>
              <p className="text-sm text-white/60">Total Supplied</p>
            </div>
            <div className="h-10 w-px bg-white/20" />
            <div>
              <p className="text-2xl font-bold text-white">${usdFmt(borrowed)}</p>
              <p className="text-sm text-white/60">Total Borrowed</p>
            </div>
            <div className="h-10 w-px bg-white/20" />
            <div>
              <p className="text-2xl font-bold text-white">{NET}</p>
              <p className="text-sm text-white/60">Network</p>
            </div>
          </div>
        </div>
      </div>

      {/* Live keeper / oracle status */}
      {keeper?.ok && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/20 bg-primary/[0.06] px-4 py-2.5 text-[11px]">
          <span className="inline-flex items-center gap-2 font-medium text-primary/90">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/70" />
              <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
            </span>
            Keeper live — oracle relay + auto-liquidations
          </span>
          <span className="font-mono text-muted-foreground">
            XLM ${keeper.prices?.XLM ? keeper.prices.XLM.toFixed(4) : "…"} (CEX median){keeper.liquidations.length > 0 ? ` · ${keeper.liquidations.length} liquidation${keeper.liquidations.length > 1 ? "s" : ""}` : ""}
          </span>
        </div>
      )}

      {/* Lend & Borrow panel */}
      <div id="lend-panel" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">Lend & Borrow</h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
            Supply USDC or XLM to earn interest, or post collateral and borrow against it. Rates accrue every second
            from utilization; your health factor is enforced on-chain and underwater positions are auto-liquidated.
          </p>
          <div className="hidden lg:grid grid-cols-2 gap-3 pt-2 max-w-sm">
            {list.slice(0, 2).map((m) => {
              const s = tokenSymbol(m.asset);
              return (
                <div key={m.asset} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex items-center gap-2"><AssetIcon s={s} size={26} /><span className="text-sm font-medium">{s}</span></div>
                  <div className="mt-2 flex items-center justify-between text-[11px]">
                    <span className="text-primary">supply {pct(m.supplyApyBps)}</span>
                    <span className="text-muted-foreground">borrow {pct(m.borrowApyBps)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="lg:sticky lg:top-20"><LendForm /></div>
      </div>

      {/* Featured market cards */}
      <div className="space-y-4">
        <span className="inline-flex items-center rounded-full border border-border bg-card px-5 py-2 text-sm font-medium text-foreground">Markets</span>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.length === 0 && (
            <div className="text-sm text-muted-foreground py-6">{lendingEnabled() ? "Loading markets…" : "Lending not configured."}</div>
          )}
          {list.map((m) => {
            const s = tokenSymbol(m.asset);
            return (
              <button key={m.asset} onClick={() => scrollToLend()}
                className="text-left rounded-xl border border-border bg-card p-5 flex flex-col gap-4 transition-colors hover:border-zinc-600">
                <div className="flex items-center gap-3">
                  <AssetIcon s={s} />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{s}</p>
                    <p className="text-xs text-muted-foreground">{m.collateralFactor / 100}% max LTV</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Supply APY</p><p className="text-base font-semibold text-primary">{pct(m.supplyApyBps)}</p></div>
                  <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Borrow APY</p><p className="text-base font-semibold text-foreground">{pct(m.borrowApyBps)}</p></div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-accent/30">
              {["Asset", "Supply APY", "Borrow APY", "Total Supplied", "Total Borrowed", "Utilization", "Max LTV"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.length > 0 ? list.map((m) => {
              const s = tokenSymbol(m.asset);
              return (
                <tr key={m.asset} onClick={() => scrollToLend()}
                  className="border-b border-border last:border-0 transition-colors hover:bg-accent/50 cursor-pointer">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3"><AssetIcon s={s} size={30} /><span className="text-sm font-medium text-foreground">{s}</span></div>
                  </td>
                  <td className="py-4 px-4 text-sm font-medium text-primary tabular-nums">{pct(m.supplyApyBps)}</td>
                  <td className="py-4 px-4 text-sm text-foreground tabular-nums">{pct(m.borrowApyBps)}</td>
                  <td className="py-4 px-4 text-sm text-muted-foreground tabular-nums">{fmt(m.totalSupplied)} {s}</td>
                  <td className="py-4 px-4 text-sm text-muted-foreground tabular-nums">{fmt(m.totalBorrows)} {s}</td>
                  <td className="py-4 px-4 text-sm text-foreground tabular-nums">{pct(m.utilizationBps)}</td>
                  <td className="py-4 px-4 text-sm text-muted-foreground tabular-nums">{m.collateralFactor / 100}%</td>
                </tr>
              );
            }) : (
              <tr><td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">No markets</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
