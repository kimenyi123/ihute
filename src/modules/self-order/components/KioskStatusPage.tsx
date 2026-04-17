"use client"

import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import type { KioskOrderStatus } from "@/src/modules/self-order/types"

// ─── Keyword-based category detection to infer BAR or KITCHEN ─────────────────
const DRINK_KEYWORDS = [
  "beer","bière","primus","heineken","skol","amstel","guinness","tusker",
  "savana","smirnoff","bavaria","desperados","leffe","virunga","exo","corona","serengete",
  "wine","champagne","prosecco","whisky","whiskey","vodka","tequila","gin","rum","cognac","brandy",
  "jager","cocktail","mojito","margarita","b52","panache","soda","cola","sprite","fanta",
  "redbull","red bull","energy","lemonade","juice","jus","smoothie","water","eau",
  "coffee","café","tea","thé","umutobe","inyange",
]

function looksLikeDrink(name: string): boolean {
  const n = name.toLowerCase()
  return DRINK_KEYWORDS.some((kw) => n.includes(kw))
}

// ─── Animated particle / celebration component ────────────────────────────────
function Confetti() {
  const colors = ["#34d399","#60a5fa","#f472b6","#fbbf24","#a78bfa"]
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-0" aria-hidden>
      {Array.from({ length: 30 }).map((_, i) => (
        <div
          key={i}
          className="absolute top-0 rounded-sm opacity-0 animate-fall"
          style={{
            left: `${Math.random() * 100}%`,
            width: `${6 + Math.random() * 8}px`,
            height: `${6 + Math.random() * 8}px`,
            background: colors[i % colors.length],
            animationDelay: `${Math.random() * 2}s`,
            animationDuration: `${2 + Math.random() * 2}s`,
          }}
        />
      ))}
    </div>
  )
}

// ─── Progress step labels — bar vs kitchen ────────────────────────────────────
function getStepLabels(isBar: boolean) {
  return [
    { key: "waiting",    label: "Waiting" },
    { key: "in_kitchen", label: isBar ? "Preparing 🍺" : "In Kitchen 🍳" },
    { key: "ready",      label: "Pick Up!" },
    { key: "completed",  label: "Done ✓" },
  ]
}

interface Props {
  orderId: string
}

function laneStepLabel(s: KioskOrderStatus): string {
  switch (s) {
    case "waiting":
      return "Received"
    case "in_kitchen":
      return "Preparing"
    case "ready":
      return "Pick up"
    case "completed":
      return "Done ✓"
    case "cancelled":
      return "Cancelled"
    default:
      return s
  }
}

