"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { motion, type Variants } from "framer-motion";

// Shared scroll-reveal for each paginated section.
const reveal: Variants = {
  hidden: { opacity: 0, y: 60 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};
const sectionMotion = {
  variants: reveal,
  initial: "hidden" as const,
  whileInView: "show" as const,
  viewport: { once: false, amount: 0.2 },
};

export default function Home() {
  // Simulated on-chain verify latency (ms) for the prover sandbox.
  const [latency, setLatency] = useState(28);
  const [promptInput, setPromptInput] = useState("prove transfer --in=2 --out=2 --amount=hidden");
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    "SYS // LOADING POSEIDON + GROTH16 WASM...",
    "SYS // BN254 PROVING KEY LOADED (transfer.zkey)",
    "SYS // MERKLE TREE SYNCED — ROOT 0x1c484cca…",
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  // Pipeline pulse index for the bento "proving" visual.
  const [activeBar, setActiveBar] = useState(3);

  // Dynamic system status pulse
  useEffect(() => {
    const interval = setInterval(() => {
      setLatency(prev => {
        const change = (Math.random() - 0.5) * 6;
        const next = Math.round(prev + change);
        return next > 18 && next < 40 ? next : prev;
      });
      setActiveBar(prev => (prev + 1) % 6);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const handleTerminalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim() || isProcessing) return;

    setIsProcessing(true);
    const newLogs = [...terminalLogs, `> ${promptInput}`];
    setTerminalLogs(newLogs);
    setPromptInput("");

    setTimeout(() => {
      setTerminalLogs(prev => [
        ...prev,
        "WITNESS GENERATED // 32k R1CS CONSTRAINTS",
        "✔ GROTH16 PROOF GENERATED — amounts never left the browser",
        `✔ VERIFIED ON-CHAIN — pairing_check = true (${latency}ms)`,
      ]);
      setIsProcessing(false);
    }, 1200);
  };

  return (
    <div className="relative min-h-screen bg-[#0c0c0c] text-[#ebebeb] overflow-x-hidden selection:bg-lime-accent selection:text-black">

      {/* Decorative Radial Glowing Spheres */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-lime-accent/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-emerald-glow/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/2 right-10 w-[300px] h-[300px] bg-lime-accent/10 rounded-full blur-[100px] pointer-events-none animate-pulse-slow" />

      {/* Floating Shell Container */}
      <div className="relative w-full bg-[#0c0c0c] overflow-hidden flex flex-col min-h-screen">

        {/* Subtle grid pattern background */}
        <div className="absolute inset-0 bg-grid pointer-events-none opacity-80" />

        {/* Grainy Noise Overlay */}
        <div className="absolute inset-0 bg-noise pointer-events-none" />

        <Header />

        {/* Hero Section */}
        <motion.section {...sectionMotion} className="relative z-10 pt-16 pb-20 snap-start min-h-screen">
          <div className="w-full max-w-7xl mx-auto flex flex-col items-center text-center">
            {/* Top Badge */}
            <div className="flex justify-center mb-8">
              <span className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-[rgba(204,255,0,0.3)] bg-[rgba(204,255,0,0.05)] text-[#CCFF00] text-xs font-mono font-semibold uppercase tracking-wider shadow-[0_0_20px_rgba(204,255,0,0.15)] backdrop-blur-md">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-pulse-ring absolute inline-flex h-full w-full rounded-full bg-[#CCFF00] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#CCFF00]"></span>
                </span>
                Stellar Hacks: Real-World ZK · Built on Soroban
              </span>
            </div>

            {/* H1 Heading */}
            <h1 className="font-sans font-extrabold text-4xl sm:text-6xl md:text-7xl xl:text-[5.5rem] tracking-[-0.05em] leading-[1.05] text-[#ebebeb] max-w-5xl mb-6 mx-auto">
              Shielded by default. <br />
              <span className="italic bg-gradient-to-r from-lime-accent via-emerald-glow to-white bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(204,255,0,0.3)]">
                Proven on Stellar.
              </span>
            </h1>

            {/* Subheadline */}
            <p className="font-sans text-white/60 text-lg md:text-xl max-w-2xl mb-10 leading-relaxed mx-auto">
              Shield public USDC into a constellation of unlinkable UTXO notes, pay privately with amounts and counterparties hidden, and prove every spend in zero knowledge — verified on-chain by a BN254 Groth16 contract on Soroban. Private, <span className="italic text-white/80">not</span> anonymous.
            </p>

            {/* Two CTAs Side-by-Side */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 w-full sm:w-auto">
              <Link
                href={process.env.NEXT_PUBLIC_APP_URL || "https://app.xorr.finance"}
                className="relative group overflow-hidden bg-lime-accent text-black font-sans font-black text-sm py-4 px-8 rounded-full shadow-[0_0_35px_rgba(204,255,0,0.35)] hover:scale-105 active:scale-95 hover:shadow-[0_0_45px_rgba(204,255,0,0.5)] transition-all duration-300 flex items-center justify-center"
              >
                <span className="absolute inset-0 bg-white transform translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                <span className="relative z-10 flex items-center gap-2">
                  Open the Wallet <span className="font-sans font-normal">→</span>
                </span>
              </Link>
              <a href="#methodology" className="inline-flex items-center justify-center font-sans font-semibold rounded-full px-8 py-4 border border-white/10 backdrop-blur-md bg-white/3 hover:bg-white/7 text-white text-sm transition-all duration-300">
                How It Works
              </a>
            </div>

            {/* App dashboard preview with premium hardware shell */}
            <div className="relative w-full max-w-[1240px] mx-auto group mt-4 md:mt-6 z-10">
              {/* Soft Ambient glowing backlight behind the mockup */}
              <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[70%] h-[70%] bg-lime-accent/10 rounded-full blur-[140px] pointer-events-none animate-pulse-slow" />
              <div className="absolute bottom-4 left-1/3 w-[50%] h-[50%] bg-emerald-glow/8 rounded-full blur-[120px] pointer-events-none" />

              {/* Premium outer device panel */}
              <div className="glass-panel rounded-[2rem] p-3 shadow-[0_0_80px_rgba(0,0,0,0.9)] relative overflow-hidden border border-white/10 transition-all duration-500 hover:border-lime-accent/20">
                {/* Internal window control header */}
                <div className="flex items-center justify-between px-6 py-3 bg-[#0a0a0a]/50 border-b border-white/5 font-mono text-[10px] text-white/40 tracking-wider">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
                    <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
                    <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
                  </div>
                  <span>XORR // SHIELDED_WALLET</span>
                  <span className="text-lime-accent font-bold">SHIELDED SESSION</span>
                </div>

                {/* Live shielded-wallet mock */}
                <WalletPreview />
              </div>
            </div>
          </div>
        </motion.section>

        {/* Bento Grid Features */}
        <motion.section id="features" {...sectionMotion} className="relative z-10 py-16 border-t border-white/5 snap-start min-h-screen flex flex-col justify-center">
          <div className="w-full max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
              <div>
                <span className="font-mono text-[10px] tracking-[0.25em] text-lime-accent uppercase bg-lime-accent/10 border border-lime-accent/20 px-3.5 py-1.5 rounded-full">
                  PRIVATE BY ARCHITECTURE
                </span>
                <h2 className="font-sans font-bold text-3xl md:text-5xl tracking-tight text-[#ebebeb] mt-4 leading-tight">
                  Money that moves without being seen
                </h2>
              </div>
              <p className="font-sans text-white/50 text-sm md:text-base max-w-xl leading-relaxed">
                Every balance is a Poseidon commitment, every spend an unlinkable nullifier. The circuits do all the hashing; the Soroban contract only verifies a Groth16 proof and keeps the books. Your amounts, counterparties, and balances never hit the public ledger.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

              {/* Shielded notes + ZK proving Card (2x2) */}
              <div className="md:col-span-2 md:row-span-2 glass-panel rounded-[2.5rem] p-8 shadow-lg flex flex-col justify-between hover:border-lime-accent/40 transition-colors duration-300 group min-h-[440px]">
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="font-mono text-[10px] tracking-[0.2em] text-lime-accent uppercase px-3 py-1 bg-lime-accent/10 border border-lime-accent/20 rounded-full font-bold">
                      SHIELDED UTXO NOTES
                    </span>
                    <span className="font-mono text-[11px] text-white/30">ZK // 2x2</span>
                  </div>
                  <h3 className="font-sans font-bold text-2xl md:text-3xl text-white tracking-tight leading-snug">
                    Your balance, hidden in plain sight.
                  </h3>
                  <p className="font-sans text-white/60 text-sm mt-3 max-w-md leading-relaxed">
                    A single master key derives a constellation of unlinkable notes — <code className="text-lime-accent font-mono text-xs">commitment = Poseidon(amount, pk, blinding)</code>. Only commitments enter the Merkle tree; spends reveal nothing but a one-time nullifier. A Groth16 proof, generated in your browser, is verified on-chain by Stellar&rsquo;s BN254 host functions.
                  </p>
                </div>

                {/* Proving pipeline visual */}
                <div className="mt-8 p-4 bg-[#0a0a0a]/50 rounded-2xl border border-white/5 relative overflow-hidden flex flex-col gap-4">
                  <div className="flex justify-between items-center gap-2 relative z-10">
                    {["Deposit", "Commit", "Prove", "Verify", "Insert", "Spend"].map((agent, i) => (
                      <div
                        key={agent}
                        className={`flex-1 p-2 rounded-xl text-center font-mono text-[10px] border transition-all duration-300 ${
                          activeBar === i % 6
                            ? "bg-lime-accent text-black border-lime-accent shadow-[0_0_15px_rgba(204,255,0,0.4)] font-bold scale-105"
                            : "bg-white/3 text-white/40 border-white/5"
                        }`}
                      >
                        {agent}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center bg-white/3 rounded-xl p-3 border border-white/5 relative z-10">
                    <span className="font-mono text-[9px] text-white/40">VERIFIER STATUS</span>
                    <span className="font-mono text-[10px] text-lime-accent font-bold animate-pulse">
                      ✦ pairing_check = true · BN254 GROTH16
                    </span>
                  </div>
                </div>
              </div>

              {/* Private payments Card (1x2) */}
              <div className="md:row-span-2 glass-panel rounded-[2.5rem] p-8 shadow-lg flex flex-col justify-between hover:border-lime-accent/40 transition-colors duration-300 group min-h-[440px]">
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="font-mono text-[10px] tracking-[0.2em] text-emerald-glow uppercase px-3 py-1 bg-emerald-glow/10 border border-emerald-glow/20 rounded-full font-bold">
                      PRIVATE PAYMENTS
                    </span>
                    <span className="font-mono text-[11px] text-white/30">STEALTH</span>
                  </div>
                  <h3 className="font-sans font-bold text-2xl text-white tracking-tight leading-tight">
                    Pay without an audience.
                  </h3>
                  <p className="font-sans text-white/60 text-xs mt-3 leading-relaxed">
                    A 2-in / 2-out transfer mints a fresh stealth note for the recipient and delivers the encrypted opening to their view key. Their reusable address never appears on-chain — every received note is unlinkable.
                  </p>
                </div>

                {/* Privacy guarantee swatches */}
                <div className="space-y-2.5 mt-6">
                  {[
                    { name: "Amounts", status: "HIDDEN", color: "text-emerald-glow" },
                    { name: "Sender ↔ Receiver", status: "UNLINKED", color: "text-emerald-glow" },
                    { name: "Nullifiers", status: "ONE-TIME", color: "text-emerald-glow" },
                    { name: "Value conservation", status: "IN-CIRCUIT", color: "text-emerald-glow" },
                  ].map((rule, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white/3 border border-white/5">
                      <span className="text-[11px] font-sans text-white/80">{rule.name}</span>
                      <span className={`font-mono text-[10px] font-bold ${rule.color}`}>{rule.status}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ETH→Stellar bridge Card (1x1) */}
              <div className="glass-panel rounded-[2.5rem] p-8 shadow-lg flex flex-col justify-between hover:border-lime-accent/40 transition-colors duration-300 group min-h-[210px]">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] tracking-[0.2em] text-white/40 uppercase">ETH → STELLAR BRIDGE</span>
                  </div>
                  <h4 className="font-sans font-bold text-lg text-white mt-4 leading-tight">Bridge ETH, arrive shielded</h4>
                  <p className="font-sans text-white/50 text-xs leading-relaxed mt-2">
                    Lock ETH on Sepolia; a ZK proof mints a hidden note on Stellar, fully backed by bridge liquidity. Replayed nonces rejected.
                  </p>
                </div>
                <div className="mt-4 p-2.5 rounded-lg bg-white/3 border border-white/5">
                  <code className="text-[10px] text-lime-accent font-mono">bridge.bridge_in(proof)</code>
                </div>
              </div>

              {/* Compliance Card (1x1, lime) */}
              <div className="relative overflow-hidden bg-lime-accent rounded-[2.5rem] p-8 shadow-lg flex flex-col justify-between hover:scale-[1.02] transition-transform duration-300 group min-h-[210px]">
                {/* Noise overlay */}
                <div className="absolute inset-0 bg-noise opacity-30 pointer-events-none" />

                <div className="relative z-10">
                  <span className="font-mono text-[9px] font-bold text-black/50 tracking-[0.2em] uppercase">VIEW-KEY COMPLIANCE</span>
                  <h3 className="font-sans font-black text-xl text-black tracking-tight leading-tight mt-4">
                    PRIVATE, NOT ANONYMOUS. DISCLOSE WHEN YOU CHOOSE.
                  </h3>
                </div>

                <div className="relative z-10 flex items-center justify-between mt-4 border-t border-black/10 pt-3">
                  <span className="font-mono text-[10px] font-bold text-black">Built on Stellar</span>
                  <span className="text-black text-xl font-bold font-sans">→</span>
                </div>
              </div>

            </div>
          </div>
        </motion.section>

        {/* Interactive Prover Sandbox Section */}
        <motion.section id="terminal" {...sectionMotion} className="relative z-10 py-16 border-t border-white/5 snap-start min-h-screen flex flex-col justify-center">
          <div className="w-full max-w-7xl mx-auto">
            <div className="max-w-4xl mx-auto flex flex-col items-center text-center mb-12">
              <span className="font-mono text-[10px] tracking-[0.25em] text-lime-accent uppercase bg-lime-accent/10 border border-lime-accent/20 px-3.5 py-1.5 rounded-full mb-4">
                ZK SANDBOX
              </span>
              <h2 className="font-sans font-bold text-3xl md:text-5xl tracking-tight text-[#ebebeb]">
                Generate a zero-knowledge proof
              </h2>
              <p className="font-sans text-white/50 text-sm md:text-base mt-3 max-w-xl">
                Spend two notes for two outputs. The witness and Groth16 proof are built in the browser — amounts and counterparties never leave it. Only an unlinkable nullifier and a verified proof reach the chain.
              </p>
            </div>

            <div className="max-w-3xl mx-auto relative">
              {/* Soft background glow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] h-[70%] bg-lime-accent/5 rounded-full blur-[100px] pointer-events-none" />

              <div className="relative w-full aspect-[16/10] sm:aspect-[16/9] glass-panel rounded-[2rem] p-6 shadow-2xl flex flex-col overflow-hidden">
                {/* Header inside Mockup */}
                <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4 font-mono text-[9px] tracking-widest text-white/40">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-lime-accent" />
                  </div>
                  <span>PROVER_SESSION // BN254_GROTH16</span>
                  <span>VERIFY // {latency}ms</span>
                </div>

                {/* Console logs */}
                <div className="flex-1 font-mono text-xs text-white/80 space-y-2 overflow-y-auto pr-1 flex flex-col justify-end">
                  {terminalLogs.map((log, idx) => (
                    <div key={idx} className={`${log.startsWith(">") ? "text-lime-accent font-semibold" : "text-white/60"}`}>
                      {log}
                    </div>
                  ))}
                  {isProcessing && (
                    <div className="text-lime-accent flex items-center gap-1.5 animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-lime-accent animate-ping" />
                      GENERATING WITNESS + PROOF...
                    </div>
                  )}
                </div>

                {/* Form Input inside Mockup */}
                <form onSubmit={handleTerminalSubmit} className="mt-4 border-t border-white/5 pt-4 flex gap-2">
                  <span className="font-mono text-lime-accent text-sm select-none">&gt;</span>
                  <input
                    type="text"
                    value={promptInput}
                    onChange={(e) => setPromptInput(e.target.value)}
                    disabled={isProcessing}
                    placeholder="prove transfer --in=2 --out=2 --amount=hidden"
                    className="flex-1 font-mono text-xs bg-transparent border-none outline-none text-white placeholder-white/20 select-text"
                  />
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="font-mono text-[10px] font-bold text-black bg-lime-accent px-3 py-1.5 rounded-md hover:bg-lime-accent/80 transition-colors"
                  >
                    PROVE
                  </button>
                </form>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Contrast Methodology Section */}
        <motion.section id="methodology" {...sectionMotion} className="relative bg-[#e5e5e5] text-black rounded-t-[4.5rem] pt-20 pb-16 mt-16 transition-all duration-500 snap-start min-h-screen">
          <div className="w-full max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

              {/* Left Side: Text and Numbered List */}
              <div className="lg:col-span-7 flex flex-col items-start text-left">
                <span className="font-mono text-[10px] tracking-[0.3em] text-black/40 uppercase bg-black/5 px-3.5 py-1.5 rounded-full mb-6 font-bold">
                  XORR / HOW IT WORKS
                </span>

                <h2 className="font-sans font-bold text-4xl md:text-6xl tracking-tight text-black mb-8 leading-[0.95]">
                  Shield. Send. <br />
                  Prove.
                </h2>

                <p className="font-sans text-black/70 text-base md:text-lg max-w-xl mb-12 leading-relaxed">
                  Three steps, zero exposure. Public USDC becomes a private note, moves with its amount and counterparty hidden, and every spend is settled by a proof the whole network can check but no one can read.
                </p>

                {/* Numbered List in circles */}
                <div className="space-y-6 w-full max-w-xl">
                  {[
                    { num: "01", title: "Shield your USDC", desc: "Deposit public USDC into the pool. A ZK proof binds the secret amount to a fresh note — only a Poseidon commitment is published on-chain." },
                    { num: "02", title: "Send privately", desc: "Spend your notes to pay anyone. Amounts and the sender↔receiver link stay hidden; the encrypted note opening is delivered only to the recipient." },
                    { num: "03", title: "Prove — or disclose", desc: "Every spend is verified on-chain by a BN254 Groth16 contract. When compliance calls, hand an auditor a view key to reveal your own notes — and nothing else." },
                  ].map((item, idx) => (
                    <div key={idx} className="flex gap-5 items-start">
                      <div className="w-12 h-12 rounded-full border border-black/10 flex items-center justify-center font-mono font-bold text-sm bg-black/5 text-black shrink-0 shadow-sm">
                        {item.num}
                      </div>
                      <div>
                        <h4 className="font-sans font-bold text-lg text-black">{item.title}</h4>
                        <p className="font-sans text-black/60 text-sm mt-1.5 leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Side: Greyscale Circular Portrait & Overlay Card */}
              <div className="lg:col-span-5 flex justify-center items-center relative py-12">
                {/* Decorative background visual element */}
                <div className="absolute w-[360px] h-[360px] rounded-full border border-black/5 animate-spin-slow pointer-events-none" />

                {/* Main Circle Portrait Wrapper */}
                <div className="relative w-[340px] h-[340px] md:w-[380px] md:h-[380px] rounded-full overflow-hidden border-2 border-white shadow-2xl bg-black">
                  <Image
                    src="/cyber_pioneer.png"
                    alt="Zero-knowledge privacy on Stellar"
                    fill
                    className="object-cover object-center grayscale hover:grayscale-0 transition-all duration-700 hover:scale-105"
                  />
                </div>

                {/* Glassmorphism Card Overlay */}
                <div className="absolute -bottom-4 left-4 right-4 md:-left-6 md:right-8 bg-black/60 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-2xl flex flex-col gap-3 transition-transform duration-300 hover:translate-y-[-5px]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-sans font-black text-sm text-lime-accent">ZERO-KNOWLEDGE</span>
                      <span className="font-mono text-[8px] text-white/40 tracking-wider">BN254_GROTH16</span>
                    </div>
                    <span className="text-lime-accent text-xs">✦✦✦✦✦</span>
                  </div>

                  <p className="font-sans text-xs text-white/80 leading-relaxed italic">
                    &ldquo;Alice pays Bob 5 USDC. The chain records a new commitment and a spent nullifier — no amount, no addresses, no link. Bob scans, decrypts, and spends it. The proof verifies in ~28ms on Soroban.&rdquo;
                  </p>

                  <div className="flex items-center justify-between border-t border-white/10 pt-3 font-mono text-[8px] text-white/40">
                    <span>AMOUNTS: HIDDEN</span>
                    <span>PROOF: ON-CHAIN</span>
                  </div>
                </div>

              </div>

            </div>
          </div>
        </motion.section>

        {/* Footer section */}
        <Footer />

      </div>
    </div>
  );
}

/* ── Live shielded-wallet preview (replaces the static screenshot) ───────── */
function WalletPreview() {
  const notes = [
    { amt: "12.50", leaf: 0, id: "0x4a91c…", active: true },
    { amt: "5.00", leaf: 1, id: "0x1c484…", active: true },
    { amt: "3.25", leaf: 2, id: "0x9f46c…", active: true },
    { amt: "8.00", leaf: 3, id: "0x7b3e2…", active: false },
  ];
  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-white/10 bg-[#0a0a0a] p-5 md:p-7 text-left">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Shielded balance */}
        <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between">
          <span className="font-mono text-[9px] tracking-[0.2em] text-white/40 uppercase">Shielded balance</span>
          <div className="mt-3">
            <div className="font-sans font-extrabold text-3xl md:text-4xl bg-gradient-to-r from-lime-accent to-emerald-glow bg-clip-text text-transparent tabular-nums">
              20.75
            </div>
            <span className="font-mono text-[10px] text-white/40">USDC · 3 private notes</span>
          </div>
        </div>
        {/* Constellation count */}
        <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between">
          <span className="font-mono text-[9px] tracking-[0.2em] text-white/40 uppercase">UTXO constellation</span>
          <div className="mt-3">
            <div className="font-sans font-extrabold text-3xl md:text-4xl text-white tabular-nums">4</div>
            <span className="font-mono text-[10px] text-white/40">3 active · 1 spent</span>
          </div>
        </div>
        {/* Live on-chain */}
        <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between">
          <span className="font-mono text-[9px] tracking-[0.2em] text-white/40 uppercase flex items-center gap-1.5">
            On-chain pool
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime-accent opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-lime-accent" />
            </span>
          </span>
          <div className="mt-3 space-y-1.5">
            <div className="flex justify-between"><span className="font-mono text-[10px] text-white/40">total shielded</span><span className="font-mono text-[10px] text-white/80">1,000.00</span></div>
            <div className="flex justify-between"><span className="font-mono text-[10px] text-white/40">merkle root</span><span className="font-mono text-[10px] text-lime-accent">0x1c484cca…</span></div>
          </div>
        </div>
      </div>

      {/* Notes constellation */}
      <div className="mt-4 glass-panel rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="font-sans font-semibold text-sm text-white">Your notes</span>
          <div className="flex gap-1.5">
            {["Deposit", "Send", "Bridge"].map((a) => (
              <span key={a} className="font-mono text-[9px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/60">{a}</span>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {notes.map((n, i) => (
            <div key={i} className={`relative rounded-xl border p-3.5 ${n.active ? "border-lime-accent/30 bg-lime-accent/5" : "border-white/5 bg-white/3 opacity-50"}`}>
              <span className={`absolute top-2.5 right-2.5 font-mono text-[8px] px-1.5 py-0.5 rounded-full ${n.active ? "bg-lime-accent/20 text-lime-accent" : "bg-white/10 text-white/40"}`}>
                {n.active ? "active" : "spent"}
              </span>
              <div className="font-sans font-bold text-lg text-white tabular-nums">{n.amt} <span className="text-[10px] text-white/40 font-mono">USDC</span></div>
              <div className="font-mono text-[9px] text-white/40 mt-1">leaf #{n.leaf}</div>
              <div className="font-mono text-[9px] text-white/30">{n.id}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
