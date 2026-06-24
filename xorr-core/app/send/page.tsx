"use client";

import { useState } from "react";
import * as pool from "@/lib/pool";
import { useWallet } from "@/components/stellar-wallet-provider";
import { WalletScaffold, Banner } from "@/components/wallet/scaffold";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ASSET_SYMBOL, deliveryEnabled } from "@/lib/config";
import { fmt, parseAmount } from "@/lib/format";
import { isEmail } from "@/lib/identity/normalize";
import { getProvider } from "@/lib/identity/provider";
import type { ResolvedRecipient } from "@/lib/identity/types";
import { RecipientAvatar } from "@/components/auth/recipient-avatar";
import { toast } from "sonner";

const labelCls = "font-mono text-[11px] uppercase tracking-wider text-muted-foreground";
const inputCls = "bg-background/50 border-white/10 h-11";

export default function SendPage() {
  const { address, wallet, busy, run, pushLog } = useWallet();
  const unspent = (wallet?.notes ?? []).filter((n) => !n.spent);
  const total = unspent.reduce((s, n) => s + BigInt(n.amount), 0n);
  const [to, setTo] = useState("");
  const [amt, setAmt] = useState("");
  const [resolved, setResolved] = useState<ResolvedRecipient | null>(null);
  const [resolving, setResolving] = useState(false);

  const isDirect = to.trim().startsWith("sb1:");
  const isIdentity = !isDirect && to.trim().length > 0;

  const onToChange = (v: string) => {
    setTo(v);
    setResolved(null); // any edit invalidates a prior resolution
  };

  const resolve = async () => {
    setResolving(true);
    try {
      const r = await getProvider().resolveRecipient(to.trim());
      setResolved(r);
      pushLog(`Resolved ${r.uidNorm ?? to.trim()} ${r.exists ? "(registered)" : "(not signed in yet)"}`);
    } catch (e: unknown) {
      toast.error((e as Error).message);
      pushLog(`⚠ resolve failed: ${(e as Error).message}`);
    } finally {
      setResolving(false);
    }
  };

  const submit = () => {
    const recipientAddr = isDirect ? to.trim() : `sb1:${resolved!.encPub}`;
    const emailToNotify = isEmail(to.trim()) ? to.trim() : null;
    run("Generating private payment proof", async () => {
      await pool.payTo(address!, wallet!, recipientAddr, parseAmount(amt), pushLog);
      if (emailToNotify) {
        try {
          await getProvider().notify(emailToNotify);
          pushLog(`📧 Notified ${emailToNotify} — they can sign in to claim`);
        } catch (e) {
          pushLog(`⚠ payment sent, but email notify failed: ${(e as Error).message}`);
        }
      }
    });
  };

  // Send is allowed for a direct sb1: address, or once an identity is resolved.
  const canSend =
    !busy && !!amt && !!address && unspent.length >= 2 && (isDirect || !!resolved);

  return (
    <WalletScaffold
      eyebrow="Private payment"
      title="Send"
      description="Pay by email, social handle, or shielded address. Amounts and the sender↔receiver link stay hidden on-chain."
    >
      <div className="glass-card rounded-2xl p-6 max-w-lg">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Spends two of your notes and mints a fresh stealth note for the recipient (plus your
          change), then delivers the encrypted opening so only they can find &amp; spend it.
          Spendable balance: <b className="text-foreground">{fmt(total)} {ASSET_SYMBOL}</b>.
        </p>

        {!deliveryEnabled() && (
          <Banner tone="warn">
            Delivery layer off — set <code>NEXT_PUBLIC_DELIVERY_URL</code> and run the backend to
            enable cross-user payments.
          </Banner>
        )}
        {unspent.length < 2 && (
          <Banner tone="warn">Need ≥2 active notes — deposit a couple of times first.</Banner>
        )}

        <div className="mt-5 space-y-4">
          <div className="space-y-2">
            <Label className={labelCls}>Recipient — email, @handle, or sb1: address</Label>
            <div className="flex gap-2">
              <Input
                value={to}
                onChange={(e) => onToChange(e.target.value)}
                className={inputCls}
                placeholder="alice@gmail.com · @alice · sb1:…"
              />
              {isIdentity && (
                <Button
                  variant="outline"
                  onClick={resolve}
                  disabled={resolving || !to.trim()}
                  className="h-11 text-xs shrink-0"
                >
                  {resolving ? "…" : resolved ? "✓" : "Resolve"}
                </Button>
              )}
            </div>
            {resolved && (
              <div className="rounded-xl bg-background/50 border border-white/10 p-3 space-y-2">
                <RecipientAvatar recipient={to.trim()} kind={isEmail(to.trim()) ? "email" : "handle"} />
                <div className="text-xs">
                  {resolved.exists ? (
                    <span className="text-primary/80">● already on XORR</span>
                  ) : (
                    <span className="text-amber-400/90">● not signed in yet — they’ll claim on login</span>
                  )}
                </div>
                <div className="font-mono text-[10px] text-muted-foreground break-all">
                  encrypts to {resolved.encPub.slice(0, 22)}…
                </div>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label className={labelCls}>Amount ({ASSET_SYMBOL})</Label>
            <Input
              value={amt}
              onChange={(e) => setAmt(e.target.value)}
              className={`${inputCls} tabular-nums`}
              placeholder="5.0"
              inputMode="decimal"
            />
          </div>
          <Button
            disabled={!canSend}
            onClick={submit}
            className="w-full h-11 font-mono uppercase tracking-widest text-xs"
          >
            {busy ? "Proving…" : isIdentity && !resolved ? "Resolve recipient first" : "Send privately"}
          </Button>
        </div>
      </div>
    </WalletScaffold>
  );
}
