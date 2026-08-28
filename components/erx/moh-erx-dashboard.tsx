"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  LayoutDashboard,
  LogOut,
  Pill,
  Radar,
  Shield,
  Star,
  Store,
  TrendingUp,
} from "lucide-react"

import { MOH_ERX_DASHBOARD_EMAIL } from "@/lib/erx/moh-dashboard-auth.constants"
import type { ErxDashboardStats } from "@/lib/erx/erx-tracking"

const RW_BLUE = "#00A1DE"
const RW_YELLOW = "#FAD201"
const RW_GREEN = "#20603D"
const RW_NAVY = "#1E3A5F"
/** Light shell — high-contrast text (avoid washed-out gray on white). */
const BG = "#eef2f7"
const PANEL = "#ffffff"
const BORDER = "#c9daf0"
const TEXT = "#16233B"
const TEXT_SUB = "#3a4a6b"
const TEXT_MUTED = "#5c6b82"
const TRACK_BG = "#e2e8f0"

function FlagBar() {
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-sm">
      <div className="flex-[2]" style={{ background: RW_BLUE }} />
      <div className="flex-1" style={{ background: RW_YELLOW }} />
      <div className="flex-[2]" style={{ background: RW_GREEN }} />
    </div>
  )
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string
  value: string | number
  sub?: string
  icon: typeof Activity
  accent: string
}) {
  return (
    <div
      className="rounded-xl border p-4 shadow-sm"
      style={{ background: PANEL, borderColor: BORDER }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: TEXT_SUB }}>
            {label}
          </p>
          <p className="mt-2 text-2xl font-extrabold tabular-nums" style={{ color: TEXT }}>
            {value}
          </p>
          {sub ? (
            <p className="mt-1 text-xs font-medium" style={{ color: TEXT_MUTED }}>
              {sub}
            </p>
          ) : null}
        </div>
        <Icon className="h-5 w-5 shrink-0" style={{ color: accent }} />
      </div>
    </div>
  )
}

function WeeklyChart({ data }: { data: number[] }) {
  const max = Math.max(...data, 1)
  const w = 320
  const h = 88
  const pad = 4
  const step = (w - pad * 2) / Math.max(data.length - 1, 1)
  const points = data
    .map((v, i) => {
      const x = pad + i * step
      const y = h - pad - (v / max) * (h - pad * 2)
      return `${x},${y}`
    })
    .join(" ")
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[88px]" aria-hidden>
      <polyline
        fill="none"
        stroke={RW_BLUE}
        strokeWidth="2"
        strokeLinejoin="round"
        points={points}
      />
      {data.map((v, i) => {
        const x = pad + i * step
        const y = h - pad - (v / max) * (h - pad * 2)
        return <circle key={i} cx={x} cy={y} r="3" fill={RW_YELLOW} />
      })}
    </svg>
  )
}

