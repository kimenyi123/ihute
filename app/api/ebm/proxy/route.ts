import { NextRequest, NextResponse } from "next/server"

import { getEbmInvoiceUrl } from "@/lib/ebm/config"

import { loadEbmConfigResolved } from "@/lib/ebm/ebm-platform-config"



export const runtime = "nodejs"

export const dynamic = "force-dynamic"



function resolveTargetUrl(cfg: Awaited<ReturnType<typeof loadEbmConfigResolved>>, req: NextRequest): string | null {

  if (!cfg) return null

  const headerPath = req.headers.get("x-ebm-path")?.trim()

  const path = headerPath || cfg.endpoints.invoice

  const normalized = path.startsWith("/") ? path : `/${path}`

  return `${cfg.baseUrl.replace(/\/$/, "")}${normalized}`

}



/**

 * Server-side proxy to Ishyiga RRA VSDC API (invoice + registration + items).

 * Local dev when ishyiga.com:443 is blocked:

 *   EBM_BASE_URL=https://ishyiga.com

 *   EBM_PROXY_URL=https://shop.ihute.rw/api/ebm/proxy

 * Pass target path via header: x-ebm-path: /vsdc/post_parameter_vsdc_Json

 */

export async function POST(req: NextRequest) {

  const cfg = await loadEbmConfigResolved()

  if (!cfg?.securityKey) {

    return NextResponse.json(

      { ok: false, error: "EBM_SECURITY_KEY not configured on proxy server" },

      { status: 503 },

    )

  }



  const proxySecret = process.env.EBM_PROXY_SECRET?.trim()

  if (proxySecret) {

    const provided = req.headers.get("x-ebm-proxy-secret")?.trim()

    if (provided !== proxySecret) {

      return NextResponse.json({ ok: false, error: "Unauthorized proxy request" }, { status: 401 })

    }

  }



  let body: unknown

  try {

    body = await req.json()

  } catch {

    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })

  }



  const target = resolveTargetUrl(cfg, req) || getEbmInvoiceUrl(cfg)

  const timeoutMs = Math.max(5000, Number(process.env.EBM_TIMEOUT_MS) || 30000)



  try {

    const res = await fetch(target, {

      method: "POST",

      headers: {

        "Content-Type": "application/json",

        Accept: "application/json",

        security_key: cfg.securityKey,

      },

      body: JSON.stringify(body),

      cache: "no-store",

      signal: AbortSignal.timeout(timeoutMs),

    })



    const rawText = await res.text()

    let parsed: unknown = rawText

    try {

      parsed = JSON.parse(rawText)

    } catch {

      /* keep text */

    }



    return NextResponse.json(

      { ok: res.ok, httpStatus: res.status, body: parsed, rawText },

      { status: res.ok ? 200 : res.status >= 400 && res.status < 600 ? res.status : 502 },

    )

  } catch (e: unknown) {

    const msg = e instanceof Error ? e.message : String(e)

    console.error("[ebm/proxy]", target, msg)

    return NextResponse.json(

      {

        ok: false,

        error: `Proxy could not reach Ishyiga EBM API (${target}): ${msg}`,

        code: "EBM_PROXY_NETWORK",

      },

      { status: 502 },

    )

  }

}



/** Optional GET proxy for registration status checks. */

export async function GET(req: NextRequest) {

  const cfg = await loadEbmConfigResolved()

  if (!cfg?.securityKey) {

    return NextResponse.json({ ok: false, error: "EBM not configured" }, { status: 503 })

  }



  const targetBase = resolveTargetUrl(cfg, req)

  if (!targetBase) {

    return NextResponse.json({ ok: false, error: "Invalid path" }, { status: 400 })

  }



  const qs = req.nextUrl.searchParams.toString()

  const target = qs ? `${targetBase}?${qs}` : targetBase

  const timeoutMs = Math.max(5000, Number(process.env.EBM_TIMEOUT_MS) || 30000)



  try {

    const res = await fetch(target, {

      method: "GET",

      headers: { Accept: "application/json", security_key: cfg.securityKey },

      cache: "no-store",

      signal: AbortSignal.timeout(timeoutMs),

    })

    const rawText = await res.text()

    let parsed: unknown = rawText

    try {

      parsed = JSON.parse(rawText)

    } catch {

      /* text */

    }

    return NextResponse.json(

      { ok: res.ok, httpStatus: res.status, body: parsed, rawText },

      { status: res.ok ? 200 : res.status },

    )

  } catch (e: unknown) {

    const msg = e instanceof Error ? e.message : String(e)

    return NextResponse.json({ ok: false, error: msg }, { status: 502 })

  }

}

