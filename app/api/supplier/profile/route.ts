// app/api/supplier/profile/route.ts
import { NextRequest, NextResponse } from "next/server"

import { getBackendBase } from "@/lib/backend-config"

const SUPPLIER_STOCK_URL = `${getBackendBase()}/SupplierStock`

/**
 * GET /api/supplier/profile?account=...
 * Proxies to Kaos SupplierStock?action=profile&account=...
 * Returns { ok, preferredCategories } for Bar/Restaurant checkbox from account_signup.PREFEREDCATEGORIES.
 */
export async function GET(req: NextRequest) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), Number(process.env.PROXY_TIMEOUT_MS ?? 12000))

  try {
    const account = req.nextUrl.searchParams.get("account")
    if (!account) {
      return NextResponse.json(
        { ok: false, error: "account required", preferredCategories: "" },
        { status: 400 }
      )
    }

    const url = `${SUPPLIER_STOCK_URL}?account=${encodeURIComponent(account)}&action=profile`
    const resp = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      signal: controller.signal,
      cache: "no-store",
    })

    const text = await resp.text()
    let data: { ok?: boolean; preferredCategories?: string; owner?: string; error?: string }
    try {
      data = JSON.parse(text)
    } catch {
      return NextResponse.json(
        { ok: true, preferredCategories: "" },
        { status: 200 }
      )
    }

    if (!data.ok) {
      return NextResponse.json(
        { ok: true, preferredCategories: "" },
        { status: 200 }
      )
    }

    return NextResponse.json({
      ok: true,
      preferredCategories: typeof data.preferredCategories === "string" ? data.preferredCategories : "",
      owner: typeof data.owner === "string" ? data.owner : "",
    })
  } catch (e: any) {
    if (e.name === "AbortError") {
      return NextResponse.json(
        { ok: true, preferredCategories: "" },
        { status: 200 }
      )
    }
    return NextResponse.json(
      { ok: true, preferredCategories: "" },
      { status: 200 }
    )
  } finally {
    clearTimeout(timeout)
  }
}
