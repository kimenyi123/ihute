"use client"

import { useEffect, useState } from "react"
import { getGrandmaFetchStats, getGrandmaFetchSuccessRate } from "@/lib/grandma-fetch-stats"

type Labels = {
  title: string
  none: string
  line: string
  lastFail: string
}

function formatLine(
  template: string,
  p: { total: number; ok: number; fail: number; pct: string },
) {
  return template
    .replace(/\{total\}/g, String(p.total))
    .replace(/\{ok\}/g, String(p.ok))
    .replace(/\{fail\}/g, String(p.fail))
    .replace(/\{pct\}/g, p.pct)
}

function formatLast(template: string, url: string, status: number) {
  return template.replace(/\{url\}/g, url).replace(/\{status\}/g, String(status))
}

export function GrandmaRequestStatsPanel({ open, labels }: { open: boolean; labels: Labels }) {
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!open) return
    const t = setInterval(() => setTick((x) => x + 1), 1200)
    return () => clearInterval(t)
  }, [open])

  const stats = getGrandmaFetchStats()
  const pct = getGrandmaFetchSuccessRate()
  const pctStr = pct == null ? "—" : String(pct)

  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{labels.title}</div>
      <p className="mt-1 text-xs text-muted-foreground">
        {stats.total <= 0
          ? labels.none
          : formatLine(labels.line, {
              total: stats.total,
              ok: stats.ok,
              fail: stats.fail,
              pct: pctStr,
            })}
      </p>
      {stats.lastFailUrl != null && stats.lastFailStatus != null ? (
        <p className="mt-2 break-all font-mono text-[11px] text-red-700/90">
          {formatLast(labels.lastFail, stats.lastFailUrl, stats.lastFailStatus)}
        </p>
      ) : null}
    </div>
  )
}
