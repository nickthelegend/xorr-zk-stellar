"use client";

import { useState } from "react";
import * as pool from "@/lib/pool";
import { useWallet } from "@/components/stellar-wallet-provider";
import { WalletScaffold } from "@/components/wallet/scaffold";
import { MONEY_TABS } from "@/components/app/segmented-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ASSET_SYMBOL } from "@/lib/config";
import { parseAmount } from "@/lib/format";

export default function DepositPage() {
  const { address, wallet, busy, run, pushLog } = useWallet();
  const [amt, setAmt] = useState("");

  const submit = () =>
    run("Generating deposit proof", () => pool.deposit(address!, wallet!, parseAmount(amt), pushLog));

  return (
    <WalletScaffold
      eyebrow="Shield"
      title="Deposit"
      description="Pull public tokens into a fresh hidden note. Every spend is later proven in zero knowledge."
      tabs={MONEY_TABS}
    >
      <div className="bg-card border border-border rounded-2xl p-6">
        <h3 className="font-semibold text-foreground">Shield public {ASSET_SYMBOL}</h3>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          A ZK proof binds the note&rsquo;s secret value to the deposited amount; only a Poseidon
          commitment is published on-chain. The amount itself never appears.
        </p>

        <div className="mt-5 space-y-2">
          <Label htmlFor="amt" className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Amount ({ASSET_SYMBOL})
          </Label>
          <Input
            id="amt"
            value={amt}
            onChange={(e) => setAmt(e.target.value)}
            placeholder="10.0"
            inputMode="decimal"
            className="bg-background/50 border-white/10 h-11 text-lg tabular-nums"
          />
        </div>

        <Button
          disabled={busy || !amt || !address}
          onClick={submit}
          className="mt-5 w-full h-11 font-mono uppercase tracking-widest text-xs"
        >
          {busy ? "Proving…" : "Shield"}
        </Button>
      </div>
    </WalletScaffold>
  );
}
