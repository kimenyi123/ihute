"use client"

/**
 * IHUTE eRx market — the 5-step MoH eRx patient flow (feature flag
 * NEXT_PUBLIC_ERX_MARKET=1), per the validated spec ihute_erx_sample_v4.html.
 *
 * Steps 1–2 (lookup + unlock + medicines) are ALREADY LIVE on beta: this flow
 * reuses the same PharmacyErxInput component and /api/pharmacy/erx-lookup
 * endpoint. Steps 3–5 (candidates → RFQ/quotes/pay → track & rate) are new.
 * Kinyarwanda copy is verbatim (lib/erx/erx-market-copy.ts).
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import Image from "next/image"
import { ChevronLeft, X } from "lucide-react"

import { PharmacyErxInput, type ErxUnlockKey } from "@/components/category_ai/pharmacy-erx-input"
import { PharmacyErxResult } from "@/components/category_ai/pharmacy-erx-result"
import { ErxStepCandidates } from "./erx-step-candidates"
import { ErxStepQuotes, ErxStepPay, type ErxDeliveryChoice } from "./erx-step-quotes"
import { ErxStepTrack } from "./erx-step-track"

import { ERX_COPY, ERX_STEP_NAMES } from "@/lib/erx/erx-market-copy"
import { KIGALI } from "@/lib/erx/erx-market-mock"
import type { ErxIdentityMatchField } from "@/lib/erx/erx-identity-match"
import { erxUnlockErrorMessage } from "@/lib/erx/erx-unlock-messages"

/** Default eRx code for local testing when URL has none. */
const MARKET_DEFAULT_ERX_CODE = "EP-0317-170"
import type {
  ErxCandidatePharmacy,
  ErxOrderSnapshot,
  ErxRfqItem,
} from "@/lib/erx/erx-market-types"
import type { MohErxDrugLineDTO } from "@/lib/erx/moh-erx-types"

import { ERX_SYNC_POLL_SEC } from "@/lib/erx/erx-pos-sync"

const POLL_MS = ERX_SYNC_POLL_SEC * 1000

type LookupState = {
  loading: boolean
  errorCode: string | null
  errorMessage: string | null
  failedFields: ErxIdentityMatchField[]
  patientDisplayName: string | null
  patientPhone: string | null
  drugs: MohErxDrugLineDTO[] | null
}

const IDLE_LOOKUP: LookupState = {
  loading: false,
  errorCode: null,
  errorMessage: null,
  failedFields: [],
  patientDisplayName: null,
  patientPhone: null,
  drugs: null,
}

function drugsToItems(drugs: MohErxDrugLineDTO[]): ErxRfqItem[] {
  return drugs.map((d) => ({
    name: d.name,
    qty: d.quantityValue && d.quantityValue > 0 ? Math.round(d.quantityValue) : 1,
    avgUnit: 0,
    doseText: [d.dosageText, d.route, d.frequencyText].filter(Boolean).join(" · ") || undefined,
  }))
}

