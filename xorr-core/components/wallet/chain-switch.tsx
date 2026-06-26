"use client";

// Sepolia network guard for the EVM side of the ETH→Stellar bridge. The EVM
// wallet (MetaMask/Rabby via the injected connector) is only used to lock funds
// on Sepolia, so if it's pointed at any other network the bridge can't work.
// This header pill surfaces the wallet's current chain and, when it's wrong,
// switches it back to Sepolia in one click. It renders nothing until an EVM
// wallet is connected (there's no chain to guard before then).
import { useEffect, useState } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";
import { toast } from "sonner";

export function ChainSwitch() {
  const [mounted, setMounted] = useState(false);
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();

  useEffect(() => setMounted(true), []);
  if (!mounted || !isConnected) return null;

  const onSepolia = chainId === sepolia.id;

  if (onSepolia) {
    return (
      <div
        title="EVM bridge network — Sepolia"
        className="hidden sm:flex items-center gap-1.5 h-9 rounded-lg px-3 bg-white/5 border border-white/10 text-gray-300 font-mono text-[10px] tracking-widest uppercase select-none"
      >
        <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
        Sepolia
      </div>
    );
  }

  return (
    <button
      onClick={() =>
        switchChain(
          { chainId: sepolia.id },
          { onError: (e) => toast.error("Couldn't switch network", { description: e.message.slice(0, 140) }) },
        )
      }
      disabled={isPending}
      title="Your wallet is on the wrong network for the bridge — switch to Sepolia"
      className="flex items-center gap-1.5 h-9 rounded-lg px-3 bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 font-mono text-[10px] tracking-widest uppercase transition-colors disabled:opacity-60"
    >
      <span className="size-1.5 rounded-full bg-amber-400" />
      {isPending ? "Switching…" : "Switch to Sepolia"}
    </button>
  );
}
