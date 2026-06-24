"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { ConnectWalletButton } from "@/components/wallet/connect-wallet-button"
import { SignInButton } from "@/components/auth/sign-in-button"

const NAV = [
  { href: "/", label: "Home" },
  { href: "/deposit", label: "Deposit" },
  { href: "/send", label: "Send" },
  { href: "/receive", label: "Receive" },
  { href: "/swap", label: "Swap" },
  { href: "/pools", label: "Pools" },
  { href: "/bridge", label: "Bridge" },
  { href: "/claim", label: "Claim" },
  { href: "/withdraw", label: "Withdraw" },
  { href: "/offramp", label: "Off-ramp" },
  { href: "/solvency", label: "Solvency" },
]

export function AppHeader() {
  const pathname = usePathname()
  return (
    <header className="sticky top-0 z-40 w-full px-3 pt-3">
      <div className="mx-auto flex max-w-6xl items-center gap-4 rounded-2xl border border-white/10 bg-[#070b12]/80 px-4 py-2.5 backdrop-blur-xl">
        {/* Left: logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Image src="/logo.png" alt="XORR" width={92} height={24} className="h-6 w-auto" priority />
        </Link>

        {/* Center: a single, quiet nav row that scrolls on small screens */}
        <nav className="flex flex-1 items-center gap-0.5 overflow-x-auto no-scrollbar">
          {NAV.map((n) => {
            const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href)
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "rounded-lg px-2.5 py-1.5 text-sm whitespace-nowrap transition-colors",
                  active ? "bg-primary/15 text-primary font-medium" : "text-foreground/60 hover:text-foreground",
                )}
              >
                {n.label}
              </Link>
            )
          })}
        </nav>

        {/* Right: identity + Stellar wallet only (EVM connect lives in Bridge) */}
        <div className="flex items-center gap-2 shrink-0">
          <SignInButton />
          <ConnectWalletButton />
        </div>
      </div>
    </header>
  )
}
