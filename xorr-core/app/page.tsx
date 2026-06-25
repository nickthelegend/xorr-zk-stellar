"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useWallet } from "@/components/stellar-wallet-provider";
import { SegmentedControl } from "@/components/app/segmented-tabs";
import { PayReceive } from "@/components/flows/pay-receive";
import { SwapForm } from "@/components/flows/swap-form";
import { BridgeForm } from "@/components/flows/bridge-form";
import { DepositForm } from "@/components/flows/deposit-form";

const TABS = ["Deposit", "Pay", "Swap", "Bridge"] as const;
type Tab = (typeof TABS)[number];

const FORMS: Record<Tab, React.ComponentType> = {
  Pay: PayReceive,
  Swap: SwapForm,
  Bridge: BridgeForm,
  Deposit: DepositForm,
};

const META: Record<Tab, { title: string; desc: string }> = {
  Pay: {
    title: "Pay & Receive",
    desc: "Send a private payment, or share your shielded address to get paid. Amounts and the sender↔receiver link stay hidden on-chain.",
  },
  Swap: {
    title: "Swap",
    desc: "Swap tokens on a Soroban AMM. Choose Public for a standard swap, or Private (ZK) to spend from your shielded balance with no on-chain link to your trade.",
  },
  Bridge: {
    title: "Bridge to xUSDC",
    desc: "Bridge USDC from Ethereum into private xUSDC on Stellar using a Groth16 proof — no on-chain link between deposit and claim.",
  },
  Deposit: {
    title: "Deposit",
    desc: "Shield public USDC into a fresh hidden note. Every spend is later proven in zero knowledge — the amount itself never appears on-chain.",
  },
};

const QUERY_TO_TAB: Record<string, Tab> = {
  pay: "Pay",
  receive: "Pay",
  swap: "Swap",
  bridge: "Bridge",
  deposit: "Deposit",
};

export default function HomePage() {
  const { ready } = useWallet();
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>(QUERY_TO_TAB[params.get("tab") ?? ""] ?? "Deposit");

  const onChange = (t: string) => {
    const next = t as Tab;
    setTab(next);
    router.replace(`/?tab=${next.toLowerCase()}`, { scroll: false });
  };

  if (!ready) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative size-10">
            <span className="absolute inset-0 rounded-full border-2 border-primary/20" />
            <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
          </div>
          <span className="text-muted-foreground font-mono text-xs tracking-wide">
            initializing zero-knowledge wallet…
          </span>
        </div>
      </div>
    );
  }

  // Guard against a stale/unknown tab (e.g. a bookmarked ?tab=swap after the
  // swap→lend rename) so an invalid value can never crash the page.
  const safeTab: Tab = TABS.includes(tab) ? tab : "Deposit";
  const m = META[safeTab];
  const ActiveForm = FORMS[safeTab];

  return (
    <div className="w-full max-w-xl mx-auto pt-4 pb-10 space-y-6">
      <SegmentedControl tabs={[...TABS]} value={tab} onChange={onChange} />

      <motion.div
        key={tab}
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
        className="space-y-6"
      >
        <div className="space-y-2">
          <h1 className="text-2xl font-medium text-foreground">{m.title}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">{m.desc}</p>
        </div>
        <ActiveForm />
      </motion.div>
    </div>
  );
}
