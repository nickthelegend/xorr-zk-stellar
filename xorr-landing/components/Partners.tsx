"use client";
import { motion } from "framer-motion";

const ease = [0.25, 0.1, 0.25, 1] as const;

const Dot = ({ c }: { c: string }) => <span className="inline-block w-4 h-4 rounded-md" style={{ background: c }} />;

const partners: { name: string; logo: React.ReactNode }[] = [
  { name: "Stellar", logo: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11" stroke="#fff" strokeWidth="1.4"/><path d="M5 9.5 19 14M5 14l14-4.5" stroke="#fff" strokeWidth="1.4" strokeLinecap="round"/></svg>
  ) },
  { name: "Soroban", logo: <Dot c="#a855f7" /> },
  { name: "Ethereum", logo: (
    <svg className="w-5 h-5" viewBox="0 0 32 32" fill="none"><path d="M16 2l-.2.7v18.2l.2.2 8.5-5L16 2z" fill="#627EEA" opacity="0.6"/><path d="M16 2 7.5 16.1l8.5 5V2z" fill="#627EEA"/><path d="M16 22.9l-.1.1v6.5l.1.3 8.5-12L16 22.9z" fill="#627EEA" opacity="0.6"/><path d="M16 29.8v-6.9l-8.5-5 8.5 11.9z" fill="#627EEA"/></svg>
  ) },
  { name: "Circom", logo: <Dot c="#34d399" /> },
  { name: "snarkjs", logo: <Dot c="#f472b6" /> },
  { name: "Groth16 · BN254", logo: <Dot c="#6366f1" /> },
  { name: "Poseidon", logo: <Dot c="#e2a9f1" /> },
  { name: "USDC", logo: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11" fill="#2775CA"/><path d="M12 6v1.2m0 9.6V18m-2.5-3.2c0 1 .9 1.6 2.5 1.6s2.5-.6 2.5-1.7c0-1-.7-1.4-2.5-1.8-1.6-.3-2.3-.7-2.3-1.6 0-1 .8-1.5 2.3-1.5s2.3.5 2.4 1.5" stroke="#fff" strokeWidth="1.1" strokeLinecap="round"/></svg>
  ) },
  { name: "Freighter", logo: <Dot c="#fbbf24" /> },
];

export default function Partners() {
  return (
    <section className="py-20 px-6">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease }}
        className="max-w-6xl mx-auto"
      >
        <h2 className="text-3xl sm:text-[40px] font-semibold tracking-tight leading-tight mb-2 text-white">Built on real cryptography.</h2>
        <p className="text-gray-400 text-base mb-10">The primitives and networks that make every spend private and verifiable.</p>

        <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
          <div className="flex items-center gap-x-12 animate-marquee w-max">
            {[...partners, ...partners, ...partners, ...partners].map((p, i) => (
              <div key={`${p.name}-${i}`} className="flex items-center gap-2.5 select-none shrink-0">
                {p.logo}
                <span className="text-sm font-semibold tracking-wide whitespace-nowrap text-gray-400">{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
