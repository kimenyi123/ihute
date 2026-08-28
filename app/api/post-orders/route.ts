import { NextRequest, NextResponse } from "next/server"
import { getPostOrdersUrl, getProxyTimeoutMs } from "@/lib/backend-config"
import { buildPostOrdersXml } from "@/lib/post-orders-build"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const PROXY_TIMEOUT_MS = Math.max(15000, getProxyTimeoutMs())

/**
 * GET – health check, returns post_orders URL (no secret data).
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/post-orders",
    postOrdersUrl: getPostOrdersUrl(),
  })
}

/**
 * POST – proxy to Java post_orders (Trading/post_orders).
 * - Content-Type: application/json → build XML from body and forward.
 * - Content-Type: application/xml or text/xml → forward body as-is.
 */
export async function POST(req: NextRequest) {
  const postOrdersUrl = getPostOrdersUrl()
  let xmlBody: string
  const contentType = req.headers.get("content-type") ?? ""

  try {
    if (contentType.includes("application/json")) {
      const json = await req.json()
      xmlBody = buildPostOrdersXml(json)
    } else if (contentType.includes("application/xml") || contentType.includes("text/xml")) {
      xmlBody = await req.text()
    } else {
      return NextResponse.json(
        {
          ok: false,
          error: "Content-Type must be application/json or application/xml",
        },
        { status: 400 },
      )
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Invalid request body"
    return NextResponse.json({ ok: false, error: msg }, { status: 400 })
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS)

  try {
    const res = await fetch(postOrdersUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/xml",
        Accept: "application/xml, text/plain, */*",
      },
      body: xmlBody,
      signal: controller.signal,
      cache: "no-store",
    })
    clearTimeout(timeoutId)

    const text = await res.text()

    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: `Backend returned ${res.status}`,
          status: res.status,
          body: text.slice(0, 500),
        },
        { status: res.status >= 500 ? 502 : res.status },
      )
    }

    const trimmed = text.trim()
    if (/^\d+$/.test(trimmed) || trimmed === "") {
      return NextResponse.json({
        ok: true,
        result: trimmed || "1",
        postOrdersUrl,
      })
    }

    try {
      const parsed = JSON.parse(text)
      return NextResponse.json({ ok: true, ...parsed, postOrdersUrl })
    } catch {
      return NextResponse.json({
        ok: true,
        result: text,
        postOrdersUrl,
      })
    }
  } catch (e: unknown) {
    clearTimeout(timeoutId)
    const msg = e instanceof Error ? e.message : String(e)
    const isAbort = e instanceof Error && e.name === "AbortError"
    return NextResponse.json(
      {
        ok: false,
        error: isAbort ? "Request to post_orders timed out" : msg,
        postOrdersUrl,
      },
      { status: 502 },
    )
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}
