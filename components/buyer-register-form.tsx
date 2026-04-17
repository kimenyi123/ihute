"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, Banknote, Bike, Check, Footprints, Loader2, Smartphone, Wallet, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GeoCombobox, type GeoComboboxOption } from "@/components/geo-combobox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  cellsForDistrict,
  cellulesForDistrictSector,
  villagesForDistrictSectorCellule,
} from "@/lib/rwanda-nep-hierarchy"
import {
  DEFAULT_PROVINCE_ID,
  PROVINCES,
  districtsForProvince,
  provinceById,
  type ProvinceId,
} from "@/lib/rwanda-provinces"
import { useLanguageStore } from "@/lib/language-store"
import { LanguageSelector } from "@/components/language-selector"
import { BUYER_UI, L, pickLang, SELLER_UI } from "@/lib/seller-register-i18n"
import { useAuthStore } from "@/lib/auth-store"
import type { UserRole } from "@/lib/auth-store"
import { getShopPublicUrl } from "@/lib/shop-public-url"
import { shopCategoryToSectorSlug } from "@/lib/seller-category-sector"
import {
  mapListSuppliersWithProductsToShops,
  type ShopInfo,
} from "@/components/category_ai/shops-by-sector"
import { cn } from "@/lib/utils"
import { GRANDMA_PATHS } from "@/lib/grandma-urls"

function placeholderEmailFromPhone(phone: string): string {
  const d = phone.replace(/\D/g, "")
  const base = d.length >= 9 ? d : `u${Date.now()}`
  return `${base}@buyer.phone.ihute.rw`
}

const cardClass =
  "rounded-2xl border-[#dbe7f3] bg-white shadow-[0_8px_18px_rgba(24,151,224,.08)]"

/** True when the API still returns an old generic DB line (no useful detail). */
function isVagueDatabaseMessage(text: string): boolean {
  const t = text.trim().toLowerCase()
  return (
    t === "database error. please try again." ||
    t === "database error. please try again" ||
    t === "database error" ||
    /^database error\.?\s*please try again\.?$/.test(t)
  )
}

/** When the server only says “database error”, short hint for the banner (mobile-friendly). */
function vagueDatabaseHint(): string {
  return [
    "Sign-up failed (database). On the server check:",
    "• Tomcat running + Next.js can reach JAVA_AUTH_URL",
    "• MySQL up, JDBC URL/credentials, database name exists",
    "• Schema/migrations applied; Tomcat logs if a column/value is rejected",
  ].join("\n")
}

/**
 * Prefer HTTP status and `code`, then the raw message. Expands vague DB errors so the banner is useful even with an old WAR.
 */
