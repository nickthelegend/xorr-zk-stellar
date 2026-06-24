"use client";

import { useState } from "react";
import {
  generateDisclosure,
  verifyDisclosure,
  type DisclosureBundle,
} from "@/lib/compliance";
import { useWallet } from "@/components/stellar-wallet-provider";
import { WalletScaffold, Banner } from "@/components/wallet/scaffold";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ASSET_SYMBOL } from "@/lib/config";
import { fmt } from "@/lib/format";
import { shieldedBalance } from "@/lib/notes";
import { toast } from "sonner";

export default function CompliancePage() {
  const { wallet, busy, run, pushLog } = useWallet();
  const [label, setLabel] = useState("auditor-2026");
  const [disclosure, setDisclosure] = useState<DisclosureBundle | null>(null);

  const active = (wallet?.notes ?? []).filter((n) => !n.spent).length;
  const total = wallet ? shieldedBalance(wallet) : 0n;

  const onGenerate = () =>
    run("Generating disclosure proofs", async () => {
      const b = await generateDisclosure(
        BigInt(wallet!.master),
        wallet!.notes.filter((n) => !n.spent),
        label,
        pushLog,
      );
      setDisclosure(b);
      pushLog(`Disclosure ready: ${b.items.length} note(s), total ${fmt(BigInt(b.total))} ${ASSET_SYMBOL}`);
    });

  const onVerify = () =>
    run("Auditor verifying disclosure", async () => {
      if (!disclosure) return pushLog("⚠ generate a disclosure first");
      const r = await verifyDisclosure(disclosure, new Set(wallet!.leaves));
      pushLog(
        `Auditor: ${r.verified}/${disclosure.items.length} proofs valid · total ${fmt(r.total)} ${ASSET_SYMBOL}${
          r.onChain ? " · commitments on-chain ✓" : ""
        }`,
      );
      toast.success(`${r.verified}/${disclosure.items.length} proofs valid`);
    });

  return (
    <WalletScaffold
      eyebrow="Compliance"
      title="Selective disclosure"
      description="Privacy ≠ opacity. Prove you own specific notes worth specific amounts — without revealing spend keys, blindings, or any other notes."
    >
      <div className="glass-card rounded-2xl p-6 max-w-lg">
        <p className="text-sm text-muted-foreground leading-relaxed">
          A holder generates <b className="text-foreground">zero-knowledge proofs</b> of ownership
          for an auditor. The auditor verifies the bundle and that each commitment is on-chain.
          Spend authority is never exposed.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white/3 border border-white/5 px-4 py-3">
            <div className="font-mono text-[10px] uppercase text-muted-foreground">Active notes</div>
            <div className="text-xl font-bold tabular-nums">{active}</div>
          </div>
          <div className="rounded-xl bg-white/3 border border-white/5 px-4 py-3">
            <div className="font-mono text-[10px] uppercase text-muted-foreground">To disclose</div>
            <div className="text-xl font-bold tabular-nums text-primary">
              {fmt(total)} <span className="text-[10px] text-muted-foreground">{ASSET_SYMBOL}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Auditor / session label
          </Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="auditor-2026"
            className="bg-background/50 border-white/10 h-11"
          />
        </div>

        <Button
          disabled={busy || active === 0}
          onClick={onGenerate}
          className="mt-4 w-full h-11 font-mono uppercase tracking-widest text-xs"
        >
          {busy ? "Proving…" : "Generate disclosure proofs"}
        </Button>

        {disclosure && (
          <div className="mt-4 space-y-3">
            <Banner tone="ok">
              ✓ Disclosure bundle: {disclosure.items.length} proof(s), total{" "}
              {fmt(BigInt(disclosure.total))} {ASSET_SYMBOL}.
            </Banner>
            <div className="flex gap-2">
              <Button variant="outline" disabled={busy} onClick={onVerify} className="flex-1 h-10 text-xs">
                Verify as auditor
              </Button>
              <Button
                variant="outline"
                className="flex-1 h-10 text-xs"
                onClick={() => {
                  navigator.clipboard?.writeText(JSON.stringify(disclosure));
                  toast.success("Bundle copied");
                }}
              >
                Copy bundle
              </Button>
            </div>
          </div>
        )}
      </div>
    </WalletScaffold>
  );
}
