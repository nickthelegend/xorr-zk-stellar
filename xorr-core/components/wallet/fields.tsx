"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A token pill: colored dot + symbol. */
export function TokenChip({
  symbol,
  color = "#2775ca",
  primary = false,
  className,
}: {
  symbol: string;
  color?: string;
  primary?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-2 font-semibold shrink-0 text-sm",
        primary ? "bg-primary/10 border border-primary/25 text-primary" : "bg-white/5 border border-white/10 text-foreground",
        className,
      )}
    >
      <span
        className="rounded-full shrink-0"
        style={{
          width: 18,
          height: 18,
          background: primary ? "#e2a9f1" : color,
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12)",
        }}
      />
      {symbol}
    </span>
  );
}

/** Premium token-amount card (Uniswap-style): label · token pill · big amount. */
export function AmountCard({
  label,
  right,
  token,
  value,
  onChange,
  readOnly,
  placeholder = "0.0",
  footer,
  accent,
}: {
  label: string;
  right?: ReactNode;
  token: ReactNode;
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  footer?: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 transition-colors",
        accent
          ? "border-primary/20 bg-gradient-to-b from-primary/[0.06] to-transparent"
          : "border-white/10 bg-gradient-to-b from-white/[0.045] to-white/[0.012] focus-within:border-primary/30",
      )}
    >
      <div className="flex items-center justify-between gap-2" style={{ minHeight: 18 }}>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
        {right}
      </div>
      <div className="mt-3 flex items-center gap-3">
        {token}
        <input
          inputMode="decimal"
          placeholder={placeholder}
          value={value}
          readOnly={readOnly}
          onChange={(e) => onChange?.(e.target.value)}
          className={cn(
            "flex-1 min-w-0 bg-transparent text-right text-3xl md:text-[34px] font-semibold tabular-nums outline-none placeholder:text-muted-foreground/30",
            readOnly && "text-primary",
          )}
        />
      </div>
      {footer && <div className="mt-2.5 text-[11px] text-muted-foreground">{footer}</div>}
    </div>
  );
}

/** The down-chevron divider between two amount cards. */
export function SwapDivider({ onClick }: { onClick?: () => void }) {
  return (
    <div className="relative flex justify-center -my-3 z-10">
      <button
        type="button"
        onClick={onClick}
        aria-label="Flip"
        className={cn(
          "grid place-items-center size-9 rounded-xl border border-white/10 bg-[#161616] text-foreground/80 transition-all",
          onClick ? "hover:border-primary/40 hover:text-primary hover:rotate-180" : "cursor-default",
        )}
      >
        {onClick ? "⇅" : "↓"}
      </button>
    </div>
  );
}
