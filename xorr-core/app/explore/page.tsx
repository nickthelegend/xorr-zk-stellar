"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronDown, Check, Search, Plus } from "lucide-react";
import * as pools from "@/lib/pools";
import type { PoolInfo } from "@/lib/pools";
import {
  poolsEnabled, NETWORK, SWAP_TOKEN_A_SYMBOL, SWAP_TOKEN_B_SYMBOL, tokenSymbol,
} from "@/lib/config";
import { fmt } from "@/lib/format";

const NET = NETWORK === "public" ? "Mainnet" : "Testnet";

function sym(a: string): string {
  return tokenSymbol(a);
}

const ICON: Record<string, string> = {
  USDC: "linear-gradient(135deg,#2775ca,#4f9cf9)",
  xUSDC: "linear-gradient(135deg,#a855f7,#7c3aed)",
  XLM: "linear-gradient(135deg,#3a3a3a,#7d7d7d)",
};
function iconFor(s: string) {
  return ICON[s] ?? "linear-gradient(135deg,#e2a9f1,#a855f7)";
}

function PoolIcon({ a, b, size = 36 }: { a: string; b: string; size?: number }) {
  return (
    <span className="relative shrink-0" style={{ width: size, height: size }}>
      <span className="absolute left-0 top-0 rounded-full grid place-items-center text-[10px] font-bold text-white"
        style={{ width: size * 0.74, height: size * 0.74, background: iconFor(a), boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.15)" }}>
        {a.replace(/^x/i, "").slice(0, 1)}
      </span>
      <span className="absolute right-0 bottom-0 rounded-full grid place-items-center text-[10px] font-bold text-white ring-2 ring-card"
        style={{ width: size * 0.74, height: size * 0.74, background: iconFor(b), boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.15)" }}>
        {b.replace(/^x/i, "").slice(0, 1)}
      </span>
    </span>
  );
}

type Row = {
  id: number; name: string; aSym: string; bSym: string;
  confidential: boolean; feeBps: number; reserveA: bigint; reserveB: bigint; totalShares: bigint;
};

function FilterDropdown({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="relative" ref={ref} onMouseLeave={() => setOpen(false)}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
          value !== options[0] ? "border-primary/50 bg-primary/10 text-foreground" : "border-border bg-card text-foreground hover:bg-accent"
        }`}
      >
        {value}
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-44 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden py-1">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => { onChange(opt); setOpen(false); }}
              className="flex items-center justify-between w-full px-4 py-2 text-sm text-foreground hover:bg-accent transition-colors cursor-pointer"
            >
              {opt}
              {value === opt && <Check className="h-3.5 w-3.5 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ExplorePage() {
  const router = useRouter();
  const [list, setList] = useState<PoolInfo[]>([]);
  const [token, setToken] = useState("All Tokens");
  const [type, setType] = useState("All Types");
  const [status, setStatus] = useState("All Status");
  const [search, setSearch] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (poolsEnabled()) pools.listPools().then(setList).catch(() => setList([]));
  }, []);

  const rows: Row[] = useMemo(
    () => list.map((p) => ({
      id: p.id, name: `${sym(p.tokenA)} / ${sym(p.tokenB)}`, aSym: sym(p.tokenA), bSym: sym(p.tokenB),
      confidential: p.confidential, feeBps: p.feeBps, reserveA: p.reserveA, reserveB: p.reserveB, totalShares: p.totalShares,
    })),
    [list],
  );

  const filtered = useMemo(
    () => rows.filter((r) => {
      if (token !== "All Tokens" && r.aSym !== token && r.bSym !== token) return false;
      if (type === "Public" && r.confidential) return false;
      if (type === "Confidential" && !r.confidential) return false;
      if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }),
    [rows, token, type, search],
  );

  const confidentialCount = rows.filter((r) => r.confidential).length;

  return (
    <div className="w-full max-w-6xl mx-auto pt-4 pb-10 space-y-8">
      {/* Hero */}
      <div className="relative w-full overflow-hidden rounded-2xl p-8 md:p-10 gradient-card-dark border border-white/10">
        <div className="absolute -right-10 -top-10 h-64 w-64 rounded-full blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(168,85,247,0.45), transparent 70%)" }} />
        <div className="relative z-10 space-y-4 max-w-xl">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">Explore XORR Pools</h1>
          <p className="text-base text-white/70">
            Browse public and confidential AMM pools on Soroban. Confidential pools are entered from shielded balances —
            amounts and providers stay hidden on-chain.
          </p>
          <div className="flex items-center gap-8 pt-2">
            <div>
              <p className="text-2xl font-bold text-white">{rows.length}</p>
              <p className="text-sm text-white/60">Pools Available</p>
            </div>
            <div className="h-10 w-px bg-white/20" />
            <div>
              <p className="text-2xl font-bold text-white">{confidentialCount}</p>
              <p className="text-sm text-white/60">Confidential Pools</p>
            </div>
            <div className="h-10 w-px bg-white/20" />
            <div>
              <p className="text-2xl font-bold text-white">{NET}</p>
              <p className="text-sm text-white/60">Network</p>
            </div>
          </div>
        </div>
      </div>

      {/* Featured */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center rounded-full border border-border bg-card px-5 py-2 text-sm font-medium text-foreground">
            Featured Pools
          </span>
          <div className="flex items-center gap-2">
            <Link href="/pools" className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity">
              <Plus className="h-4 w-4" /> Create pool
            </Link>
            <button onClick={() => scrollRef.current?.scrollBy({ left: -300, behavior: "smooth" })}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-card border border-border text-muted-foreground transition-colors hover:text-foreground cursor-pointer">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button onClick={() => scrollRef.current?.scrollBy({ left: 300, behavior: "smooth" })}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-card border border-border text-foreground transition-colors hover:text-foreground cursor-pointer">
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="flex gap-3 overflow-x-auto scrollbar-hide">
          {rows.length === 0 && (
            <div className="text-sm text-muted-foreground py-6">{poolsEnabled() ? "No pools yet — be the first to create one." : "Pool factory not configured."}</div>
          )}
          {rows.slice(0, 6).map((r) => (
            <Link
              key={r.id}
              href="/?tab=swap"
              className="flex-shrink-0 w-[270px] rounded-xl border border-border bg-card p-5 flex flex-col justify-between gap-5 cursor-pointer transition-colors hover:border-zinc-600"
            >
              <div className="flex items-center gap-3">
                <PoolIcon a={r.aSym} b={r.bSym} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{r.name}</p>
                  <p className="text-xs text-muted-foreground">fee {(r.feeBps / 100).toFixed(2)}%</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${r.confidential ? "bg-primary/20 text-primary" : "bg-emerald-500/20 text-emerald-400"}`}>
                  {r.confidential ? "🔒 Confidential" : "Active Pool"}
                </span>
                <span className="text-xs text-muted-foreground">{NET}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Filters + search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <FilterDropdown value={token} options={["All Tokens", SWAP_TOKEN_A_SYMBOL, SWAP_TOKEN_B_SYMBOL]} onChange={setToken} />
          <FilterDropdown value={type} options={["All Types", "Public", "Confidential"]} onChange={setType} />
          <FilterDropdown value={status} options={["All Status", "Active"]} onChange={setStatus} />
        </div>
        <div className="ml-auto flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2">
          <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search pool name or symbol"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-48"
          />
          <kbd className="flex-shrink-0 text-xs text-muted-foreground border border-border rounded px-1.5 py-0.5">/</kbd>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-accent/30">
              {["#", "Pool", "Fee", "Reserves", "LP Shares", "Type"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? (
              filtered.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => router.push("/?tab=swap")}
                  className="border-b border-border last:border-0 transition-colors hover:bg-accent/50 cursor-pointer"
                >
                  <td className="py-4 px-4 text-sm text-muted-foreground">{r.id}</td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <PoolIcon a={r.aSym} b={r.bSym} size={32} />
                      <div>
                        <p className="text-sm font-medium text-foreground">{r.name}</p>
                        <p className="text-xs text-muted-foreground">Pool #{r.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-sm text-foreground">{(r.feeBps / 100).toFixed(2)}%</td>
                  <td className="py-4 px-4 text-sm text-muted-foreground tabular-nums">{fmt(r.reserveA)} / {fmt(r.reserveB)}</td>
                  <td className="py-4 px-4 text-sm font-medium text-foreground tabular-nums">{fmt(r.totalShares)}</td>
                  <td className="py-4 px-4">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${r.confidential ? "bg-primary/20 text-primary" : "bg-emerald-500/20 text-emerald-400"}`}>
                      {r.confidential ? "Confidential" : "Public"}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No pools match your filters</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
