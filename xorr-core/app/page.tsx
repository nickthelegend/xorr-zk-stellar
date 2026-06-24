"use client";

import Link from "next/link";
import { useWallet } from "@/components/stellar-wallet-provider";
import { WalletScaffold } from "@/components/wallet/scaffold";
import { Constellation } from "@/components/wallet/constellation";
import { Button } from "@/components/ui/button";
import { ASSET_SYMBOL, POOL_ID } from "@/lib/config";
import { fmt, short } from "@/lib/format";
import { ArrowDownToLine, Send, Cable, ShieldCheck } from "lucide-react";

const QUICK = [
  { href: "/deposit", label: "Deposit", icon: ArrowDownToLine },
  { href: "/send", label: "Send", icon: Send },
  { href: "/bridge", label: "Bridge", icon: Cable },
  { href: "/compliance", label: "Disclose", icon: ShieldCheck },
];

export default function DashboardPage() {
  const { wallet, balance, chain, resetWallet } = useWallet();
  const notes = wallet?.notes ?? [];
  const unspent = notes.filter((n) => !n.spent);

  return (
    <WalletScaffold
      eyebrow="Shielded wallet"
      title="Dashboard"
      description={
        <>
          Your private balance is a constellation of unlinkable UTXO notes. Shield {ASSET_SYMBOL},
          pay privately, and prove every spend in zero knowledge — verified on-chain by a BN254
          Groth16 contract on Soroban.
        </>
      }
    >
      {/* Stat grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl p-5">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
            Shielded balance
          </span>
          <div className="mt-2 font-sans font-extrabold text-4xl bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent tabular-nums">
            {fmt(balance)}
          </div>
          <span className="font-mono text-[11px] text-muted-foreground">
            {ASSET_SYMBOL} · {unspent.length} private note(s)
          </span>
        </div>

        <div className="glass-card rounded-2xl p-5">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
            UTXO constellation
          </span>
          <div className="mt-2 font-sans font-extrabold text-4xl text-foreground tabular-nums">
            {notes.length}
          </div>
          <span className="font-mono text-[11px] text-muted-foreground">
            {unspent.length} active · {notes.length - unspent.length} spent
          </span>
        </div>

        <div className="glass-card rounded-2xl p-5 sm:col-span-2 lg:col-span-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1.5">
            Live on-chain pool {chain && <span className="size-1.5 rounded-full bg-primary animate-pulse" />}
          </span>
          {chain ? (
            <div className="mt-3 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">total shielded</span>
                <code className="text-foreground tabular-nums">
                  {fmt(chain.total)} {ASSET_SYMBOL}
                </code>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">merkle root</span>
                <code className="text-primary">{short(chain.root, 8)}</code>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground/60">connect to read the live contract…</p>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {QUICK.map((q) => (
          <Link
            key={q.href}
            href={q.href}
            className="glass-card rounded-2xl p-4 flex items-center gap-3 hover:border-primary/40 border border-transparent transition-colors group"
          >
            <span className="size-9 rounded-xl bg-primary/10 border border-primary/20 grid place-items-center text-primary group-hover:bg-primary/20 transition-colors">
              <q.icon className="size-4" />
            </span>
            <span className="font-medium text-sm">{q.label}</span>
          </Link>
        ))}
      </div>

      {/* Notes */}
      <div className="glass-card rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">Your notes</h3>
          {notes.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-[11px] text-muted-foreground hover:text-destructive"
              onClick={() => {
                if (confirm("Reset local wallet for this pool? (clears notes + tree mirror)")) resetWallet();
              }}
            >
              Reset wallet
            </Button>
          )}
        </div>
        <Constellation notes={notes} />
      </div>

      {POOL_ID && (
        <p className="text-[11px] text-muted-foreground/50 font-mono">
          pool{" "}
          <a
            className="text-primary/70 hover:text-primary"
            href={`https://stellar.expert/explorer/testnet/contract/${POOL_ID}`}
            target="_blank"
            rel="noreferrer"
          >
            {short(POOL_ID, 6)}
          </a>{" "}
          · proofs verified on-chain via BN254 Groth16 · testnet, not audited
        </p>
      )}
    </WalletScaffold>
  );
}
