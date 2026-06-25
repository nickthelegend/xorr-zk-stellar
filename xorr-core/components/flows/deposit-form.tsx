"use client";

import { useState } from "react";
import * as pool from "@/lib/pool";
import { useWallet } from "@/components/stellar-wallet-provider";
import { Button } from "@/components/ui/button";
import { ASSET_SYMBOL } from "@/lib/config";
import { parseAmount } from "@/lib/format";
import { AmountCard, TokenChip } from "@/components/wallet/fields";
import { NotesStrip } from "@/components/wallet/notes-strip";

export function DepositForm() {
  const { address, wallet, busy, run, pushLog } = useWallet();
  const [amt, setAmt] = useState("");

  const submit = () =>
    run("Generating deposit proof", () => pool.deposit(address!, wallet!, parseAmount(amt), pushLog));

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl p-6">
        <h3 className="font-semibold text-foreground">Shield public {ASSET_SYMBOL}</h3>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          A ZK proof binds the note&rsquo;s secret value to the deposited amount; only a Poseidon
          commitment is published on-chain. The amount itself never appears.
        </p>

        <div className="mt-5">
          <AmountCard
            label="Amount to shield"
            token={<TokenChip symbol={ASSET_SYMBOL} primary />}
            value={amt}
            onChange={setAmt}
            placeholder="0.0"
          />
        </div>

        <Button
          disabled={busy || !amt || !address}
          onClick={submit}
          className="mt-4 w-full h-12 rounded-xl text-sm font-medium"
        >
          {busy ? "Proving…" : "Shield"}
        </Button>
      </div>

      <NotesStrip title="Your shielded notes" emptyHint="No notes yet — shield some USDC to mint your first UTXO." />
    </div>
  );
}
