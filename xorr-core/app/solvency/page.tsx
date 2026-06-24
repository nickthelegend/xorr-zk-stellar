"use client";

import { useState } from "react";
import { useWallet } from "@/components/stellar-wallet-provider";
import { WalletScaffold } from "@/components/wallet/scaffold";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ASSET_SYMBOL } from "@/lib/config";
import { parseAmount, fmt, short } from "@/lib/format";
import { proveSolvency, type SolvencyResult } from "@/lib/solvency";

export default function SolvencyPage() {
  const { wallet, busy, run, pushLog } = useWallet();
  const [thr, setThr] = useState("0.05");
  const [res, setRes] = useState<SolvencyResult | null>(null);

  const submit = () =>
    run("Proving solvency", async () => {
      setRes(null);
      setRes(await proveSolvency(wallet!, parseAmount(thr), pushLog));
    });

  return (
    <WalletScaffold
      eyebrow="Proof of Funds"
      title="Proof of Solvency"
      description="Prove your shielded balance clears a threshold — for an OTC desk, loan collateral, or an accredited-investor gate — without revealing the actual amount or which notes you hold."
    >
      <div className="glass-card rounded-2xl p-6 max-w-lg">
        <h3 className="font-semibold text-foreground">Attest balance ≥ threshold</h3>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          A Groth16 proof shows you control a shielded note worth at least the threshold. Only the
          threshold is public — the amount stays hidden — and it&rsquo;s checked on-chain by the
          BN254 verifier (CAP-0074), no balance ever disclosed.
        </p>

        <div className="mt-5 space-y-2">
          <Label htmlFor="thr" className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Threshold ({ASSET_SYMBOL})
          </Label>
          <Input
            id="thr"
            value={thr}
            onChange={(e) => setThr(e.target.value)}
            placeholder="0.05"
            inputMode="decimal"
            className="bg-background/50 border-white/10 h-11 text-lg tabular-nums"
          />
        </div>

        <Button
          disabled={busy || !thr || !wallet}
          onClick={submit}
          className="mt-5 w-full h-11 font-mono uppercase tracking-widest text-xs"
        >
          {busy ? "Proving…" : "Prove & verify on-chain"}
        </Button>

        {res && (
          <div
            className={`mt-5 rounded-xl border p-4 ${
              res.verified ? "border-primary/30 bg-primary/5" : "border-red-500/30 bg-red-500/5"
            }`}
          >
            <div className="font-mono text-xs uppercase tracking-wider text-foreground">
              {res.verified ? "✓ Verified on-chain" : "✗ Not verified"}
            </div>
            <div className="mt-3 space-y-1 font-mono text-[11px] text-muted-foreground break-all">
              <div>threshold (public): {fmt(res.thresholdBase)} {ASSET_SYMBOL}</div>
              <div className="text-primary/80">amount: ••••••• — never revealed</div>
              <div>nullifier: {short(res.nullifier.toString(16), 10)}</div>
            </div>
          </div>
        )}
      </div>
    </WalletScaffold>
  );
}
