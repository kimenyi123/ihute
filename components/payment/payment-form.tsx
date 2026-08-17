"use client"

import { useMemo, useState } from "react"
import { CheckCircle2, CreditCard, Loader2, Smartphone, XCircle } from "lucide-react"
import { UrubutoApi } from "@/lib/urubuto-api"
import type { PaymentInitiationRequest } from "@/lib/payment-types"
import {
  PAYMENT_METHODS,
  mapToUrubutoChannel,
  isUrubutoPaySupported,
  getPaymentMethodInfo,
  formatPaymentMethod,
} from "@/lib/payment-utils"
import { digitsOnly } from "@/lib/rwanda-phone"
import { cn } from "@/lib/utils"
import { AcceptedCardNetworksStrip } from "@/components/payment/AcceptedCardNetworksStrip"

interface PaymentFormProps {
  onPaymentInitiated?: (response: unknown) => void
  defaultPayerCode?: string
  defaultAmount?: number
  defaultMethod?: string
}

type CardNetwork = "VISA" | "MASTERCARD" | "AMEX" | "VERVE"

function parseAmountRwf(raw: string): number {
  const n = Number.parseFloat(raw.replace(/,/g, "").trim())
  return Number.isFinite(n) ? n : NaN
}

const methodOrder = [
  PAYMENT_METHODS.MOMO,
  PAYMENT_METHODS.CARD,
  PAYMENT_METHODS.BANK,
  PAYMENT_METHODS.COD,
] as const

const cardChoices: { id: CardNetwork; label: string }[] = [
  { id: "VISA", label: "Visa" },
  { id: "MASTERCARD", label: "Mastercard" },
  { id: "AMEX", label: "Amex" },
  { id: "VERVE", label: "Verve" },
]

