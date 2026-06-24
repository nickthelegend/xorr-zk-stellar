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
      {/* Hero: balance + live pool */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="premium-card p-6 lg:col-span-2 halo">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Shielded balance
            </span>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-primary bg-primary/10 border border-primary/25 rounded-full px-2.5 py-1">
              <span className="size-1.5 rounded-full bg-primary animate-pulse" /> private
            </span>
          </div>
          <div className="mt-5 flex items-end gap-3">
            <span className="font-display font-extrabold text-6xl md:text-7xl text-gradient tabular-nums leading-[0.9]">
              {fmt(balance)}
            </span>
            <span className="font-mono text-sm text-muted-foreground mb-2">{ASSET_SYMBOL}</span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {unspent.length} unlinkable note(s) · amounts &amp; counterparties hidden on-chain
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild className="h-10 px-5 text-xs uppercase tracking-widest">
              <Link href="/deposit">Deposit</Link>
            </Button>
            <Button asChild variant="outline" className="h-10 px-5 text-xs uppercase tracking-widest">
              <Link href="/send">Send</Link>
            </Button>
            <Button asChild variant="outline" className="h-10 px-5 text-xs uppercase tracking-widest">
              <Link href="/swap">Swap</Link>
            </Button>
          </div>
        </div>

        <div className="premium-card p-6 flex flex-col">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground flex items-center gap-1.5">
            Live on-chain pool {chain && <span className="size-1.5 rounded-full bg-primary animate-pulse" />}
          </span>
          {chain ? (
            <div className="mt-4 space-y-3">
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Total shielded</div>
                <div className="font-display font-bold text-2xl tabular-nums mt-0.5">{fmt(chain.total)} <span className="text-sm text-muted-foreground">{ASSET_SYMBOL}</span></div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Merkle root</div>
                <code className="text-primary text-xs break-all">{short(chain.root, 10)}</code>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-xs text-muted-foreground/60">reading the live contract…</p>
          )}
          <div className="mt-auto pt-4 text-[10px] font-mono text-muted-foreground/60">BN254 Groth16 · Soroban</div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {QUICK.map((q) => (
          <Link key={q.href} href={q.href} className="premium-card p-4 flex items-center gap-3 group">
            <span className="size-10 rounded-xl bg-primary/10 border border-primary/20 grid place-items-center text-primary group-hover:bg-primary/20 transition-colors">
              <q.icon className="size-4" />
            </span>
            <span className="font-medium text-sm">{q.label}</span>
          </Link>
        ))}
      </div>

      {/* Constellation count */}
      <div className="grid grid-cols-2 gap-3">
        <div className="premium-card p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Active notes</div>
          <div className="mt-1 font-display font-bold text-2xl tabular-nums">{unspent.length}</div>
        </div>
        <div className="premium-card p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Spent</div>
          <div className="mt-1 font-display font-bold text-2xl tabular-nums text-muted-foreground">{notes.length - unspent.length}</div>
        </div>
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