function FunnelChart({ steps }: { steps: Array<{ stage: string; count: number; pct: number }> }) {
  return (
    <div className="space-y-2">
      {steps.map((s, i) => (
        <div key={s.stage}>
          <div className="mb-1 flex justify-between text-xs font-medium">
            <span style={{ color: TEXT_SUB }}>{s.stage}</span>
            <span className="tabular-nums font-semibold" style={{ color: TEXT }}>
              {s.count.toLocaleString()} · {s.pct}%
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full" style={{ background: TRACK_BG }}>
            <div
              className="h-full rounded-sm"
              style={{
                width: `${s.pct}%`,
                background: i === steps.length - 1 ? RW_GREEN : i === 0 ? RW_BLUE : RW_YELLOW,
                opacity: 0.85,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function DiscoveryDonut({ breakdown }: { breakdown: Array<{ label: string; pct: number }> }) {
  const colors = [RW_BLUE, RW_YELLOW, RW_GREEN, RW_NAVY]
  let offset = 0
  const r = 36
  const c = 2 * Math.PI * r
  return (
    <div className="flex items-center gap-6">
      <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden>
        <circle cx="48" cy="48" r={r} fill="none" stroke={TRACK_BG} strokeWidth="12" />
        {breakdown.map((b, i) => {
          const dash = (b.pct / 100) * c
          const el = (
            <circle
              key={b.label}
              cx="48"
              cy="48"
              r={r}
              fill="none"
              stroke={colors[i % colors.length]}
              strokeWidth="12"
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 48 48)"
            />
          )
          offset += dash
          return el
        })}
      </svg>
      <ul className="space-y-1 text-xs">
        {breakdown.map((b, i) => (
          <li key={b.label} className="flex items-center gap-2 text-xs font-medium" style={{ color: TEXT_SUB }}>
            <span
              className="inline-block h-2 w-2 rounded-sm"
              style={{ background: colors[i % colors.length] }}
            />
            {b.label}: <strong style={{ color: TEXT }}>{b.pct}%</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

function LoginPanel({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState(MOH_ERX_DASHBOARD_EMAIL)
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/erx/dashboard/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        setError("Email cyangwa ijambo ry'ibanga siyo.")
        return
      }
      onSuccess()
    } catch {
      setError("Ntibyashoboye kwinjira — gerageza nanone.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: BG }}>
      <div
        className="w-full max-w-md rounded-2xl border p-8 shadow-lg"
        style={{ background: PANEL, borderColor: BORDER }}
      >
        <FlagBar />
        <div className="mt-6 flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ background: "#EAF1FA" }}
          >
            <Shield className="h-7 w-7" style={{ color: RW_BLUE }} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold" style={{ color: TEXT }}>
              MoH eRx Dashboard
            </h1>
            <p className="text-sm font-medium" style={{ color: TEXT_MUTED }}>
              Minisiteri y&apos;Ubuzima · Service delivery
            </p>
          </div>
        </div>
        <form onSubmit={(e) => void submit(e)} className="mt-8 space-y-4">
          <div>
            <label className="text-xs font-bold" style={{ color: TEXT_SUB }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border px-4 py-3 text-sm font-medium outline-none focus:border-[#00A1DE] focus:ring-2 focus:ring-[#00A1DE]/20"
              style={{ borderColor: BORDER, color: TEXT, background: "#f8fafc" }}
              autoComplete="username"
            />
          </div>
          <div>
            <label className="text-xs font-bold" style={{ color: TEXT_SUB }}>
              Ijambo ry&apos;ibanga
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border px-4 py-3 text-sm font-medium outline-none focus:border-[#00A1DE] focus:ring-2 focus:ring-[#00A1DE]/20"
              style={{ borderColor: BORDER, color: TEXT, background: "#f8fafc" }}
              autoComplete="current-password"
            />
          </div>
          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl py-3.5 text-sm font-extrabold text-white disabled:opacity-50"
            style={{ background: RW_NAVY }}
          >
            {busy ? "Turimo kwinjiza…" : "Injira"}
          </button>
        </form>
      </div>
    </div>
  )
}

export function MohErxDashboard() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [stats, setStats] = useState<ErxDashboardStats | null>(null)
  const [demoMode, setDemoMode] = useState(false)
  const [dbOk, setDbOk] = useState(false)
  const [snapshotAt, setSnapshotAt] = useState<string>("")

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/erx/dashboard/stats", { cache: "no-store" })
      if (res.status === 401) {
        setAuthed(false)
        return
      }
      const json = await res.json()
      if (json.ok) {
        setAuthed(true)
        setStats(json.stats)
        setDemoMode(Boolean(json.demoMode))
        setDbOk(Boolean(json.db?.ok))
        setSnapshotAt(json.snapshotAt || "")
      }
    } catch {
      setAuthed(false)
    }
  }, [])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  const logout = async () => {
    await fetch("/api/erx/dashboard/login", { method: "DELETE" })
    setAuthed(false)
    setStats(null)
  }

  if (authed === null) {
    return (
      <div
        className="flex min-h-screen items-center justify-center font-medium"
        style={{ background: BG, color: TEXT_MUTED }}
      >
        Turimo gufungura…
      </div>
    )
  }

  if (!authed) {
    return <LoginPanel onSuccess={() => void loadStats()} />
  }

  const successRate =
    stats && stats.totalRequested > 0
      ? Math.round((stats.totalServed / stats.totalRequested) * 100)
      : 0

  const funnel = stats?.journeyFunnel ?? []
  const weekly = stats?.weeklyTrend ?? []
  const discoveryBreakdown = stats?.discoveryBreakdown ?? []

  return (
    <div className="min-h-screen" style={{ background: BG, color: TEXT }}>
      <header className="border-b bg-white shadow-sm" style={{ borderColor: BORDER }}>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl"
              style={{ background: "#EAF1FA" }}
            >
              <LayoutDashboard className="h-5 w-5" style={{ color: RW_NAVY }} />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight" style={{ color: TEXT }}>
                MoH eRx · Service Delivery
              </h1>
              <p className="text-xs font-medium" style={{ color: TEXT_MUTED }}>
                Rwanda · {snapshotAt ? new Date(snapshotAt).toLocaleString() : "—"}
                {demoMode ? " · DEMO data" : dbOk ? " · live DB" : " · partial"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/category_ai/pharmacy?browse=erx"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold text-white"
              style={{ background: RW_NAVY }}
            >
              <Pill className="h-4 w-4" />
              Reba farumasi &amp; ohereza RFQ
              <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold hover:bg-slate-50"
              style={{ borderColor: BORDER, color: TEXT_SUB }}
            >
              <LogOut className="h-4 w-4" />
              Sohoka
            </button>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 pb-3">
          <FlagBar />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        {demoMode ? (
          <div
            className="rounded-xl border px-4 py-3 text-sm font-medium shadow-sm"
            style={{ borderColor: BORDER, background: "#FFF9E6", color: TEXT_SUB }}
          >
            <strong style={{ color: "#8A6A00" }}>DEMO</strong> — Journey mockup until{" "}
            <code className="rounded bg-white px-1 font-mono text-xs font-bold" style={{ color: RW_BLUE }}>
              erx_tracking
            </code>{" "}
            is populated on chaos_beta.
          </div>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Total requested" value={(stats?.totalRequested ?? 0).toLocaleString()} sub="eRx unlock pulls" icon={TrendingUp} accent={RW_BLUE} />
          <KpiCard label="Total served" value={(stats?.totalServed ?? 0).toLocaleString()} sub={`${successRate}% completion`} icon={CheckCircle2} accent={RW_GREEN} />
          <KpiCard label="Total failed" value={(stats?.totalFailed ?? 0).toLocaleString()} sub="Mismatch · upstream · RFQ" icon={AlertTriangle} accent="#e5534b" />
          <KpiCard label="Avg response" value={`${stats?.avgResponseMs ?? 0} ms`} sub="MoH lookup → response" icon={Clock} accent={RW_YELLOW} />
        </section>

        <section className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          <div
            className="rounded-xl border p-5 shadow-sm lg:col-span-1"
            style={{ background: PANEL, borderColor: BORDER }}
          >
            <div className="mb-4 flex items-center gap-2 text-sm font-extrabold" style={{ color: TEXT }}>
              <BarChart3 className="h-4 w-4" style={{ color: RW_BLUE }} />
              Patient journey funnel
            </div>
            {funnel.length ? <FunnelChart steps={funnel} /> : <p className="text-xs font-medium" style={{ color: TEXT_MUTED }}>—</p>}
          </div>

          <div className="rounded-xl border p-5 shadow-sm" style={{ background: PANEL, borderColor: BORDER }}>
            <div className="mb-2 flex items-center gap-2 text-sm font-extrabold" style={{ color: TEXT }}>
              <Activity className="h-4 w-4" style={{ color: RW_GREEN }} />
              Requests · last 7 days
            </div>
            {weekly.length ? <WeeklyChart data={weekly} /> : null}
          </div>

          <div className="rounded-xl border p-5 shadow-sm" style={{ background: PANEL, borderColor: BORDER }}>
            <div className="mb-4 flex items-center gap-2 text-sm font-extrabold" style={{ color: TEXT }}>
              <Radar className="h-4 w-4" style={{ color: RW_NAVY }} />
              Discovery rate distribution
            </div>
            <p className="mb-3 text-3xl font-extrabold tabular-nums" style={{ color: TEXT }}>
              {stats?.discoveryRatePct ?? 0}%
            </p>
            <p className="mb-4 text-xs font-medium" style={{ color: TEXT_MUTED }}>
              Avg pharmacies that received RFQ per request (1 = one pharmacy found channel)
            </p>
            {discoveryBreakdown.length ? (
              <DiscoveryDonut breakdown={discoveryBreakdown} />
            ) : null}
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: "SLA · Stars ≥ 4.0", value: `${stats?.slaStarsPct ?? 0}%`, icon: Star, color: "#8A6A00" },
            { label: "SLA · Stock acc ≥ 4/5", value: `${stats?.slaStockPct ?? 0}%`, icon: Activity, color: RW_BLUE },
            {
              label: "Stock availability",
              value: `${stats?.stockAvailabilityPct ?? 0}%`,
              icon: Store,
              color: RW_GREEN,
            },
            {
              label: "Synced < 3h",
              value: `${stats?.pharmaciesSyncedLt3h ?? 0}/${stats?.pharmaciesTotal ?? 0}`,
              icon: Store,
              color: RW_GREEN,
            },
            {
              label: "Discovery rate",
              value: `${stats?.discoveryRatePct ?? 0}%`,
              icon: Radar,
              color: RW_NAVY,
            },
          ].map((m) => (
            <div
              key={m.label}
              className="rounded-xl border p-4 shadow-sm"
              style={{ background: PANEL, borderColor: BORDER }}
            >
              <m.icon className="mb-2 h-4 w-4" style={{ color: m.color }} />
              <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: TEXT_MUTED }}>
                {m.label}
              </p>
              <p className="mt-1 text-xl font-extrabold tabular-nums" style={{ color: TEXT }}>
                {m.value}
              </p>
            </div>
          ))}
        </section>

        <section
          className="rounded-xl border overflow-hidden shadow-sm"
          style={{ background: PANEL, borderColor: BORDER }}
        >
          <div className="border-b px-5 py-3 bg-[#f8fafc]" style={{ borderColor: BORDER }}>
            <h2 className="text-sm font-extrabold" style={{ color: TEXT }}>
              Recent eRx tracking
            </h2>
            <p className="text-xs font-medium" style={{ color: TEXT_MUTED }}>
              Unlock → RFQ → pharmacy picked
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr
                  className="border-b text-[10px] font-bold uppercase tracking-wider"
                  style={{ borderColor: BORDER, color: TEXT_MUTED, background: "#f8fafc" }}
                >
                  <th className="px-4 py-2.5">Time</th>
                  <th className="px-4 py-2.5">Event</th>
                  <th className="px-4 py-2.5">eRx</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Key</th>
                  <th className="px-4 py-2.5">Ms</th>
                  <th className="px-4 py-2.5">Pharmacy / order</th>
                </tr>
              </thead>
              <tbody>
                {(stats?.recent ?? []).map((row) => (
                  <tr
                    key={String(row.id)}
                    className="border-b hover:bg-[#f8fafc]"
                    style={{ borderColor: BORDER }}
                  >
                    <td className="px-4 py-2.5 tabular-nums text-xs font-medium" style={{ color: TEXT_MUTED }}>
                      {row.requested_at ? new Date(String(row.requested_at)).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-2.5 font-bold text-xs" style={{ color: TEXT }}>
                      {String(row.event_type ?? "")}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold" style={{ color: TEXT_SUB }}>
                      {String(row.erx_code ?? "")}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-bold">
                      <span
                        className={
                          row.status === "SUCCESS"
                            ? "text-emerald-700"
                            : row.status === "FAIL"
                              ? "text-red-700"
                              : "text-amber-700"
                        }
                      >
                        {String(row.status ?? "")}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-medium" style={{ color: TEXT_SUB }}>
                      {String(row.unlock_key_hint ?? "—")}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-xs font-semibold" style={{ color: TEXT }}>
                      {String(row.duration_ms ?? "—")}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-medium" style={{ color: TEXT_SUB }}>
                      {String(row.picked_pharmacy_name ?? row.order_id ?? "—")}
                      {row.pharmacies_inserted != null ? ` · ${row.pharmacies_inserted} inserted` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}
