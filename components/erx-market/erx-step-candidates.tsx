"use client"

/**
 * Intambwe 3/5 — Amafarumasi akwegereye (eRx market candidates).
 * Paginated (5 per page), start unselected, select-all available.
 */

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { ERX_COPY, fmtRwf } from "@/lib/erx/erx-market-copy"
import type { ErxCandidatePharmacy, ErxRfqItem } from "@/lib/erx/erx-market-types"

export type ErxCandidateSort = "dist" | "stars" | "acc" | "sync"

const PAGE_SIZE = 5

export function ErxStepCandidates({
  pharmacies,
  items,
  selected,
  onToggle,
  onSelectAll,
  onSend,
  sending,
}: {
  pharmacies: ErxCandidatePharmacy[]
  items: ErxRfqItem[]
  selected: string[]
  onToggle: (id: string, on: boolean) => void
  onSelectAll: () => void
  onSend: () => void
  sending: boolean
}) {
  const [sort, setSort] = useState<ErxCandidateSort>("dist")
  const [page, setPage] = useState(0)

  const rxTotalAvg = items.reduce((s, i) => s + i.qty * i.avgUnit, 0)

  const sorted = useMemo(() => {
    const a = [...pharmacies]
    if (sort === "stars") a.sort((x, y) => y.stars - x.stars)
    else if (sort === "acc") a.sort((x, y) => y.stockAcc - x.stockAcc || x.lastSyncMin - y.lastSyncMin)
    else if (sort === "sync") a.sort((x, y) => x.lastSyncMin - y.lastSyncMin)
    else a.sort((x, y) => x.distKm - y.distKm)
    return a
  }, [pharmacies, sort])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pageItems = sorted.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)
  const from = sorted.length ? safePage * PAGE_SIZE + 1 : 0
  const to = Math.min((safePage + 1) * PAGE_SIZE, sorted.length)
  const allSelected = sorted.length > 0 && sorted.every((p) => selected.includes(p.id))

  return (
    <>
      <div className="rounded-[14px] border border-[#DDE3EE] bg-white p-4 shadow-sm mb-3">
        <h1 className="text-xl font-extrabold tracking-tight text-[#16233B]">
          {ERX_COPY.nearTitle}{" "}
          <span className="text-[11.5px] font-normal text-[#6B7690]">{ERX_COPY.nearTitleEn}</span>
        </h1>
        <p className="text-[13px] text-[#6B7690] mb-3">
          Gusaba kwemeza bijya kuri <b>{ERX_COPY.nearLeadBoldPart}</b> — uhereye ku ikwegereye.
          Hitamo farumasi ushaka.
        </p>

        <div className="rounded-[10px] border border-[#C9DAF0] bg-[#EAF1FA] p-2.5 text-xs text-[#23446E] mb-2.5">
          {ERX_COPY.noteBlueRw}
          <br />
          <span className="text-[11.5px] text-[#6B7690]">{ERX_COPY.noteBlueEn}</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <p className="text-[12px] font-semibold text-[#3A4A6B]">
            {ERX_COPY.showingRange(from, to, sorted.length)}
          </p>
          <button
            type="button"
            onClick={onSelectAll}
            className="rounded-full border-[1.5px] border-[#1E3A5F] px-3 py-1.5 text-[11px] font-extrabold text-[#1E3A5F] hover:bg-[#EAF1FA]"
          >
            {allSelected ? "Kuramo byose" : ERX_COPY.selectAll}
          </button>
        </div>

        <div className="flex gap-1.5 my-2.5" role="tablist" aria-label="Sort pharmacies">
          {ERX_COPY.sortChips.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={sort === key}
              onClick={() => {
                setSort(key as ErxCandidateSort)
                setPage(0)
              }}
              className={cn(
                "flex-1 rounded-full border-[1.5px] px-0.5 py-2 text-[11px] font-extrabold cursor-pointer",
                sort === key
                  ? "border-[#1E3A5F] bg-[#1E3A5F] text-white"
                  : "border-[#DDE3EE] bg-white text-[#3A4A6B]",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {pageItems.map((p) => {
          const isSel = selected.includes(p.id)
          return (
            <label
              key={p.id}
              className={cn(
                "flex gap-2.5 rounded-xl border-[1.5px] bg-white p-3 mb-2 cursor-pointer",
                isSel ? "border-[#1E3A5F] shadow-[0_0_0_2px_rgba(30,58,95,.14)]" : "border-[#DDE3EE]",
              )}
            >
              <input
                type="checkbox"
                checked={isSel}
                onChange={(e) => onToggle(p.id, e.target.checked)}
                aria-label={p.name}
                className="mt-0.5 h-[22px] w-[22px] accent-[#1E3A5F]"
              />
              <div className="flex-1">
                <div className="text-[14.5px] font-extrabold">{p.name}</div>
                <div className="text-[11.5px] text-[#6B7690] mt-0.5 mb-1">{p.zone}</div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11.5px] font-extrabold text-[#3A4A6B]">
                    {p.distKm.toFixed(1)} km
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF6DC] px-2 py-0.5 text-[11px] font-extrabold text-[#8A6A00]">
                    ★ {p.stars.toFixed(1)}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold",
                      p.stockAcc >= 4
                        ? "bg-[#E2F4EC] text-[#118A5A]"
                        : p.stockAcc >= 3
                          ? "bg-[#FFF6DC] text-[#8A6A00]"
                          : "bg-[#FCE9E7] text-[#D0342C]",
                    )}
                  >
                    Stock {p.stockAcc}/5
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold",
                      p.lastSyncMin <= 15
                        ? "bg-[#E2F4EC] text-[#118A5A]"
                        : p.lastSyncMin <= 45
                          ? "bg-[#FFF6DC] text-[#8A6A00]"
                          : "bg-[#EEF1F6] text-[#6B7690]",
                    )}
                  >
                    Sync {p.lastSyncMin}m
                  </span>
                </div>
                <div className="mt-1 text-[11.5px] text-[#6B7690]">
                  {ERX_COPY.cardEstimate(fmtRwf(rxTotalAvg * p.priceFactor), p.lastSyncMin)}
                </div>
              </div>
            </label>
          )
        })}

        {totalPages > 1 ? (
          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={safePage <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-lg border border-[#DDE3EE] px-3 py-2 text-[12px] font-bold text-[#3A4A6B] disabled:opacity-40"
            >
              {ERX_COPY.prevPage}
            </button>
            <span className="text-[12px] font-semibold text-[#6B7690]">
              {ERX_COPY.pageOf(safePage + 1, totalPages, sorted.length)}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="rounded-lg border border-[#DDE3EE] px-3 py-2 text-[12px] font-bold text-[#3A4A6B] disabled:opacity-40"
            >
              {ERX_COPY.nextPage}
            </button>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        disabled={!selected.length || sending}
        onClick={onSend}
        className="block w-full rounded-xl bg-[#1E3A5F] p-[15px] text-base font-extrabold text-white disabled:opacity-45 disabled:cursor-not-allowed"
      >
        {selected.length === pharmacies.length
          ? ERX_COPY.sendAll(selected.length)
          : ERX_COPY.sendSome(selected.length)}
      </button>
    </>
  )
}
