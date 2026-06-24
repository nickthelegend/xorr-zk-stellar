"use client";

import React, { useRef, useEffect } from "react";
import Link from "next/link";
import { Logo } from "./logo";
import { gsap } from "gsap";
import { NavBar } from "@/components/ui/nav-bar";
import { APP_NAV_ITEMS } from "@/components/layout/nav-items";

export const Header = () => {
  const logoRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    // Initial load animation
    const logo = logoRef.current;

    if (logo) {
      gsap.fromTo(
        logo,
        { opacity: 0, x: -20 },
        { opacity: 1, x: 0, duration: 0.5, ease: "power3.out" },
      );
    }
  }, []);

  return (
    <header className="sticky top-0 w-full z-50 bg-[#111111] border-b border-[#2a2a2a]">
      <div className="relative max-w-7xl mx-auto px-6 py-4">
        <nav className="flex items-center gap-4">
          {/* Logo */}
          <Link
            href="/"
            ref={logoRef}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0"
          >
            <Logo />
          </Link>

          {/* Center Navigation */}
          {APP_NAV_ITEMS.length > 0 && (
            <div className="hidden md:flex flex-1 justify-center min-w-0 overflow-hidden">
              <NavBar items={APP_NAV_ITEMS} />
            </div>
          )}

          {/* Right Section - Launch App Button */}
          <div className="hidden md:flex items-center shrink-0 ml-auto">
            <Link
              href={process.env.NEXT_PUBLIC_APP_URL || "https://app.xorr.finance"}
              className="bg-[#CCFF00] text-black px-5 py-2.5 rounded-full text-xs font-mono font-bold tracking-wider hover:bg-[#CCFF00]/90 hover:scale-105 active:scale-95 transition-all duration-300 shadow-md shadow-[#CCFF00]/20"
            >
              Launch App
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button className="md:hidden ml-auto flex flex-col gap-1.5 p-2">
            <span className="w-5 h-0.5 bg-white rounded-full" />
            <span className="w-5 h-0.5 bg-white rounded-full" />
          </button>
        </nav>
      </div>

      {/* Mobile Bottom NavBar */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 mb-6 md:hidden">
        <NavBar items={APP_NAV_ITEMS} />
      </div>
    </header>
  );
};
