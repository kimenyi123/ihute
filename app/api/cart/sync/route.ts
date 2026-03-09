/**
 * Cart sync: save/load cart for logged-in users via Kaos/CartSyncServlet.
 */
import { NextRequest, NextResponse } from "next/server"
import { getBackendBase } from "@/lib/backend-config"

const CART_SYNC_URL = `${getBackendBase()}/Kaos/CartSyncServlet`

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId")?.trim() ?? req.headers.get("x-user-id")?.trim()
  if (!userId) {
    return NextResponse.json({ ok: true, items: [] })
  }
  try {
    const res = await fetch(`${CART_SYNC_URL}?userId=${encodeURIComponent(userId)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    })
    const data = await res.json().catch(() => ({}))
    const items = Array.isArray(data?.items) ? data.items : []
    return NextResponse.json({ ok: true, items })
  } catch {
    return NextResponse.json({ ok: true, items: [] })
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const userId = (body.userId ?? body.user_id ?? req.headers.get("x-user-id"))?.trim()
  if (!userId) {
    return NextResponse.json({ ok: true })
  }
  const items = Array.isArray(body.items) ? body.items : []
  try {
    await fetch(CART_SYNC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, items }),
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    // no-op on failure
  }
  return NextResponse.json({ ok: true })
}
