import Image from "next/image";
import { links } from "@/lib/links";

const cols: { title: string; items: { name: string; href: string }[] }[] = [
  { title: "Product", items: [
    { name: "Pay", href: links.pay }, { name: "Deposit", href: links.deposit },
    { name: "Earn & Borrow", href: links.lend }, { name: "Bridge", href: links.bridge },
  ] },
  { title: "Resources", items: [
    { name: "GitHub", href: links.github }, { name: "Docs", href: links.docs }, { name: "Markets", href: links.markets },
  ] },
  { title: "Protocol", items: [
    { name: "xUSDC", href: links.docs }, { name: "Launch App", href: links.app },
  ] },
];

export default function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-white/[0.06] mt-10">
      <div className="absolute -bottom-40 left-1/2 -translate-x-1/2 h-[420px] w-[820px] rounded-full blur-[120px] pointer-events-none" style={{ background: "radial-gradient(circle, rgba(168,85,247,0.22), transparent 70%)" }} />
      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-16 pb-10">
        <div className="flex flex-col md:flex-row justify-between gap-12">
          <div className="max-w-xs">
            <Image src="/logo.png" alt="XORR" width={105} height={32} className="h-8 w-auto select-none" />
            <p className="text-sm text-gray-500 mt-4 leading-relaxed">Private-by-default money on Stellar. Zero-knowledge USDC — shielded, verifiable, yours.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-10">
            {cols.map((c) => (
              <div key={c.title}>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">{c.title}</p>
                <ul className="space-y-2.5">
                  {c.items.map((it) => (
                    <li key={it.name}><a href={it.href} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-400 hover:text-white transition-colors">{it.name}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-14 pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-600">© {2026} XORR · Testnet · Not audited</p>
          <p className="text-xs text-gray-600 font-mono">BN254_GROTH16 // SOROBAN_TESTNET</p>
        </div>
      </div>
    </footer>
  );
}
