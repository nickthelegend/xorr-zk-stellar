"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { ConnectWalletButton } from "@/components/wallet/connect-wallet-button"
import { SignInButton } from "@/components/auth/sign-in-button"
import { MenuToggleIcon } from "@/components/ui/menu-toggle-icon"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuContent,
  NavigationMenuTrigger,
  NavigationMenuLink,
} from "@/components/ui/navigation-menu"
import {
  Send, QrCode, Gift, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight,
  Layers, Cable, Banknote, ShieldCheck, FileCheck, Droplets, type LucideIcon,
} from "lucide-react"

type Item = { href: string; title: string; desc: string; icon: LucideIcon }

const WALLET: Item[] = [
  { href: "/send", title: "Send", desc: "Pay an email, handle, or address privately", icon: Send },
  { href: "/receive", title: "Receive", desc: "Your shielded address + QR", icon: QrCode },
  { href: "/claim", title: "Claim", desc: "Claim a payment someone sent you", icon: Gift },
  { href: "/deposit", title: "Deposit", desc: "Shield public USDC into notes", icon: ArrowDownToLine },
  { href: "/withdraw", title: "Withdraw", desc: "Unshield to a public account", icon: ArrowUpFromLine },
]
const TRADE: Item[] = [
  { href: "/swap", title: "Swap", desc: "AMM swaps + ZK private swap", icon: ArrowLeftRight },
  { href: "/pools", title: "Pools", desc: "Create pools & provide liquidity", icon: Layers },
  { href: "/bridge", title: "Bridge", desc: "Ethereum USDC → private xUSDC", icon: Cable },
  { href: "/offramp", title: "Off-ramp", desc: "Private fiat off-ramp corridor", icon: Banknote },
]
const PRIVACY: Item[] = [
  { href: "/solvency", title: "Proof of Solvency", desc: "Prove balance ≥ threshold, amount hidden", icon: ShieldCheck },
  { href: "/compliance", title: "Compliance", desc: "Selective disclosure to an auditor", icon: FileCheck },
  { href: "/faucet", title: "Faucet", desc: "Get testnet USDC / ETH", icon: Droplets },
]
const GROUPS = [
  { label: "Pay", items: WALLET },
  { label: "Trade", items: TRADE },
  { label: "Privacy", items: PRIVACY },
]

const isActive = (p: string, href: string) => (href === "/" ? p === "/" : p.startsWith(href))

export function AppHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#101010]/90 backdrop-blur-xl">
      <div className="flex w-full items-center gap-4 px-5 md:px-6 py-3">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Image src="/logo.png" alt="XORR" width={96} height={24} className="h-6 w-auto" priority />
        </Link>

        {/* Desktop grouped dropdowns */}
        <NavigationMenu viewport={false} className="hidden md:flex">
          <NavigationMenuList className="gap-0.5">
            <NavigationMenuItem>
              <NavigationMenuLink
                asChild
                className={cn(
                  "rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive(pathname, "/") ? "bg-primary/15 text-primary font-medium" : "text-foreground/70 hover:bg-white/5 hover:text-foreground",
                )}
              >
                <Link href="/">Dashboard</Link>
              </NavigationMenuLink>
            </NavigationMenuItem>

            {GROUPS.map((g) => {
              const groupActive = g.items.some((it) => isActive(pathname, it.href))
              return (
                <NavigationMenuItem key={g.label}>
                  <NavigationMenuTrigger
                    className={cn(
                      "bg-transparent h-auto px-3 py-2 text-sm hover:bg-white/5 data-[state=open]:bg-white/5 rounded-lg",
                      groupActive ? "text-primary" : "text-foreground/70",
                    )}
                  >
                    {g.label}
                  </NavigationMenuTrigger>
                  <NavigationMenuContent className="rounded-xl border border-white/10 bg-[#161616]/95 backdrop-blur-xl shadow-2xl p-2">
                    <ul className="grid w-[380px] gap-1">
                      {g.items.map((it) => (
                        <li key={it.href}>
                          <ListItem item={it} active={isActive(pathname, it.href)} />
                        </li>
                      ))}
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              )
            })}
          </NavigationMenuList>
        </NavigationMenu>

        {/* Right side */}
        <div className="flex flex-1 items-center justify-end gap-2">
          <div className="hidden sm:flex items-center gap-2">
            <SignInButton />
            <ConnectWalletButton />
          </div>
          {/* Mobile hamburger → side drawer */}
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
            aria-expanded={open}
            className="md:hidden grid place-items-center size-9 rounded-lg border border-white/10 text-foreground/80 hover:bg-white/5"
          >
            <MenuToggleIcon open={open} className="size-5" />
          </button>
        </div>
      </div>

      {/* Mobile side drawer */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[300px] bg-[#101010] border-white/10 p-0 flex flex-col">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex items-center gap-2 px-5 py-4 border-b border-white/10">
            <Image src="/logo.png" alt="XORR" width={88} height={22} className="h-5 w-auto" />
          </div>
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
            <DrawerLink href="/" label="Dashboard" active={isActive(pathname, "/")} onNavigate={() => setOpen(false)} />
            {GROUPS.map((g) => (
              <div key={g.label}>
                <div className="px-2 pb-1.5 text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">{g.label}</div>
                <div className="space-y-0.5">
                  {g.items.map((it) => (
                    <DrawerItem key={it.href} item={it} active={isActive(pathname, it.href)} onNavigate={() => setOpen(false)} />
                  ))}
                </div>
              </div>
            ))}
          </nav>
          <div className="border-t border-white/10 p-4 flex flex-col gap-2">
            <SignInButton />
            <ConnectWalletButton />
          </div>
        </SheetContent>
      </Sheet>
    </header>
  )
}

function ListItem({ item, active }: { item: Item; active: boolean }) {
  const Icon = item.icon
  return (
    <NavigationMenuLink
      asChild
      className={cn(
        "group/item flex flex-row items-center gap-3 rounded-xl p-2.5 transition-all duration-200 border border-transparent",
        active
          ? "bg-primary/12 border-primary/25"
          : "hover:bg-primary/10 hover:border-primary/20",
      )}
    >
      <Link href={item.href}>
        <span
          className={cn(
            "size-10 shrink-0 grid place-items-center rounded-lg border text-primary transition-colors",
            active
              ? "bg-primary/20 border-primary/40"
              : "bg-primary/10 border-primary/20 group-hover/item:bg-primary/20 group-hover/item:border-primary/40",
          )}
        >
          <Icon className="size-[18px]" />
        </span>
        <span className="flex flex-col min-w-0">
          <span className={cn("text-sm font-medium transition-colors", active ? "text-primary" : "text-foreground group-hover/item:text-primary")}>
            {item.title}
          </span>
          <span className="text-xs text-muted-foreground">{item.desc}</span>
        </span>
      </Link>
    </NavigationMenuLink>
  )
}

function DrawerItem({ item, active, onNavigate }: { item: Item; active: boolean; onNavigate: () => void }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-lg px-2 py-2 transition-colors",
        active ? "bg-primary/15 text-primary" : "text-foreground/80 hover:bg-white/5",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="text-sm font-medium">{item.title}</span>
    </Link>
  )
}

function DrawerLink({ href, label, active, onNavigate }: { href: string; label: string; active: boolean; onNavigate: () => void }) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium transition-colors",
        active ? "bg-primary/15 text-primary" : "text-foreground/80 hover:bg-white/5",
      )}
    >
      {label}
    </Link>
  )
}
