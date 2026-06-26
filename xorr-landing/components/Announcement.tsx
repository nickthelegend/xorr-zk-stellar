"use client";
import { ArrowUpRight, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { links } from "@/lib/links";

const ease = [0.25, 0.1, 0.25, 1] as const;

export default function Announcement() {
  return (
    <section className="py-16 px-6">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease }}
        className="max-w-6xl mx-auto"
      >
        <a
          href={links.docs}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col sm:flex-row items-start sm:items-center gap-8 sm:gap-12 bg-[#161616] border border-white/[0.06] rounded-3xl p-8 sm:px-10 sm:py-8 hover:border-white/[0.12] transition-all duration-300 group cursor-pointer overflow-hidden relative"
        >
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full blur-3xl pointer-events-none opacity-60" style={{ background: "radial-gradient(circle, rgba(168,85,247,0.35), transparent 70%)" }} />
          <div className="flex-1 min-w-0 relative z-10">
            <h3 className="text-xl sm:text-2xl font-semibold text-white flex items-center gap-2.5 mb-2">
              The privacy is real — not mocked
              <ArrowUpRight className="w-5 h-5 text-gray-500 group-hover:text-white transition-colors duration-300 shrink-0" />
            </h3>
            <p className="text-sm text-gray-400 leading-relaxed max-w-md">
              A real BN254 Groth16 verifier on Soroban enforces every spend. Tampered proofs return
              <code className="mx-1 text-[#e2a9f1]">InvalidProof</code>. Amounts, senders, and balances stay hidden on-chain — with a view key for selective disclosure.
            </p>
          </div>
          <div className="shrink-0 relative z-10 grid place-items-center h-28 w-28 rounded-3xl border border-white/10" style={{ background: "linear-gradient(135deg,#1a1030,#12121a)" }}>
            <Lock className="w-10 h-10" style={{ color: "#e2a9f1" }} />
          </div>
        </a>
      </motion.div>
    </section>
  );
}
