"use client";

import { useEffect, useState } from "react";
import * as pool from "@/lib/pool";
import { assetBalance } from "@/lib/lending";
import { useWallet } from "@/components/stellar-wallet-provider";
import { Button } from "@/components/ui/button";
import { ASSET_SYMBOL, ASSET_DECIMALS, TOKEN_ID } from "@/lib/config";
import { fmt, parseAmount } from "@/lib/format";
import { AmountCard, TokenChip } from "@/components/wallet/fields";
import { NotesStrip } from "@/components/wallet/notes-strip";

export function DepositForm() {
  const { address, wallet, busy, run, pushLog, refresh } = useWallet();
  const [amt, setAmt] = useState("");
  const [bal, setBal] = useState<bigint>(0n);

  // Show the connected wallet's public USDC balance (what's available to shield).
  useEffect(() => {
    if (!address) { setBal(0n); return; }
    let on = true;
    assetBalance(TOKEN_ID, address).then((b) => on && setBal(b)).catch(() => {});
    return () => { on = false; };
  }, [address, busy]);

  const submit = () =>
    run("Generating deposit proof", async () => {
      await pool.deposit(address!, wallet!, parseAmount(amt), pushLog);
      setAmt("");
      refresh();
    });

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
            right={address ? (
              <button
                type="button"
                onClick={() => setAmt((Number(bal) / 10 ** ASSET_DECIMALS).toString())}
                className="text-[11px] text-primary hover:underline"
              >
                Balance {fmt(bal)} {ASSET_SYMBOL} · Max
              </button>
            ) : undefined}
          />
        </div>
        {address && bal === 0n && (
          <p className="mt-2 text-[11px] text-amber-400/90">
            No {ASSET_SYMBOL} balance — grab some from the <a href="/faucet" className="underline">faucet</a> first.
          </p>
        )}

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
