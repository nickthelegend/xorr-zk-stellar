"use client"

import { useState, useRef, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { ChevronDown, ArrowUpRight, Menu, X } from "lucide-react"
import { motion, AnimatePresence, LayoutGroup } from "framer-motion"
import { ConnectWalletButton } from "@/components/wallet/connect-wallet-button"
import { SignInButton } from "@/components/auth/sign-in-button"

// --- Data ---------------------------------------------------------------

type MenuItem = { name: string; desc: string; href: string; badge?: string; colors: string[] }

const pay: MenuItem[] = [
  { name: "Send", desc: "Pay an email, handle, or address privately", href: "/send", colors: ["#a78bfa", "#7c3aed", "#c4b5fd"] },
  { name: "Receive", desc: "Your shielded address + QR", href: "/receive", colors: ["#e2a9f1", "#a855f7", "#f0abfc"] },
  { name: "Claim", desc: "Claim a payment someone sent you", href: "/claim", colors: ["#86efac", "#16a34a", "#bbf7d0"] },
  { name: "Deposit", desc: "Shield public USDC into notes", href: "/deposit", colors: ["#818cf8", "#4f46e5", "#a5b4fc"] },
  { name: "Withdraw", desc: "Unshield to a public account", href: "/withdraw", colors: ["#fbbf24", "#d97706", "#fde68a"] },
]

const trade: MenuItem[] = [
  { name: "Swap", desc: "AMM swaps + ZK private swap", href: "/swap", colors: ["#67e8f9", "#0891b2", "#a5f3fc"] },
  { name: "Pools", desc: "Create pools & provide liquidity", href: "/pools", colors: ["#60a5fa", "#2563eb", "#bfdbfe"] },
  { name: "Bridge", desc: "Ethereum USDC → private xUSDC", href: "/bridge", colors: ["#c084fc", "#9333ea", "#e9d5ff"] },
  { name: "Off-ramp", desc: "Private fiat off-ramp corridor", href: "/offramp", colors: ["#34d399", "#059669", "#a7f3d0"] },
]

const privacy: MenuItem[] = [
  { name: "Proof of Solvency", desc: "Prove balance ≥ threshold, amount hidden", href: "/solvency", colors: ["#f472b6", "#db2777", "#fbcfe8"] },
  { name: "Compliance", desc: "Selective disclosure to an auditor", href: "/compliance", colors: ["#a78bfa", "#7c3aed", "#c4b5fd"] },
  { name: "Faucet", desc: "Get testnet USDC / ETH", href: "/faucet", colors: ["#38bdf8", "#0284c7", "#bae6fd"] },
]

const tabs = ["Pay", "Trade", "Privacy"] as const
type Tab = (typeof tabs)[number]

function getItems(tab: Tab): MenuItem[] {
  switch (tab) {
    case "Pay": return pay
    case "Trade": return trade
    case "Privacy": return privacy
  }
}

const isActive = (p: string, href: string) => (href === "/" ? p === "/" : p.startsWith(href))

// --- Spring configs -----------------------------------------------------

const springBouncy = { type: "spring" as const, stiffness: 350, damping: 20, mass: 0.7 }
const springSnappy = { type: "spring" as const, stiffness: 400, damping: 28 }

// --- Abstract visual ----------------------------------------------------

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
      <motion.div
        className="absolute rounded-full"
        style={{ width: "70%", height: "70%", background: colors[1], right: "-10%", bottom: "-10%" }}
        initial={{ scale: 0.5, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 0.7, y: 0 }}
        transition={{ ...springBouncy, delay: 0.04 }}
      />
      <motion.div
        className="absolute rounded-full"
        style={{ width: "45%", height: "45%", background: colors[2], right: "5%", bottom: "5%" }}
        initial={{ scale: 0.3, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 0.6, y: 0 }}
        transition={{ ...springBouncy, delay: 0.08 }}
      />
      <motion.div
        className="absolute"
        style={{ width: "40%", height: "100%", background: `linear-gradient(180deg, ${colors[1]}88, ${colors[2]}44)`, left: "30%", top: 0 }}
        initial={{ opacity: 0, x: -30, scaleY: 0.8 }}
        animate={{ opacity: 0.5, x: 0, scaleY: 1 }}
        transition={{ ...springSnappy, delay: 0.06 }}
      />
    </motion.div>
  )
}

// --- Nav item -----------------------------------------------------------