export default function PaymentForm({
  onPaymentInitiated,
  defaultPayerCode = "",
  defaultAmount = 0,
  defaultMethod = PAYMENT_METHODS.MOMO,
}: PaymentFormProps) {
  const [formData, setFormData] = useState({
    payer_code: defaultPayerCode,
    amount: defaultAmount > 0 ? String(defaultAmount) : "",
    internal_method: defaultMethod,
    phone_number: "",
    payer_names: "",
    payer_email: "",
  })
  const [selectedCard, setSelectedCard] = useState<CardNetwork | null>(null)
  const [loading, setLoading] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [paymentState, setPaymentState] = useState<"success" | "failed" | null>(null)
  const [error, setError] = useState("")

  const amountParsed = useMemo(() => parseAmountRwf(formData.amount), [formData.amount])
  const showPhone = formData.internal_method !== PAYMENT_METHODS.COD && formData.internal_method !== PAYMENT_METHODS.CARD
  const showCardPicker = formData.internal_method === PAYMENT_METHODS.CARD
  const showCardFields = showCardPicker && selectedCard !== null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setWaiting(false)
    setPaymentState(null)
    setError("")

    try {
      if (!isUrubutoPaySupported(formData.internal_method)) {
        throw new Error(
          `Payment method ${formatPaymentMethod(formData.internal_method)} is not supported for online payments`,
        )
      }

      const amount = parseAmountRwf(formData.amount)
      if (!Number.isFinite(amount) || amount < 100) {
        throw new Error("Enter a valid amount (minimum 100 RWF).")
      }

      const needsPhone =
        formData.internal_method !== PAYMENT_METHODS.COD && formData.internal_method !== PAYMENT_METHODS.CARD
      if (needsPhone) {
        const tel = digitsOnly(formData.phone_number)
        if (tel.length < 9) {
          throw new Error("Enter a valid mobile money number.")
        }
      }

      if (showCardPicker && !selectedCard) {
        throw new Error("Select a card type to continue.")
      }

      const urubutoRequest: PaymentInitiationRequest = {
        payer_code: formData.payer_code.trim(),
        amount: Math.round(amount),
        channel_name: mapToUrubutoChannel(formData.internal_method),
        phone_number: formData.phone_number.trim(),
        payer_names: formData.payer_names.trim(),
        payer_email: formData.payer_email.trim(),
        card_type_to_be_used: showCardPicker ? selectedCard ?? "VISA" : "NOT_APPLICABLE",
      }

      setWaiting(true)
      const response = await UrubutoApi.initiatePayment(urubutoRequest)
      onPaymentInitiated?.(response)

      const cardUrl =
        response && typeof response === "object" && "card_processing_url" in response
          ? (response as { card_processing_url?: string }).card_processing_url
          : undefined
      if (cardUrl) {
        window.open(cardUrl, "_blank", "noopener,noreferrer")
      }

      setPaymentState("success")
    } catch (err) {
      setPaymentState("failed")
      setError(err instanceof Error ? err.message : "Payment initiation failed")
    } finally {
      setWaiting(false)
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const paymentMethodInfo = getPaymentMethodInfo(formData.internal_method)

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-blue-100 bg-gradient-to-b from-blue-50/50 to-white p-6 shadow-lg shadow-blue-900/5">
      <div className="mb-5 flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/25">
          <Smartphone className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h2 className="text-lg font-bold tracking-tight text-blue-950">Urubuto</h2>
          <p className="text-xs text-blue-800/80">Secure checkout</p>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </div>
      ) : null}

      {waiting ? (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          Waiting for confirmation...
        </div>
      ) : null}

      {paymentState === "success" ? (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          <span className="inline-flex items-center gap-1 font-semibold">
            <CheckCircle2 className="h-4 w-4" aria-hidden /> Payment request sent
          </span>
        </div>
      ) : null}

      {paymentState === "failed" && !error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <span className="inline-flex items-center gap-1 font-semibold">
            <XCircle className="h-4 w-4" aria-hidden /> Payment failed
          </span>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-blue-900/70">Method</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {methodOrder.map((m) => {
              const info = getPaymentMethodInfo(m)
              const active = formData.internal_method === m
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setFormData((p) => ({ ...p, internal_method: m }))
                    if (m !== PAYMENT_METHODS.CARD) setSelectedCard(null)
                  }}
                  className={cn(
                    "flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-xl border-2 px-2 py-2 text-center text-[11px] font-bold transition-all duration-200",
                    active
                      ? "border-blue-500 bg-blue-50 text-blue-950 shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:border-blue-200",
                  )}
                >
                  <span className="text-base leading-none" aria-hidden>
                    {info.icon}
                  </span>
                  <span className="leading-tight">{info.name}</span>
                </button>
              )
            })}
          </div>
          {!isUrubutoPaySupported(formData.internal_method) ? (
            <p className="text-xs font-medium text-amber-700">Manual processing - not available online.</p>
          ) : null}
        </div>

        {showCardPicker ? (
          <div className="rounded-xl border border-blue-100 bg-white/90 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wide text-blue-800">Select card</p>
              <AcceptedCardNetworksStrip className="max-w-[180px]" />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {cardChoices.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setSelectedCard(card.id)}
                  className={cn(
                    "flex min-h-[44px] items-center justify-center rounded-lg border text-xs font-semibold transition",
                    selectedCard === card.id
                      ? "border-blue-500 bg-blue-50 text-blue-900"
                      : "border-slate-200 bg-white text-slate-700 hover:border-blue-300",
                  )}
                  aria-pressed={selectedCard === card.id}
                >
                  {card.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {showCardFields ? (
          <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/40 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-900">
              <CreditCard className="h-4 w-4" aria-hidden />
              {selectedCard} details
            </div>
            <input
              type="text"
              disabled
              placeholder="Card number"
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                disabled
                placeholder="MM/YY"
                className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500"
              />
              <input
                type="text"
                disabled
                placeholder="CVV"
                className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500"
              />
            </div>
          </div>
        ) : null}

        <div>
          <label htmlFor="payer_code" className="mb-1 block text-xs font-semibold text-blue-900">
            Payer code
          </label>
          <input
            type="text"
            id="payer_code"
            name="payer_code"
            value={formData.payer_code}
            onChange={handleChange}
            required
            className="min-h-[48px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base outline-none transition-shadow focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
          />
        </div>

        <div>
          <label htmlFor="amount" className="mb-1 block text-xs font-semibold text-blue-900">
            Amount (RWF)
          </label>
          <input
            type="text"
            id="amount"
            name="amount"
            inputMode="decimal"
            value={formData.amount}
            onChange={handleChange}
            required
            className="min-h-[48px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base outline-none transition-shadow focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
            placeholder="15,000"
          />
        </div>

        {showPhone ? (
          <div>
            <label htmlFor="phone_number" className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-blue-900">
              <Smartphone className="h-3.5 w-3.5 text-blue-700" aria-hidden />
              Mobile Money number
            </label>
            <input
              type="tel"
              id="phone_number"
              name="phone_number"
              value={formData.phone_number}
              onChange={handleChange}
              required
              className="min-h-[48px] w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-base outline-none transition-shadow focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
              placeholder="+250 7..."
              autoComplete="tel"
            />
            <p className="mt-1 text-xs text-blue-900/80">You will receive a prompt on your phone to confirm this payment.</p>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="payer_names" className="mb-1 block text-xs font-semibold text-blue-900">
              Name <span className="font-normal text-slate-500">(opt.)</span>
            </label>
            <input
              type="text"
              id="payer_names"
              name="payer_names"
              value={formData.payer_names}
              onChange={handleChange}
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
            />
          </div>
          <div>
            <label htmlFor="payer_email" className="mb-1 block text-xs font-semibold text-blue-900">
              Email <span className="font-normal text-slate-500">(opt.)</span>
            </label>
            <input
              type="email"
              id="payer_email"
              name="payer_email"
              value={formData.payer_email}
              onChange={handleChange}
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !isUrubutoPaySupported(formData.internal_method)}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 text-base font-bold text-white shadow-lg shadow-blue-700/25 transition hover:from-blue-500 hover:to-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              Sending request...
            </>
          ) : (
            <>
              Pay {Number.isFinite(amountParsed) ? amountParsed.toLocaleString() : "-"} RWF
              <span className="sr-only">{paymentMethodInfo.name}</span>
            </>
          )}
        </button>
      </form>
    </div>
  )
}
