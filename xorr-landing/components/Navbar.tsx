"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import { ChevronDown, ArrowUpRight, Menu, X } from "lucide-react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { links } from "@/lib/links";

// --- Data ---

type MenuItem = { name: string; desc: string; badge?: string; colors: string[]; link: string };

const products: { category: string; items: MenuItem[] }[] = [
  {
    category: "Spend & Receive",
    items: [
      { name: "Pay", desc: "Send a private payment by email or handle. Amounts + the sender↔receiver link stay hidden.", colors: ["#a78bfa", "#7c3aed", "#c4b5fd"], link: links.pay },
      { name: "Deposit", desc: "Shield public USDC into a fresh hidden note. The amount never appears on-chain.", colors: ["#818cf8", "#4f46e5", "#a5b4fc"], link: links.deposit },
    ],
  },
  {
    category: "Earn & Move",
    items: [
      { name: "Earn & Borrow", desc: "Supply to earn interest or borrow against collateral. Live oracle + auto-liquidations.", colors: ["#34d399", "#059669", "#a7f3d0"], link: links.lend },
      { name: "Bridge", desc: "Bring USDC from Ethereum into private xUSDC on Stellar — membership-verified on-chain.", colors: ["#67e8f9", "#0891b2", "#a5f3fc"], link: links.bridge },
    ],
  },
];

const resources: MenuItem[] = [
  { name: "GitHub", desc: "The full open-source monorepo — contracts, circuits, app.", colors: ["#a78bfa", "#7c3aed", "#c4b5fd"], link: links.github },
  { name: "Documentation", desc: "Protocol architecture, the ZK note scheme, and the bridge.", colors: ["#f472b6", "#db2777", "#fbcfe8"], link: links.docs },
  { name: "Markets", desc: "Browse the on-chain money market — supply/borrow APYs + TVL.", colors: ["#fbbf24", "#d97706", "#fde68a"], link: links.markets },
];

const tokens: MenuItem[] = [
  { name: "xUSDC", desc: "USDC held privately in XORR — shielded Poseidon notes, spent with ZK proofs.", colors: ["#a855f7", "#7c3aed", "#e9d5ff"], link: links.docs },
];

const tabs = ["Products", "Resources", "Tokens"] as const;
type Tab = (typeof tabs)[number];

function getItems(tab: Tab): MenuItem[] {
  switch (tab) {
    case "Products": return products.flatMap((g) => g.items);
    case "Resources": return resources;
    case "Tokens": return tokens;
  }
}

const springBouncy = { type: "spring" as const, stiffness: 350, damping: 20, mass: 0.7 };
const springSnappy = { type: "spring" as const, stiffness: 400, damping: 28 };