function formatRegisterError(
  error: string,
  code?: string | null,
  httpStatus?: number
): string {
  const e = (error || "").trim()

  if (httpStatus === 409) {
    return e || "This phone number or account is already registered."
  }

  if (httpStatus === 503) {
    return (
      e ||
      "Could not reach the buyer API (Tomcat / Trading WAR or GRANDMA_BUYER_API_URL). Check the server is up and Next can reach it."
    )
  }
  if (httpStatus === 502) {
    return e || "Bad response from the buyer API (not valid JSON). Check Tomcat / Next proxy logs."
  }
  if (httpStatus === 500 && e.toLowerCase().includes("java_auth_url")) {
    return e
  }

  switch (code) {
    case "GRANDMA_UNREACHABLE":
      return (
        e ||
        "Could not reach the Grandma buyer API (Trading WAR on Tomcat). Check BACKEND_URL / Tomcat and redeploy the WAR."
      )
    case "GRANDMA_NOT_JSON":
      return (
        e ||
        "Java returned HTML or plain text instead of JSON — wrong servlet URL, missing WAR, or Tomcat error page. Open server logs; verify POST …/Api/grandma/buyers returns JSON."
      )
    case "PHONE_EXISTS":
    case "DB_DUPLICATE":
      return e || "This phone number is already registered."
    case "INSERT_FAILED":
      return e || "Could not create the buyer account. Check Tomcat logs and the account_buyer table."
    case "DB_ERROR":
      return e || "Database error while saving the buyer. Check Tomcat logs."
    case "BAD_JSON":
      return e || "Invalid request to the server."
    case "UPSTREAM_UNREACHABLE":
      return e || "Could not reach the Java backend (Tomcat). Check it is running and JAVA_AUTH_URL is correct."
    case "DB_UNREACHABLE":
      return e || "The app cannot connect to MySQL. Check MySQL is running and JDBC settings on the server."
    case "DB_MISSING":
      return e || "The configured database does not exist on MySQL."
    case "DB_TABLE_MISSING":
      return e || "A required table is missing — apply the DB schema or use the correct database."
    case "DB_BAD_VALUE":
    case "DB_SCHEMA_MISMATCH":
    case "DB_UNKNOWN":
      return e || "Database error."
    case "SERVER_UNEXPECTED":
      return e || "Server error. Please try again."
    case "EMAIL_EXISTS":
    case "AUTH_REGISTER_FAIL":
    case "VALIDATION_REQUIRED":
      break
    default:
      break
  }

  let out = e
  if (!out) {
    switch (code) {
      case "EMAIL_EXISTS":
      case "AUTH_REGISTER_FAIL":
      case "VALIDATION_REQUIRED":
        out = "Registration failed."
        break
      default:
        out = "Registration failed."
    }
  }

  if (isVagueDatabaseMessage(out)) {
    return vagueDatabaseHint()
  }

  // Substring hints sometimes appear in plain `error` text without a `code`
  const low = out.toLowerCase()
  if (
    low.includes("communications link failure") ||
    low.includes("connection refused") ||
    low.includes("could not create connection")
  ) {
    return "Cannot reach MySQL from the backend server. Check MySQL is running and JDBC host, port, user, and password."
  }
  if (low.includes("unknown database")) {
    return "The database name in the server config does not exist on MySQL (wrong name or wrong server)."
  }
  if (low.includes("doesn't exist") && low.includes("table")) {
    return "A required table is missing. Apply your SQL schema on the database the app uses."
  }
  if (low.includes("duplicate entry") || low.includes("duplicate key")) {
    return "This email or account is already registered."
  }
  if (low.includes("data truncated") || low.includes("incorrect string value") || low.includes("cannot be null")) {
    return "Wrong format or value for a field (length, charset, or allowed values). Check server logs for the column name."
  }

  return out
}

function appendRequestRef(msg: string, rid: unknown): string {
  if (typeof rid !== "string" || !rid.trim()) return msg
  return `${msg}\n\n(Ref: ${rid.trim()})`
}

function toGeoOptions(values: string[]): GeoComboboxOption[] {
  return values.map((v) => ({ value: v, label: v, keywords: v.toLowerCase() }))
}

const SHOP_CATEGORIES = [
  "pharmacy",
  "liquor store",
  "boutique",
  "bar/restaurant",
  "supermarket",
  "coffee shop",
  "pizzeria",
  "electronics",
].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))

type PaymentId = "momo" | "airtel" | "bk" | "cash"
type RiderId = "human" | "bike" | "moto"

function persistBuyerPrefs(prefs: {
  preferredShopIds: string[]
  payment: PaymentId
  rider: RiderId
}) {
  try {
    localStorage.setItem("grandma:preferredShops", JSON.stringify(prefs.preferredShopIds))
    localStorage.setItem("grandma:payment", prefs.payment)
    localStorage.setItem("grandma:buyerLogistics", prefs.rider)
  } catch {
    /* ignore */
  }
}