export function ErxMarketFlow({
  initialCode,
  onClose,
}: {
  initialCode?: string
  onClose: () => void
}) {
  const [step, setStep] = useState(0)
  const [erxCode, setErxCode] = useState(initialCode?.trim() || MARKET_DEFAULT_ERX_CODE)
  const [lookup, setLookup] = useState<LookupState>(IDLE_LOOKUP)
  const [items, setItems] = useState<ErxRfqItem[]>([])
  const [pos, setPos] = useState(KIGALI)
  const [candidates, setCandidates] = useState<ErxCandidatePharmacy[]>([])
  const [candidatesLoading, setCandidatesLoading] = useState(false)
  const [candidatesError, setCandidatesError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [order, setOrder] = useState<ErxOrderSnapshot | null>(null)
  const [paying, setPaying] = useState(false)
  const [busy, setBusy] = useState(false)
  const [posFeedback, setPosFeedback] = useState<string | null>(null)
  const [posInserts, setPosInserts] = useState<
    Array<{ pharmacyId: string; transactionId: string; ok: boolean; backend?: string; error?: string }>
  >([])
  const [syncCountdown, setSyncCountdown] = useState(ERX_SYNC_POLL_SEC)
  const scrollRef = useRef<HTMLDivElement>(null)

  const goStep = useCallback((n: number) => {
    setStep(n)
    scrollRef.current?.scrollTo({ top: 0 })
  }, [])

  const goBack = useCallback(() => {
    if (paying) {
      setPaying(false)
      scrollRef.current?.scrollTo({ top: 0 })
      return
    }
    if (step <= 0) {
      onClose()
      return
    }
    if (step === 3) {
      setOrder(null)
      setPaying(false)
    }
    goStep(step - 1)
  }, [paying, step, onClose, goStep])

  /* ---- Intambwe 1: kode + gufungura (live MoH HIE — no mock) ---- */
  const runLookup = useCallback(async (code: string, unlock?: ErxUnlockKey) => {
    setErxCode(code)
    setLookup({ ...IDLE_LOOKUP, loading: true })
    try {
      const qs = new URLSearchParams({ code })
      if (unlock?.phone) qs.set("phone", unlock.phone)
      if (unlock?.names) qs.set("names", unlock.names)
      if (unlock?.nationalId) qs.set("nationalId", unlock.nationalId)
      const res = await fetch(`/api/pharmacy/erx-lookup?${qs.toString()}`, { cache: "no-store" })
      const json = await res.json()
      if (json.ok) {
        setLookup({
          loading: false,
          errorCode: null,
          errorMessage: null,
          failedFields: [],
          patientDisplayName: json.patientDisplayName,
          patientPhone: json.patientPhone ?? null,
          drugs: json.drugs,
        })
        setItems(drugsToItems(json.drugs || []))
        goStep(1)
        return
      }
      const failedFields = (json.failedFields || []) as ErxIdentityMatchField[]
      const errCode = json.code || "ERX_UPSTREAM_ERROR"
      setLookup({
        ...IDLE_LOOKUP,
        errorCode: errCode,
        errorMessage: erxUnlockErrorMessage(errCode, failedFields),
        failedFields,
      })
    } catch {
      setLookup({
        ...IDLE_LOOKUP,
        errorCode: "ERX_UPSTREAM_ERROR",
        errorMessage: erxUnlockErrorMessage("ERX_UPSTREAM_ERROR"),
        failedFields: [],
      })
    }
  }, [goStep])

  /* ---- Intambwe 2 → 3: locate + candidates ---- */
  const findPharmacies = useCallback(() => {
    setCandidatesLoading(true)
    setCandidatesError(null)
    const proceed = async (p: { lat: number; lng: number }) => {
      setPos(p)
      try {
        const res = await fetch(`/api/pharmacies/nearby?lat=${p.lat}&lng=${p.lng}`, { cache: "no-store" })
        const json = await res.json()
        if (!json.ok) {
          setCandidatesError(
            json.code === "ERX_PHARMACIES_UNAVAILABLE"
              ? "Ntitwashoboye kubona amafarumasi — reba ko backend na database byakora."
              : "Ntitwashoboye kubona amafarumasi.",
          )
          return
        }
        const list: ErxCandidatePharmacy[] = json.pharmacies || []
        setCandidates(list)
        setSelected([])
        goStep(2)
      } catch {
        setCandidatesError("Ntitwashoboye kubona amafarumasi.")
      } finally {
        setCandidatesLoading(false)
      }
    }
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (g) => void proceed({ lat: g.coords.latitude, lng: g.coords.longitude }),
        () => void proceed(KIGALI),
        { timeout: 2500 },
      )
    } else {
      void proceed(KIGALI)
    }
  }, [goStep])

  /* ---- Intambwe 4: RFQ to ALL selected + poll quotes ---- */
  const sendRfq = useCallback(async () => {
    setBusy(true)
    setPosFeedback(null)
    setPosInserts([])
    try {
      const res = await fetch("/api/erx/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          erxCode: erxCode || MARKET_DEFAULT_ERX_CODE,
          items,
          pharmacies: candidates.filter((p) => selected.includes(p.id)),
          patientName: lookup.patientDisplayName || undefined,
          patientPhone: lookup.patientPhone || undefined,
          msgUbitanze: "KEY USED",
        }),
      })
      const json = await res.json()
      if (json.ok) {
        setOrder(json.order)
        setPaying(false)
        if (json.posSummary) setPosFeedback(json.posSummary)
        if (Array.isArray(json.posInserts)) setPosInserts(json.posInserts)
        goStep(3)
      } else if (json.code) {
        setPosFeedback(`POS insert failed: ${json.code}`)
      }
    } finally {
      setBusy(false)
    }
  }, [erxCode, items, candidates, selected, lookup.patientDisplayName, lookup.patientPhone, goStep])

  const orderId = order?.id
  const rated = Boolean(order?.rating)
  useEffect(() => {
    if (!orderId || rated) return
    setSyncCountdown(ERX_SYNC_POLL_SEC)
    const pullOnce = async () => {
      try {
        const res = await fetch(`/api/erx/orders/${orderId}/quotes`, { cache: "no-store" })
        const json = await res.json()
        if (json.ok) setOrder(json.order)
      } catch {
        /* retry on interval */
      }
    }
    void pullOnce()
    const tick = window.setInterval(() => {
      setSyncCountdown((s) => (s <= 1 ? ERX_SYNC_POLL_SEC : s - 1))
    }, 1000)
    const poll = window.setInterval(() => {
      setSyncCountdown(ERX_SYNC_POLL_SEC)
      void pullOnce()
    }, POLL_MS)
    return () => {
      window.clearInterval(tick)
      window.clearInterval(poll)
    }
  }, [orderId, rated])

  const postOrderAction = useCallback(
    async (action: string, body?: Record<string, unknown>) => {
      if (!orderId) return null
      setBusy(true)
      try {
        const res = await fetch(`/api/erx/orders/${orderId}/${action}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body || {}),
        })
        const json = await res.json()
        if (json.ok) {
          setOrder(json.order)
          return json.order as ErxOrderSnapshot
        }
        return null
      } finally {
        setBusy(false)
      }
    },
    [orderId],
  )

  const restart = useCallback(() => {
    setStep(0)
    setErxCode(initialCode?.trim() || MARKET_DEFAULT_ERX_CODE)
    setLookup(IDLE_LOOKUP)
    setItems([])
    setCandidates([])
    setSelected([])
    setOrder(null)
    setPaying(false)
    setCandidatesError(null)
    scrollRef.current?.scrollTo({ top: 0 })
  }, [initialCode])

  const maskedPatient = "•••••••••"
  const rxTotalAvg = items.reduce((s, i) => s + i.qty * i.avgUnit, 0)

  // Portal to <body>: ancestors with CSS transforms would otherwise re-anchor
  // this fixed overlay away from the viewport.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[70] flex justify-center bg-[#F2F5FA]">
      <div ref={scrollRef} className="flex h-full w-full max-w-[430px] flex-col overflow-y-auto">
        {/* ============================ HEADER ============================ */}
        <header className="sticky top-0 z-[5] bg-[#132A47] px-4 pb-3 pt-[13px] text-white">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <button
                type="button"
                onClick={goBack}
                aria-label={ERX_COPY.backButton}
                className="rounded-full p-1 text-white/90 hover:bg-white/10"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <Image
                src="/images/ishyiga-logo.png"
                alt="Ishyiga"
                width={26}
                height={26}
                style={{ width: 26, height: 26 }}
                className="rounded bg-white/95 p-0.5"
              />
              <b className="text-[19px] tracking-[.4px]">
                IHUTE <span className="text-[#F2B705]">eRx</span>
              </b>
            </span>
            <span className="flex items-center gap-2">
              <span className="rounded-full bg-[#0E7C46] px-2 py-[3px] text-[10.5px] font-bold">
                {ERX_COPY.hieUp}
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Funga"
                className="rounded-full p-1 text-white/80 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </span>
          </div>
          <div className="mt-0.5 text-[11px] text-[#B9C4DC]">{ERX_COPY.brandSub}</div>
          <div className="mt-2.5 flex items-center gap-2.5">
            <span className="whitespace-nowrap rounded-full bg-[#F2B705] px-2.5 py-[3px] text-[13px] font-extrabold text-[#132A47]">
              {ERX_COPY.stepPill(step + 1)}
            </span>
            <span className="flex-1 text-[13px] font-bold text-white">{ERX_STEP_NAMES[step]}</span>
          </div>
          <div className="mt-2 flex gap-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <i
                key={i}
                className={`h-1 flex-1 rounded-sm ${i <= step ? "bg-[#F2B705]" : "bg-[#33436B]"}`}
              />
            ))}
          </div>
        </header>

        <main className="flex-1 px-3.5 pb-[84px] pt-3.5 text-[#16233B]">
          {/* ---- Intambwe 1: kode + gufungura (one card, live components) ---- */}
          {step === 0 && (
            <div className="rounded-[14px] border border-[#DDE3EE] bg-white p-4 shadow-sm mb-3">
              <h1 className="text-xl font-extrabold tracking-tight">
                {ERX_COPY.unlockTitle}{" "}
                <span className="text-[11.5px] font-normal text-[#6B7690]">
                  {ERX_COPY.unlockTitleEn}
                </span>
              </h1>
              <p className="text-[13px] text-[#6B7690] mb-3">{ERX_COPY.unlockLead}</p>
              <PharmacyErxInput
                compact
                singleKeyMode
                initialCode={erxCode || MARKET_DEFAULT_ERX_CODE}
                onLookup={runLookup}
              />
              <div className="mt-3 flex gap-2 rounded-[10px] border border-[#F2C4C0] bg-[#FCE9E7] p-2.5 text-xs text-[#7C221D]">
                <b>⚠</b>
                <span>
                  <b>{ERX_COPY.privacyBold}</b> {ERX_COPY.privacyPre}
                  <span className="rounded-md bg-[#FCE9E7] px-1 font-extrabold text-[#D0342C]">
                    {maskedPatient}
                  </span>
                  {ERX_COPY.privacyPost}
                </span>
              </div>
              {(lookup.loading || lookup.errorCode) && (
                <div className="mt-3">
                  <PharmacyErxResult
                    loading={lookup.loading}
                    errorCode={lookup.errorCode}
                    errorMessage={lookup.errorMessage}
                    failedFields={lookup.failedFields}
                    patientDisplayName={null}
                    drugs={null}
                  />
                </div>
              )}
            </div>
          )}

          {/* ---- Intambwe 2: imiti yasabwe ---- */}
          {step === 1 && (
            <>
              <div className="rounded-[14px] border border-[#DDE3EE] bg-white p-4 shadow-sm mb-3">
                <div className="mb-1 flex items-center justify-between">
                  <h1 className="text-xl font-extrabold tracking-tight">{ERX_COPY.rxTitle}</h1>
                  <span className="rounded-full bg-[#E2F4EC] px-2 py-1 text-[11px] font-extrabold text-[#118A5A]">
                    {ERX_COPY.rxUnlockedChip}
                  </span>
                </div>
                <p className="text-[13px] text-[#6B7690] mb-3">
                  {ERX_COPY.rxLead(lookup.patientDisplayName || "", erxCode || MARKET_DEFAULT_ERX_CODE)}
                </p>
                {items.map((it) => (
                  <div key={it.name} className="border-b border-dashed border-[#DDE3EE] py-[11px] last:border-b-0">
                    <div className="flex justify-between gap-2.5">
                      <b className="text-[14.5px]">{it.name}</b>
                      <span className="h-fit whitespace-nowrap rounded-lg bg-[#EEF1F6] px-2 py-1 text-xs font-extrabold text-[#3A4A6B]">
                        × {it.qty}
                      </span>
                    </div>
                    {it.doseText ? (
                      <div className="mt-1 text-xs leading-[1.45] text-[#6B7690]">{it.doseText}</div>
                    ) : null}
                    {it.avgUnit > 0 ? (
                      <div className="mt-1 text-[11.5px] text-[#6B7690]">
                        {ERX_COPY.rxAvgLine(String(it.avgUnit), (it.qty * it.avgUnit).toLocaleString("en-US"))}
                      </div>
                    ) : null}
                  </div>
                ))}
                {rxTotalAvg > 0 ? (
                  <div className="flex justify-between pt-2.5 text-[14.5px] font-extrabold">
                    <span>{ERX_COPY.rxTotal}</span>
                    <span>≈ {rxTotalAvg.toLocaleString("en-US")} RWF</span>
                  </div>
                ) : (
                  <p className="pt-2.5 text-[11.5px] text-[#6B7690]">{ERX_COPY.rxPriceFromPharmacy}</p>
                )}
              </div>
              {candidatesError ? (
                <p className="mb-3 rounded-[10px] border border-[#F2C4C0] bg-[#FCE9E7] p-3 text-xs text-[#7C221D]">
                  {candidatesError}
                </p>
              ) : null}
              <button
                type="button"
                disabled={candidatesLoading}
                onClick={findPharmacies}
                className="block w-full rounded-xl bg-[#1E3A5F] p-[15px] text-base font-extrabold text-white disabled:opacity-45"
              >
                {ERX_COPY.rxFindButton}
              </button>
            </>
          )}

          {/* ---- Intambwe 3: amafarumasi akwegereye ---- */}
          {step === 2 && (
            <>
              <ErxStepCandidates
              pharmacies={candidates}
              items={items}
              selected={selected}
              onToggle={(id, on) =>
                setSelected((cur) => (on ? [...cur, id] : cur.filter((x) => x !== id)))
              }
              onSelectAll={() => {
                const allIds = candidates.map((p) => p.id)
                const allOn = allIds.length > 0 && allIds.every((id) => selected.includes(id))
                setSelected(allOn ? [] : allIds)
              }}
              onSend={() => void sendRfq()}
              sending={busy}
            />
            </>
          )}

          {/* ---- Intambwe 4: ibiciro no kwishyura ---- */}
          {step === 3 && order && !paying && (
            <>
            <ErxStepQuotes
              order={order}
              countdownSec={syncCountdown}
              posInsertByPharmacy={Object.fromEntries(
                posInserts.map((r) => [
                  r.pharmacyId,
                  {
                    ok: r.ok,
                    alreadyExists: r.alreadyExists,
                    transactionId: r.transactionId,
                    error: r.error,
                  },
                ]),
              )}
              onChoose={(pharmacyId) => {
                void postOrderAction("choose", { pharmacyId }).then((o) => {
                  if (o) {
                    setPaying(true)
                    scrollRef.current?.scrollTo({ top: 0 })
                  }
                })
              }}
            />
            </>
          )}
          {step === 3 && order && paying && (
            <ErxStepPay
              order={order}
              paying={busy}
              onBack={() => setPaying(false)}
              onPay={({ momo, choice, momoSms, txId, paymentName }) => {
                const delivery = choice === "pharm" ? "pharmacy" : choice
                void postOrderAction("pay", { momo, delivery, momoSms, txId, paymentName }).then((o) => {
                  if (o) goStep(4)
                })
              }}
            />
          )}

          {/* ---- Intambwe 5: gukurikirana itumiza ---- */}
          {step === 4 && order && (
            <ErxStepTrack
              order={order}
              busy={busy}
              onDelivered={() => void postOrderAction("delivered")}
              onRate={(pharmacyStars, riderStars) =>
                void postOrderAction("rate", { pharmacyStars, riderStars })
              }
              onFinish={restart}
            />
          )}
        </main>

        <footer className="px-4 pb-16 pt-2.5 text-center text-[10.5px] text-[#6B7690]">
          ihute.rw by Ishyiga Software · Kigali ·{" "}
          <a href="tel:+250798687932" className="text-[#6B7690]">
            +250 798 687 932
          </a>{" "}
          · info@ihute.rw
          <br />
          <button type="button" onClick={restart} className="text-[#6B7690] underline">
            Tangira bundi bushya · Restart demo
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
