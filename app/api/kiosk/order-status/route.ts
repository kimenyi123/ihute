import { NextRequest, NextResponse } from "next/server"
import { getOrderStatusUrl } from "@/lib/backend-config"
import type { KioskOrderStatus } from "@/src/modules/self-order/types"

const PICKUP_DONE = "KIOSK_PICKUP_DONE"
const LANES_PREFIX = "KIOSK_LANES:"
const SPEAK_SEQ_PREFIX = "KIOSK_SPEAK_SEQ:"

const VALID_LANE: KioskOrderStatus[] = [
  "waiting",
  "in_kitchen",
  "ready",
  "completed",
  "cancelled",
]

function parseLaneStatus(v: unknown): KioskOrderStatus | undefined {
  const s = String(v ?? "").toLowerCase().trim()
  return VALID_LANE.includes(s as KioskOrderStatus) ? (s as KioskOrderStatus) : undefined
}

/** Matches Kaos INTERNAL_DATA marker written by KioskController */
function parseKioskLanesFromInternal(internalRaw: string): {
  bar?: KioskOrderStatus
  kitchen?: KioskOrderStatus
} | null {
  const internal = String(internalRaw ?? "")
  const i = internal.indexOf(LANES_PREFIX)
  if (i < 0) return null

  // Slice the JSON object after `KIOSK_LANES:` using brace depth, not `|` splitting.
  // This makes parsing stable even if `INTERNAL_DATA` contains other tokens.
  const jsonStart = internal.indexOf("{", i + LANES_PREFIX.length)
  if (jsonStart < 0) return null

  let depth = 0
  let end = -1
  for (let k = jsonStart; k < internal.length; k++) {
    const c = internal[k]
    if (c === "{") depth++
    else if (c === "}") {
      depth--
      if (depth === 0) {
        end = k
        break
      }
    }
  }
  if (end < 0) return null

  const jsonSlice = internal.slice(jsonStart, end + 1).trim()
  if (!jsonSlice) return null
  try {
    const o = JSON.parse(jsonSlice) as Record<string, unknown>
    const bar = parseLaneStatus(o.bar)
    const kitchen = parseLaneStatus(o.kitchen)
    if (bar == null && kitchen == null) return null
    return { bar, kitchen }
  } catch {
    return null
  }
}

function mapToKioskCustomerStatus(data: Record<string, unknown>): KioskOrderStatus {
  const internal = String(data.internalData ?? data.INTERNAL_DATA ?? "")
  const dbStatus = String(data.ORDER_STATUS ?? data.order_status ?? "")
    .toUpperCase()
    .trim()
  const supplierStatus = String(data.status ?? "").toLowerCase()

  // Staff marked "Done" after pickup — customer sees finished
  if (internal.includes(PICKUP_DONE)) {
    return "completed"
  }

  // Raw DB beats normalized when PICKED (OrderStatusServlet used to map PICKED → pending)
  if (dbStatus === "PICKED") return "ready"

  if (supplierStatus === "picked") return "ready"
  if (supplierStatus === "invoice") return "in_kitchen"
  if (supplierStatus === "processing") return "in_kitchen"
  if (supplierStatus === "delivered") {
    // Completed in supplier app = DELIVERED but customer still at "pick up" until Done
    return "ready"
  }
  if (supplierStatus === "pending") return "waiting"

  switch (dbStatus) {
    case "ORDER":
      return "waiting"
    case "INVOICE":
    case "PROCESSING":
      return "in_kitchen"
    case "PICKED":
      return "ready"
    case "DELIVERED":
      return "ready"
    case "CANCEL":
      return "cancelled"
    default:
      return "waiting"
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const orderId = searchParams.get("orderId")

  if (!orderId) {
    return NextResponse.json({ error: "orderId is required" }, { status: 400 })
  }

  try {
    const url = `${getOrderStatusUrl()}?orderId=${encodeURIComponent(orderId)}`
    const resp = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    })

    const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>

    if (!resp.ok) {
      return NextResponse.json(
        { error: "Failed to fetch order status" },
        { status: 502 },
      )
    }

    const kioskStatus = mapToKioskCustomerStatus(data)

    const buyerNames = String(data.BUYER_NAMES ?? data.customer_name ?? "").trim()
    const tableName = String(data.TABLE_NAME ?? data.table_number ?? "").trim()

    const internalStr = String(data.internalData ?? data.INTERNAL_DATA ?? "")
    const laneStatuses = parseKioskLanesFromInternal(internalStr)

    const speakSeq = (() => {
      const idx = internalStr.indexOf(SPEAK_SEQ_PREFIX)
      if (idx < 0) return undefined
      const start = idx + SPEAK_SEQ_PREFIX.length
      const end = internalStr.indexOf("|", start)
      const raw = internalStr.slice(start, end < 0 ? internalStr.length : end).trim()
      if (!raw) return undefined
      const n = Number(raw)
      return Number.isFinite(n) ? n : undefined
    })()

    return NextResponse.json({
      orderId,
      order_number: data.ORDER_NUMBER ?? data.order_number ?? "",
      status: kioskStatus,
      lane_statuses: laneStatuses ?? undefined,
      speak_seq: speakSeq,
      customer_name: buyerNames && buyerNames !== "NA" ? buyerNames : "",
      table_number:
        tableName && tableName !== "NA" && tableName.toUpperCase() !== "NA" ? tableName : "",
      raw: data,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[kiosk/order-status] error", msg)
    return NextResponse.json(
      { error: "Order status request failed" },
      { status: 500 },
    )
  }
}
