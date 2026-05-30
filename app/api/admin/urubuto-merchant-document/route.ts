import { NextResponse } from "next/server"

import { getAdminServletUrl } from "@/lib/backend-config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

function getAdminServletCandidates(): string[] {
  return [getAdminServletUrl()]
}

function firstNonWhitespaceByte(ab: ArrayBuffer): number | undefined {
  const u8 = new Uint8Array(ab)
  for (let i = 0; i < u8.length; i++) {
    const b = u8[i]
    if (b !== 32 && b !== 9 && b !== 10 && b !== 13) {
      return b
    }
  }
  return undefined
}

export async function POST(req: Request) {
  try {
    const raw = await req.text()
    const trimmed = raw?.trim() ?? ""
    if (!trimmed) {
      return NextResponse.json({ ok: false, error: "Empty request body" }, { status: 400 })
    }
    let body: Record<string, unknown>
    try {
      body = JSON.parse(trimmed) as Record<string, unknown>
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return NextResponse.json({ ok: false, error: "Invalid JSON", details: msg }, { status: 400 })
    }

    const actionStr = typeof body.action === "string" ? body.action.trim() : ""
    if (actionStr !== "downloadUrubutoMerchantDocument") {
      return NextResponse.json(
        { ok: false, error: "This route only supports action downloadUrubutoMerchantDocument" },
        { status: 400 },
      )
    }

    const { action: _a, ...params } = body
    const adminTokenFromBody =
      typeof (params as { adminToken?: unknown }).adminToken === "string"
        ? String((params as { adminToken?: string }).adminToken).trim()
        : ""

    const headerEmail = req.headers.get("x-admin-email")?.trim() || ""
    const bodyEmail =
      typeof params.adminEmail === "string" ? String(params.adminEmail).trim() : ""
    let adminEmail = headerEmail
    if (!adminEmail) {
      const cookies = req.headers.get("cookie") || ""
      const authMatch = cookies.match(/auth-storage=([^;]+)/)
      if (authMatch) {
        try {
          const authData = JSON.parse(decodeURIComponent(authMatch[1]))
          if (authData?.state?.user?.role === "admin" && authData?.state?.user?.email) {
            adminEmail = String(authData.state.user.email).trim()
          }
        } catch {
          /* ignore */
        }
      }
      if (!adminEmail) {
        adminEmail = bodyEmail
      }
    }

    const headerAdminToken = req.headers.get("x-admin-token")?.trim() || ""
    const tokenForJava = adminTokenFromBody || headerAdminToken

    if (!adminEmail) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Admin email missing. Sign in again as admin, or ensure the client sends x-admin-email.",
        },
        { status: 401 },
      )
    }

    const form = new URLSearchParams()
    form.set("action", actionStr)
    form.set("adminEmail", adminEmail)
    if (tokenForJava) {
      form.set("adminToken", tokenForJava)
    }

    Object.entries(params).forEach(([key, value]) => {
      if (key === "adminEmail" || key === "adminToken") return
      if (value !== null && value !== undefined) {
        form.set(key, String(value))
      }
    })

    const urls = getAdminServletCandidates()
    const inboundCookie = req.headers.get("cookie") || ""

    for (const candidate of urls) {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000)
      try {
        const attemptRes = await fetch(candidate, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "*/*",
            ...(inboundCookie ? { Cookie: inboundCookie } : {}),
            ...(tokenForJava ? { "X-Admin-Token": tokenForJava } : {}),
          },
          body: form.toString(),
          signal: controller.signal,
          cache: "no-store",
        })
        const arrayBuf = await attemptRes.arrayBuffer()
        clearTimeout(timeoutId)

        const ct = attemptRes.headers.get("content-type") || ""
        const first = firstNonWhitespaceByte(arrayBuf)
        const looksJson = ct.includes("application/json") || first === 0x7b

        if (looksJson) {
          const text = new TextDecoder("utf-8").decode(arrayBuf)
          let json: Record<string, unknown>
          try {
            json = JSON.parse(text) as Record<string, unknown>
          } catch {
            continue
          }
          const ok = json.ok === true
          let st = attemptRes.status
          if (!ok) {
            if (st === 401 || st === 403) {
              /* keep */
            } else if (st >= 400 && st < 600) {
              /* keep */
            } else {
              st = 400
            }
          }
          return NextResponse.json(json, { status: st })
        }

        if (!attemptRes.ok) {
          return NextResponse.json(
            { ok: false, error: "Backend returned a non-JSON error for document download" },
            { status: attemptRes.status >= 400 ? attemptRes.status : 502 },
          )
        }

        const headers = new Headers()
        if (ct) {
          headers.set("Content-Type", ct)
        }
        const cd = attemptRes.headers.get("Content-Disposition")
        if (cd) {
          headers.set("Content-Disposition", cd)
        }
        return new NextResponse(arrayBuf, { status: attemptRes.status, headers })
      } catch (attemptErr: unknown) {
        clearTimeout(timeoutId)
        const msg = attemptErr instanceof Error ? attemptErr.message : String(attemptErr)
        console.error("[urubuto-merchant-document] attempt failed:", candidate, msg)
      }
    }

    return NextResponse.json(
      { ok: false, error: "Could not reach AdminServlet or response was not usable" },
      { status: 502 },
    )
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (e instanceof Error && e.name === "AbortError") {
      return NextResponse.json({ ok: false, error: "Backend request timed out" }, { status: 504 })
    }
    console.error("[urubuto-merchant-document]", msg)
    return NextResponse.json({ ok: false, error: msg || "Internal server error" }, { status: 500 })
  }
}
