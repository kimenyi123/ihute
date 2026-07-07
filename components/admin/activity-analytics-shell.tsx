"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import {
  Activity,
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronUp,
  Search,
  ScrollText,
  Store,
  X,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function isoDateDaysAgo(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function fmtRwf(n: number): string {
  return new Intl.NumberFormat("en-RW", { maximumFractionDigits: 0 }).format(Math.round(n)) + " RWF"
}

export function fmtNum(n: number): string {
  return new Intl.NumberFormat("en-RW").format(n)
}

export function fmtChartDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
}

const DATE_PRESETS = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
] as const

type AnalyticsNavProps = {
  active: "visitors" | "sales"
  from: string
  to: string
  environment?: string
}

export function ActivityAnalyticsNav({ active, from, to, environment = "" }: AnalyticsNavProps) {
  const q = new URLSearchParams({ from, to })
  if (environment) q.set("environment", environment)

  const tabs = [
    { id: "visitors" as const, href: `/admin/activity-logs?${q}`, label: "Visitor tracking", icon: ScrollText },
    { id: "sales" as const, href: `/admin/ihute-stats?${q}`, label: "Shop-with-me sales", icon: Store },
  ]

  return (
    <nav className="flex flex-wrap gap-2 rounded-xl border border-slate-200/80 bg-white p-1.5 shadow-sm">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = active === tab.id
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all sm:flex-none",
              isActive
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}

type HeroProps = {
  title: string
  subtitle: string
  icon: LucideIcon
  actions?: ReactNode
}

export function AnalyticsHero({ title, subtitle, icon: Icon, actions }: HeroProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
            <Icon className="h-6 w-6 text-slate-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600 sm:text-base">{subtitle}</p>
          </div>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  )
}

export type SellerOption = {
  sellerAccount: string
  sellerName: string
  shopNickname?: string
  orderCount?: number
  gmv?: number
}

export function SellerSearchPicker({
  value,
  options,
  onChange,
  placeholder = "Search seller name, account, or shop nickname…",
}: {
  value: string
  options: SellerOption[]
  onChange: (account: string) => void
  placeholder?: string
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const selected = options.find((s) => s.sellerAccount === value)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? options.filter((s) => {
          const hay = [s.sellerName, s.sellerAccount, s.shopNickname].filter(Boolean).join(" ").toLowerCase()
          return hay.includes(q)
        })
      : options
    return list.slice(0, 80)
  }, [options, query])

  function pick(account: string) {
    onChange(account)
    setQuery("")
    setOpen(false)
  }

  return (
    <div className="relative" ref={rootRef}>
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
        Seller (deep dive)
      </span>
      {value && selected ? (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <span className="min-w-0 flex-1 truncate">
            <span className="font-medium text-slate-900">{selected.sellerName || selected.sellerAccount}</span>
            <span className="text-slate-500"> · {selected.sellerAccount}</span>
            {selected.shopNickname ? <span className="text-slate-500"> · @{selected.shopNickname}</span> : null}
          </span>
          <button
            type="button"
            className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
            onClick={() => pick("")}
            aria-label="Clear seller"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder={placeholder}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setOpen(true)
              }}
              onFocus={() => setOpen(true)}
            />
          </div>
          {open && (
            <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
                onClick={() => pick("")}
              >
                All sellers
              </button>
              {filtered.length === 0 ? (
                <p className="px-3 py-4 text-sm text-slate-500">No sellers match “{query}”</p>
              ) : (
                filtered.map((s) => (
                  <button
                    key={s.sellerAccount}
                    type="button"
                    className="block w-full border-t border-slate-50 px-3 py-2 text-left text-sm hover:bg-slate-50"
                    onClick={() => pick(s.sellerAccount)}
                  >
                    <span className="font-medium text-slate-900">{s.sellerName || s.sellerAccount}</span>
                    <span className="block text-xs text-slate-500">
                      {s.sellerAccount}
                      {s.shopNickname ? ` · @${s.shopNickname}` : ""}
                      {(s.orderCount ?? 0) > 0 ? ` · ${s.orderCount} shop orders in range` : ""}
                    </span>
                  </button>
                ))
              )}
              {options.length > 80 && !query.trim() ? (
                <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-400">Type to search {options.length} sellers…</p>
              ) : null}
            </div>
          )}
        </>
      )}
    </div>
  )
}

type DateRangeProps = {
  from: string
  to: string
  environment: string
  sellerAccount?: string
  sellerOptions?: SellerOption[]
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
  onEnvironmentChange: (v: string) => void
  onSellerChange?: (v: string) => void
  onApply?: () => void
  loading?: boolean
  showDevEnv?: boolean
}

