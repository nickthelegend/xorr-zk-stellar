"use client";

import { useEffect, useState } from "react";
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
import { toast } from "sonner";

const labelCls = "font-mono text-[10px] uppercase tracking-wider text-muted-foreground";
const inputCls = "bg-background/50 border-white/10 h-10 font-mono text-xs";

function sym(a: string): string {
  if (a === SWAP_TOKEN_A) return SWAP_TOKEN_A_SYMBOL;
  if (a === SWAP_TOKEN_B) return SWAP_TOKEN_B_SYMBOL;
  return short(a);
}

export default function PoolsPage() {
  const { address, busy, run, pushLog } = useWallet();
  const [list, setList] = useState<PoolInfo[]>([]);
  const [tokenA, setTokenA] = useState(SWAP_TOKEN_A);
  const [tokenB, setTokenB] = useState("");
  const [fee, setFee] = useState("30");
  const [confidential, setConfidential] = useState(false);
  const [liqId, setLiqId] = useState("0");
  const [liqA, setLiqA] = useState("");
  const [liqB, setLiqB] = useState("");

  const refresh = () => pools.listPools().then(setList).catch(() => setList([]));
  useEffect(() => { if (poolsEnabled()) refresh(); }, []);

  const create = () => {
    if (!tokenA || !tokenB) return toast.error("two token addresses required");
    run("Creating pool", async () => {
      await pools.createPool(address!, tokenA.trim(), tokenB.trim(), Number(fee) || 30, confidential);
      pushLog(`Created ${confidential ? "confidential " : ""}pool ${sym(tokenA)}/${sym(tokenB)}`);
      await refresh();
    });
  };

  const addLiq = () => {
    run("Adding liquidity", async () => {
      await pools.addLiquidity(address!, Number(liqId), parseAmount(liqA), parseAmount(liqB));
      pushLog(`Added liquidity to pool #${liqId}`);
      await refresh();
    });
  };

  return (
    <WalletScaffold
      eyebrow="Liquidity"
      title="Pools"
      description="Create a swap pool for any token pair — or a confidential pool entered from shielded balances — and provide liquidity."
    >
      <div className="grid gap-4 md:grid-cols-2 max-w-3xl">
        {/* Create pool */}
        <div className="glass-card rounded-2xl p-5 space-y-3">
          <h3 className="font-semibold">Create a pool</h3>
          {!poolsEnabled() && <Banner tone="warn">Set <code>NEXT_PUBLIC_POOL_FACTORY_ID</code>.</Banner>}
          <div className="space-y-1">
            <Label className={labelCls}>Token A (SAC address)</Label>
            <Input value={tokenA} onChange={(e) => setTokenA(e.target.value)} className={inputCls} placeholder="C…" />
          </div>
          <div className="space-y-1">
            <Label className={labelCls}>Token B (SAC address)</Label>
            <Input value={tokenB} onChange={(e) => setTokenB(e.target.value)} className={inputCls} placeholder="C… (e.g. native XLM SAC)" />
            <button onClick={() => setTokenB(SWAP_TOKEN_B)} className="text-[10px] text-primary hover:underline">use XLM</button>
          </div>
          <div className="flex items-center gap-3">
            <div className="space-y-1 flex-1">
              <Label className={labelCls}>Fee (bps)</Label>
              <Input value={fee} onChange={(e) => setFee(e.target.value)} className={inputCls} />
            </div>
            <label className="flex items-center gap-2 text-xs mt-5 cursor-pointer">
              <input type="checkbox" checked={confidential} onChange={(e) => setConfidential(e.target.checked)} />
              🔒 Confidential
            </label>
          </div>
          <Button disabled={busy || !address || !poolsEnabled()} onClick={create} className="w-full h-11 font-mono uppercase tracking-widest text-xs">
            {busy ? "…" : "Create pool"}
          </Button>
        </div>

        {/* Add liquidity */}
        <div className="glass-card rounded-2xl p-5 space-y-3">
          <h3 className="font-semibold">Add liquidity</h3>
          <div className="space-y-1">
            <Label className={labelCls}>Pool id</Label>
            <Input value={liqId} onChange={(e) => setLiqId(e.target.value)} className={inputCls} />
          </div>
          <div className="flex gap-2">
            <div className="space-y-1 flex-1">
              <Label className={labelCls}>Amount A</Label>
              <Input value={liqA} onChange={(e) => setLiqA(e.target.value)} className={`${inputCls} tabular-nums`} placeholder="100" inputMode="decimal" />
            </div>
            <div className="space-y-1 flex-1">
              <Label className={labelCls}>Amount B</Label>
              <Input value={liqB} onChange={(e) => setLiqB(e.target.value)} className={`${inputCls} tabular-nums`} placeholder="500" inputMode="decimal" />
            </div>
          </div>
          <Button disabled={busy || !address || !liqA || !liqB} onClick={addLiq} className="w-full h-11 font-mono uppercase tracking-widest text-xs" variant="outline">
            {busy ? "…" : "Add liquidity"}
          </Button>
        </div>

        {/* Pool list */}
        <div className="glass-card rounded-2xl p-5 md:col-span-2">
          <h3 className="font-semibold mb-3">Pools ({list.length})</h3>
          <div className="space-y-2">
            {list.length === 0 && <p className="text-sm text-muted-foreground">No pools yet.</p>}
            {list.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-background/40 px-4 py-3">
                <div>
                  <div className="font-semibold">
                    #{p.id} {sym(p.tokenA)}/{sym(p.tokenB)} {p.confidential && <span className="text-primary">🔒</span>}
                  </div>
                  <div className="text-[11px] text-muted-foreground">fee {(p.feeBps / 100).toFixed(2)}% · reserves {fmt(p.reserveA)} / {fmt(p.reserveB)}</div>
                </div>
                <div className="text-[11px] text-muted-foreground tabular-nums">LP {fmt(p.totalShares)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </WalletScaffold>
  );
}
