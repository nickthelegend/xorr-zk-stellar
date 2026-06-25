"use client";

import { useState } from "react";
import * as pool from "@/lib/pool";
import { useWallet } from "@/components/stellar-wallet-provider";
import { WalletScaffold, Banner } from "@/components/wallet/scaffold";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AmountCard, TokenChip } from "@/components/wallet/fields";
import { ASSET_SYMBOL, deliveryEnabled } from "@/lib/config";
import { fmt, parseAmount } from "@/lib/format";
import { shieldedBalance } from "@/lib/notes";

const labelCls = "font-mono text-[10px] uppercase tracking-wider text-muted-foreground";

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

  const available = wallet ? shieldedBalance(wallet) : 0n;

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
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Amounts stay private in the pool; an Ed25519 <b className="text-foreground">settlement oracle</b>{" "}
          attests the payout. Rails are sandbox (no real money moves).
        </p>

        {!deliveryEnabled() && (
          <Banner tone="warn">
            Off-ramp service off — set <code>NEXT_PUBLIC_DELIVERY_URL</code> + run the backend.
          </Banner>
        )}

        {/* Amount — styled token-amount card */}
        <AmountCard
          label="Amount to off-ramp"
          right={
            <button
              type="button"
              onClick={() => setAmt(fmt(available))}
              className="text-[11px] text-primary hover:underline"
            >
              Max · {fmt(available)} {ASSET_SYMBOL}
            </button>
          }
          token={<TokenChip symbol={ASSET_SYMBOL} primary />}
          value={amt}
          onChange={setAmt}
          placeholder="0.0"
          footer={`Private balance unshields to the operator, then the rail pays out in ${ccy}.`}
        />

        {/* Payout rail — pill selector */}
        <div className="space-y-2">
          <Label className={labelCls}>Payout rail</Label>
          <div className="grid grid-cols-3 gap-2">
            {RAILS.map((r) => {
              const active = rail === r.value;
              return (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRail(r.value)}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                    active ? "border-primary/50 bg-primary/10 text-foreground" : "border-border bg-muted/40 text-muted-foreground hover:bg-muted/70"
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Currency + handle */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className={labelCls}>Payout currency</Label>
            <select
              value={ccy}
              onChange={(e) => setCcy(e.target.value)}
              className="h-11 w-full rounded-xl bg-muted/50 border border-border px-3 text-sm outline-none focus:border-primary/40"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c} className="bg-zinc-900">{c}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label className={labelCls}>Payout handle / IBAN</Label>
            <Input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              className="bg-muted/50 border-border h-11"
              placeholder="$alice / GB…"
            />
          </div>
        </div>

        <Button
          disabled={busy || !amt || !handle || !address}
          onClick={submit}
          className="w-full h-12 rounded-xl text-sm font-medium"
        >
          {busy ? "Settling…" : `Off-ramp ${amt || "0"} ${ASSET_SYMBOL} → ${ccy}`}
        </Button>
        {!address && <p className="text-[11px] text-muted-foreground">Connect a wallet (or sign in) to off-ramp.</p>}
      </div>
    </WalletScaffold>
  );
}
