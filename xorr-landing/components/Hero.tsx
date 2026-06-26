"use client";
import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { links } from "@/lib/links";

const ease = [0.25, 0.1, 0.25, 1] as const;

export default function Hero() {
  return (
    <section className="relative min-h-[92vh] overflow-hidden gradient-hero flex items-center justify-center">
      {/* Aurora blobs */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="aurora absolute -top-32 left-1/4 h-[520px] w-[520px] rounded-full blur-3xl" style={{ background: "radial-gradient(circle, rgba(168,85,247,0.30), transparent 65%)" }} />
        <div className="aurora absolute top-20 right-1/5 h-[420px] w-[420px] rounded-full blur-3xl" style={{ background: "radial-gradient(circle, rgba(99,102,241,0.22), transparent 65%)", animationDelay: "-5s" }} />
        <div className="aurora absolute bottom-0 left-1/3 h-[400px] w-[400px] rounded-full blur-3xl" style={{ background: "radial-gradient(circle, rgba(226,169,241,0.18), transparent 65%)", animationDelay: "-9s" }} />
      </div>
      {/* Fade to page bg at the bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-[300px] z-[1]" style={{ background: "linear-gradient(to top, #101010 0%, #10101099 50%, transparent 100%)" }} />

      <div className="relative z-[2] flex flex-col items-center text-center px-6 max-w-4xl mx-auto pt-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs text-white/70 mb-7"
        >
          <ShieldCheck className="w-3.5 h-3.5" style={{ color: "#e2a9f1" }} />
          Zero-knowledge USDC, live on Stellar testnet
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1, ease }}
          className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.05]"
        >
          Private by default.
          <br />
          <span style={{ background: "linear-gradient(120deg,#e2a9f1,#a855f7 55%,#7c3aed)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
            Verifiable by design.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.25, ease }}
          className="mt-6 max-w-xl text-base sm:text-lg text-gray-400 leading-relaxed"
        >
          XORR is a zero-knowledge wallet for USDC on Stellar. Shield your balance, pay anyone privately,
          bridge from Ethereum, and earn or borrow — every spend proven in zero knowledge and verified on-chain.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.4, ease }}
          className="mt-9 flex flex-col sm:flex-row items-center gap-3"
        >
          <a href={links.app} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-7 py-3.5 text-gray-900 text-sm font-semibold rounded-full hover:opacity-90 transition-opacity" style={{ backgroundColor: "#e2a9f1" }}>
            Launch App <ArrowRight className="w-4 h-4" />
          </a>
          <a href={links.github} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold rounded-full border border-white/15 text-white hover:bg-white/[0.06] transition-colors">
            View on GitHub
          </a>
        </motion.div>

        {/* Stat chips */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.55, ease }}
          className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-2xl"
        >
          {[
            { v: "BN254", k: "Groth16 ZK" },
            { v: "Soroban", k: "on-chain verify" },
            { v: "2-way", k: "ETH ↔ Stellar bridge" },
            { v: "5.4% APY", k: "lend & borrow" },
          ].map((s) => (
            <div key={s.k} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3.5 text-center backdrop-blur-sm">
              <div className="text-base font-semibold text-white">{s.v}</div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500 mt-0.5">{s.k}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
