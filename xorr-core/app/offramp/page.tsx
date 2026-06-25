"use client";

import { useState } from "react";
import * as pool from "@/lib/pool";
import { useWallet } from "@/components/stellar-wallet-provider";
import { WalletScaffold, Banner } from "@/components/wallet/scaffold";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ASSET_SYMBOL, deliveryEnabled } from "@/lib/config";
import { parseAmount } from "@/lib/format";

const labelCls = "font-mono text-[11px] uppercase tracking-wider text-muted-foreground";
const inputCls = "bg-muted/50 border-border h-11 w-full rounded-md px-3";

const RAILS = [
  { value: "wise", label: "Wise" },
  { value: "cashapp", label: "Cash App" },
  { value: "revolut", label: "Revolut" },
];
const CURRENCIES = ["USD", "EUR", "GBP", "INR", "NGN"];

export default function OfframpPage() {
  const { address, wallet, busy, run, pushLog } = useWallet();
  const [rail, setRail] = useState("wise");
  const [ccy, setCcy] = useState("USD");
  const [amt, setAmt] = useState("");
  const [handle, setHandle] = useState("");

  const submit = () =>
    run("Off-ramping to fiat", async () => {
      await pool.offramp(
        address!,
        wallet!,
        { rail, currency: ccy, usdcAmount: parseAmount(amt), payoutHandle: handle, operator: address! },
        pushLog,
      );
    });

  return (
    <WalletScaffold
      eyebrow="Remittance"
      title="Off-ramp — shielded USDC → fiat"
      description="The fiat edge of a private remittance corridor: unshield on-chain to the operator (ZK-verified), then a rail settles fiat."
      flow
    >
      <div className="bg-card border border-border rounded-2xl p-6">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Amounts stay private in the pool; an Ed25519 <b className="text-foreground">settlement oracle</b>{" "}
          attests the payout. Rails are sandbox (no real money moves).
        </p>

        {!deliveryEnabled() && (
          <div className="mt-4">
            <Banner tone="warn">
              Off-ramp service off — set <code>NEXT_PUBLIC_DELIVERY_URL</code> + run the backend.
            </Banner>
          </div>
        )}

        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className={labelCls}>Rail</Label>
              <select value={rail} onChange={(e) => setRail(e.target.value)} className={`${inputCls} border text-sm`}>
                {RAILS.map((r) => (
                  <option key={r.value} value={r.value} className="bg-zinc-900">
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className={labelCls}>Payout currency</Label>
              <select value={ccy} onChange={(e) => setCcy(e.target.value)} className={`${inputCls} border text-sm`}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c} className="bg-zinc-900">
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className={labelCls}>Amount ({ASSET_SYMBOL})</Label>
            <Input value={amt} onChange={(e) => setAmt(e.target.value)} className="bg-muted/50 border-border h-11 tabular-nums" placeholder="25.0" inputMode="decimal" />
          </div>
          <div className="space-y-2">
            <Label className={labelCls}>Payout handle / IBAN (sandbox)</Label>
            <Input value={handle} onChange={(e) => setHandle(e.target.value)} className="bg-muted/50 border-border h-11" placeholder="$alice / GB…" />
          </div>

          <Button
            disabled={busy || !amt || !handle || !address}
            onClick={submit}
            className="w-full h-12 rounded-xl text-sm font-medium"
          >
            {busy ? "Settling…" : `Off-ramp to ${ccy}`}
          </Button>
        </div>
      </div>
    </WalletScaffold>
  );
}