function NavItem({
  item,
  layoutScope,
  isHovered,
  onHover,
}: {
  item: MenuItem
  layoutScope: string
  isHovered: boolean
  onHover: () => void
}) {
  return (
    <Link
      href={item.href}
      className="relative flex items-center justify-between px-4 py-3 rounded-xl group"
      onMouseEnter={onHover}
    >
      {isHovered && (
        <motion.div
          layoutId={`nav-highlight-${layoutScope}`}
          className="absolute inset-0 bg-white/[0.06] rounded-xl"
          transition={springSnappy}
        />
      )}
      <div className="min-w-0 relative z-10">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">{item.name}</span>
          {item.badge && (
            <span className="text-[10px] font-bold bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded-md">
              {item.badge}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
      </div>
      <ArrowUpRight className="w-3.5 h-3.5 text-gray-600 shrink-0 ml-3 relative z-10" />
    </Link>
  )
}

// --- Dropdown content ---------------------------------------------------

function DropdownContent({ tab, hoveredIdx, setHoveredIdx }: { tab: Tab; hoveredIdx: number; setHoveredIdx: (i: number) => void }) {
  const allItems = getItems(tab)
  const activeColors = allItems[hoveredIdx]?.colors ?? allItems[0]?.colors ?? ["#333", "#555", "#777"]

  return (
    <motion.div
      key={tab}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: "spring", stiffness: 500, damping: 35 }}
      className="flex rounded-2xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.6)] border border-white/10 bg-[#1a1a1a] overflow-hidden"
      style={{ width: allItems.length > 3 ? 580 : 520 }}
    >
      {/* left: menu items */}
      <LayoutGroup id={tab}>
        <div className="flex-1 py-4 px-2 min-w-0">
          {allItems.map((item, idx) => (
            <NavItem
              key={item.name}
              item={item}
              layoutScope={tab}
              isHovered={hoveredIdx === idx}
              onHover={() => setHoveredIdx(idx)}
            />
          ))}
        </div>
      </LayoutGroup>

      {/* right: animated visual */}
      <div className="w-[220px] p-3 shrink-0">
        <AnimatePresence mode="wait">
          <PanelVisual key={`${tab}-${hoveredIdx}`} colors={activeColors} />
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// --- Main header --------------------------------------------------------

export function AppHeader() {
  const pathname = usePathname()
  const [activeTab, setActiveTab] = useState<Tab | null>(null)
  const [hoveredIdx, setHoveredIdx] = useState(0)
  const [mobileOpen, setMobileOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleTabEnter = useCallback((tab: Tab) => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setActiveTab((prev) => {
      if (prev !== tab) setHoveredIdx(0)
      return tab
    })
  }, [])

  const handleLeave = useCallback(() => {
    closeTimer.current = setTimeout(() => setActiveTab(null), 200)
  }, [])

  const handlePanelEnter = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }, [])

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#101010]/70 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Image src="/logo.png" alt="XORR" width={96} height={28} className="h-7 w-auto" priority />
        </Link>

        {/* Desktop nav — single container for tabs + dropdown */}
        <div className="hidden md:flex flex-col items-center relative">
          <div className="flex items-center gap-0.5" onMouseLeave={handleLeave}>
            <Link
              href="/"
              onMouseEnter={() => { if (closeTimer.current) clearTimeout(closeTimer.current); setActiveTab(null) }}
              className={`px-4 py-2 text-sm font-medium rounded-full transition-colors duration-150 ${
                isActive(pathname, "/") ? "text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              Dashboard
            </Link>
            {tabs.map((tab) => {
              const groupActive = getItems(tab).some((it) => isActive(pathname, it.href))
              return (
                <button
                  key={tab}
                  onMouseEnter={() => handleTabEnter(tab)}
                  className={`relative flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full transition-colors duration-150 ${
                    activeTab === tab || groupActive ? "text-white" : "text-gray-400 hover:text-white"
                  }`}
                >
                  {activeTab === tab && (
                    <motion.div
                      layoutId="tab-pill"
                      className="absolute inset-0 bg-white/10 rounded-full"
                      transition={springSnappy}
                    />
                  )}
                  <span className="relative z-10">{tab}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 relative z-10 transition-transform duration-200 ${activeTab === tab ? "rotate-180" : ""}`}
                  />
                </button>
              )
            })}
          </div>

          {/* Dropdown panel — shared across all tabs */}
          <AnimatePresence>
            {activeTab && (
              <div
                className="absolute top-full pt-3 z-50"
                onMouseEnter={handlePanelEnter}
                onMouseLeave={handleLeave}
              >
                <AnimatePresence mode="wait">
                  <DropdownContent
                    key={activeTab}
                    tab={activeTab}
                    hoveredIdx={hoveredIdx}
                    setHoveredIdx={setHoveredIdx}
                  />
                </AnimatePresence>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Right: auth + wallet (where Ghost puts "Launch App") */}
        <div className="hidden md:flex items-center gap-2">
          <SignInButton />
          <ConnectWalletButton />
        </div>

        {/* Mobile toggle */}
        <button onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu" className="md:hidden p-2 text-gray-400">
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden bg-[#1a1a1a] border-t border-white/[0.06] overflow-hidden"
          >
            <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
              <Link href="/" onClick={() => setMobileOpen(false)} className="block text-sm font-semibold py-1.5 text-white">
                Dashboard
              </Link>
              {tabs.map((tab) => (
                <div key={tab}>
                  <div className="text-[10px] uppercase tracking-[0.2em] font-semibold text-gray-500 mb-1.5">{tab}</div>
                  <div className="space-y-0.5">
                    {getItems(tab).map((it) => (
                      <Link
                        key={it.href}
                        href={it.href}
                        onClick={() => setMobileOpen(false)}
                        className={`block text-sm py-1.5 ${isActive(pathname, it.href) ? "text-white" : "text-gray-400"}`}
                      >
                        {it.name}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex flex-col gap-2 pt-3 border-t border-white/[0.06]">
                <SignInButton />
                <ConnectWalletButton />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}
