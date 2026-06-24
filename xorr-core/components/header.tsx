"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { ConnectWalletButton } from "@/components/wallet/connect-wallet-button"
import { SignInButton } from "@/components/auth/sign-in-button"

// Primary consumer flows stay visible; everything else lives under "More".
const PRIMARY = [
  { href: "/", label: "Home" },
  { href: "/send", label: "Send" },
  { href: "/swap", label: "Swap" },
  { href: "/bridge", label: "Bridge" },
  { href: "/claim", label: "Claim" },
]
const MORE = [
  { href: "/deposit", label: "Deposit" },
  { href: "/receive", label: "Receive" },
  { href: "/withdraw", label: "Withdraw" },
  { href: "/pools", label: "Pools" },
  { href: "/offramp", label: "Off-ramp" },
  { href: "/solvency", label: "Solvency" },
  { href: "/compliance", label: "Compliance" },
  { href: "/faucet", label: "Faucet" },
]

const isActive = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname.startsWith(href)

export function AppHeader() {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!moreOpen) return
    const close = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [moreOpen])

  const linkCls = (active: boolean) =>
    cn(
      "rounded-lg px-3 py-1.5 text-sm whitespace-nowrap transition-colors",
      active ? "bg-primary/15 text-primary font-medium" : "text-foreground/60 hover:text-foreground hover:bg-white/5",
    )
  const moreActive = MORE.some((m) => isActive(pathname, m.href))

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#070b12]/90 backdrop-blur-xl">
      <div className="flex w-full items-center gap-4 px-6 py-3">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Image src="/logo.png" alt="XORR" width={92} height={24} className="h-6 w-auto" priority />
        </Link>

        <nav className="hidden md:flex flex-1 items-center gap-1">
          {PRIMARY.map((n) => (
            <Link key={n.href} href={n.href} className={linkCls(isActive(pathname, n.href))}>
              {n.label}
            </Link>
          ))}

          {/* More dropdown */}
          <div className="relative" ref={moreRef}>
            <button
              onClick={() => setMoreOpen((o) => !o)}
              className={cn(linkCls(moreActive), "flex items-center gap-1")}
            >
              More <span className="text-[10px] opacity-70">▾</span>
            </button>
            {moreOpen && (
              <div className="absolute left-0 mt-2 w-44 rounded-xl border border-white/10 bg-[#070b12] p-1.5 shadow-xl z-50">
                {MORE.map((n) => (
                  <Link
                    key={n.href}
                    href={n.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "block rounded-lg px-3 py-1.5 text-sm transition-colors",
                      isActive(pathname, n.href) ? "bg-primary/15 text-primary" : "text-foreground/70 hover:bg-white/5",
                    )}
                  >
                    {n.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="flex flex-1 md:flex-none items-center justify-end gap-2 shrink-0">
          <SignInButton />
          <ConnectWalletButton />
        </div>
      </div>

      {/* Mobile: compact scrolling row of all destinations */}
      <nav className="md:hidden flex items-center gap-1 overflow-x-auto no-scrollbar px-4 pb-2">
        {[...PRIMARY, ...MORE].map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={cn(
              "rounded-lg px-2.5 py-1 text-xs whitespace-nowrap shrink-0",
              isActive(pathname, n.href) ? "bg-primary text-black font-semibold" : "text-foreground/60 bg-white/5",
            )}
          >
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  )
}
