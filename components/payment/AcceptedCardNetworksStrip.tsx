"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Compact, recognizable card marks for checkout (demo / informational). */
export function AcceptedCardNetworksStrip({
  className,
  label,
  selectedNetwork,
}: {
  className?: string
  /** Visually hidden / optional short heading for screen readers */
  label?: string
  selectedNetwork?: "visa" | "mastercard" | "amex" | "verve" | null
}) {
  return (
    <div className={cn("w-full", className)}>
      {label ? (
        <p className="sr-only" role="heading">
          {label}
        </p>
      ) : null}
      <div
        className="flex gap-2 overflow-x-auto pb-1 pt-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="list"
        aria-label={label ?? "Accepted card networks"}
      >
        <VisaMark selected={selectedNetwork === "visa"} />
        <MastercardMark selected={selectedNetwork === "mastercard"} />
        <AmexMark selected={selectedNetwork === "amex"} />
        <VerveMark selected={selectedNetwork === "verve"} />
      </div>
    </div>
  )
}

function MarkShell({
  children,
  name,
  selected = false,
}: {
  children: ReactNode
  name: string
  selected?: boolean
}) {
  return (
    <div
      role="listitem"
      title={name}
      className={cn(
        "relative flex h-9 min-w-[52px] shrink-0 items-center justify-center rounded-lg border bg-white px-2 shadow-sm transition-transform duration-200 hover:scale-[1.02] dark:bg-slate-900",
        selected ? "border-green-300 ring-1 ring-green-200" : "border-slate-200/90 dark:border-slate-700",
      )}
    >
      {selected ? (
        <span className="absolute right-0.5 top-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-green-600 text-[9px] font-bold text-white">
          ✓
        </span>
      ) : null}
      {children}
    </div>
  )
}

function VisaMark({ selected = false }: { selected?: boolean }) {
  return (
    <MarkShell name="Visa" selected={selected}>
      <svg viewBox="0 0 48 16" className="h-3.5 w-12" aria-hidden>
        <text
          x="0"
          y="12"
          className="fill-[#1a1f71] font-bold italic"
          style={{ fontSize: 14, fontFamily: "system-ui, sans-serif" }}
        >
          VISA
        </text>
      </svg>
    </MarkShell>
  )
}

function MastercardMark({ selected = false }: { selected?: boolean }) {
  return (
    <MarkShell name="Mastercard" selected={selected}>
      <svg viewBox="0 0 40 24" className="h-6 w-10" aria-hidden>
        <circle cx="15" cy="12" r="10" fill="#eb001b" opacity={0.95} />
        <circle cx="25" cy="12" r="10" fill="#f79e1b" opacity={0.95} />
        <path
          d="M20 6.2a9.9 9.9 0 000 11.6 9.9 9.9 0 000-11.6z"
          fill="#ff5f00"
          opacity={0.9}
        />
      </svg>
    </MarkShell>
  )
}

function AmexMark({ selected = false }: { selected?: boolean }) {
  return (
    <MarkShell name="American Express" selected={selected}>
      <svg viewBox="0 0 56 18" className="h-4 w-14" aria-hidden>
        <rect width="56" height="18" rx="3" fill="#006fcf" />
        <text
          x="28"
          y="12.5"
          textAnchor="middle"
          fill="white"
          className="font-bold"
          style={{ fontSize: 8.5, fontFamily: "system-ui, sans-serif" }}
        >
          AMEX
        </text>
      </svg>
    </MarkShell>
  )
}

function VerveMark({ selected = false }: { selected?: boolean }) {
  return (
    <MarkShell name="Verve" selected={selected}>
      <svg viewBox="0 0 52 18" className="h-4 w-[3.25rem]" aria-hidden>
        <rect width="52" height="18" rx="3" fill="#004d2e" />
        <text
          x="26"
          y="12.5"
          textAnchor="middle"
          fill="#fff"
          className="font-bold tracking-wide"
          style={{ fontSize: 9, fontFamily: "system-ui, sans-serif" }}
        >
          VERVE
        </text>
      </svg>
    </MarkShell>
  )
}