function PanelVisual({ colors }: { colors: string[] }) {
  return (
    <motion.div
      className="w-full h-full rounded-2xl overflow-hidden relative"
      style={{ background: colors[0] }}
      initial={{ opacity: 0, scale: 0.88, rotate: -3 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      exit={{ opacity: 0, scale: 0.88, rotate: 3 }}
      transition={springBouncy}
    >
      <motion.div className="absolute rounded-full" style={{ width: "70%", height: "70%", background: colors[1], right: "-10%", bottom: "-10%" }}
        initial={{ scale: 0.5, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 0.7, y: 0 }} transition={{ ...springBouncy, delay: 0.04 }} />
      <motion.div className="absolute rounded-full" style={{ width: "45%", height: "45%", background: colors[2], right: "5%", bottom: "5%" }}
        initial={{ scale: 0.3, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 0.6, y: 0 }} transition={{ ...springBouncy, delay: 0.08 }} />
      <motion.div className="absolute" style={{ width: "40%", height: "100%", background: `linear-gradient(180deg, ${colors[1]}88, ${colors[2]}44)`, left: "30%", top: 0 }}
        initial={{ opacity: 0, x: -30, scaleY: 0.8 }} animate={{ opacity: 0.5, x: 0, scaleY: 1 }} transition={{ ...springSnappy, delay: 0.06 }} />
    </motion.div>
  );
}

function NavItem({ item, layoutScope, isHovered, onHover }: { item: MenuItem; layoutScope: string; isHovered: boolean; onHover: () => void }) {
  return (
    <a href={item.link} target="_blank" rel="noopener noreferrer" className="relative flex items-center justify-between px-4 py-3 rounded-xl group" onMouseEnter={onHover}>
      {isHovered && <motion.div layoutId={`nav-highlight-${layoutScope}`} className="absolute inset-0 bg-white/[0.06] rounded-xl" transition={springSnappy} />}
      <div className="min-w-0 relative z-10">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">{item.name}</span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
      </div>
      <ArrowUpRight className="w-3.5 h-3.5 text-gray-600 shrink-0 ml-3 relative z-10" />
    </a>
  );
}

function DropdownContent({ tab, hoveredIdx, setHoveredIdx }: { tab: Tab; hoveredIdx: number; setHoveredIdx: (i: number) => void }) {
  const allItems = getItems(tab);
  const activeColors = allItems[hoveredIdx]?.colors ?? allItems[0]?.colors ?? ["#333", "#555", "#777"];

  return (
    <motion.div
      key={tab}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      transition={{ type: "spring", stiffness: 500, damping: 35 }}
      className="flex rounded-2xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.6)] border border-white/10 bg-[#1a1a1a] overflow-hidden"
      style={{ width: allItems.length > 3 ? 580 : 520 }}
    >
      <LayoutGroup id={tab}>
        <div className="flex-1 py-4 px-2 min-w-0">
          {tab === "Products"
            ? products.map((group, gi) => {
                const allFlat = getItems("Products");
                return (
                  <div key={group.category}>
                    {gi > 0 && <div className="h-px bg-white/5 mx-3 my-2" />}
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 px-4 mb-1 mt-1">{group.category}</p>
                    {group.items.map((item) => {
                      const globalIdx = allFlat.findIndex((i) => i.name === item.name);
                      return <NavItem key={item.name} item={item} layoutScope={tab} isHovered={hoveredIdx === globalIdx} onHover={() => setHoveredIdx(globalIdx)} />;
                    })}
                  </div>
                );
              })
            : allItems.map((item, idx) => (
                <NavItem key={item.name} item={item} layoutScope={tab} isHovered={hoveredIdx === idx} onHover={() => setHoveredIdx(idx)} />
              ))}
        </div>
      </LayoutGroup>
      <div className="w-[220px] p-3 shrink-0">
        <AnimatePresence mode="wait">
          <PanelVisual key={`${tab}-${hoveredIdx}`} colors={activeColors} />
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function Wordmark() {
  return <Image src="/logo.png" alt="XORR" width={92} height={28} className="h-7 w-auto select-none" priority />;
}

export default function Navbar() {
  const [activeTab, setActiveTab] = useState<Tab | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTabEnter = useCallback((tab: Tab) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setActiveTab((prev) => { if (prev !== tab) setHoveredIdx(0); return tab; });
  }, []);
  const handleLeave = useCallback(() => { closeTimer.current = setTimeout(() => setActiveTab(null), 200); }, []);
  const handlePanelEnter = useCallback(() => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-transparent backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2"><Wordmark /></a>

        <div className="hidden md:flex flex-col items-center relative">
          <div className="flex items-center gap-0.5" onMouseLeave={handleLeave}>
            {tabs.map((tab) => (
              <button key={tab} onMouseEnter={() => handleTabEnter(tab)}
                className={`relative flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full transition-colors duration-150 ${activeTab === tab ? "text-white" : "text-gray-400 hover:text-white"}`}>
                {activeTab === tab && <motion.div layoutId="tab-pill" className="absolute inset-0 bg-white/10 rounded-full" transition={springSnappy} />}
                <span className="relative z-10">{tab}</span>
                <ChevronDown className={`w-3.5 h-3.5 relative z-10 transition-transform duration-200 ${activeTab === tab ? "rotate-180" : ""}`} />
              </button>
            ))}
            <a href={links.github} target="_blank" rel="noopener noreferrer"
              onMouseEnter={() => { if (closeTimer.current) clearTimeout(closeTimer.current); setActiveTab(null); }}
              className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white rounded-full transition-colors duration-150">GitHub</a>
          </div>

          <AnimatePresence>
            {activeTab && (
              <div className="absolute top-full pt-3 z-50" onMouseEnter={handlePanelEnter} onMouseLeave={handleLeave}>
                <AnimatePresence mode="wait">
                  <DropdownContent key={activeTab} tab={activeTab} hoveredIdx={hoveredIdx} setHoveredIdx={setHoveredIdx} />
                </AnimatePresence>
              </div>
            )}
          </AnimatePresence>
        </div>

        <a href={links.app} target="_blank" rel="noopener noreferrer" className="hidden md:block px-5 py-2 text-gray-900 text-sm font-semibold rounded-full hover:opacity-90 transition-opacity" style={{ backgroundColor: "#e2a9f1" }}>
          Launch App
        </a>

        <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 text-gray-400">
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            className="md:hidden bg-[#1a1a1a] border-t border-white/[0.06] overflow-hidden">
            <div className="p-6 space-y-2">
              {getItems("Products").map((i) => (
                <a key={i.name} href={i.link} target="_blank" rel="noopener noreferrer" className="block text-sm font-medium py-2 text-gray-300">{i.name}</a>
              ))}
              <a href={links.github} target="_blank" rel="noopener noreferrer" className="block text-sm font-medium py-2 text-gray-400">GitHub</a>
              <a href={links.app} target="_blank" rel="noopener noreferrer" className="block w-full mt-2 px-5 py-2.5 text-gray-900 text-sm font-semibold rounded-full text-center" style={{ backgroundColor: "#e2a9f1" }}>Launch App</a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
