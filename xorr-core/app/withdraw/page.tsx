"use client";

import { useState, useEffect } from "react";
import * as pool from "@/lib/pool";
import { useWallet } from "@/components/stellar-wallet-provider";
import { WalletScaffold, Banner } from "@/components/wallet/scaffold";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ASSET_SYMBOL } from "@/lib/config";
import { fmt, parseAmount } from "@/lib/format";

const labelCls = "font-mono text-[11px] uppercase tracking-wider text-muted-foreground";
const inputCls = "bg-background/50 border-white/10 h-11";

export default function WithdrawPage() {
  const { address, wallet, busy, run, pushLog } = useWallet();
  const notes = (wallet?.notes ?? []).filter((n) => !n.spent && n.leafIndex != null);
  const [idx, setIdx] = useState(0);
  const [to, setTo] = useState("");
  const [amt, setAmt] = useState("");

  useEffect(() => {
    if (address) setTo((t) => t || address);
  }, [address]);

  const submit = () =>
    run("Generating withdraw proof", () =>
      pool.withdraw(address!, wallet!, notes[idx], to, parseAmount(amt), pushLog),
    );

  return (
    <WalletScaffold
      eyebrow="Unshield"
      title="Withdraw"
      description="Spend one note, pay a public amount to a recipient, and re-shield the change into a fresh note."
    >
      <div className="glass-card rounded-2xl p-6 max-w-lg">
        <p className="text-sm text-muted-foreground leading-relaxed">
          The recipient is cryptographically bound into the proof, so the withdrawal can&rsquo;t be
          front-run. Your change comes back as a new hidden note.
        </p>

        {notes.length === 0 ? (
          <Banner tone="warn">No active notes with an on-chain position. Deposit first.</Banner>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="space-y-2">
              <Label className={labelCls}>Note to spend</Label>
              <select
                value={idx}
                onChange={(e) => setIdx(+e.target.value)}
                className={`${inputCls} w-full rounded-md px-3 text-sm`}
              >
                {notes.map((n, i) => (
                  <option key={i} value={i} className="bg-zinc-900">
                    #{n.leafIndex} · {fmt(BigInt(n.amount))} {ASSET_SYMBOL}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label className={labelCls}>Recipient (G… address)</Label>
              <Input value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} placeholder="G…" />
            </div>

            <div className="space-y-2">
              <Label className={labelCls}>Amount ({ASSET_SYMBOL})</Label>
              <Input
                value={amt}
                onChange={(e) => setAmt(e.target.value)}
                className={`${inputCls} tabular-nums`}
                placeholder="3.0"
                inputMode="decimal"
              />
            </div>

            <Button
              disabled={busy || !amt || !to || !address}
              onClick={submit}
              className="w-full h-11 font-mono uppercase tracking-widest text-xs"
            >
              {busy ? "Proving…" : "Withdraw"}
            </Button>
          </div>
        )}
      </div>
    </WalletScaffold>
  );
}
