"use client";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { links } from "@/lib/links";

const ease = [0.25, 0.1, 0.25, 1] as const;

export default function CtaBanner() {
  return (
    <section className="py-24 px-6">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease }}
        className="max-w-6xl mx-auto flex flex-col lg:flex-row items-start justify-between gap-12"
      >
        <h2 className="text-4xl sm:text-5xl lg:text-[56px] font-semibold tracking-tight leading-[1.1] text-white max-w-xl">
          Money that&apos;s private by default
        </h2>
        <div className="max-w-md">
          <p className="text-gray-300 leading-relaxed mb-8 text-base">
            XORR keeps amounts, senders, and balances off-chain while a real zero-knowledge verifier
            enforces every rule. Spend, earn, bridge, and disclose on your terms.
          </p>
          <a href={links.app} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2.5 px-7 py-3.5 text-gray-900 text-sm font-semibold rounded-full hover:opacity-90 transition-all" style={{ backgroundColor: "#e2a9f1" }}>
            Launch the app <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </motion.div>
    </section>
  );
}
