"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A token pill: colored dot + symbol (Ghost flat chip style). */
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
        "inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 font-semibold shrink-0 text-sm bg-muted/50 border border-border text-foreground",
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

/** Ghost-style amount card: label on top, big number input left, token chip right. */
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
        "rounded-xl px-5 py-4 transition-colors",
        accent
          ? "bg-primary/[0.06] border border-primary/20"
          : "bg-muted/50 border border-transparent focus-within:border-border",
      )}
    >
      <div className="flex items-center justify-between gap-2" style={{ minHeight: 18 }}>
        <span className="text-sm text-muted-foreground">{label}</span>
        {right}
      </div>
      <div className="mt-3 flex items-center justify-between gap-4">
        <input
          inputMode="decimal"
          placeholder={placeholder}
          value={value}
          readOnly={readOnly}
          onChange={(e) => onChange?.(e.target.value)}
          className={cn(
            "min-w-0 w-full bg-transparent text-3xl md:text-[34px] font-medium tabular-nums outline-none placeholder:text-muted-foreground/40",
            readOnly && "text-foreground",
          )}
        />
        <div className="shrink-0">{token}</div>
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
          "grid place-items-center size-9 rounded-xl border border-border bg-card text-foreground/80 transition-all",
          onClick ? "hover:border-primary/40 hover:text-primary hover:rotate-180" : "cursor-default",
        )}
      >
        {onClick ? "⇅" : "↓"}
      </button>
    </div>
  );
}