export function DateRangeControls({
  from,
  to,
  environment,
  sellerAccount = "",
  sellerOptions = [],
  onFromChange,
  onToChange,
  onEnvironmentChange,
  onSellerChange,
  onApply,
  loading,
  showDevEnv,
}: DateRangeProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
        <Calendar className="h-4 w-4 text-indigo-500" />
        Date range & filters
      </div>
      <div className="flex flex-wrap gap-2">
        {DATE_PRESETS.map((p) => (
          <Button
            key={p.days}
            type="button"
            size="sm"
            variant="outline"
            className="border-slate-200"
            onClick={() => {
              onFromChange(isoDateDaysAgo(p.days))
              onToChange(todayIso())
            }}
          >
            {p.label}
          </Button>
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-sm">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">From</span>
          <input
            type="date"
            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm transition focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
            value={from}
            onChange={(e) => onFromChange(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">To</span>
          <input
            type="date"
            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm transition focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
            value={to}
            onChange={(e) => onToChange(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Environment</span>
          <select
            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm transition focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
            value={environment}
            onChange={(e) => onEnvironmentChange(e.target.value)}
          >
            <option value="">All environments</option>
            <option value="prod">Production</option>
            <option value="beta">Beta</option>
            {showDevEnv ? <option value="dev">Development</option> : null}
          </select>
        </label>
        {onSellerChange ? (
          <div className="lg:col-span-2">
            <SellerSearchPicker
              value={sellerAccount}
              options={sellerOptions}
              onChange={onSellerChange}
            />
          </div>
        ) : null}
        {onApply ? (
          <div className="flex items-end">
            <Button type="button" className="w-full" variant="default" onClick={onApply} disabled={loading}>
              {loading ? "Loading…" : "Apply range"}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

type MetricCardProps = {
  label: string
  value: string
  hint?: string
  icon?: LucideIcon
  tone?: "default" | "shop" | "success" | "info" | "warning"
  loading?: boolean
}

const METRIC_TONES = {
  default: "border-slate-200 bg-white",
  shop: "border-slate-200 bg-white",
  success: "border-slate-200 bg-white",
  info: "border-slate-200 bg-white",
  warning: "border-slate-200 bg-white",
}

const METRIC_ICON_TONES = {
  default: "bg-slate-100 text-slate-600",
  shop: "bg-violet-100 text-violet-700",
  success: "bg-emerald-100 text-emerald-700",
  info: "bg-blue-100 text-blue-700",
  warning: "bg-amber-100 text-amber-700",
}

export function MetricCard({ label, value, hint, icon: Icon, tone = "default", loading }: MetricCardProps) {
  return (
    <div className={cn("rounded-xl border p-4 shadow-sm transition hover:shadow-md", METRIC_TONES[tone])}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        {Icon ? (
          <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", METRIC_ICON_TONES[tone])}>
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-slate-900">
        {loading ? <span className="inline-block h-8 w-20 animate-pulse rounded bg-slate-200" /> : value}
      </p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  )
}

type BreakdownItem = { name: string; value: number }

export function BreakdownBars({
  title,
  items,
  emptyLabel = "No data",
  color = "#6366f1",
}: {
  title: string
  items: BreakdownItem[]
  emptyLabel?: string
  color?: string
}) {
  const max = Math.max(...items.map((i) => i.value), 1)
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="mt-6 text-center text-sm text-slate-500">{emptyLabel}</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <ul className="mt-4 space-y-3">
        {items.map((item) => {
          const pct = (item.value / max) * 100
          return (
            <li key={item.name}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">{item.name}</span>
                <span className="tabular-nums text-slate-500">{fmtNum(item.value)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: color }}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const STAGE_COLORS: Record<string, string> = {
  page_view: "bg-blue-100 text-blue-800 ring-blue-200",
  search: "bg-violet-100 text-violet-800 ring-violet-200",
  product_view: "bg-indigo-100 text-indigo-800 ring-indigo-200",
  add_to_cart: "bg-amber-100 text-amber-800 ring-amber-200",
  checkout_submit: "bg-orange-100 text-orange-800 ring-orange-200",
  checkout_start: "bg-orange-100 text-orange-800 ring-orange-200",
  order_placed: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  auth: "bg-slate-100 text-slate-800 ring-slate-200",
  session_start: "bg-cyan-100 text-cyan-800 ring-cyan-200",
}

export function StagePill({ stage }: { stage?: string }) {
  const s = stage || "unknown"
  const cls = STAGE_COLORS[s] || "bg-slate-100 text-slate-700 ring-slate-200"
  return (
    <span className={cn("inline-flex rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset", cls)}>
      {s}
    </span>
  )
}

export function StatusPill({ status }: { status?: string }) {
  const failed = status === "failed"
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        failed ? "bg-red-50 text-red-700 ring-red-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200",
      )}
    >
      {status || "—"}
    </span>
  )
}

export function SectionCard({
  title,
  subtitle,
  children,
  action,
  className,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

export function CollapsibleHelp({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-medium text-slate-700 hover:text-slate-900"
      >
        <span className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-slate-400" />
          {title}
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open ? <div className="border-t border-slate-200 px-5 py-4 text-sm text-slate-600">{children}</div> : null}
    </div>
  )
}

export function GlossaryGrid({ items }: { items: { term: string; def: string }[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <p key={item.term}>
          <span className="font-medium text-slate-900">{item.term}</span>
          <span className="text-slate-600"> — {item.def}</span>
        </p>
      ))}
    </div>
  )
}

export function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-xs font-medium transition",
        active
          ? "bg-slate-900 text-white"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200",
      )}
    >
      {label}
    </button>
  )
}

export function EmptyState({ icon: Icon = Activity, title, description }: { icon?: LucideIcon; title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
        <Icon className="h-6 w-6 text-slate-400" />
      </div>
      <p className="mt-3 font-medium text-slate-800">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p> : null}
    </div>
  )
}
