"use client";
import { ArrowUpRight, BookOpen, Github, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { links } from "@/lib/links";

const ease = [0.25, 0.1, 0.25, 1] as const;

export default function FollowAlong() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
          className="text-3xl sm:text-[40px] font-semibold tracking-tight leading-tight mb-12 text-white"
        >
          Dig in.
        </motion.h2>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 mb-4">
          <motion.a
            href={links.github}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease }}
            className="sm:col-span-3 flex flex-col justify-between p-7 rounded-2xl border border-white/[0.08] transition-all hover:border-white/[0.16] min-h-[160px] group relative overflow-hidden"
          >
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full blur-3xl opacity-50" style={{ background: "radial-gradient(circle, rgba(168,85,247,0.30), transparent 70%)" }} />
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-2.5"><Github className="w-5 h-5 text-gray-300" /><h4 className="font-semibold text-white text-base">Open source</h4></div>
              <ArrowUpRight className="w-4 h-4 text-gray-600 group-hover:text-gray-300 transition-colors shrink-0" />
            </div>
            <p className="text-sm text-gray-400 leading-relaxed mt-auto pt-8 relative z-10">The full monorepo — Soroban contracts, Circom circuits, the relayer/keeper, and the wallet app.</p>
          </motion.a>

          <motion.a
            href={links.docs}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease }}
            className="sm:col-span-2 flex flex-col justify-between p-7 rounded-2xl bg-[#161616] border border-white/[0.04] transition-all hover:border-white/[0.1] group min-h-[160px]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5"><BookOpen className="w-5 h-5 text-gray-400" /><h4 className="font-semibold text-white text-base">Docs</h4></div>
              <ArrowUpRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors shrink-0" />
            </div>
            <p className="text-sm text-gray-400 leading-relaxed mt-auto pt-8">The note scheme, public-signal layouts, and the bridge + lending design.</p>
          </motion.a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <motion.a
            href={links.markets}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25, ease }}
            className="flex flex-col justify-between p-7 rounded-2xl bg-[#161616] border border-white/[0.04] transition-all hover:border-white/[0.1] group min-h-[150px]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5"><TrendingUp className="w-5 h-5 text-gray-400" /><h4 className="font-semibold text-white text-base">Live markets</h4></div>
              <ArrowUpRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors shrink-0" />
            </div>
            <p className="text-sm text-gray-400 leading-relaxed mt-auto pt-8">Browse the on-chain money market — supply/borrow APYs, TVL, and live oracle prices.</p>
          </motion.a>

          <motion.a
            href={links.x}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease }}
            className="flex flex-col justify-between p-7 rounded-2xl bg-[#161616] border border-white/[0.04] transition-all hover:border-white/[0.1] group min-h-[150px]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <svg className="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                <h4 className="font-semibold text-white text-base">X / Twitter</h4>
              </div>
              <ArrowUpRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors shrink-0" />
            </div>
            <p className="text-sm text-gray-400 leading-relaxed mt-auto pt-8">Follow along for protocol updates and ZK research.</p>
          </motion.a>
        </div>
      </div>
    </section>
  );
}
