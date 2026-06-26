"use client";

import { useEffect, useMemo, useState } from "react";
import * as lending from "@/lib/lending";
import type { MarketInfo, KeeperStatus } from "@/lib/lending";
import { lendingEnabled, NETWORK, tokenSymbol, LENDING_ASSETS } from "@/lib/config";
import { usdFmt } from "@/lib/format";
import { LendForm } from "@/components/flows/lend-form";
import { TokenLogo } from "@/components/wallet/fields";

const NET = NETWORK === "public" ? "Mainnet" : "Testnet";
const pct = (bps: number) => `${(bps / 100).toFixed(2)}%`;

const NAME: Record<string, string> = { USDC: "USD Coin", XLM: "Stellar Lumens", zUSD: "Shielded USD" };

function AssetIcon({ s, size = 40 }: { s: string; size?: number }) {
  return (
    <TokenLogo symbol={s} size={size} fallbackColor="#a855f7" />
  );
}

export default function PoolsPage() {
  const [list, setList] = useState<MarketInfo[]>([]);
  const [keeper, setKeeper] = useState<KeeperStatus | null>(null);
  const [sel, setSel] = useState<string>(LENDING_ASSETS[0]);

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
    <div className="w-full max-w-6xl mx-auto pt-4 pb-12 space-y-6">
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
              <p className="text-2xl font-bold text-white tabular-nums">${usdFmt(tvl)}</p>
              <p className="text-sm text-white/60">Total Supplied</p>
            </div>
            <div className="h-10 w-px bg-white/20" />
            <div>
              <p className="text-2xl font-bold text-white tabular-nums">${usdFmt(borrowed)}</p>
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

      {/* Markets browser + action form */}
      <div id="lend-panel" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
        {/* Left: clickable markets that drive the form */}
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-foreground">Markets</h2>
            <p className="text-sm text-muted-foreground">Select a market to supply or borrow — rates update live from utilization.</p>
          </div>

          {list.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
              {lendingEnabled() ? "Loading markets…" : "Lending not configured."}
            </div>
          ) : (
            <div className="space-y-3">
              {list.map((m) => {
                const s = tokenSymbol(m.asset);
                const on = m.asset === sel;
                const util = Math.max(2, Math.min(100, m.utilizationBps / 100));
                return (
                  <button
                    key={m.asset}
                    onClick={() => setSel(m.asset)}
                    aria-pressed={on}
                    className={`w-full text-left rounded-2xl border p-5 transition-all ${on ? "border-primary bg-primary/[0.08] shadow-[0_0_22px_-8px_rgba(168,85,247,0.55)]" : "border-border bg-card hover:border-zinc-600"}`}
                  >
                    {/* header */}
                    <div className="flex items-center gap-3">
                      <AssetIcon s={s} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{s}</p>
                        <p className="text-xs text-muted-foreground">{NAME[s] ?? "Market"}</p>
                      </div>
                      <span className={`ml-auto text-[10px] font-medium rounded-full border px-2.5 py-1 ${on ? "border-primary/40 text-primary" : "border-border text-muted-foreground"}`}>
                        {m.collateralFactor / 100}% max LTV
                      </span>
                    </div>
                    {/* stats */}
                    <div className="mt-4 grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Supply APY</p>
                        <p className="text-lg font-semibold text-primary tabular-nums">{pct(m.supplyApyBps)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Borrow APY</p>
                        <p className="text-lg font-semibold text-foreground tabular-nums">{pct(m.borrowApyBps)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Supplied</p>
                        <p className="text-lg font-semibold text-foreground tabular-nums">${usdFmt(lending.usdValue(m.totalSupplied, m.price))}</p>
                      </div>
                    </div>
                    {/* utilization */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
                        <span>Utilization</span>
                        <span className="tabular-nums">{pct(m.utilizationBps)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary" style={{ width: `${util}%` }} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: action form, follows the selected market */}
        <div className="lg:sticky lg:top-20">
          <LendForm asset={sel} />
        </div>
      </div>
    </div>
  );
}