export function KioskStatusPage({ orderId }: Props) {
  const searchParams = useSearchParams()
  // Enable voice by default; disable with `?voice=0`.
  const voiceEnabled = searchParams.get("voice") !== "0"

  const [status, setStatus] = useState<KioskOrderStatus>("waiting")
  const [orderNumber, setOrderNumber] = useState<string>("")
  const [guestName, setGuestName] = useState<string>("")
  const [tableLabel, setTableLabel] = useState<string>("")
  const [itemNames, setItemNames] = useState<string[]>([])
  const [speakSeq, setSpeakSeq] = useState<number>(0)
  const [laneBar, setLaneBar] = useState<KioskOrderStatus | null>(null)
  const [laneKitchen, setLaneKitchen] = useState<KioskOrderStatus | null>(null)
  const [failCount, setFailCount] = useState(0)
  const [connectionLost, setConnectionLost] = useState(false)
  const prevStatusRef = useRef<KioskOrderStatus>("waiting")
  /** Never move progress bar backwards (avoids flicker if API briefly returns an older state). */
  const maxStepRef = useRef(0)

  // Infer bar vs kitchen from item names (ignored when API sends split lane_statuses)
  const isBar = itemNames.length > 0 && itemNames.every(looksLikeDrink)
  const hasDualLanes = laneBar != null && laneKitchen != null
  const showLaneBreakdown = laneBar != null || laneKitchen != null
  const steps = getStepLabels(hasDualLanes ? false : isBar)

  useEffect(() => {
    let cancelled = false
    let interval: ReturnType<typeof setInterval> | undefined

    const poll = async () => {
      try {
        const res = await fetch("/api/kiosk/order-status?orderId=" + orderId)
        const data = await res.json()
        if (cancelled) return

        const s = data.status as KioskOrderStatus
        setStatus(s)
        prevStatusRef.current = s

        const idx = ["waiting", "in_kitchen", "ready", "completed"].indexOf(s)
        if (idx >= 0) maxStepRef.current = Math.max(maxStepRef.current, idx)

        const ls = data.lane_statuses as { bar?: string; kitchen?: string } | undefined
        if (ls && (ls.bar || ls.kitchen)) {
          const valid: KioskOrderStatus[] = ["waiting", "in_kitchen", "ready", "completed", "cancelled"]
          const b = ls.bar && valid.includes(ls.bar as KioskOrderStatus) ? (ls.bar as KioskOrderStatus) : null
          const k =
            ls.kitchen && valid.includes(ls.kitchen as KioskOrderStatus)
              ? (ls.kitchen as KioskOrderStatus)
              : null
          setLaneBar(b)
          setLaneKitchen(k)
        } else {
          setLaneBar(null)
          setLaneKitchen(null)
        }

        const seq = typeof data.speak_seq === "number" ? data.speak_seq : 0
        setSpeakSeq(seq)

        // Order number
        const num = data.order_number ?? data.orderNumber
        if (num !== undefined && num !== null) setOrderNumber(String(num))

        const rawName = String(data.customer_name ?? "").trim()
        const rawTable = String(data.table_number ?? "").trim()
        setGuestName(
          rawName && rawName.toLowerCase() !== "kiosk guest" ? rawName : rawName ? "Guest" : "",
        )
        setTableLabel(
          rawTable && rawTable !== "NA" && rawTable.toUpperCase() !== "NA" ? rawTable : "",
        )

        // Item names (for bar/kitchen detection)
        if (Array.isArray(data.items)) {
          setItemNames(data.items.map((it: any) => String(it.item_name || it.name || "")))
        }

        setFailCount(0)
        if (s === "completed" || s === "cancelled") {
          if (interval) clearInterval(interval)
        }
      } catch {
        if (cancelled) return
        setFailCount((prev) => {
          const next = prev + 1
          if (next >= 3) setConnectionLost(true)
          return next
        })
      }
    }
    poll()
    interval = setInterval(poll, 6000)
    return () => {
      cancelled = true
      if (interval) clearInterval(interval)
    }
  }, [orderId])

  const displayOrderNumber = orderNumber ? `#${orderNumber}` : `#${orderId}`

  // Status-based visuals
  const isReady = status === "ready"
  const isCompleted = status === "completed"
  const isCelebrating = isReady || isCompleted
  const isPreparing = status === "in_kitchen"

  const fullOrderDone = status === "completed" || (laneBar === "completed" && laneKitchen === "completed")
  const oneSideDone =
    !fullOrderDone &&
    ((laneBar === "completed" && laneKitchen !== "completed") ||
      (laneKitchen === "completed" && laneBar !== "completed"))
  const waitingForSide =
    laneBar != null && laneKitchen != null
      ? laneBar !== "completed"
        ? "🍺 Drinks"
        : "🍽 Food"
      : ""

  // If both lanes are completed, treat the whole order as completed for UI purposes.
  // Sometimes the aggregate ORDER_STATUS lags behind lane pickup tokens, causing
  // “Now Serving” + lane markers Done at the same time.
  const effectiveStatus: KioskOrderStatus = fullOrderDone ? "completed" : status

  const spokenRef = useRef<string | null>(null)
  const [voiceArmed, setVoiceArmed] = useState(false)
  const [voiceNeedsTap, setVoiceNeedsTap] = useState(false)

  // Many browsers block `speechSynthesis` until there is a user gesture.
  // We "arm" once so voice can trigger automatically afterwards.
  useEffect(() => {
    if (!voiceEnabled) return
    if (typeof window === "undefined") return
    if (voiceArmed) return

    const arm = () => {
      setVoiceArmed(true)
      setVoiceNeedsTap(false)
      window.removeEventListener("pointerdown", arm)
      window.removeEventListener("keydown", arm)
    }

    window.addEventListener("pointerdown", arm, { passive: true })
    window.addEventListener("keydown", arm)
    return () => {
      window.removeEventListener("pointerdown", arm)
      window.removeEventListener("keydown", arm)
    }
  }, [voiceEnabled, voiceArmed])

  useEffect(() => {
    if (!voiceEnabled) return
    if (effectiveStatus !== "completed") return

    const key = `${orderId}|completed|${speakSeq}`
    if (spokenRef.current === key) return
    spokenRef.current = key

    if (typeof window === "undefined") return
    if (!("speechSynthesis" in window)) return

    try {
      const parts: string[] = []
      if (guestName) parts.push(`Order for ${guestName}.`)
      parts.push(`Order ${displayOrderNumber}.`)
      if (tableLabel) parts.push(`Table ${tableLabel}.`)
      parts.push("Ready for pickup.")

      const text = parts.join(" ")
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = "en-US"
      utterance.rate = 1
      utterance.pitch = 1
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utterance)
    } catch {
      // Ignore speech failures (browser might block audio without user gesture).
      setVoiceNeedsTap(true)
    }
  }, [voiceEnabled, effectiveStatus, orderId, displayOrderNumber, guestName, tableLabel, speakSeq])

  const statusText: Record<KioskOrderStatus, string> = {
    waiting: "Order Received — Hang tight!",
    in_kitchen: hasDualLanes
      ? "We're preparing your drinks and food 🍺🍽"
      : isBar
        ? "Your drinks are being prepared 🍺"
        : "Your food is in the kitchen 👨‍🍳",
    ready: hasDualLanes
      ? "Part or all of your order is ready for pickup!"
      : isBar
        ? "Your drinks are ready! 🍺"
        : "Your order is ready! 🎉",
    completed: "Enjoy your order! 😊",
    cancelled: "Order Cancelled",
  }

  // Progress: monotonic — never un-light a step once passed
  const currentStep = ["waiting", "in_kitchen", "ready", "completed"].indexOf(effectiveStatus)
  const stepIndex =
    currentStep >= 0 ? Math.max(currentStep, maxStepRef.current) : maxStepRef.current

  const isReadyEff = effectiveStatus === "ready"
  const isCompletedEff = effectiveStatus === "completed"
  const isPreparingEff = effectiveStatus === "in_kitchen"
  const isCelebratingEff = isReadyEff || isCompletedEff

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center px-4 relative transition-colors duration-700 ${
      isCelebratingEff ? "bg-slate-900" : isPreparingEff ? "bg-slate-950" : "bg-slate-950"
    }`}>
      {/* Confetti on ready/completed */}
      {isCelebratingEff && <Confetti />}

      <div className="relative z-10 max-w-md w-full text-center space-y-8">
        {/* "NOW SERVING" pulse badge — show when kitchen or ready */}
        {(isPreparingEff || isReadyEff) && (
          <div className="flex items-center justify-center">
            <div className="relative inline-flex">
              <div className="absolute -inset-2 rounded-2xl bg-emerald-500/20 animate-ping" />
              <div className="relative rounded-2xl border border-emerald-400/40 bg-slate-900/80 px-8 py-3 backdrop-blur">
                <p className="text-[10px] uppercase tracking-[0.4em] text-emerald-400 mb-1">Now Serving</p>
                <p className="text-5xl font-black text-emerald-200 animate-pulse">{displayOrderNumber}</p>
              </div>
            </div>
          </div>
        )}

        {/* Big order number */}
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">Order Number</p>
          <p className={`font-black tracking-tight transition-all duration-500 ${
            isCelebrating
              ? "text-7xl text-emerald-300"
              : "text-7xl text-white"
          }`}>
            {displayOrderNumber}
          </p>
          {(guestName || tableLabel) && (
            <div className="pt-2 space-y-1 text-sm text-slate-400">
              {guestName && (
                <p>
                  <span className="text-slate-500">Name:</span>{" "}
                  <span className="font-semibold text-slate-200">{guestName}</span>
                </p>
              )}
              {tableLabel && (
                <p>
                  <span className="text-slate-500">Table:</span>{" "}
                  <span className="font-semibold text-slate-200">{tableLabel}</span>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Status message */}
        <div className="space-y-3">
          <p className={`text-xl font-semibold transition-all duration-500 ${
            isCelebratingEff ? "text-emerald-300" : "text-slate-100"
          }`}>
            {statusText[effectiveStatus]}
          </p>

          {isReadyEff && (
            <div className="mt-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-5 py-3 text-emerald-200 text-sm font-medium animate-pulse">
              👉 Come to the counter when your number appears in <strong>Ready</strong>
            </div>
          )}

          {showLaneBreakdown && (
            <div className="rounded-2xl border border-slate-600/50 bg-slate-900/50 px-4 py-3 text-left text-sm text-slate-300 space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Progress by station</p>
              {laneBar && (
                <p>
                  <span className="text-slate-400">🍺 Drinks:</span>{" "}
                  <span className="font-semibold text-slate-100">{laneStepLabel(laneBar)}</span>
                </p>
              )}
              {laneKitchen && (
                <p>
                  <span className="text-slate-400">🍽 Food:</span>{" "}
                  <span className="font-semibold text-slate-100">{laneStepLabel(laneKitchen)}</span>
                </p>
              )}
              {fullOrderDone && (
                <p className="pt-1 text-emerald-200 font-semibold">
                  ✅ Full order collected (Drinks + Food)
                </p>
              )}
              {oneSideDone && waitingForSide && (
                <p className="pt-1 text-amber-200 font-semibold">
                  Waiting for: {waitingForSide}
                </p>
              )}
            </div>
          )}

          {voiceEnabled && effectiveStatus === "completed" && voiceNeedsTap && (
            <p className="text-xs text-amber-200 mt-2">
              Tap once to enable voice notifications.
            </p>
          )}

          {effectiveStatus === "waiting" && (
            <p className="text-sm text-slate-400">
              Your order has been received. Please wait while we process it.
            </p>
          )}

          {isCompletedEff && (
            <p className="text-sm text-slate-400">Thank you for your order! Come back soon 😊</p>
          )}
        </div>

        {/* Progress bar */}
        <div className="max-w-sm mx-auto w-full">
          <div className="flex justify-between text-[10px] uppercase tracking-wider text-slate-500 mb-3">
            {steps.map((s) => (
              <span key={s.key}>{s.label}</span>
            ))}
          </div>
          <div className="flex gap-1.5">
            {steps.map((s, i) => {
              const lit = i <= stepIndex
              return (
                <div
                  key={s.key}
                  className={`h-2 flex-1 rounded-full transition-all duration-700 ${
                    lit ? "bg-emerald-400" : "bg-slate-700"
                  }`}
                />
              )
            })}
          </div>
        </div>

        {/* Live indicator */}
        <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
          <div className={`w-1.5 h-1.5 rounded-full ${connectionLost ? "bg-amber-400" : "bg-emerald-500 animate-pulse"}`} />
          {connectionLost
            ? "Connection lost — please ask staff if your order is ready"
            : "Live · Updates automatically"
          }
        </div>
      </div>

      {/* Inject fall animation via style tag */}
      <style>{`
        @keyframes fall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
        }
        .animate-fall { animation: fall linear forwards; }
      `}</style>
    </div>
  )
}
