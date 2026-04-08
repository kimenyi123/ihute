import { NextResponse } from "next/server"
import { getAuthUrl, getSuppliersUrl } from "@/lib/backend-config" // ← add getSuppliersUrl

const JAVA_AUTH_URL = getAuthUrl()
const JAVA_SUPPLIERS_URL = getSuppliersUrl() // e.g. http://yourserver/Api/InsertSuppliers

export async function POST(req: Request) {
  const rid = crypto.randomUUID()
  const t0 = Date.now()

  try {
    const body = await req.json()
    const { role } = body

    // ─── SELLER → InsertSuppliers servlet ───────────────────────────────────
    if (String(role).toUpperCase() === "SELLER") {
      if (!JAVA_SUPPLIERS_URL) {
        console.error(`[RID ${rid}] Missing JAVA_SUPPLIERS_URL`)
        return NextResponse.json({ ok: false, error: "JAVA_SUPPLIERS_URL not configured", rid }, { status: 500 })
      }

      const {
        email, password, firstName, lastName, tel, location,
        tin, sector, deliveryMode, momoCode, companyName,
        latitude, longitude,
      } = body

      const sellerPayload: Record<string, string> = {
        email:           String(email || ""),
        password:        String(password || ""),
        owner:           [firstName, lastName].filter(Boolean).join(" "),
        company_name:    String(companyName || ""),
        phone:           String(tel || ""),
        location:        String(location || ""),
        tin:             String(tin || ""),
        ishyiga_account: "NA",                                  // servlet will auto-generate
        sector:          String(sector || "").toLowerCase(),
        delivery_mode:   String(deliveryMode || "").toLowerCase(),
        momo_code:       String(momoCode || ""),
      }
      if (latitude != null && longitude != null) {
        sellerPayload.latitude = String(latitude)
        sellerPayload.longitude = String(longitude)
      }
      if (body.gpsAccuracy != null) sellerPayload.gpsAccuracy = String(body.gpsAccuracy)

      console.log(`[RID ${rid}] -> POST ${JAVA_SUPPLIERS_URL} (seller registration)`, sellerPayload)

      const res = await fetch(JAVA_SUPPLIERS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sellerPayload),
        cache: "no-store",
      })

      const text = await res.text()
      const trimmed = text.trim().replace(/^\uFEFF/, "") // strip BOM
      let json: any
      try { json = JSON.parse(trimmed || "{}") } catch {
        console.error(`[RID ${rid}] Bad JSON from InsertSuppliers. Status=${res.status} Body: ${text.slice(0, 800)}`)
        const preview = text.slice(0, 200).replace(/\s+/g, " ")
        return NextResponse.json({
          ok: false,
          error: "Supplier server returned invalid response. Check backend is running and returns JSON.",
          rawPreview: preview,
          rid,
        }, { status: 502 })
      }

      // 201 = created successfully (Java may include temporaryPasswordEmailed when password was generated)
      if (res.status === 201) {
        return NextResponse.json({
          ok: true,
          message: json.message,
          recipientEmail: json.recipientEmail ?? email,
          temporaryPasswordMessage: json.temporaryPasswordMessage ?? null,
          temporaryPasswordEmailed: json.temporaryPasswordEmailed === true,
          usedTemporaryPassword: json.usedTemporaryPassword === true,
          rid,
        })
      }

      // 409 = duplicate / conflict (e.g. buyer email, or insertSeller duplicate)
      if (res.status === 409) {
        return NextResponse.json({ ok: false, error: json.message || json.error || "Conflict", rid }, { status: 409 })
      }

      // InsertSuppliers returns 200 when email is already SELLER ("Seller exists with user type SELLER.")
      if (res.status === 200) {
        const msg =
          json.message ||
          json.error ||
          "This email is already registered as a seller. Sign in or use Forgot password if needed."
        return NextResponse.json({ ok: false, error: msg, rid }, { status: 409 })
      }

      if (res.status >= 500) {
        return NextResponse.json(
          { ok: false, error: json.error || json.message || "Supplier server error", rid },
          { status: 502 },
        )
      }

      return NextResponse.json(
        { ok: false, error: json.error || json.message || "Supplier registration failed", rid },
        { status: 400 },
      )
    }

    // ─── BUYER → existing general auth servlet ───────────────────────────────
    if (!JAVA_AUTH_URL) {
      console.error(`[RID ${rid}] Missing JAVA_AUTH_URL`)
      return NextResponse.json({ ok: false, error: "JAVA_AUTH_URL not configured", rid }, { status: 500 })
    }

    const { email, password, firstName, lastName, tel, location, latitude, longitude, gpsAccuracy } = body

    const form = new URLSearchParams()
    form.set("action", "register")
    form.set("email", String(email || ""))
    form.set("password", String(password || ""))
    form.set("firstName", String(firstName || ""))
    form.set("lastName", String(lastName || ""))
    form.set("tel", String(tel || ""))
    form.set("location", String(location || ""))
    form.set("role", "BUYER")
    if (latitude  != null) form.set("latitude",    String(latitude))
    if (longitude != null) form.set("longitude",   String(longitude))
    if (gpsAccuracy != null) form.set("gpsAccuracy", String(gpsAccuracy))

    console.log(`[RID ${rid}] -> POST ${JAVA_AUTH_URL} action=register email=${email} role=BUYER`)

    const res = await fetch(JAVA_AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      cache: "no-store",
    })

    const text = await res.text()
    let json: any
    try { json = JSON.parse(text) } catch {
      console.error(`[RID ${rid}] Bad JSON from auth servlet. Status=${res.status} Body: ${text.slice(0, 800)}`)
      return NextResponse.json({ ok: false, error: "Bad JSON from auth server", raw: text.slice(0, 800), rid }, { status: 502 })
    }

    if (!res.ok || !json?.ok) {
      console.warn(`[RID ${rid}] Upstream register failed HTTP ${res.status}`, json)
      return NextResponse.json({ ok: false, error: json?.error || "Register failed", rid }, { status: 400 })
    }

    return NextResponse.json({ ...json, rid })

  } catch (e: any) {
    console.error(`[RID ${rid}] Register route exception`, e)
    return NextResponse.json({ ok: false, error: e?.message || "unknown error", rid }, { status: 400 })
  } finally {
    console.log(`[RID ${rid}] /api/auth/register done in ${Date.now() - t0}ms`)
  }
}