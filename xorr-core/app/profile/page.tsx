"use client";

import { useMemo } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Copy, ShieldCheck } from "lucide-react";
import { useWallet } from "@/components/stellar-wallet-provider";
import { Constellation } from "@/components/wallet/constellation";
import { Button } from "@/components/ui/button";
import { myShieldedAddress } from "@/lib/delivery";
import { ASSET_SYMBOL, NETWORK, POOL_ID } from "@/lib/config";
import { fmt, short } from "@/lib/format";
import { toast } from "sonner";

const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const NET = NETWORK === "public" ? "Mainnet" : "Testnet";

function Badge({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "primary" }) {
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
      tone === "primary" ? "text-primary border-primary/30 bg-primary/10" : "text-muted-foreground border-border"
    }`}>
      {children}
    </span>
  );
}

function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-1">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function AccountCard() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  if (!ready) return <div className="bg-card border border-border rounded-2xl p-5 h-full animate-pulse" />;

  const accounts: { kind: string; value: string }[] = [];
  if (authenticated && user) {
    if (user.email?.address) accounts.push({ kind: "Email", value: user.email.address });
    if (user.google?.email) accounts.push({ kind: "Google", value: user.google.email });
    if (user.twitter?.username) accounts.push({ kind: "X", value: `@${user.twitter.username}` });
    if (user.github?.username) accounts.push({ kind: "GitHub", value: user.github.username });
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col">
      <h3 className="text-sm font-medium text-foreground">Account</h3>
      {authenticated ? (
        <>
          <div className="mt-3 space-y-2 flex-1">
            {accounts.length ? accounts.map((a) => (
              <div key={a.kind} className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{a.kind}</span>
                <span className="text-xs font-medium text-foreground truncate max-w-[160px]">{a.value}</span>
              </div>
            )) : <p className="text-xs text-muted-foreground">Signed in.</p>}
          </div>
          <Button variant="outline" onClick={() => logout()} className="mt-3 h-9 text-xs">Sign out</Button>
        </>
      ) : (
        <>
          <p className="mt-2 text-xs text-muted-foreground flex-1">Sign in to get paid by email or social handle and claim from any device.</p>
          <Button onClick={() => login()} className="mt-3 h-9 text-xs rounded-xl">Sign in</Button>
        </>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const { ready, wallet, balance, chain, address, resetWallet } = useWallet();
  const notes = wallet?.notes ?? [];
  const unspent = notes.filter((n) => !n.spent);
  const shieldedAddr = useMemo(() => (wallet ? myShieldedAddress(BigInt(wallet.master)) : ""), [wallet]);

  if (!ready) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative size-10">
            <span className="absolute inset-0 rounded-full border-2 border-primary/20" />
            <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
          </div>
          <span className="text-muted-foreground font-mono text-xs tracking-wide">initializing zero-knowledge wallet…</span>
        </div>
      </div>
    );
  }

  const copy = () => {
    if (!shieldedAddr) return;
    navigator.clipboard?.writeText(shieldedAddr);
    toast.success("Shielded address copied");
  };

  return (
    <div className="w-full max-w-6xl mx-auto pt-4 pb-10 space-y-8">
      {/* Identity header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="flex items-center gap-4">
          <span className="h-14 w-14 shrink-0 rounded-full grid place-items-center text-xl font-bold text-white"
            style={{ background: "linear-gradient(135deg,#e2a9f1,#7c3aed)" }}>
            <ShieldCheck className="size-6" />
          </span>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground">Shielded wallet</h1>
              <Badge>{NET}</Badge>
              <Badge tone="primary">● private</Badge>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground font-mono break-all">{shieldedAddr ? short(shieldedAddr, 14) : "—"}</span>
              <button onClick={copy} disabled={!shieldedAddr} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                <Copy className="h-3 w-3" /> Copy
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="lg:text-right">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Shielded balance</p>
            <p className="text-3xl font-extrabold tabular-nums text-gradient leading-none">{fmt(balance)} <span className="text-sm text-muted-foreground font-medium">{ASSET_SYMBOL}</span></p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active notes" value={unspent.length} sub="unlinkable UTXOs" />
        <StatCard label="Spent" value={notes.length - unspent.length} />
        <StatCard label="On-chain total" value={chain ? fmt(chain.total) : "—"} sub={`${ASSET_SYMBOL} shielded`} />
        <StatCard label="Wallet" value={address ? short(address, 4) : "—"} sub={address ? "connected" : "not connected"} />
      </div>

      {/* Account + live pool */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {APP_ID ? <AccountCard /> : (
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="text-sm font-medium text-foreground">Account</h3>
            <p className="mt-2 text-xs text-muted-foreground">Self-hosted identity — your notes live in this browser.</p>
          </div>
        )}
        <div className="bg-card border border-border rounded-2xl p-5 flex flex-col">
          <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
            Live on-chain pool {chain && <span className="size-1.5 rounded-full bg-primary animate-pulse" />}
          </span>
          {chain ? (
            <div className="mt-4 space-y-3 flex-1">
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Total shielded</div>
                <div className="font-bold text-2xl tabular-nums mt-0.5">{fmt(chain.total)} <span className="text-sm text-muted-foreground">{ASSET_SYMBOL}</span></div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Merkle root</div>
                <code className="text-primary text-xs break-all">{short(chain.root, 10)}</code>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-xs text-muted-foreground/60 flex-1">reading the live contract…</p>
          )}
          <div className="mt-auto pt-4 text-[10px] font-mono text-muted-foreground/60">BN254 Groth16 · Soroban {POOL_ID ? `· ${short(POOL_ID, 4)}` : ""}</div>
        </div>
      </div>

      {/* Notes */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-foreground">Your notes</h3>
          {notes.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-[11px] text-muted-foreground hover:text-destructive"
              onClick={() => { if (confirm("Reset local wallet for this pool? (clears notes + tree mirror)")) resetWallet(); }}
            >
              Reset wallet
            </Button>
          )}
        </div>
        <Constellation notes={notes} />
      </div>
    </div>
  );
}
