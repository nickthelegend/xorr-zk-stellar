"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useWallet } from "@/components/stellar-wallet-provider";
import { WalletScaffold, Banner, ConnectNudge } from "@/components/wallet/scaffold";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NotePicker } from "@/components/wallet/note-picker";
import {
  generateReceipt,
  verifyReceipt,
  randomNonce,
  type DisclosureReceipt,
  type ReceiptChecks,
} from "@/lib/disclosure-receipt";
import { ASSET_SYMBOL } from "@/lib/config";
import { fmt, short } from "@/lib/format";
import { toast } from "sonner";

const labelCls = "font-mono text-[10px] uppercase tracking-wider text-muted-foreground";
const inputCls = "bg-muted/50 border-border h-11";

export default function CompliancePage() {
  return (
    <WalletScaffold
      eyebrow="Compliance"
      title="Disclosure receipts"
      description="Generate a selective-disclosure receipt for one of your shielded notes — proving ownership and amount to an auditor without revealing your keys or other notes — and verify any receipt."
      flow
      requireConnect={false}
    >
      <div className="space-y-4">
        <GenerateCard />
        <VerifyCard />
      </div>
    </WalletScaffold>
  );
}

function GenerateCard() {
  const { address, wallet, pushLog } = useWallet();
  const unspent = (wallet?.notes ?? []).filter((n) => !n.spent && n.leafIndex != null);
  const [idx, setIdx] = useState(0);
  const [authority, setAuthority] = useState("");
  const [purpose, setPurpose] = useState("");
  const [nonce, setNonce] = useState("");
  const [generating, setGenerating] = useState(false);
  const [receipt, setReceipt] = useState<DisclosureReceipt | null>(null);

  useEffect(() => setNonce(randomNonce()), []);

  const note = unspent[idx];
  const canGen = !!note && !!authority.trim() && !!purpose.trim() && !!nonce && !generating;

  const generate = async () => {
    setGenerating(true);
    try {
      const r = await generateReceipt(
        BigInt(wallet!.master),
        note,
        { authority: authority.trim(), purpose: purpose.trim(), nonce },
        pushLog,
      );
      setReceipt(r);
      toast.success("Disclosure receipt generated");
    } catch (e) {
      toast.error((e as Error).message || "generation failed");
      pushLog(`⚠ ${(e as Error).message}`);
    } finally {
      setGenerating(false);
    }
  };

  const download = () => {
    if (!receipt) return;
    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `disclosure-receipt-${receipt.note.commitment.slice(0, 8)}.json`;
    a.click();
    toast.success("Receipt downloaded");
  };

  const reset = () => {
    setReceipt(null);
    setNonce(randomNonce());
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">Generate disclosure receipt</h3>

      {!address ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Connect your wallet to generate disclosure receipts for your unspent notes.
          </p>
          <ConnectNudge />
        </div>
      ) : unspent.length === 0 ? (
        <div className="mt-4">
          <Banner tone="warn">
            No unspent notes found —{" "}
            <Link href="/?tab=deposit" className="text-primary underline underline-offset-2">deposit</Link> first.
          </Banner>
        </div>
      ) : receipt ? (
        <div className="mt-4 space-y-3">
          <Banner tone="ok">✓ Disclosure receipt generated successfully.</Banner>
          <pre className="max-h-72 overflow-auto rounded-xl border border-border bg-muted/40 p-3 text-[10px] font-mono text-muted-foreground leading-relaxed">
            {JSON.stringify(receipt, null, 2)}
          </pre>
          <div className="flex gap-2">
            <Button onClick={download} className="flex-1 h-10 rounded-xl text-xs">Download JSON</Button>
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard?.writeText(JSON.stringify(receipt, null, 2));
                toast.success("Copied to clipboard");
              }}
              className="flex-1 h-10 text-xs"
            >
              Copy
            </Button>
            <Button variant="outline" onClick={reset} className="flex-1 h-10 text-xs">Generate another</Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label className={labelCls}>Select an unspent note ({unspent.length})</Label>
            <NotePicker notes={unspent} selected={idx} onSelect={setIdx} />
          </div>
          <div className="space-y-2">
            <Label className={labelCls}>Authority label</Label>
            <Input value={authority} onChange={(e) => setAuthority(e.target.value)} placeholder="e.g. KYC Provider" className={inputCls} />
          </div>
          <div className="space-y-2">
            <Label className={labelCls}>Purpose</Label>
            <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. identity-verification" className={inputCls} />
          </div>
          <div className="space-y-2">
            <Label className={labelCls}>Context nonce</Label>
            <div className="flex gap-2">
              <Input value={nonce} onChange={(e) => setNonce(e.target.value)} placeholder="0x…" className={`${inputCls} font-mono text-xs`} />
              <Button variant="outline" onClick={() => setNonce(randomNonce())} className="h-11 text-xs shrink-0">Random</Button>
            </div>
          </div>
          <Button disabled={!canGen} onClick={generate} className="w-full h-12 rounded-xl text-sm font-medium">
            {generating ? "Generating…" : "Generate Disclosure Receipt"}
          </Button>
          {note && (
            <p className="text-[11px] text-muted-foreground">
              Discloses note <span className="font-mono text-foreground">{short(BigInt(note.commitment).toString(16), 6)}</span> ·{" "}
              {fmt(BigInt(note.amount))} {ASSET_SYMBOL} to <b className="text-foreground">{authority || "the authority"}</b>.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function VerifyCard() {
  const { wallet } = useWallet();
  const [raw, setRaw] = useState("");
  const [loaded, setLoaded] = useState<DisclosureReceipt | null>(null);
  const [checks, setChecks] = useState<ReceiptChecks | null>(null);
  const [verifying, setVerifying] = useState(false);

  const load = () => {
    try {
      const r = JSON.parse(raw) as DisclosureReceipt;
      if (!r.publicSignals || !r.context || !r.note) throw new Error("not a disclosure receipt");
      setLoaded(r);
      setChecks(null);
      toast.success("Receipt loaded");
    } catch (e) {
      toast.error((e as Error).message || "invalid JSON");
    }
  };

  const verify = async () => {
    if (!loaded) return;
    setVerifying(true);
    try {
      const leaves = wallet?.leaves ? new Set(wallet.leaves) : undefined;
      setChecks(await verifyReceipt(loaded, leaves));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">Verify disclosure receipt</h3>
      <p className="text-xs text-muted-foreground mt-1">
        Paste a receipt to check the proof, the authority/purpose context, and that the note is still on-chain.
      </p>
      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        rows={4}
        placeholder="Paste receipt JSON…"
        className="mt-3 w-full rounded-xl bg-muted/50 border border-border p-3 text-[11px] font-mono text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40 resize-none"
      />
      <div className="mt-3 flex gap-2">
        <Button variant="outline" onClick={load} disabled={!raw.trim()} className="h-10 text-xs">Load receipt</Button>
        <Button onClick={verify} disabled={!loaded || verifying} className="h-10 rounded-xl text-xs">
          {verifying ? "Verifying…" : "Verify receipt"}
        </Button>
      </div>

      {loaded && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Field k="Authority" v={loaded.context.authority} />
          <Field k="Purpose" v={loaded.context.purpose} />
          <Field k="Amount" v={`${fmt(BigInt(loaded.note.amount))} ${ASSET_SYMBOL}`} />
          <Field k="Network" v={loaded.network || "—"} />
        </div>
      )}

      {checks && (
        <div className="mt-4 space-y-2">
          <Check ok={checks.proofValid} label="Proof valid"
            pass="The Groth16 proof verifies against the disclosure circuit."
            fail="The proof does not verify — the receipt may be forged or artifacts are missing." />
          <Check ok={checks.contextValid} label="Context valid"
            pass="The authority / purpose / nonce re-derives to the value the proof committed to."
            fail="The context was altered after the proof was created." />
          <Check ok={checks.rootFresh} label="Root fresh"
            pass="The note's commitment is still in the pool's known leaf set."
            fail="The commitment isn't in the known leaf set (stale, spent, or a different pool)." />
          {checks.proofValid && checks.contextValid && checks.rootFresh && (
            <Banner tone="ok">✓ Fully verified — this receipt is trustworthy.</Banner>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg bg-muted/40 border border-border px-3 py-2 min-w-0">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className="text-xs text-foreground font-medium truncate">{v}</div>
    </div>
  );
}

function Check({ ok, label, pass, fail }: { ok: boolean; label: string; pass: string; fail: string }) {
  return (
    <div className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 ${ok ? "border-primary/30 bg-primary/5" : "border-red-500/30 bg-red-500/5"}`}>
      <span className={`mt-0.5 text-sm ${ok ? "text-primary" : "text-red-400"}`}>{ok ? "✓" : "✗"}</span>
      <div>
        <div className={`text-xs font-semibold ${ok ? "text-foreground" : "text-red-300"}`}>{label}</div>
        <div className="text-[10px] text-muted-foreground">{ok ? pass : fail}</div>
      </div>
    </div>
  );
}
