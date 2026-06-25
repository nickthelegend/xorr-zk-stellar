"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/components/stellar-wallet-provider";
import { SegmentedControl } from "@/components/app/segmented-tabs";
import { PayForm } from "@/components/flows/pay-form";
import { ReceivePanel } from "@/components/flows/receive-panel";
import { SwapForm } from "@/components/flows/swap-form";
import { BridgeForm } from "@/components/flows/bridge-form";

const TABS = ["Pay", "Receive", "Swap", "Bridge"] as const;
type Tab = (typeof TABS)[number];

const FORMS: Record<Tab, React.ComponentType> = {
  Pay: PayForm,
  Receive: ReceivePanel,
  Swap: SwapForm,
  Bridge: BridgeForm,
};

const META: Record<Tab, { title: string; desc: string }> = {
  Pay: {
    title: "Send privately",
    desc: "Pay by email, social handle, or shielded address. Amounts and the sender↔receiver link stay hidden on-chain.",
  },
  Receive: {
    title: "Receive",
    desc: "Share your shielded address to get paid privately. Every received note is unlinkable on-chain.",
  },
  Swap: {
    title: "Swap",
    desc: "Constant-product AMM on Soroban. Toggle ZK to spend from your shielded balance with no public account link.",
  },
  Bridge: {
    title: "Bridge to xUSDC",
    desc: "Bridge USDC from Ethereum into private xUSDC on Stellar using a Groth16 proof — no on-chain link between deposit and claim.",
  },
};

const QUERY_TO_TAB: Record<string, Tab> = { pay: "Pay", receive: "Receive", swap: "Swap", bridge: "Bridge" };

export default function HomePage() {
  const { ready } = useWallet();
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>(QUERY_TO_TAB[params.get("tab") ?? ""] ?? "Pay");

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

  const m = META[tab];
  const ActiveForm = FORMS[tab];

  return (
    <div className="w-full max-w-xl mx-auto pt-4 pb-10 space-y-6">
      <SegmentedControl tabs={[...TABS]} value={tab} onChange={onChange} />

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ y: 8, opacity: 0, filter: "blur(2px)" }}
          animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
          exit={{ y: -8, opacity: 0, filter: "blur(2px)" }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          className="space-y-6"
        >
          <div className="space-y-2">
            <h1 className="text-2xl font-medium text-foreground">{m.title}</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">{m.desc}</p>
          </div>
          <ActiveForm />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
