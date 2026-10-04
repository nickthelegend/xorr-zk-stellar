"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as pool from "@/lib/pool";
import { useWallet } from "@/components/stellar-wallet-provider";
import { WalletScaffold, Banner } from "@/components/wallet/scaffold";
import { Button } from "@/components/ui/button";
import { ASSET_SYMBOL, deliveryEnabled } from "@/lib/config";
import { fmt, short } from "@/lib/format";

export default function ClaimPage() {
  const params = useSearchParams();
  const token = params.get("t");
  const {
    signInMode, identity, balance, busy, busyMsg, address, wallet, pushLog,
    claimWithToken, claimIntoConnected, run,
  } = useWallet();
  const [err, setErr] = useState<string | null>(null);
  const [doneToWallet, setDoneToWallet] = useState(false);

  // Is a self-custody wallet (Freighter) connected? If so, we deliver the
  // payment straight into it instead of spinning up an auto-wallet.
  const connected = signInMode === "freighter" && !!wallet;
  // Claimed once the magic link is redeemed — into an auto-wallet ("claim" mode)
  // or into the connected wallet (doneToWallet).
  const claimed = signInMode === "claim" || doneToWallet;

  const claim = async () => {
    if (!token) return;
    setErr(null);
    try {
      if (connected) {
        await claimIntoConnected(token);
        setDoneToWallet(true);
      } else {
        await claimWithToken(token);
      }
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const scan = () =>
    run("Scanning for incoming notes", async () => {
      const n = await pool.scanIncoming(wallet!, pushLog);
      pushLog(`Scan complete · ${n} new note(s)`);
    });

  return (
    <WalletScaffold
      eyebrow="Claim"
      title="Claim a payment sent to you"
      description="Someone sent you a private payment. Open your secure link to claim it — into a new private wallet, or straight into your connected wallet."
      flow
      requireConnect={false}
    >
      <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
        {!deliveryEnabled() && (
          <Banner tone="warn">
            Delivery layer off — set <code>NEXT_PUBLIC_DELIVERY_URL</code> + run the backend.
          </Banner>
        )}

        {claimed ? (
          // ── Claimed: show the account that now holds the payment ──
          <div className="space-y-5">
            <div className="rounded-xl bg-muted/50 border border-border p-4">
              <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                {doneToWallet ? "Your connected wallet" : "Your private Stellar account"}
              </p>
              <p className="font-mono text-sm text-primary/90 break-all mt-1">
                {address ? short(address) : identity ? short(identity.stellarPub) : "deriving…"}
              </p>
              <p className="text-2xl font-semibold mt-3 tabular-nums">
                {fmt(balance)} <span className="text-sm text-muted-foreground">{ASSET_SYMBOL}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">claimed &amp; spendable balance</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button asChild className="h-11 rounded-xl text-sm font-medium">
                <Link href="/withdraw">Withdraw / off-ramp</Link>
              </Button>
              <Button
                variant="outline"
                onClick={scan}
                disabled={busy || !deliveryEnabled()}
                className="h-11 text-xs"
              >
                Re-scan
              </Button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Your payment is claimed and spendable. You can{" "}
              <Link href="/withdraw" className="text-primary underline underline-offset-2">withdraw</Link>{" "}
              to a wallet or bank, or{" "}
              <Link href="/?tab=pay" className="text-primary underline underline-offset-2">send privately</Link>{" "}
              to someone else.
            </p>
          </div>
        ) : token ? (
          // ── Magic link present: one tap to claim ──
          <div className="space-y-4">
            <div className="rounded-xl bg-muted/40 border border-border p-4">
              {connected ? (
                <p className="text-sm text-foreground leading-relaxed">
                  💸 <b>You&apos;ve got a private payment.</b> It&apos;ll be delivered straight into your
                  connected wallet <span className="font-mono text-primary/90">{short(address!)}</span> —
                  private and spendable, no separate account.
                </p>
              ) : (
                <p className="text-sm text-foreground leading-relaxed">
                  💸 <b>You&apos;ve got a private payment.</b> Tap below to claim it. A private wallet is
                  created for you automatically — no sign-up, no seed phrase, no extension.
                </p>
              )}
            </div>

            {err && <Banner tone="warn">{err}</Banner>}

            <Button onClick={claim} disabled={busy} className="w-full h-12 rounded-xl text-sm font-medium">
              {busy
                ? busyMsg || "Claiming…"
                : connected
                  ? "Claim into your wallet"
                  : "Claim your payment"}
            </Button>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {connected
                ? "Want a fresh private wallet instead? Disconnect your wallet (top right) and reopen this link."
                : "This opens the private, one-time link that was emailed to you — the amount and sender stay private until you claim."}
            </p>
          </div>
        ) : (
          // ── No token: direct visit without a link ──
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              To claim a payment, open the secure <b>“Claim your payment”</b> link from the email we sent
              you. That link is all you need.
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Didn&apos;t get it? Ask the sender to resend, and check your spam folder.
            </p>
          </div>
        )}
      </div>
    </WalletScaffold>
  );
}
