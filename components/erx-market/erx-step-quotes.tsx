"use client"

/**
 * Intambwe 4/5 — Ibiciro no kwishyura (RFQ quotes + pay).
 * Quotes stream in (CALLING / YEMEJE / IGICE / NTABWO BIHARI / BYAHAGARITSWE),
 * ABAMAKE = live cheapest-per-medicine panel, "Hagarika guhamagara" cancels
 * pending RFQs only. Pay screen: 🏠 pharmacy delivery / 🏍🚲 Seller Central
 * rider offers (rendered as they arrive) / 🚶 pickup = 0; totals update live.
 * Copy verbatim from ihute_erx_sample_v4.html.
 */

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { ERX_COPY, fmtRwf } from "@/lib/erx/erx-market-copy"
import {
  matchMoMoSmsToOrderTotal,
  type MoMoSmsMatchResult,
} from "@/lib/momo-payment-sms-match"
import type { ErxOrderSnapshot, ErxQuote } from "@/lib/erx/erx-market-types"

function firstWord(s: string): string {
  return s.split(" ")[0]
}

function quoteNet(q: ErxQuote): number {
  return Math.round(q.goods * (1 - q.discountPct / 100))
}

function AbamakePanel({ order }: { order: ErxOrderSnapshot }) {
  const ready = order.quotes.filter((q) => q.status === "FULL" || q.status === "PARTIAL")
  if (!ready.length) return null
  return (
    <div className="rounded-xl border-[1.5px] border-[#DDE3EE] bg-white p-3 mb-2.5">
      <h3 className="text-[13px] font-extrabold text-[#1E3A5F] mb-1.5">{ERX_COPY.abamakeTitle}</h3>
      {order.items.map((it, ix) => {
        const offers = ready
          .map((q) => ({ ph: q.pharmacyName, l: q.lines[ix] }))
          .filter((o) => o.l && o.l.qty > 0)
          .sort((a, b) => a.l.unit - b.l.unit)
        if (!offers.length) {
          return (
            <div key={it.name} className="flex justify-between gap-2 border-b border-dashed border-[#DDE3EE] py-1 text-[12.5px] last:border-b-0">
              <span>{firstWord(it.name)}</span>
              <span className="text-[11px] text-[#6B7690]">{ERX_COPY.abamakeWaiting}</span>
            </div>
          )
        }
        const w = offers[0]
        const rest = offers
          .slice(1)
          .map((o) => `${firstWord(o.ph)} ${fmtRwf(o.l.unit)}`)
          .join(" · ")
        return (
          <div key={it.name} className="flex justify-between gap-2 border-b border-dashed border-[#DDE3EE] py-1 text-[12.5px] last:border-b-0">
            <span>
              {firstWord(it.name)} × {w.l.qty}
            </span>
            <span className="text-right">
              <span className="whitespace-nowrap font-extrabold text-[#118A5A]">
                {w.ph} · {fmtRwf(w.l.unit)} RWF/u
              </span>
              {rest ? (
                <>
                  <br />
                  <span className="text-[11px] text-[#6B7690]">{rest}</span>
                </>
              ) : null}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function QuoteCard({
  q,
  itemCount,
  onChoose,
  posInsert,
}: {
  q: ErxQuote
  itemCount: number
  onChoose: (pharmacyId: string) => void
  posInsert?: { ok: boolean; alreadyExists?: boolean; transactionId?: string; error?: string }
}) {
  if (q.status === "CALLING") {
    const inserted = posInsert?.ok === true
    const insertFailed = posInsert && !posInsert.ok
    return (
      <div className="rounded-xl border-[1.5px] border-[#DDE3EE] bg-white p-3 mb-2.5">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[14.5px] font-extrabold">{q.pharmacyName}</span>
          <div className="flex flex-col items-end gap-1">
            {inserted ? (
              <span className="rounded-full bg-[#E2F4EC] px-2 py-1 text-[11px] font-extrabold text-[#118A5A]">
                {posInsert?.alreadyExists ? ERX_COPY.chipAlreadyInserted : ERX_COPY.chipInserted}
              </span>
            ) : insertFailed ? (
              <span className="rounded-full bg-[#FCE9E7] px-2 py-1 text-[11px] font-extrabold text-[#D0342C]">
                {ERX_COPY.chipInsertFailed}
              </span>
            ) : (
              <span className="rounded-full bg-[#FFF6DC] px-2 py-1 text-[11px] font-extrabold text-[#8A6A00]">
                {ERX_COPY.chipCalling}
              </span>
            )}
          </div>
        </div>
        {inserted && posInsert?.transactionId ? (
          <div className="pt-1 text-[10px] font-mono text-[#6B7690]">{posInsert.transactionId}</div>
        ) : null}
        {insertFailed && posInsert?.error ? (
          <div className="pt-1 text-[11px] text-[#D0342C]">{posInsert.error}</div>
        ) : null}
        {!inserted && !insertFailed ? (
          <div className="flex items-center gap-2 pt-1.5 text-[12.5px] text-[#6B7690]">
            <span className="h-[9px] w-[9px] animate-pulse rounded-full bg-[#F2B705] motion-reduce:animate-none" />
            {ERX_COPY.waitLine}
          </div>
        ) : null}
      </div>
    )
  }
  if (q.status === "STOPPED") {
    return (
      <div className="rounded-xl border-[1.5px] border-[#DDE3EE] bg-white p-3 mb-2.5 opacity-55">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[14.5px] font-extrabold">{q.pharmacyName}</span>
          <span className="rounded-full bg-[#EEF1F6] px-2 py-1 text-[11px] font-extrabold text-[#6B7690]">
            {ERX_COPY.chipStopped}
          </span>
        </div>
      </div>
    )
  }
  if (q.status === "DECLINED") {
    return (
      <div className="rounded-xl border-[1.5px] border-[#DDE3EE] bg-white p-3 mb-2.5 opacity-55">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[14.5px] font-extrabold">{q.pharmacyName}</span>
          <span className="rounded-full bg-[#FCE9E7] px-2 py-1 text-[11px] font-extrabold text-[#D0342C]">
            {ERX_COPY.chipDeclined}
          </span>
        </div>
        <div className="pt-1.5 text-[11.5px] text-[#6B7690]">{ERX_COPY.declinedLine}</div>
      </div>
    )
  }

  const full = q.status === "FULL"
  const confirmedCount = q.lines.filter((l) => l.qty >= l.need).length
  const net = quoteNet(q) + q.deliveryFee
  return (
    <div className="rounded-xl border-[1.5px] border-[#DDE3EE] bg-white p-3 mb-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-[14.5px] font-extrabold">{q.pharmacyName}</span>
          <div className="text-[11px] text-[#6B7690]">
            {q.zone} · {q.distKm.toFixed(1)} km · ★ {q.stars.toFixed(1)}
          </div>
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-1 text-[11px] font-extrabold",
            full ? "bg-[#E2F4EC] text-[#118A5A]" : "bg-[#FFF6DC] text-[#8A6A00]",
          )}
        >
          {full ? ERX_COPY.chipFull(itemCount, itemCount) : ERX_COPY.chipPartial(confirmedCount, itemCount)}
        </span>
      </div>
      <div className="mt-2 border-t border-dashed border-[#DDE3EE] pt-2">
        {q.lines.map((l) => (
          <div key={l.name} className="flex justify-between py-0.5 text-[12.5px]">
            <span>
              {firstWord(l.name)} × {l.qty}
              {l.qty < l.need ? (
                <span className="font-bold text-[#8A6A00]"> {ERX_COPY.partialOf(l.need)}</span>
              ) : null}
            </span>
            <span className={cn("font-bold", l.qty < l.need ? "text-[#8A6A00]" : "text-[#118A5A]")}>
              {fmtRwf(l.price)} RWF
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <div>
          <div className="text-lg font-extrabold">{fmtRwf(net)} RWF</div>
          <div className="text-[11.5px] text-[#6B7690]">
            {ERX_COPY.quoteMeta(fmtRwf(q.deliveryFee), q.etaMin)}
            {q.discountPct ? (
              <>
                {" · "}
                <b className="text-[#118A5A]">−{q.discountPct}%</b>
              </>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onChoose(q.pharmacyId)}
          className="rounded-xl bg-[#1E3A5F] px-4 py-[11px] text-sm font-extrabold text-white"
        >
          {ERX_COPY.chooseButton}
        </button>
      </div>
    </div>
  )
}

function SyncBar({ order, countdownSec }: { order: ErxOrderSnapshot; countdownSec: number }) {
  const answers = order.sync?.answers || []
  const answered = answers.filter((a) => a.status !== "CALLING")
  return (
    <div className="mb-3 flex flex-col gap-2 rounded-xl border-[1.5px] border-[#DDE3EE] bg-[#F7F9FC] p-3 sm:flex-row sm:items-start sm:gap-3">
      <div className="shrink-0 rounded-lg bg-[#1E3A5F] px-3 py-2 text-center text-white">
        <div className="text-[10px] font-bold uppercase tracking-wide text-[#B9C4DC]">
          {ERX_COPY.syncCountdownEn}
        </div>
        <div className="text-2xl font-extrabold tabular-nums">{countdownSec}s</div>
        <div className="text-[10px] text-[#B9C4DC]">{ERX_COPY.syncCountdown(countdownSec)}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-extrabold uppercase tracking-wide text-[#6B7690]">
          {ERX_COPY.syncAnswersTitle}
        </div>
        {answered.length ? (
          <ul className="mt-1 space-y-0.5">
            {answered.map((a) => (
              <li key={a.pharmacyId} className="text-[12px] text-[#16233B]">
                <span className="font-extrabold">{a.pharmacyName}</span>
                <span className="text-[#6B7690]"> · {a.status} · </span>
                <span className="font-bold text-[#118A5A]">{a.preview}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-[12px] text-[#6B7690]">{ERX_COPY.quotesLeadWaiting}</p>
        )}
      </div>
    </div>
  )
}

export function ErxStepQuotes({
  order,
  onChoose,
  countdownSec = 10,
  posInsertByPharmacy = {},
}: {
  order: ErxOrderSnapshot
  onChoose: (pharmacyId: string) => void
  countdownSec?: number
  posInsertByPharmacy?: Record<
    string,
    { ok: boolean; alreadyExists?: boolean; transactionId?: string; error?: string }
  >
}) {
  const anyReady = order.quotes.some((q) => q.status === "FULL" || q.status === "PARTIAL")
  return (
    <div className="rounded-[14px] border border-[#DDE3EE] bg-white p-4 shadow-sm mb-3">
      <h1 className="text-xl font-extrabold tracking-tight text-[#16233B]">
        {ERX_COPY.quotesTitle}{" "}
        <span className="text-[11.5px] font-normal text-[#6B7690]">{ERX_COPY.quotesTitleEn}</span>
      </h1>
      <p className="text-[13px] text-[#6B7690] mb-3">
        {ERX_COPY.quotesOrderPrefix(order.id)}{" "}
        {anyReady ? ERX_COPY.quotesLeadReady : ERX_COPY.quotesLeadWaiting}{" "}
        {order.stillCalling && anyReady ? ERX_COPY.quotesLeadOthers : ""}
      </p>
      {order.sync ? <SyncBar order={order} countdownSec={countdownSec} /> : null}
      <AbamakePanel order={order} />
      {order.quotes.map((q) => (
        <QuoteCard
          key={q.pharmacyId}
          q={q}
          itemCount={order.items.length}
          onChoose={onChoose}
          posInsert={posInsertByPharmacy[q.pharmacyId]}
        />
      ))}
    </div>
  )
}

/* ============================== PAY SCREEN ============================== */

const VEHICLE_ICON: Record<string, string> = { moto: "🏍", bike: "🚲" }
const VEHICLE_WORD: Record<string, string> = { moto: "Moto", bike: "Bike" }

export type ErxDeliveryChoice = "pharm" | "pickup" | string

export function erxDeliveryAmount(order: ErxOrderSnapshot, q: ErxQuote, choice: ErxDeliveryChoice): number {
  if (choice === "pickup") return 0
  if (choice === "pharm") return q.deliveryFee
  const r = order.riderOffers.find((x) => x.id === choice)
  return r ? r.fee : q.deliveryFee
}

export function erxDeliveryLabel(order: ErxOrderSnapshot, choice: ErxDeliveryChoice): string {
  if (choice === "pickup") return ERX_COPY.delPickupChosen
  if (choice === "pharm") return ERX_COPY.delPharmacyTitle
  const r = order.riderOffers.find((x) => x.id === choice)
  return r
    ? `${VEHICLE_ICON[r.vehicle]} ${VEHICLE_WORD[r.vehicle]} ya ${r.rider} (Seller Central)`
    : "Delivery"
}

export function ErxStepPay({
  order,
  onPay,
  onBack,
  paying,
}: {
  order: ErxOrderSnapshot
  onPay: (input: {
    momo: string
    choice: ErxDeliveryChoice
    momoSms: string
    txId: string | null
    paymentName: string
  }) => void
  onBack: () => void
  paying: boolean
}) {
  const [choice, setChoice] = useState<ErxDeliveryChoice>("pharm")
  const [momo, setMomo] = useState("")
  const [momoSms, setMomoSms] = useState("")
  const [momoTouched, setMomoTouched] = useState(false)
  const [smsMatch, setSmsMatch] = useState<MoMoSmsMatchResult | null>(null)

  const q = order.quotes.find((x) => x.pharmacyId === order.chosenPharmacyId)
  const net = q ? quoteNet(q) : 0
  const delAmt = q ? erxDeliveryAmount(order, q, choice) : 0
  const total = net + delAmt
  const momoOk = momo.replace(/\s+/g, "").length >= 8

  useEffect(() => {
    const text = momoSms.trim()
    if (text.length < 8 || total < 1) {
      setSmsMatch(null)
      return
    }
    const timer = window.setTimeout(() => {
      setSmsMatch(matchMoMoSmsToOrderTotal(text, Math.round(total), 2))
    }, 450)
    return () => window.clearTimeout(timer)
  }, [momoSms, total])

  const smsPaid = Boolean(smsMatch?.matched && smsMatch.txId)

  if (!q) return null

  const optionRow = (
    value: ErxDeliveryChoice,
    title: string,
    sub: string,
    amount: string,
  ) => (
    <label
      key={value}
      className={cn(
        "flex items-center gap-2.5 rounded-xl border-[1.5px] bg-white p-3 mb-2 cursor-pointer",
        choice === value ? "border-[#1E3A5F] shadow-[0_0_0_2px_rgba(30,58,95,.14)]" : "border-[#DDE3EE]",
      )}
    >
      <input
        type="radio"
        name="erx-delivery"
        checked={choice === value}
        onChange={() => setChoice(value)}
        className="h-5 w-5 accent-[#1E3A5F]"
      />
      <div className="flex-1">
        <div className="text-[13.5px] font-extrabold">{title}</div>
        <div className="text-[11.5px] text-[#6B7690]">{sub}</div>
      </div>
      <b className="whitespace-nowrap">{amount}</b>
    </label>
  )

  return (
    <div className="rounded-[14px] border border-[#DDE3EE] bg-white p-4 shadow-sm mb-3">
      <h1 className="text-xl font-extrabold tracking-tight text-[#16233B]">
        {ERX_COPY.payTitle(q.pharmacyName)}
      </h1>
      <p className="text-[13px] text-[#6B7690] mb-3">
        {q.status === "FULL" ? ERX_COPY.payLeadFull : ERX_COPY.payLeadPartial}
      </p>

      {q.lines.map((l) => (
        <div key={l.name} className="flex justify-between py-1 text-sm">
          <span>
            {firstWord(l.name)} × {l.qty}
          </span>
          <span>{fmtRwf(l.price)} RWF</span>
        </div>
      ))}
      {q.discountPct ? (
        <div className="flex justify-between py-1 text-sm">
          <span>{ERX_COPY.payDiscount}</span>
          <span className="font-extrabold text-[#118A5A]">−{q.discountPct}%</span>
        </div>
      ) : null}

      <label className="mt-3 mb-1 block text-[11.5px] font-bold text-[#3A4A6B]">
        {ERX_COPY.payDeliveryLabel}
      </label>
      <div>
        {optionRow("pharm", ERX_COPY.delPharmacyTitle, ERX_COPY.delPharmacySub(q.etaMin), `${fmtRwf(q.deliveryFee)} RWF`)}
        {order.riderOffers.map((r) =>
          optionRow(
            r.id,
            ERX_COPY.delRiderTitle(VEHICLE_ICON[r.vehicle], VEHICLE_WORD[r.vehicle], r.rider),
            ERX_COPY.delRiderSub(r.etaMin),
            `${fmtRwf(r.fee)} RWF`,
          ),
        )}
        {optionRow("pickup", ERX_COPY.delPickupTitle, ERX_COPY.delPickupSub, "0 RWF")}
        {!order.riderOffers.length ? (
          <div className="px-0.5 pt-0.5 text-[11.5px] text-[#6B7690]">{ERX_COPY.delRidersComing}</div>
        ) : null}
      </div>

      <div className="flex justify-between py-1 text-sm">
        <span>{erxDeliveryLabel(order, choice)}</span>
        <span>{fmtRwf(delAmt)} RWF</span>
      </div>
      <div className="mt-1.5 flex justify-between border-t-[1.5px] border-[#DDE3EE] pt-2.5 text-[17px] font-extrabold">
        <span>{ERX_COPY.payTotal}</span>
        <span>{fmtRwf(total)} RWF</span>
      </div>

      <label className="mt-3 mb-1 block text-[11.5px] font-bold text-[#3A4A6B]" htmlFor="erx-momo">
        {ERX_COPY.momoLabel}
      </label>
      <input
        id="erx-momo"
        inputMode="tel"
        value={momo}
        onChange={(e) => setMomo(e.target.value)}
        onBlur={() => setMomoTouched(true)}
        placeholder={ERX_COPY.momoPlaceholder}
        className={cn(
          "w-full rounded-[10px] border-[1.5px] bg-white p-[13px] text-base focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[rgba(30,58,95,.3)]",
          momoTouched && !momoOk ? "border-[#D0342C]" : "border-[#DDE3EE]",
        )}
      />

      <label className="mt-3 mb-1 block text-[11.5px] font-bold text-[#3A4A6B]" htmlFor="erx-momo-sms">
        {ERX_COPY.momoSmsLabel}
      </label>
      <p className="mb-1 text-[11px] text-[#6B7690]">{ERX_COPY.momoSmsHint(fmtRwf(total))}</p>
      <textarea
        id="erx-momo-sms"
        value={momoSms}
        onChange={(e) => setMomoSms(e.target.value)}
        placeholder={ERX_COPY.momoSmsPlaceholder}
        className="min-h-[88px] w-full resize-y rounded-[10px] border-[1.5px] border-[#DDE3EE] bg-white p-[13px] text-sm focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[rgba(30,58,95,.3)]"
      />
      {smsPaid && smsMatch?.txId ? (
        <div className="mt-2 rounded-lg border border-[#B8E6CF] bg-[#E2F4EC] px-2 py-2 text-xs font-medium text-[#118A5A]">
          {ERX_COPY.momoSmsPaid(smsMatch.txId)}
        </div>
      ) : null}
      {smsMatch && !smsMatch.matched && momoSms.trim().length > 8 ? (
        <div className="mt-2 rounded-lg border border-[#F2C4C0] bg-[#FCE9E7] px-2 py-2 text-xs text-[#7C221D]">
          {ERX_COPY.momoSmsMismatch}
        </div>
      ) : null}

      <div className="h-3" />
      <button
        type="button"
        disabled={!momoOk || !smsPaid || paying}
        onClick={() =>
          onPay({
            momo,
            choice,
            momoSms: momoSms.trim(),
            txId: smsMatch?.txId ?? null,
            paymentName: momoSms.toLowerCase().includes("airtel") ? "airtel" : "momo",
          })
        }
        className="block w-full rounded-xl bg-[#F2B705] p-[15px] text-base font-extrabold text-[#132A47] disabled:opacity-45 disabled:cursor-not-allowed"
      >
        {ERX_COPY.payButton(fmtRwf(total))}
      </button>
      <div className="h-2" />
      <button
        type="button"
        onClick={onBack}
        className="block w-full rounded-xl border-[1.5px] border-[#DDE3EE] bg-white p-[15px] text-base font-extrabold text-[#1E3A5F]"
      >
        {ERX_COPY.backToQuotes}
      </button>
    </div>
  )
}
