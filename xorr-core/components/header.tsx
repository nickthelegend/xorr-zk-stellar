"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { ConnectWalletButton } from "@/components/wallet/connect-wallet-button"
import { SignInButton } from "@/components/auth/sign-in-button"
import {
  Send, QrCode, ArrowDownToLine, ArrowUpFromLine, Gift, ArrowRightLeft,
  Layers, Cable, ShieldCheck, FileCheck, Banknote, Droplets, LayoutDashboard,
  type LucideIcon,
} from "lucide-react"

type Item = { href: string; title: string; desc: string; icon: LucideIcon }
type Menu = { label: string; items: Item[]; featured?: { href: string; title: string; desc: string } }

const MENUS: Menu[] = [
  {
    label: "Pay",
    items: [
      { href: "/send", title: "Send", desc: "Pay by email, handle, or address", icon: Send },
      { href: "/receive", title: "Receive", desc: "Your shielded address & QR", icon: QrCode },
      { href: "/deposit", title: "Deposit", desc: "Shield USDC into private notes", icon: ArrowDownToLine },
      { href: "/withdraw", title: "Withdraw", desc: "Unshield to any account", icon: ArrowUpFromLine },
      { href: "/claim", title: "Claim", desc: "Claim a payment sent to you", icon: Gift },
    ],
  },
  {
    label: "Trade",
    items: [
      { href: "/swap", title: "Swap", desc: "AMM swaps — public or ZK-private", icon: ArrowRightLeft },
      { href: "/pools", title: "Pools", desc: "Create & seed liquidity pools", icon: Layers },
      { href: "/bridge", title: "Bridge", desc: "Ethereum → private xUSDC", icon: Cable },
    ],
    featured: { href: "/swap", title: "ZK Private Swap", desc: "Spend a shielded note through the AMM — no on-chain link to you." },
  },
  {
    label: "Privacy",
    items: [
      { href: "/solvency", title: "Proof of Solvency", desc: "Prove funds ≥ a threshold, amount hidden", icon: ShieldCheck },
      { href: "/compliance", title: "Compliance", desc: "Selective disclosure to an auditor", icon: FileCheck },
      { href: "/offramp", title: "Off-ramp", desc: "Private fiat remittance corridor", icon: Banknote },
      { href: "/faucet", title: "Faucet", desc: "Grab testnet USDC to try it", icon: Droplets },
    ],
  },
]

const isActive = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname.startsWith(href)

export function AppHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState<string | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navRef = useRef<HTMLElement>(null)

  const enter = (label: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setOpen(label)
  }
  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setOpen(null), 140)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null)
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  // Close the menu whenever the route changes.
  useEffect(() => { setOpen(null) }, [pathname])

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#070b12]/85 backdrop-blur-xl">
      <div className="flex w-full items-center gap-4 px-6 py-3">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Image src="/logo.png" alt="XORR" width={92} height={24} className="h-6 w-auto" priority />
        </Link>

        {/* Desktop mega-nav */}
        <nav ref={navRef} className="hidden md:flex flex-1 items-center gap-1" onMouseLeave={scheduleClose}>
          <Link
            href="/"
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-medium transition-colors flex items-center gap-1.5",
              isActive(pathname, "/") ? "text-primary" : "text-foreground/70 hover:text-foreground",
            )}
          >
            <LayoutDashboard className="size-4" /> Home
          </Link>

          {MENUS.map((menu) => {
            const menuActive = menu.items.some((i) => isActive(pathname, i.href))
            const isOpen = open === menu.label
            return (
              <div key={menu.label} className="relative" onMouseEnter={() => enter(menu.label)}>
                <button
                  onClick={() => setOpen(isOpen ? null : menu.label)}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-medium transition-colors flex items-center gap-1",
                    isOpen || menuActive ? "text-primary" : "text-foreground/70 hover:text-foreground",
                  )}
                  aria-expanded={isOpen}
                >
                  {menu.label}
                  <svg className={cn("size-3 transition-transform", isOpen && "rotate-180")} viewBox="0 0 12 12" fill="none">
                    <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {isOpen && (
                  <div className="absolute left-0 top-full pt-2 z-50 animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 duration-150">
                    <div
                      className={cn(
                        "rounded-2xl border border-white/12 bg-[#0b1118] p-2",
                        "shadow-[0_30px_70px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/5",
                        menu.featured ? "grid grid-cols-[1fr_220px] gap-2 w-[560px]" : "w-[340px]",
                      )}
                    >
                      <div className="flex flex-col gap-0.5">
                        {menu.items.map((item) => {
                          const active = isActive(pathname, item.href)
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={cn(
                                "flex items-start gap-3 rounded-xl p-2.5 transition-colors group",
                                active ? "bg-primary/10" : "hover:bg-white/5",
                              )}
                            >
                              <span className="size-9 rounded-lg bg-primary/10 border border-primary/20 grid place-items-center text-primary shrink-0 group-hover:bg-primary/20 transition-colors">
                                <item.icon className="size-4" />
                              </span>
                              <span className="min-w-0">
                                <span className="block text-sm font-medium text-foreground">{item.title}</span>
                                <span className="block text-xs text-muted-foreground leading-snug">{item.desc}</span>
                              </span>
                            </Link>
                          )
                        })}
                      </div>

                      {menu.featured && (
                        <Link
                          href={menu.featured.href}
                          className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/15 via-primary/5 to-[#7c4dff]/15 p-4 flex flex-col justify-end group"
                        >
                          <div className="absolute inset-0 opacity-30 group-hover:opacity-50 transition-opacity"
                            style={{ background: "radial-gradient(120px 120px at 70% 20%, rgba(166,242,74,0.5), transparent 70%)" }} />
                          <ShieldCheck className="size-6 text-primary mb-auto relative" />
                          <div className="relative mt-3">
                            <div className="text-sm font-semibold text-foreground">{menu.featured.title}</div>
                            <div className="text-xs text-muted-foreground mt-1 leading-snug">{menu.featured.desc}</div>
                          </div>
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        <div className="flex flex-1 md:flex-none items-center justify-end gap-2 shrink-0">
          <SignInButton />
          <ConnectWalletButton />
        </div>
      </div>

      {/* Mobile: compact scrolling row of every destination */}
      <nav className="md:hidden flex items-center gap-1 overflow-x-auto no-scrollbar px-4 pb-2">
        {[{ href: "/", title: "Home" }, ...MENUS.flatMap((m) => m.items)].map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs whitespace-nowrap shrink-0",
              isActive(pathname, n.href) ? "bg-primary text-black font-semibold" : "text-foreground/60 bg-white/5",
            )}
          >
            {n.title}
          </Link>
        ))}
      </nav>
    </header>
  )
}
