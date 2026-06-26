"use client";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { links } from "@/lib/links";

const ease = [0.25, 0.1, 0.25, 1] as const;

export default function TokenBanner() {
  return (
    <section className="py-16 px-6">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease }}
        className="max-w-6xl mx-auto"
      >
        <div className="relative rounded-[28px] overflow-hidden border border-white/10 gradient-card-dark p-10 sm:p-14 min-h-[300px] flex flex-col justify-center">
          <div className="absolute -right-10 -top-10 h-72 w-72 rounded-full blur-3xl pointer-events-none" style={{ background: "radial-gradient(circle, rgba(168,85,247,0.40), transparent 70%)" }} />
          <div className="absolute -left-20 bottom-0 h-64 w-64 rounded-full blur-3xl pointer-events-none" style={{ background: "radial-gradient(circle, rgba(99,102,241,0.25), transparent 70%)" }} />
          <div className="relative z-10 max-w-md">
            <span className="inline-block text-[11px] font-mono uppercase tracking-widest text-[#e2a9f1] mb-4">the shielded asset</span>
            <h3 className="text-4xl sm:text-5xl font-semibold text-white mb-5 tracking-tight">xUSDC</h3>
            <p className="text-gray-300 leading-relaxed mb-8 text-base">
              USDC held privately inside XORR. Backed 1:1 by USDC on Stellar, it lives as a hidden Poseidon
              note and is spent with a zero-knowledge proof — no public account ever links your payments.
            </p>
            <a href={links.deposit} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2.5 px-7 py-3.5 text-gray-900 text-sm font-semibold rounded-full hover:opacity-90 transition-all hover:-translate-y-0.5 active:translate-y-0" style={{ backgroundColor: "#e2a9f1" }}>
              Shield USDC <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
