// app/api/orders/update-status/route.ts
import { NextResponse } from "next/server"

import { getOrderStatusUrl } from "@/lib/backend-config"

const ORDER_STATUS_URL = getOrderStatusUrl()

function isLikelyStatusTransitionConflict(res: Response, json: Record<string, unknown> | null): boolean {
  if (res.status === 409 || res.status === 423) return true
  const err = String(json?.error ?? json?.message ?? "").toLowerCase()
  return (
    err.includes("transition") ||
    err.includes("invalid status") ||
    err.includes("cannot change") ||
    err.includes("not allowed") ||
    err.includes("conflict") ||
    err.includes("wrong state")
  )
}

function looksAlreadyAtTarget(json: Record<string, unknown> | null, target: string): boolean {
  const err = String(json?.error ?? json?.message ?? "").toLowerCase()
  const cur = String(json?.currentStatus ?? json?.orderStatus ?? json?.status ?? "").toLowerCase()
  if (cur && cur === target.toLowerCase()) return true
  return err.includes("already") && (err.includes(target) || err.includes("delivered") || err.includes("processing"))
}

async function postOrderStatus(
  orderId: number,
  status: string,
  publicSiteUrl: string,
): Promise<{ ok: boolean; res: Response; json: Record<string, unknown> | null }> {
  const payload: Record<string, unknown> = {
    orderId: Number(orderId),
    status: String(status),
  }
  if (publicSiteUrl) payload.publicSiteUrl = publicSiteUrl

  const res = await fetch(ORDER_STATUS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  })

  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null
  const ok = Boolean(res.ok && json?.ok)
  return { ok, res, json }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Order status update endpoint",
    method: "POST",
    endpoint: "/api/orders/update-status",
    backendUrl: ORDER_STATUS_URL,
    requiredFields: ["orderId", "status"],
    validStatuses: ["open", "pending", "processing", "invoice", "in-transit", "delivered"],
    example: {
      orderId: 400,
      status: "processing"
    }
  })
}

export async function POST(req: Request) {
  try {
    if (!ORDER_STATUS_URL) {
      return NextResponse.json(
        { ok: false, error: "ORDER_STATUS_URL not configured" },
        { status: 500 }
      )
    }

    const body = await req.json()
    const { orderId, status, publicSiteUrl: publicSiteUrlRaw } = body

    // Validation
    if (!orderId) {
      return NextResponse.json(
        { ok: false, error: "orderId required" },
        { status: 400 }
      )
    }
    if (!status) {
      return NextResponse.json(
        { ok: false, error: "status required" },
        { status: 400 }
      )
    }

    // Validate status value
    const validStatuses = ["open", "pending", "processing", "invoice", "in-transit", "delivered"]
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { ok: false, error: `Invalid status: ${status}. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      )
    }

    console.log(`[UPDATE-STATUS] Updating order ${orderId} to status: ${status}`)
    console.log(`[UPDATE-STATUS] Backend URL: ${ORDER_STATUS_URL}`)

    const publicSiteUrl =
      (typeof publicSiteUrlRaw === "string" && publicSiteUrlRaw.trim()) ||
      process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")

    let { ok, res, json } = await postOrderStatus(Number(orderId), String(status), publicSiteUrl)

    /** Kaos often rejects open → delivered; bridge via `processing` (same for some invoice paths). */
    const st = String(status)
    if (!ok && isLikelyStatusTransitionConflict(res, json)) {
      if (st === "delivered") {
        console.warn(`[UPDATE-STATUS] conflict on delivered (HTTP ${res.status}); bridging via processing`)
        await postOrderStatus(Number(orderId), "processing", publicSiteUrl)
        ;({ ok, res, json } = await postOrderStatus(Number(orderId), "delivered", publicSiteUrl))
      } else if (st === "invoice") {
        console.warn(`[UPDATE-STATUS] conflict on invoice (HTTP ${res.status}); bridging via processing`)
        await postOrderStatus(Number(orderId), "processing", publicSiteUrl)
        ;({ ok, res, json } = await postOrderStatus(Number(orderId), "invoice", publicSiteUrl))
      }
    }

    /** Double-click / replay: treat “already there” as success so UI does not error. */
    if (!ok && looksAlreadyAtTarget(json, st)) {
      console.log(`[UPDATE-STATUS] idempotent ok — already at or past ${st}`)
      return NextResponse.json({ ok: true, ...(json ?? {}), idempotent: true })
    }

    if (!ok) {
      const errorMsg = (json?.error as string) || `HTTP ${res.status}`
      console.error(`[UPDATE-STATUS] Error: ${errorMsg}`)
      return NextResponse.json(
        { ok: false, error: errorMsg },
        { status: res.status || 502 }
      )
    }

    console.log(`[UPDATE-STATUS] Success:`, json)
    return NextResponse.json(json)

  } catch (e: any) {
    console.error("[UPDATE-STATUS] Exception:", e)
    return NextResponse.json(
      { ok: false, error: e?.message || "unknown error" },
      { status: 500 }
    )
  }
}