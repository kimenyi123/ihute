"use client"

/**
 * Intambwe 5/5 — Gukurikirana itumiza (track + mandatory rating).
 * Timeline: Paid → Pulled to POS → VSDC invoice → In transit/awaiting pickup;
 * auto-advance STOPS there. Patient taps "Imiti yangezeho / Nayifashe", then
 * MUST rate the pharmacy (and rider when one carried it) before "Byarangiye".
 * Copy verbatim from ihute_erx_sample_v4.html.
 */

import { useState } from "react"
import { cn } from "@/lib/utils"
import { ERX_COPY, fmtRwf } from "@/lib/erx/erx-market-copy"
import type { ErxOrderSnapshot } from "@/lib/erx/erx-market-types"
import { erxDeliveryLabel } from "./erx-step-quotes"

function Stars({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <div>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`${n} stars — ${label}`}
          className={cn(
            "border-0 bg-transparent text-[34px] leading-none cursor-pointer",
            n <= value ? "text-[#F2B705]" : "text-[#D7DEEA]",
          )}
        >
          ★
        </button>
      ))}
    </div>
  )
}

export function ErxStepTrack({
  order,
  onDelivered,
  onRate,
  onFinish,
  busy,
}: {
  order: ErxOrderSnapshot
  onDelivered: () => void
  onRate: (pharmacyStars: number, riderStars: number) => void
  onFinish: () => void
  busy: boolean
}) {
  const [phStars, setPhStars] = useState(0)
  const [rdStars, setRdStars] = useState(0)

  const q = order.quotes.find((x) => x.pharmacyId === order.chosenPharmacyId)
  if (!q) return null

  const isPickup = order.delivery?.mode === "pickup"
  const isRider = order.delivery?.mode === "rider"
  const delivered = Boolean(order.deliveredAt)
  const rated = Boolean(order.rating)
  const stage = order.trackStage
  const choice = order.delivery?.mode === "rider" ? order.delivery.riderId || "pharm" : order.delivery?.mode === "pickup" ? "pickup" : "pharm"
  const delLabel = erxDeliveryLabel(order, choice)

  const steps: Array<[string, string]> = [
    [ERX_COPY.tlPaid, ERX_COPY.tlPaidSub(order.paidAtLabel || "", order.momoRef || "")],
    [ERX_COPY.tlPos, ERX_COPY.tlPosSub],
    [ERX_COPY.tlInvoice, ERX_COPY.tlInvoiceSub(order.invoiceNo || "")],
    isPickup
      ? [ERX_COPY.tlAwaitPickup, ERX_COPY.tlAwaitPickupSub]
      : [ERX_COPY.tlTransit, ERX_COPY.tlTransitSub(delLabel, fmtRwf(order.delivery?.fee || 0))],
    [ERX_COPY.tlDone, q.status === "FULL" ? ERX_COPY.tlDoneFullSub : ERX_COPY.tlDonePartialSub],
  ]

  const holdBanner = ERX_COPY.holdBanner(order.erxCode)

  return (
    <>
      {rated && order.rating ? (
        <div className="mb-3 rounded-[10px] border border-[#BFE5D4] bg-[#E2F4EC] p-3 text-[13px] font-bold text-[#0B5E3D]">
          {ERX_COPY.doneBanner(order.rating.pharmacyStars, q.pharmacyName, order.rating.riderStars)}
        </div>
      ) : (
        <div className="mb-3 rounded-[10px] border border-[#BFE5D4] bg-[#E2F4EC] p-3 text-[13px] font-bold text-[#0B5E3D]">
          {holdBanner.prefix}
          <b>{holdBanner.bold}</b>
          {holdBanner.suffix}
        </div>
      )}

      <div className="rounded-[14px] border border-[#DDE3EE] bg-white p-4 shadow-sm mb-3">
        <div className="mb-2.5 flex items-center justify-between">
          <h1 className="text-xl font-extrabold tracking-tight text-[#16233B]">
            {ERX_COPY.orderTitle(order.id)}
          </h1>
          <span
            className={cn(
              "rounded-full px-2 py-1 text-[11px] font-extrabold",
              delivered ? "bg-[#E2F4EC] text-[#118A5A]" : "bg-[#D0342C] text-white",
            )}
          >
            {delivered ? ERX_COPY.chipDelivered : ERX_COPY.chipHeld}
          </span>
        </div>

        <ul className="list-none">
          {steps.map(([title, sub], i) => {
            const done = i < stage || (delivered && i <= 4)
            const now = !done && i === stage
            return (
              <li key={title} className="relative flex gap-[11px] pb-[18px] last:pb-0">
                {i < steps.length - 1 ? (
                  <span className="absolute left-[9px] top-[22px] bottom-0 w-0.5 bg-[#DDE3EE]" aria-hidden />
                ) : null}
                <span
                  className={cn(
                    "z-[1] h-5 w-5 flex-none rounded-full border-[2.5px] bg-white",
                    done
                      ? "border-[#118A5A] bg-[#118A5A]"
                      : now
                        ? "border-[#F2B705] bg-[#FFF6DC]"
                        : "border-[#DDE3EE]",
                  )}
                />
                <span>
                  <b className="block text-sm">{title}</b>
                  <small className="text-xs text-[#6B7690]">{sub}</small>
                </span>
              </li>
            )
          })}
        </ul>

        {stage === 3 && !delivered ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={onDelivered}
              className="mt-1.5 block w-full rounded-xl bg-[#F2B705] p-[15px] text-base font-extrabold text-[#132A47] disabled:opacity-45"
            >
              {isPickup ? ERX_COPY.arrivedPickup : ERX_COPY.arrivedDelivery}
            </button>
            <div className="pt-1.5 text-center text-[11.5px] text-[#6B7690]">
              {isPickup ? ERX_COPY.arrivedHintPickup : ERX_COPY.arrivedHintDelivery}
            </div>
          </>
        ) : null}
      </div>

      {delivered && !rated ? (
        <div className="rounded-[14px] border border-[#DDE3EE] bg-white p-4 shadow-sm mb-3">
          <h1 className="text-lg font-extrabold tracking-tight text-[#16233B]">
            {ERX_COPY.rateTitle}{" "}
            <span className="text-[11.5px] font-normal text-[#6B7690]">{ERX_COPY.rateTitleEn}</span>
          </h1>
          <p className="text-[13px] text-[#6B7690] mb-3">{ERX_COPY.rateLead}</p>
          <label className="mb-1 block text-[11.5px] font-bold text-[#3A4A6B]">
            {ERX_COPY.ratePharmacyLabel(q.pharmacyName)}
          </label>
          <Stars value={phStars} onChange={setPhStars} label={q.pharmacyName} />
          {isRider ? (
            <>
              <label className="mb-1 mt-2.5 block text-[11.5px] font-bold text-[#3A4A6B]">
                {ERX_COPY.rateRiderLabel(delLabel.replace(" (Seller Central)", ""))}
              </label>
              <Stars value={rdStars} onChange={setRdStars} label="rider" />
            </>
          ) : null}
          <div className="h-3" />
          <button
            type="button"
            disabled={!phStars || (isRider && !rdStars) || busy}
            onClick={() => onRate(phStars, rdStars)}
            className="block w-full rounded-xl bg-[#1E3A5F] p-[15px] text-base font-extrabold text-white disabled:opacity-45 disabled:cursor-not-allowed"
          >
            {ERX_COPY.rateSubmit}
          </button>
        </div>
      ) : null}

      <div className="rounded-[14px] border border-[#DDE3EE] bg-white p-4 shadow-sm mb-3">
        <h3 className="mb-2 text-[13px] font-extrabold text-[#1E3A5F]">{ERX_COPY.respondersTitle}</h3>
        {order.responders.map((r) => (
          <div key={r.pharmacyId} className="flex justify-between py-1 text-[13px]">
            <span>{r.pharmacyName}</span>
            <span
              className={cn(
                "rounded-full px-2 py-1 text-[11px] font-extrabold",
                r.chosen ? "bg-[#E2F4EC] text-[#118A5A]" : "bg-[#EEF1F6] text-[#6B7690]",
              )}
            >
              {r.chosen ? ERX_COPY.responderChosen : ERX_COPY.responderClosed}
            </span>
          </div>
        ))}
        <div className="pt-1.5 text-[11.5px] text-[#6B7690]">{ERX_COPY.respondersHint}</div>
      </div>

      <button
        type="button"
        onClick={onFinish}
        className={cn(
          "block w-full rounded-xl p-[15px] text-base font-extrabold",
          rated
            ? "bg-[#1E3A5F] text-white"
            : "border-[1.5px] border-[#DDE3EE] bg-white text-[#1E3A5F]",
        )}
      >
        {rated ? ERX_COPY.finishButton : ERX_COPY.anotherRx}
      </button>
    </>
  )
}
