import { NextResponse } from "next/server"
import { getGrandmaBuyerApiUrl, getProxyTimeoutMs } from "@/lib/backend-config"

export const runtime = "nodejs"

/**
 * Proxies buyer signup to Spring Boot Grandma API (account_buyer), so the browser
 * does not need Tomcat or JAVA_AUTH_URL for this flow.
 */
export async function POST(req: Request) {
  const rid = crypto.randomUUID()
  const t0 = Date.now()
  const url = getGrandmaBuyerApiUrl()

  try {
    const body = await req.json()
    let res: Response
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(getProxyTimeoutMs()),
      })
    } catch (e: unknown) {
      const detail = e instanceof Error ? e.message : String(e)
      console.error(`[RID ${rid}] Grandma buyer proxy unreachable`, e)
      return NextResponse.json(
        {
          ok: false,
          error: `Cannot reach Grandma buyer API (${url}). Deploy Trading WAR on Tomcat or set GRANDMA_BUYER_API_URL. ${detail}`,
          code: "GRANDMA_UNREACHABLE",
          rid,
        },
        { status: 503 }
      )
    }

    const text = await res.text()
    let json: unknown
    try {
      json = text ? JSON.parse(text) : {}
    } catch {
      const preview = text.slice(0, 500)
      console.error(`[RID ${rid}] Grandma buyer non-JSON HTTP ${res.status} ${url}`, preview)
      return NextResponse.json(
        {
          ok: false,
          error:
            "Tomcat did not return JSON (often a 404/500 HTML page). Check BACKEND_URL / GRANDMA_BUYER_API_URL matches your deployed servlet.",
          code: "GRANDMA_NOT_JSON",
          upstreamStatus: res.status,
          upstreamUrl: url,
          raw: text.slice(0, 600),
          rid,
        },
        { status: 502 }
      )
    }

    const payload = typeof json === "object" && json !== null ? { ...(json as object), rid } : { ok: false, rid }
    const statusOut = res.status >= 500 ? 502 : res.status
    console.log(`[RID ${rid}] Grandma buyer proxy -> ${res.status} in ${Date.now() - t0}ms`)
    return NextResponse.json(payload, { status: statusOut })
  } catch (e: unknown) {
    console.error(`[RID ${rid}] /api/grandma/buyers`, e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "unknown error", rid },
      { status: 400 }
    )
  }
}