export function BuyerRegisterForm() {
  const router = useRouter()
  const login = useAuthStore((s) => s.login)
  const lang = useLanguageStore((s) => s.language)

  const [step, setStep] = useState<1 | 2>(1)

  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [province, setProvince] = useState(DEFAULT_PROVINCE_ID)
  const [district, setDistrict] = useState("")
  const [locationSector, setLocationSector] = useState("")
  const [cellule, setCellule] = useState("")
  const [village, setVillage] = useState("")
  const [street, setStreet] = useState("")

  const [shopSector, setShopSector] = useState("")
  const [shops, setShops] = useState<ShopInfo[]>([])
  const [shopsLoading, setShopsLoading] = useState(false)
  const [preferredShopIds, setPreferredShopIds] = useState<string[]>([])
  const [payment, setPayment] = useState<PaymentId>("momo")
  const [rider, setRider] = useState<RiderId>("moto")

  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const provinceOptions = useMemo(
    () =>
      PROVINCES.map((p) => ({
        value: p.id,
        label: pickLang(p.tri, lang),
        keywords: `${p.id} ${p.tri.en} ${p.tri.rw} ${p.tri.fr}`.toLowerCase(),
      })).sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" })),
    [lang]
  )

  const districtOptions = useMemo(
    () =>
      districtsForProvince(province).map((d) => ({
        value: d,
        label: d,
        keywords: d.toLowerCase(),
      })),
    [province]
  )

  const locationSectorOptions = useMemo(() => cellsForDistrict(district), [district])
  const celluleOptions = useMemo(
    () => cellulesForDistrictSector(district, locationSector),
    [district, locationSector]
  )
  const villageOptions = useMemo(
    () => villagesForDistrictSectorCellule(district, locationSector, cellule),
    [district, locationSector, cellule]
  )

  const sectorGeoOptions = useMemo(() => toGeoOptions(locationSectorOptions), [locationSectorOptions])
  const celluleGeoOptions = useMemo(() => toGeoOptions(celluleOptions), [celluleOptions])
  const villageGeoOptions = useMemo(() => toGeoOptions(villageOptions), [villageOptions])

  const locationLine = (): string => {
    const prov = provinceById(province)
    return [
      prov ? pickLang(prov.tri, lang) : "",
      district,
      locationSector,
      cellule,
      village,
      street,
    ]
      .filter(Boolean)
      .join(" · ")
  }

  useEffect(() => {
    setPreferredShopIds([])
  }, [shopSector])

  useEffect(() => {
    if (!shopSector.trim()) {
      setShops([])
      return
    }
    const sectorSlug = shopCategoryToSectorSlug(shopSector)
    let cancelled = false
    setShopsLoading(true)
    const url = `/api/sector-list-suppliers?sector=${encodeURIComponent(sectorSlug)}&Currency=RWF&limit=100`
    fetch(url, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((raw: unknown) => {
        if (cancelled) return
        const arr = Array.isArray(raw) ? raw : []
        setShops(mapListSuppliersWithProductsToShops(arr))
      })
      .catch(() => {
        if (!cancelled) setShops([])
      })
      .finally(() => {
        if (!cancelled) setShopsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [shopSector])

  const validateStep1 = (): boolean => {
    if (!name.trim() || !phone.trim()) {
      setErr("Please enter your name and phone.")
      return false
    }
    if (!password.trim()) {
      setErr("Please choose a password.")
      return false
    }
    if (!province || !district || !locationSector || !cellule || !village) {
      setErr("Please complete your location (through village).")
      return false
    }
    return true
  }

  const validateAll = (): boolean => validateStep1()

  const goNext = () => {
    setErr(null)
    if (!validateStep1()) return
    setStep(2)
  }

  const submit = async () => {
    setErr(null)
    if (!validateAll()) return
    setLoading(true)
    try {
      const [firstName, ...rest] = name.trim().split(" ")
      const lastName = rest.join(" ")
      const email = placeholderEmailFromPhone(phone)
      const payload = {
        email,
        password,
        firstName,
        lastName,
        tel: phone,
        location: locationLine(),
      }
      const res = await fetch("/api/grandma/buyers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(async () => {
        const t = await res.text()
        throw new Error(t.slice(0, 200))
      })
      if (!res.ok || !json?.ok) {
        const base = formatRegisterError(
          String(json?.error ?? "Registration failed"),
          json?.code,
          res.status
        )
        let extra = ""
        if (json?.code === "GRANDMA_NOT_JSON") {
          const st = json?.upstreamStatus
          const u = json?.upstreamUrl
          if (typeof st === "number" || typeof u === "string") {
            extra += `\n\nUpstream: HTTP ${st ?? "?"} ${typeof u === "string" ? u : ""}`.trimEnd()
          }
          if (typeof json?.raw === "string" && json.raw.trim()) {
            const oneLine = json.raw.replace(/\s+/g, " ").trim().slice(0, 280)
            extra +=
              oneLine.startsWith("<!") || oneLine.startsWith("<html")
                ? "\n\nTomcat likely sent an HTML error page — compare this URL in the browser or curl; fix BACKEND_URL / GRANDMA_BUYER_API_URL or redeploy the WAR with /Api/grandma/buyers."
                : `\n\nUpstream preview: ${oneLine}`
          }
        }
        throw new Error(appendRequestRef(base + extra, json?.rid))
      }
      const ishyiga =
        typeof json?.ishyigaAccount === "string"
          ? json.ishyigaAccount
          : typeof json?.ishyiga === "string"
            ? json.ishyiga
            : ""
      const emailOut = typeof json?.email === "string" ? json.email : email
      const storeRole: UserRole = json?.dualPharmacyRetail ? "supplier" : "customer"
      login({
        id: emailOut,
        email: emailOut,
        name,
        role: storeRole,
        phone,
        location: locationLine(),
        ishyigaAccount: ishyiga,
        dbRole: json?.type ?? json?.dbRole ?? json?.role ?? "BUYER",
        dualPharmacyRetail: !!json?.dualPharmacyRetail,
        pharmacySector: !!json?.pharmacySector,
      })
      persistBuyerPrefs({ preferredShopIds, payment, rider })
      try {
        localStorage.setItem("grandma:mode", "buyer")
      } catch {
        /* ignore */
      }
      router.push(GRANDMA_PATHS.appRoot)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Network error")
    } finally {
      setLoading(false)
    }
  }

  const emptyLoc = pickLang(BUYER_UI.noMatchLocation, lang)

  const shopAccountIds = useMemo(
    () => shops.map((s) => String(s.seller_account || "").trim()).filter(Boolean),
    [shops]
  )
  const allShopsSelected =
    shopAccountIds.length > 0 && shopAccountIds.every((id) => preferredShopIds.includes(id))

  const toggleShop = (id: string) => {
    setPreferredShopIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const toggleAllShops = () => {
    if (allShopsSelected) setPreferredShopIds([])
    else setPreferredShopIds([...shopAccountIds])
  }

  const paymentOptions: { id: PaymentId; label: typeof BUYER_UI.payMomo; Icon: typeof Smartphone }[] = [
    { id: "momo", label: BUYER_UI.payMomo, Icon: Smartphone },
    { id: "airtel", label: BUYER_UI.payAirtel, Icon: Smartphone },
    { id: "bk", label: BUYER_UI.payBk, Icon: Banknote },
    { id: "cash", label: BUYER_UI.payCash, Icon: Wallet },
  ]

  const riderOptions: { id: RiderId; label: typeof BUYER_UI.riderWalk; Icon: typeof Footprints }[] = [
    { id: "human", label: BUYER_UI.riderWalk, Icon: Footprints },
    { id: "bike", label: BUYER_UI.riderBike, Icon: Bike },
    { id: "moto", label: BUYER_UI.riderMoto, Icon: Zap },
  ]

  return (
    <div className="min-h-screen bg-[#eef4fb] text-[#17324d]">
      <div className="mx-auto max-w-[430px] min-h-screen bg-gradient-to-b from-[#f7fbff] to-[#eef4fb] pb-28">
        <header className="sticky top-0 z-30 bg-gradient-to-r from-[#1897e0] via-[#30acef] to-[#127fc0] text-white shadow-[0_8px_20px_rgba(0,0,0,.1)]">
          <div className="flex items-center gap-2 px-3 py-3.5">
            <Link
              href={getShopPublicUrl()}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white/15 text-lg text-white hover:bg-white/25"
              aria-label={pickLang(SELLER_UI.back, lang)}
            >
              ←
            </Link>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-white/35 bg-white">
                <Image src="/images/ishyiga-logo.png" alt="" width={34} height={34} className="object-contain" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-lg font-bold leading-tight">Ishyiga Ihute</div>
                <div className="truncate text-xs text-white/90">{pickLang(BUYER_UI.pageSubtitle, lang)}</div>
              </div>
            </div>
            <div className="shrink-0 [&_button]:border-white/40 [&_button]:text-white [&_button]:hover:bg-white/15">
              <LanguageSelector />
            </div>
          </div>
        </header>

        <div className="space-y-4 px-3 pt-4">
          <div className="flex flex-col gap-2 text-xs font-semibold text-[#6f8399] sm:flex-row sm:flex-wrap sm:items-center sm:text-sm">
            {[
              { n: 1 as const, tri: BUYER_UI.stepUmuguzi },
              { n: 2 as const, tri: BUYER_UI.stepPreferences },
            ].map(({ n, tri }) => (
              <div
                key={n}
                className={cn(
                  "w-full rounded-xl border px-3 py-2 leading-snug sm:w-auto sm:rounded-full sm:py-1.5",
                  step === n
                    ? "border-[#1897e0] bg-[#1897e0] text-white shadow-[0_4px_12px_rgba(24,151,224,.25)]"
                    : "border-[#dbe7f3] bg-white text-[#17324d]"
                )}
              >
                {n}. {pickLang(tri, lang)}
              </div>
            ))}
          </div>

          {err && (
            <div className="whitespace-pre-line rounded-xl border border-red-200 bg-red-50/95 px-3 py-2 text-sm leading-snug text-red-800 shadow-sm">
              {err}
            </div>
          )}

          {step === 1 && (
            <Card className={cardClass}>
              <CardHeader>
                <CardTitle className="text-[#17324d]">{pickLang(BUYER_UI.cardStep1, lang)}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-[#17324d]">{pickLang(BUYER_UI.fullName, lang)}</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="—"
                    className="border-[#dbe7f3]"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-[#17324d]">{pickLang(L.phone, lang)}</Label>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="250…"
                    className="border-[#dbe7f3]"
                  />
                </div>

                <div className="space-y-3 rounded-xl border border-[#dbe7f3] bg-[#f7fbff]/50 p-3 sm:col-span-2">
                  <Label className="text-sm font-semibold text-[#17324d]">{pickLang(BUYER_UI.location, lang)}</Label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label className="text-xs font-semibold text-[#17324d]">{pickLang(L.province, lang)}</Label>
                      <GeoCombobox
                        value={province}
                        onChange={(v) => {
                          setProvince(v as ProvinceId)
                          setDistrict("")
                          setLocationSector("")
                          setCellule("")
                          setVillage("")
                        }}
                        options={provinceOptions}
                        placeholder={pickLang(SELLER_UI.searchProvince, lang)}
                        searchPlaceholder={pickLang(SELLER_UI.searchProvince, lang)}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label className="text-xs font-semibold text-[#17324d]">{pickLang(L.district, lang)}</Label>
                      <GeoCombobox
                        value={district}
                        onChange={(v) => {
                          setDistrict(v)
                          setLocationSector("")
                          setCellule("")
                          setVillage("")
                        }}
                        options={districtOptions}
                        placeholder={
                          province
                            ? pickLang(SELLER_UI.searchDistrict, lang)
                            : pickLang(SELLER_UI.selectProvinceFirst, lang)
                        }
                        disabled={!province}
                        emptyText={pickLang(SELLER_UI.noDistricts, lang)}
                        searchPlaceholder={pickLang(SELLER_UI.searchDistrict, lang)}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label className="text-xs font-semibold text-[#17324d]">{pickLang(L.locationSector, lang)}</Label>
                      <GeoCombobox
                        value={locationSector}
                        onChange={(v) => {
                          setLocationSector(v)
                          setCellule("")
                          setVillage("")
                        }}
                        options={sectorGeoOptions}
                        placeholder={
                          district
                            ? pickLang(BUYER_UI.searchUmurenge, lang)
                            : pickLang(SELLER_UI.selectProvinceFirst, lang)
                        }
                        disabled={!district || sectorGeoOptions.length === 0}
                        emptyText={emptyLoc}
                        searchPlaceholder={pickLang(BUYER_UI.searchUmurenge, lang)}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label className="text-xs font-semibold text-[#17324d]">{pickLang(L.cellule, lang)}</Label>
                      <GeoCombobox
                        value={cellule}
                        onChange={(v) => {
                          setCellule(v)
                          setVillage("")
                        }}
                        options={celluleGeoOptions}
                        placeholder={
                          locationSector
                            ? pickLang(BUYER_UI.searchAkagari, lang)
                            : pickLang(SELLER_UI.selectLocationSector, lang)
                        }
                        disabled={!locationSector || celluleGeoOptions.length === 0}
                        emptyText={emptyLoc}
                        searchPlaceholder={pickLang(BUYER_UI.searchAkagari, lang)}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label className="text-xs font-semibold text-[#17324d]">{pickLang(L.village, lang)}</Label>
                      <GeoCombobox
                        value={village}
                        onChange={setVillage}
                        options={villageGeoOptions}
                        placeholder={
                          cellule
                            ? pickLang(BUYER_UI.searchUmudugudu, lang)
                            : pickLang(SELLER_UI.selectCellule, lang)
                        }
                        disabled={!cellule || villageGeoOptions.length === 0}
                        emptyText={emptyLoc}
                        searchPlaceholder={pickLang(BUYER_UI.searchUmudugudu, lang)}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label className="text-xs font-semibold text-[#17324d]">{pickLang(L.street, lang)}</Label>
                      <Input
                        value={street}
                        onChange={(e) => setStreet(e.target.value)}
                        placeholder="—"
                        className="border-[#dbe7f3]"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-[#17324d]">{pickLang(BUYER_UI.password, lang)}</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className="border-[#dbe7f3]"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card className={cardClass}>
              <CardHeader>
                <CardTitle className="text-[#17324d]">{pickLang(BUYER_UI.cardStep2, lang)}</CardTitle>
                <CardDescription>{pickLang(BUYER_UI.cardStep2Desc, lang)}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5">
                <div className="space-y-2">
                  <Label className="text-[#17324d]">{pickLang(BUYER_UI.shopSectorLabel, lang)}</Label>
                  <p className="text-xs text-[#6f8399]">{pickLang(BUYER_UI.shopSectorHint, lang)}</p>
                  <Select value={shopSector} onValueChange={setShopSector}>
                    <SelectTrigger className="border-[#dbe7f3]">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {SHOP_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <Label className="text-[#17324d]">{pickLang(BUYER_UI.preferredShops, lang)}</Label>
                      <p className="text-xs text-[#6f8399]">{pickLang(BUYER_UI.preferredShopsHint, lang)}</p>
                    </div>
                    {shopAccountIds.length > 0 && (
                      <button
                        type="button"
                        onClick={toggleAllShops}
                        className="text-xs font-semibold text-[#1897e0] hover:underline"
                      >
                        {pickLang(BUYER_UI.allShops, lang)}
                      </button>
                    )}
                  </div>
                  {shopsLoading && (
                    <p className="text-sm text-[#6f8399]">{pickLang(BUYER_UI.loadingShops, lang)}</p>
                  )}
                  {!shopsLoading && shopSector && shops.length === 0 && (
                    <p className="text-sm text-[#6f8399]">{pickLang(BUYER_UI.noShopsInSector, lang)}</p>
                  )}
                  {!shopsLoading && shops.length > 0 && (
                    <div className="max-h-[240px] space-y-2 overflow-y-auto rounded-xl border border-[#dbe7f3] bg-[#f7fbff]/40 p-2">
                      {shops.map((s) => {
                        const id = String(s.seller_account || "").trim()
                        if (!id) return null
                        return (
                          <label
                            key={id}
                            className="flex cursor-pointer items-start gap-3 rounded-lg border border-transparent px-2 py-2 hover:bg-white/80"
                          >
                            <Checkbox
                              checked={preferredShopIds.includes(id)}
                              onCheckedChange={() => toggleShop(id)}
                              className="mt-0.5"
                            />
                            <span className="min-w-0 flex-1 text-sm">
                              <span className="font-semibold text-[#17324d]">{s.seller_name}</span>
                              {s.seller_location ? (
                                <span className="mt-0.5 block text-xs text-[#6f8399]">{s.seller_location}</span>
                              ) : null}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-[#17324d]">{pickLang(BUYER_UI.paymentMode, lang)}</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {paymentOptions.map(({ id, label, Icon }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setPayment(id)}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-center text-xs font-semibold transition-colors",
                          payment === id
                            ? "border-[#1897e0] bg-[#e8f4fc] text-[#127fc0]"
                            : "border-[#dbe7f3] bg-white text-[#17324d] hover:bg-[#f7fbff]"
                        )}
                      >
                        <Icon className="h-5 w-5 shrink-0 opacity-90" />
                        {pickLang(label, lang)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[#17324d]">{pickLang(BUYER_UI.ridersTitle, lang)}</Label>
                  <p className="text-xs text-[#6f8399]">{pickLang(BUYER_UI.ridersHint, lang)}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {riderOptions.map(({ id, label, Icon }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setRider(id)}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-center text-xs font-semibold transition-colors",
                          rider === id
                            ? "border-[#1897e0] bg-[#e8f4fc] text-[#127fc0]"
                            : "border-[#dbe7f3] bg-white text-[#17324d] hover:bg-[#f7fbff]"
                        )}
                      >
                        <Icon className="h-5 w-5 shrink-0 opacity-90" />
                        {pickLang(label, lang)}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap justify-between gap-2 pt-2">
            {step === 1 ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="border-[#dbe7f3] bg-white text-[#17324d] hover:bg-[#f7fbff]"
                  asChild
                >
                  <Link href={getShopPublicUrl()}>
                    <ArrowLeft className="mr-1 h-4 w-4" />
                    {pickLang(SELLER_UI.back, lang)}
                  </Link>
                </Button>
                <Button
                  type="button"
                  onClick={goNext}
                  className="bg-gradient-to-r from-[#1897e0] to-[#127fc0] text-white shadow-[0_10px_20px_rgba(24,151,224,.22)] hover:opacity-95"
                >
                  {pickLang(SELLER_UI.next, lang)}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="border-[#dbe7f3] bg-white text-[#17324d] hover:bg-[#f7fbff]"
                  onClick={() => {
                    setErr(null)
                    setStep(1)
                  }}
                >
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  {pickLang(SELLER_UI.back, lang)}
                </Button>
                <Button
                  type="button"
                  disabled={loading}
                  onClick={submit}
                  className="bg-gradient-to-r from-[#1897e0] to-[#127fc0] text-white shadow-[0_10px_20px_rgba(24,151,224,.22)] hover:opacity-95"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {pickLang(SELLER_UI.saving, lang)}
                    </>
                  ) : (
                    <>
                      <Check className="mr-1 h-4 w-4" />
                      {pickLang(SELLER_UI.submit, lang)}
                    </>
                  )}
                </Button>
              </>
            )}
          </div>

          <p className="pb-8 text-center text-sm text-[#6f8399]">
            {pickLang(BUYER_UI.haveAccount, lang)}{" "}
            <Link href="/login" className="font-medium text-[#1897e0] hover:underline">
              {pickLang(BUYER_UI.signIn, lang)}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
