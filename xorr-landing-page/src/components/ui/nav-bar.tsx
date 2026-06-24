"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface NavItem {
  name: string;
  url: string;
  icon: LucideIcon;
  disabled?: boolean;
}

interface NavBarProps {
  items: NavItem[];
  className?: string;
}

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(" ");

export function NavBar({ items, className }: NavBarProps) {
  const [activeTab, setActiveTab] = useState<string | null>("Features");

  return (
    <div className={cn("z-50", className)}>
      <div className="flex items-center gap-0.5 bg-white/3 border border-white/10 backdrop-blur-lg py-1 px-1 rounded-full shadow-lg">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.name;

          return (
            <a
              key={item.name}
              href={item.url}
              onClick={() => setActiveTab(item.name)}
              className={cn(
                "relative cursor-pointer text-xs font-semibold px-4 py-2 rounded-full transition-colors whitespace-nowrap",
                "text-white/70 hover:text-[#CCFF00] font-sans",
                isActive && "text-[#CCFF00] font-bold"
              )}
            >
              <span className="hidden md:inline">{item.name}</span>
              <span className="md:hidden">
                <Icon size={18} strokeWidth={2.5} />
              </span>
              {isActive && (
                <motion.div
                  layoutId="lamp"
                  className="absolute inset-0 w-full bg-white/5 rounded-full -z-10"
                  initial={false}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 30,
                  }}
                >
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#CCFF00] rounded-full">
                    <div className="absolute w-12 h-4 bg-[#CCFF00]/30 rounded-full blur-sm -top-1.5 -left-2" />
                    <div className="absolute w-6 h-3 bg-[#CCFF00]/20 rounded-full blur-xs -top-1" />
                  </div>
                </motion.div>
              )}
            </a>
          );
        })}
      </div>
    </div>
  );
}
