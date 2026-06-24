"use client";

import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import * as pool from "@/lib/pool";
import { useWallet } from "@/components/stellar-wallet-provider";
import { WalletScaffold, Banner } from "@/components/wallet/scaffold";
import { SignInButton } from "@/components/auth/sign-in-button";
import { Button } from "@/components/ui/button";
import { ASSET_SYMBOL, deliveryEnabled } from "@/lib/config";
import { fmt, short } from "@/lib/format";

export default function ClaimPage() {
  const { ready, authenticated } = usePrivy();
  const { signInMode, identity, balance, busy, claimAccount, run, wallet, pushLog } = useWallet();
  const signedIn = ready && authenticated && signInMode === "sso";

  const scan = () =>
    run("Scanning for incoming notes", async () => {
      const n = await pool.scanIncoming(wallet!, pushLog);
      pushLog(`Scan complete · ${n} new note(s)`);
    });

  return (
    <WalletScaffold
      eyebrow="Claim"
      title="Claim a payment sent to you"
      description="Sign in with the email or social account the payment was sent to. A private wallet is created for you automatically — no seed phrase, no extension."
    >
      <div className="glass-card rounded-2xl p-6 max-w-lg space-y-5">
        {!deliveryEnabled() && (
          <Banner tone="warn">
            Delivery layer off — set <code>NEXT_PUBLIC_DELIVERY_URL</code> + run the backend.
          </Banner>
        )}

        {!signedIn ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Someone sent you a private payment. Sign in to claim it — your funds are encrypted to
              your identity and only become spendable once you authenticate.
            </p>
            <div className="flex items-center gap-3">
              <SignInButton />
              <span className="text-xs text-muted-foreground">Google · X · GitHub · email</span>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-xl bg-background/50 border border-white/10 p-4">
              <p className={"font-mono text-[11px] uppercase tracking-wider text-muted-foreground"}>
                Your custodial Stellar account
              </p>
              <p className="font-mono text-sm text-primary/90 break-all mt-1">
                {identity ? short(identity.stellarPub) : "deriving…"}
              </p>
              <p className="text-2xl font-semibold mt-3 tabular-nums">
                {fmt(balance)} <span className="text-sm text-muted-foreground">{ASSET_SYMBOL}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">claimed & spendable balance</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={claimAccount}
                disabled={busy}
                className="h-11 font-mono uppercase tracking-widest text-xs"
              >
                {busy ? "Working…" : "Activate & claim"}
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
              <b>Activate &amp; claim</b> funds your account (creates it + adds a USDC trustline) and
              pulls in any pending payments. Then you can{" "}
              <Link href="/withdraw" className="text-primary underline underline-offset-2">withdraw</Link>{" "}
              to a wallet or{" "}
              <Link href="/send" className="text-primary underline underline-offset-2">send privately</Link>.
            </p>
          </div>
        )}
      </div>
    </WalletScaffold>
  );
}
