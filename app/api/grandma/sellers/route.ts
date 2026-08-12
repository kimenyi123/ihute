import { NextResponse } from "next/server"
import { getGrandmaSellerApiUrl, getProxyTimeoutMs } from "@/lib/backend-config"
import { persistGrandmaSellerGps } from "@/lib/grandma-seller-gps-persist"
import { isValidLatLng } from "@/lib/geo-haversine"

export const runtime = "nodejs"

/** Proxies seller signup to Tomcat {@code CreateSellerServlet} (account_seller). */
export async function POST(req: Request) {
  const rid = crypto.randomUUID()
  const t0 = Date.now()
  const url = getGrandmaSellerApiUrl()

  try {
    const body = (await req.json()) as Record<string, unknown>
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
      console.error(`[RID ${rid}] Grandma seller proxy unreachable`, e)
      return NextResponse.json(
        {
          ok: false,
          error: `Cannot reach Grandma seller API (${url}). Deploy Trading WAR with /Api/grandma/sellers or set GRANDMA_SELLER_API_URL. ${detail}`,
          code: "GRANDMA_SELLER_UNREACHABLE",
          rid,
        },
        { status: 503 },
      )
    }

    const text = await res.text()
    let json: unknown
    try {
      json = text ? JSON.parse(text) : {}
    } catch {
      const preview = text.slice(0, 500)
      console.error(`[RID ${rid}] Grandma seller non-JSON HTTP ${res.status} ${url}`, preview)
      return NextResponse.json(
        {
          ok: false,
          error:
            "Tomcat did not return JSON (often a 404/500 HTML page). Check BACKEND_URL / GRANDMA_SELLER_API_URL and servlet deployment.",
          code: "GRANDMA_NOT_JSON",
          upstreamStatus: res.status,
          upstreamUrl: url,
          raw: text.slice(0, 600),
          rid,
        },
        { status: 502 },
      )
    }

    const base =
      typeof json === "object" && json !== null
        ? { ...(json as Record<string, unknown>) }
        : ({ ok: false } as Record<string, unknown>)

    // Best-effort: write GPS onto existing supplier_* columns so Near Me works
    // even if CreateSellerServlet ignores latitude/longitude in the JSON body.
    let gpsPersist: unknown = undefined
    const ishyiga = String(base.ishyigaAccount ?? "").trim()
    const lat = body.latitude != null ? Number(body.latitude) : NaN
    const lng = body.longitude != null ? Number(body.longitude) : NaN
    if (res.ok && base.ok && ishyiga && isValidLatLng(lat, lng)) {
      const accuracy =
        body.gpsAccuracy != null && Number.isFinite(Number(body.gpsAccuracy))
          ? Number(body.gpsAccuracy)
          : null
      const persist = await persistGrandmaSellerGps({
        ishyigaAccount: ishyiga,
        latitude: lat,
        longitude: lng,
        gpsAccuracy: accuracy,
      })
      gpsPersist = persist
      if (!persist.ok && !persist.skipped) {
        console.warn(`[RID ${rid}] Grandma seller GPS persist failed:`, persist.error)
      } else if (persist.ok) {
        console.log(
          `[RID ${rid}] Grandma seller GPS persisted seller=${persist.updatedSeller} signup=${persist.updatedSignup}`,
        )
      }
    }

    const payload = { ...base, rid, ...(gpsPersist ? { gpsPersist } : {}) }
    const statusOut = res.status >= 500 ? 502 : res.status
    console.log(`[RID ${rid}] Grandma seller proxy -> ${res.status} in ${Date.now() - t0}ms`)
    return NextResponse.json(payload, { status: statusOut })
  } catch (e: unknown) {
    console.error(`[RID ${rid}] /api/grandma/sellers`, e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "unknown error", rid },
      { status: 400 },
    )
  }
}
