"use client"

import { Shield, Github } from "lucide-react"
import { useWallet } from "@/components/stellar-wallet-provider"
import { NETWORK } from "@/lib/config"

export function AppFooter() {
  const { chain } = useWallet()

  return (
    <footer className="w-full flex flex-col md:flex-row justify-between items-center py-6 px-2 md:px-4 border-t border-white/5 gap-6 opacity-50 font-mono">
      <div className="flex items-center gap-6 flex-wrap justify-center">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em]">
          <span className="w-1 h-1 bg-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(166,242,74,0.8)]" />
          XORR_PROTOCOL: ACTIVE
        </div>
        <div className="text-[10px] flex items-center gap-1.5 font-bold uppercase tracking-[0.2em]">
          <Shield className="w-3 h-3" />
          BN254_GROTH16 // SOROBAN_{NETWORK.toUpperCase()}
        </div>
        {chain && (
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] hidden lg:block">
            ROOT: {chain.root.slice(0, 10)}…
          </div>
        )}
      </div>
      <div className="flex gap-6 items-center">
        <span className="text-[10px] font-bold uppercase tracking-widest">Testnet · not audited</span>
        <a
          href="https://github.com/nickthelegend"
          target="_blank"
          rel="noreferrer"
          className="hover:text-primary transition-colors flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest"
        >
          <Github className="w-3 h-3" /> Source
        </a>
      </div>
    </footer>
  )
}
