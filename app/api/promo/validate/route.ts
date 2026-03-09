import { NextRequest, NextResponse } from "next/server"
import { getBackendBase } from "@/lib/backend-config"

/**
 * Validate promo code. Backend can implement PromoServlet or similar.
 * Returns { valid, percent?, message? }. No hardcoded codes in frontend.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")?.trim().toUpperCase()
  if (!code) {
    return NextResponse.json({ valid: false, message: "Code required" }, { status: 400 })
  }

  // Backend: implement GET /Kaos/PromoServlet?code=X returning { valid, percent?, message? }
  const backendUrl = `${getBackendBase()}/Kaos/PromoServlet`
  const url = `${backendUrl}?code=${encodeURIComponent(code)}`

  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(5000) })
    if (!res.ok) {
      return NextResponse.json({ valid: false, message: "Invalid or expired code" })
    }
    const data = (await res.json().catch(() => null)) as { valid?: boolean; ok?: boolean; percent?: number; message?: string } | null
    const valid = data ? Boolean(data.valid ?? data.ok) : false
    const percent = typeof data?.percent === "number" ? data.percent : undefined
    const message = typeof data?.message === "string" ? data.message : undefined
    return NextResponse.json({ valid, percent, message })
  } catch {
    return NextResponse.json({ valid: false, message: "Invalid or expired code" })
  }
}
