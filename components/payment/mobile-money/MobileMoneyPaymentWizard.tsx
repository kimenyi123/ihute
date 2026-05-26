"use client"

import { useCallback, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CheckCircle2, Loader2, Smartphone, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  normalizeRwMobileMoneyPhone,
  isValidRwMobileMoneyPhone,
  validatePositiveAmountRwf,
} from "@/lib/mobile-money-validation"

type Provider = "mtn" | "airtel"
type Step = "pick" | "details" | "waiting" | "result"

export function MobileMoneyPaymentWizard() {
  const router = useRouter()
  const [provider, setProvider] = useState<Provider | null>(null)
  const [step, setStep] = useState<Step>("pick")
  const [phone, setPhone] = useState("")
  const [amountStr, setAmountStr] = useState("")
  const [maskedPhone, setMaskedPhone] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [paymentStatus, setPaymentStatus] = useState<"SUCCESS" | "FAILED" | null>(null)
  const [paymentMessage, setPaymentMessage] = useState("")

  const amountNum = useMemo(() => {
    const n = Number.parseFloat(amountStr.replace(/,/g, ""))
    return Number.isFinite(n) ? n : NaN
  }, [amountStr])

  const phoneValid = useMemo(() => {
    const norm = normalizeRwMobileMoneyPhone(phone)
    return isValidRwMobileMoneyPhone(norm)
  }, [phone])

  const resetFlow = useCallback(() => {
    setProvider(null)
    setStep("pick")
    setPhone("")
    setAmountStr("")
    setMaskedPhone("")
    setError("")
    setPaymentStatus(null)
    setPaymentMessage("")
  }, [])

  const selectProvider = (p: Provider) => {
    setProvider(p)
    setStep("details")
    setError("")
    setPaymentStatus(null)
    setPaymentMessage("")
  }

  const payStart = async () => {
    if (!provider) return
    setError("")
    const norm = normalizeRwMobileMoneyPhone(phone)
    if (!isValidRwMobileMoneyPhone(norm)) {
      setError("Enter a valid Rwanda mobile number (e.g. 078 … or 25078 …).")
      return
    }
    if (!validatePositiveAmountRwf(amountNum)) {
      setError("Amount must be between 100 and 50,000,000 RWF.")
      return
    }

    setLoading(true)
    setStep("waiting")
    try {
      const startRes = await fetch("/api/payment/mobile-money/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, phone: norm, amount: Math.round(amountNum) }),
      })
      const startData = (await startRes.json()) as { ok?: boolean; sessionToken?: string; maskedPhone?: string; error?: string }
      if (!startRes.ok || !startData.ok || !startData.sessionToken) {
        throw new Error(startData.error || `Request failed (${startRes.status})`)
      }
      setMaskedPhone(startData.maskedPhone ?? "")

      // Simulate network/payment processor callback delay.
      await new Promise((resolve) => setTimeout(resolve, 1400))

      const completeRes = await fetch("/api/payment/mobile-money/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken: startData.sessionToken }),
      })
      const completeData = (await completeRes.json()) as {
        ok?: boolean
        transactionId?: string
        status?: string
        paymentMethod?: string
        phoneMasked?: string
        amountRwf?: number
        error?: string
      }
      if (!completeRes.ok || !completeData.ok || !completeData.transactionId) {
        throw new Error(completeData.error || `Payment failed (${completeRes.status})`)
      }

      const status = completeData.status === "FAILED" ? "FAILED" : "SUCCESS"
      setPaymentStatus(status)
      setPaymentMessage(
        status === "SUCCESS"
          ? "Payment confirmed on your phone."
          : "Payment was not confirmed on your phone.",
      )
      setStep("result")

      if (status === "SUCCESS") {
        const q = new URLSearchParams({
          transactionId: completeData.transactionId,
          status,
          method: completeData.paymentMethod ?? (provider === "mtn" ? "MTN Mobile Money" : "Airtel Money"),
          phone: completeData.phoneMasked ?? startData.maskedPhone ?? "",
          amount: String(completeData.amountRwf ?? Math.round(amountNum)),
        })
        router.push(`/payment/track?${q.toString()}`)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not start payment")
      setStep("details")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-blue-100 bg-gradient-to-b from-blue-50/60 to-white p-6 shadow-lg shadow-blue-900/5">
      <div className="mb-5 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/25">
            <Smartphone className="h-5 w-5" aria-hidden />
          </div>
          <h2 className="text-lg font-bold tracking-tight text-blue-950">Mobile money</h2>
        </div>
        <p className="text-xs text-blue-900/75">Request to pay flow</p>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </div>
      ) : null}

      {step === "pick" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => selectProvider("mtn")}
            className={cn(
              "flex min-h-[88px] flex-col items-start gap-1 rounded-xl border-2 p-4 text-left transition-all duration-200 hover:scale-[1.01] hover:shadow-md",
              "border-blue-300/60 bg-blue-50/80",
            )}
          >
            <span className="text-xl" aria-hidden>
              📱
            </span>
            <span className="font-semibold text-blue-950">MTN Mobile Money</span>
            <span className="text-[11px] text-blue-900/70">Push prompt to phone</span>
          </button>
          <button
            type="button"
            onClick={() => selectProvider("airtel")}
            className={cn(
              "flex min-h-[88px] flex-col items-start gap-1 rounded-xl border-2 p-4 text-left transition-all duration-200 hover:scale-[1.01] hover:shadow-md",
              "border-blue-300/60 bg-blue-50/70",
            )}
          >
            <span className="text-xl" aria-hidden>
              📲
            </span>
            <span className="font-semibold text-blue-950">Airtel Money</span>
            <span className="text-[11px] text-blue-900/70">USSD confirmation flow</span>
          </button>
        </div>
      ) : null}

      {step === "details" && provider ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold capitalize text-blue-950">{provider}</p>
            <Button type="button" variant="ghost" size="sm" className="shrink-0 text-blue-800" onClick={resetFlow}>
              Change
            </Button>
          </div>
          <div>
            <Label htmlFor="mm-phone" className="text-blue-900">
              Mobile number
            </Label>
            <Input
              id="mm-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={provider === "mtn" ? "078 …" : "073 …"}
              className={cn(
                "mt-1.5 min-h-[48px] border-blue-200 text-base transition-shadow focus-visible:border-blue-500 focus-visible:ring-blue-500/20",
                phoneValid && "ring-2 ring-blue-400/30",
              )}
            />
          </div>
          <div>
            <Label htmlFor="mm-amount" className="text-blue-900">
              Amount (RWF)
            </Label>
            <Input
              id="mm-amount"
              type="text"
              inputMode="decimal"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value.replace(/[^\d.,]/g, ""))}
              placeholder="5,000"
              className="mt-1.5 min-h-[48px] border-blue-200 text-base focus-visible:border-blue-500 focus-visible:ring-blue-500/20"
            />
          </div>

          <div className="animate-in fade-in rounded-xl border border-blue-200 bg-blue-50/60 px-3 py-2 text-xs text-blue-900">
            You will receive a prompt on your phone to confirm this payment.
          </div>

          {provider === "airtel" ? (
            <div className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs text-blue-900">
              Dial *182# to confirm payment of{" "}
              <span className="font-semibold">{Number.isFinite(amountNum) ? Math.round(amountNum).toLocaleString() : "0"} RWF</span>
            </div>
          ) : null}

          <Button
            type="button"
            className="min-h-[48px] w-full bg-gradient-to-r from-blue-600 to-blue-700 font-bold text-white shadow-md shadow-blue-700/20 hover:from-blue-500 hover:to-blue-600"
            disabled={loading}
            onClick={() => void payStart()}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending request...
              </>
            ) : (
              "Send order"
            )}
          </Button>
        </div>
      ) : null}

      {step === "waiting" ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-4 text-sm text-blue-900">
          <div className="flex items-center gap-2 font-semibold">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Waiting for confirmation...
          </div>
          <p className="mt-2 text-xs text-blue-900/80">
            Confirm on {maskedPhone || "your phone"} to complete this payment request.
          </p>
        </div>
      ) : null}

      {step === "result" && paymentStatus ? (
        <div
          className={cn(
            "rounded-xl border px-4 py-4 text-sm",
            paymentStatus === "SUCCESS" ? "border-blue-200 bg-blue-50 text-blue-900" : "border-red-200 bg-red-50 text-red-800",
          )}
        >
          <div className="flex items-center gap-2 font-semibold">
            {paymentStatus === "SUCCESS" ? (
              <CheckCircle2 className="h-4 w-4" aria-hidden />
            ) : (
              <XCircle className="h-4 w-4" aria-hidden />
            )}
            {paymentStatus === "SUCCESS" ? "Payment successful" : "Payment failed"}
          </div>
          <p className="mt-2 text-xs">{paymentMessage}</p>
          <Button type="button" variant="outline" className="mt-3 border-blue-200 text-blue-900" onClick={resetFlow}>
            Start another payment
          </Button>
        </div>
      ) : null}
    </div>
  )
}
