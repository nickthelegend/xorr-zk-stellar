"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as lending from "@/lib/lending";
import type { MarketInfo } from "@/lib/lending";
import { lendingEnabled, NETWORK, tokenSymbol } from "@/lib/config";
import { fmt, usdFmt } from "@/lib/format";

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

export default function MarketsPage() {
  const router = useRouter();
  const [list, setList] = useState<MarketInfo[]>([]);

  useEffect(() => {
    if (lendingEnabled()) lending.listMarkets().then(setList).catch(() => setList([]));
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
              <button key={m.asset} onClick={() => router.push(`/?tab=lend`)}
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
                <tr key={m.asset} onClick={() => router.push(`/?tab=lend`)}
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
