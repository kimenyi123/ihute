import { NextResponse } from "next/server"
import { getGrandmaSellerApiUrl, getProxyTimeoutMs } from "@/lib/backend-config"
import {
  persistGrandmaSellerGps,
  toClientGpsPersistStatus,
  type GrandmaGpsPersistClientStatus,
} from "@/lib/grandma-seller-gps-persist"
import { extractGpsFromRegistrationBody } from "@/lib/grandma-seller-gps-payload"
import { isPlaceholderGrandmaShopName } from "@/lib/seller-category-sector"

export const runtime = "nodejs"

/** Proxies seller signup to Tomcat {@code CreateSellerServlet} (account_seller). */
export async function POST(req: Request) {
  const rid = crypto.randomUUID()
  const t0 = Date.now()
  const url = getGrandmaSellerApiUrl()

  try {
    const body = (await req.json()) as Record<string, unknown>
    const companyName = String(body.companyName ?? body.owner ?? "").trim()
    if (isPlaceholderGrandmaShopName(companyName)) {
      return NextResponse.json(
        {
          ok: false,
          error: "A real shop name is required",
          code: "INVALID_SHOP_NAME",
          rid,
        },
        { status: 400 },
      )
    }
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

    // Secondary sync onto account_signup + account_seller (Near Me reads account_signup).
    // Primary insert path is Java CreateSellerServlet (must also write signup GPS).
    let gpsPersist: GrandmaGpsPersistClientStatus | undefined
    const ishyiga = String(base.ishyigaAccount ?? "").trim()
    const extracted = extractGpsFromRegistrationBody(body)
    const hasGpsPayload = extracted != null

    if (res.ok && base.ok && hasGpsPayload && extracted) {
      if (!ishyiga) {
        gpsPersist = {
          ok: false,
          skipped: false,
          reason: "GPS persistence failed",
        }
        console.warn(
          `[Grandma GPS] GPS persistence failed rid=${rid} reason=missing_ishyiga_account`,
        )
      } else {
        console.log(
          `[Grandma GPS] captured rid=${rid} lat=${extracted.latitude} lng=${extracted.longitude} accuracy=${extracted.gpsAccuracy ?? "n/a"}`,
        )
        const persist = await persistGrandmaSellerGps({
          ishyigaAccount: ishyiga,
          latitude: extracted.latitude,
          longitude: extracted.longitude,
          gpsAccuracy: extracted.gpsAccuracy,
        })
        gpsPersist = toClientGpsPersistStatus(persist)

        if (persist.ok) {
          console.log(
            `[Grandma GPS] GPS persisted successfully rid=${rid} ishyigaAccount=${ishyiga} sellerRows=${persist.updatedSeller} signupRows=${persist.updatedSignup}`,
          )
        } else if (persist.skipped) {
          console.warn(
            `[Grandma GPS] GPS persistence skipped rid=${rid} ishyigaAccount=${ishyiga} reason=ONBOARDING_MYSQL_*_not_configured`,
          )
        } else {
          console.warn(
            `[Grandma GPS] GPS persistence failed rid=${rid} ishyigaAccount=${ishyiga} error=${persist.error}`,
          )
        }
      }
    } else if (res.ok && base.ok && !hasGpsPayload) {
      console.warn(`[Grandma GPS] no valid GPS in registration payload rid=${rid}`)
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
