"use client";

import * as faucet from "@/lib/faucet";
import { useWallet } from "@/components/stellar-wallet-provider";
import { WalletScaffold, Banner } from "@/components/wallet/scaffold";
import { Button } from "@/components/ui/button";
import { ASSET_SYMBOL } from "@/lib/config";
import { short } from "@/lib/format";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export default function FaucetPage() {
  const { address, busy, run, pushLog, refreshChain } = useWallet();
  const { address: evm, isConnected } = useAccount();

  const onXlm = () =>
    run("Funding test XLM", async () => {
      await faucet.fundXlm(address!);
      pushLog(`Funded ${short(address!)} with test XLM (friendbot)`);
      refreshChain();
    });

  const onUsdc = () =>
    run("Funding mock USDC", async () => {
      pushLog("Ensuring account is funded (XLM)…");
      await faucet.fundXlm(address!);
      if (!(await faucet.hasUsdcTrustline(address!))) {
        pushLog("Adding USDC trustline (Freighter)…");
        await faucet.addUsdcTrustline(address!);
      }
      await faucet.faucetUsdc(address!);
      pushLog(`+100 mock ${ASSET_SYMBOL} → ${short(address!)}`);
      refreshChain();
    });

  const onEth = () =>
    run("Funding Sepolia ETH", async () => {
      const r = await faucet.faucetEth(evm!);
      pushLog(`+0.005 Sepolia ETH → ${short(evm!)} · ${String(r.txHash).slice(0, 12)}…`);
    });

  return (
    <WalletScaffold
      eyebrow="Testnet tokens"
      title="Faucet"
      description="Grab tokens to try every flow. Demo-only, rate-limited per address."
    >
      <div className="glass-card rounded-2xl p-6 max-w-lg space-y-4">
        {!address && <Banner tone="warn">Connect Freighter (top-right) first.</Banner>}

        <Row label="Test XLM (Stellar) — creates / funds your account">
          <Button variant="outline" disabled={busy || !address} onClick={onXlm} className="h-9 text-xs">
            Get test XLM
          </Button>
        </Row>

        <Row label={`Mock ${ASSET_SYMBOL} (Stellar)`}>
          <Button disabled={busy || !address} onClick={onUsdc} className="h-9 text-xs">
            Get 100 {ASSET_SYMBOL}
          </Button>
        </Row>
        <p className="text-[11px] text-muted-foreground/70">
          USDC auto-funds XLM if needed, adds a trustline via Freighter, then mints 100 {ASSET_SYMBOL}{" "}
          (needs the backend faucet — set <code>NEXT_PUBLIC_DELIVERY_URL</code>).
        </p>

        <div className="border-t border-white/5 pt-4">
          <Row label="Sepolia ETH (EVM)">
            {isConnected ? (
              <Button disabled={busy} onClick={onEth} className="h-9 text-xs">
                Get 0.005 ETH
              </Button>
            ) : (
              <ConnectButton label="Connect EVM" />
            )}
          </Row>
          <p className="text-[11px] text-muted-foreground/70 mt-2">
            Sends 0.005 Sepolia ETH to your connected EVM wallet (gas + native locking for the bridge).
          </p>
        </div>
      </div>
    </WalletScaffold>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-white/3 border border-white/5 px-4 py-3">
      <span className="text-sm text-foreground/80">{label}</span>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
