"use client";

import { ArrowUpRight, ShieldCheck, BadgeCheck, ArrowLeftRight, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { links } from "@/lib/links";

const ease = [0.25, 0.1, 0.25, 1] as const;

type Feature = { title: string; desc: string; icon: LucideIcon; grad: string; link: string };

const features: Feature[] = [
  {
    title: "Shielded notes",
    desc: "Balances live as Poseidon commitments in a Merkle tree. The amount itself never touches the chain — only an unlinkable nullifier on spend.",
    icon: ShieldCheck,
    grad: "linear-gradient(135deg,#a855f7,#7c3aed)",
    link: links.deposit,
  },
  {
    title: "Proven on-chain",
    desc: "Every transfer is a Groth16 proof verified by a real BN254 pairing on Soroban (CAP-0074). No trusted operator — the contract is the judge.",
    icon: BadgeCheck,
    grad: "linear-gradient(135deg,#6366f1,#4338ca)",
    link: links.docs,
  },
  {
    title: "Two-way ZK bridge",
    desc: "Lock USDC on Ethereum → mint private xUSDC on Stellar, gated by an on-chain deposit-tree membership proof. Burn on Stellar → release real USDC back.",
    icon: ArrowLeftRight,
    grad: "linear-gradient(135deg,#06b6d4,#0e7490)",
    link: links.bridge,
  },
  {
    title: "Earn & borrow",
    desc: "A Compound-style money market: supply to earn, borrow against collateral, utilization-based rates, a live oracle, and automated on-chain liquidations.",
    icon: TrendingUp,
    grad: "linear-gradient(135deg,#34d399,#059669)",
    link: links.lend,
  },
];

export default function Features() {
  return (
    <section className="pt-12 pb-24 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
          className="text-3xl sm:text-[40px] font-semibold tracking-tight leading-tight mb-3 text-white"
        >
          How XORR works.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease }}
          className="text-gray-400 mb-14 max-w-lg text-sm leading-relaxed"
        >
          Real zero-knowledge primitives — Poseidon commitments, BN254 Groth16, and a privacy pool — wired into payments, a bridge, and a money market.
        </motion.p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.a
                key={f.title}
                href={f.link}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 + i * 0.1, ease }}
                className="feature-card rounded-[20px] bg-[#161616] border border-white/[0.06] hover:border-white/[0.12] transition-all hover-lift group cursor-pointer overflow-hidden flex flex-col"
              >
                <div className="relative aspect-[16/7] overflow-hidden p-5">
                  <div className="w-full h-full rounded-2xl border border-white/[0.08] overflow-hidden flex items-center justify-center relative" style={{ background: f.grad }}>
                    <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.4), transparent 50%)" }} />
                    <Icon className="w-12 h-12 text-white relative z-10 transition-transform duration-300 group-hover:scale-110" />
                  </div>
                </div>
                <div className="p-6 pt-3 pb-7">
                  <div className="flex items-center justify-between mb-2.5">
                    <h3 className="text-lg font-semibold text-white">{f.title}</h3>
                    <ArrowUpRight className="w-5 h-5 text-gray-500 group-hover:text-white transition-colors shrink-0" />
                  </div>
                  <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
                </div>
              </motion.a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
