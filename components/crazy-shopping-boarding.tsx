"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, Check, Loader2, Plus, Trash2, X } from "lucide-react"
import type { GlobalResult } from "@/components/global-search"
import { filterProductsByRelevance } from "@/lib/search-utils"
import { getNikiCodeFromSource, getProductImageSrc, type ProductImageSource } from "@/lib/image-utils"
import { ProductImageFallback } from "@/components/product-image-fallback"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GeoCombobox } from "@/components/geo-combobox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/auth-store"
import { cn } from "@/lib/utils"
import type { CatalogPick, ShopBusinessDraft, ShopLineDraft } from "@/lib/crazy-shopping-types"
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
  type Tri,
} from "@/lib/rwanda-provinces"
import { getShopPublicUrl } from "@/lib/shop-public-url"
import type { Language } from "@/lib/language-store"
import { useLanguageStore } from "@/lib/language-store"
import { LanguageSelector } from "@/components/language-selector"
import { DELIVERY_MODES, ERR, L, pickLang, SELLER_UI } from "@/lib/seller-register-i18n"
import { shopCategoryToSectorSlug } from "@/lib/seller-category-sector"

const BUSINESS_CATEGORIES = [
  "pharmacy",
  "liquor store",
  "boutique",
  "bar/restaurant",
  "supermarket",
  "coffee shop",
  "pizzeria",
  "electronics",
].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))

function numPrice(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v
  const n = String(v ?? "")
    .replace(/[^\d.,-]/g, "")
    .replace(",", ".")
  const p = parseFloat(n)
  return Number.isFinite(p) ? p : 0
}

function catalogKey(p: GlobalResult): string {
  const niki = getNikiCodeFromSource(p) || p.item_code || ""
  const name = p.item_commercial_name || ""
  return `${niki}::${name}`
}

/** `GlobalResult` is structurally fine for image resolution but lacks an index signature. */
function asProductImageSource(p: GlobalResult): ProductImageSource {
  return p as unknown as ProductImageSource
}

function toPick(p: GlobalResult): CatalogPick {
  const niki = getNikiCodeFromSource(p) || p.item_code || ""
  const img = getProductImageSrc(asProductImageSource(p))
  return {
    id: catalogKey(p),
    nikiCode: niki,
    name: String(p.item_commercial_name || p.item_code || "Item"),
    famille: String((p as Record<string, unknown>).famille ?? (p as Record<string, unknown>).FAMILLE ?? "") || undefined,
    refSellingPrice: numPrice(p.selling_price),
    image: img && !img.includes("no_image") ? img : undefined,
  }
}

function linesFromPicks(picks: CatalogPick[]): ShopLineDraft[] {
  return picks.map((p) => {
    const ref = p.refSellingPrice ?? 0
    return {
      ...p,
      quantity: Math.max(1, 1),
      profitRwf: 0,
      salePrice: ref > 0 ? Math.round(ref) : 0,
      descriptionKeywords: p.nikiCode || "",
    }
  })
}

const initialBusiness: ShopBusinessDraft = {
  companyName: "",
  email: "",
  password: "",
  tin: "",
  phone: "",
  momoCode: "",
  ownerName: "",
  category: "",
  deliveryPref: "pickup",
  province: DEFAULT_PROVINCE_ID,
  district: "",
  locationSector: "",
  cellule: "",
  village: "",
  street: "",
  logoDataUrl: null,
}

function FieldLabel({ tri, lang }: { tri: Tri; lang: Language }) {
  return (
    <Label className="text-sm font-medium leading-none text-[#17324d]">{pickLang(tri, lang)}</Label>
  )
}

/** Quantity: type large values (e.g. 200) without stepper-only UX. */
function IntegerQtyInput({
  value,
  min,
  onCommit,
  className,
}: {
  value: number
  min: number
  onCommit: (n: number) => void
  className?: string
}) {
  const [str, setStr] = useState(String(value))
  useEffect(() => {
    setStr(String(value))
  }, [value])
  return (
    <Input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      className={className}
      value={str}
      onChange={(e) => {
        const v = e.target.value.replace(/\D/g, "")
        setStr(v)
        if (v === "") return
        const n = parseInt(v, 10)
        if (Number.isFinite(n)) onCommit(Math.max(min, n))
      }}
      onBlur={() => {
        const n = parseInt(str, 10)
        if (!Number.isFinite(n) || n < min) {
          setStr(String(Math.max(min, value)))
          onCommit(Math.max(min, value))
        } else {
          onCommit(n)
        }
      }}
    />
  )
}

/** Sale / profit RWF: free typing, commit on blur. */
function RwfPriceInput({
  value,
  min,
  onCommit,
  className,
}: {
  value: number
  min: number
  onCommit: (n: number) => void
  className?: string
}) {
  const [str, setStr] = useState(value === 0 ? "" : String(value))
  useEffect(() => {
    setStr(value === 0 ? "" : String(value))
  }, [value])
  return (
    <Input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      className={className}
      value={str}
      onChange={(e) => {
        const v = e.target.value.replace(/\D/g, "")
        setStr(v)
        if (v === "") return
        const n = parseInt(v, 10)
        if (Number.isFinite(n)) onCommit(Math.max(min, n))
      }}
      onBlur={() => {
        const n = parseInt(str, 10)
        if (!Number.isFinite(n) || str === "") {
          onCommit(0)
          setStr("")
        } else {
          onCommit(Math.max(min, n))
        }
      }}
    />
  )
}

export function CrazyShoppingBoarding() {
  const router = useRouter()
  const login = useAuthStore((s) => s.login)
  const [step, setStep] = useState<1 | 2>(1)
  const [business, setBusiness] = useState<ShopBusinessDraft>(initialBusiness)
  const [searchQ, setSearchQ] = useState("")
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchHits, setSearchHits] = useState<GlobalResult[]>([])
  /** First ~20 products for selected shop category (sector filter). */
  const [categoryPreview, setCategoryPreview] = useState<GlobalResult[]>([])
  const [categoryPreviewLoading, setCategoryPreviewLoading] = useState(false)
  const [picks, setPicks] = useState<CatalogPick[]>([])
  const [lines, setLines] = useState<ShopLineDraft[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [doneMsg, setDoneMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const lang = useLanguageStore((s) => s.language)
  const setLanguage = useLanguageStore((s) => s.setLanguage)

  const langPersistSkip = useRef(true)
  useEffect(() => {
    try {
      const g = localStorage.getItem("grandma:lang")
      if (g === "en" || g === "rw" || g === "fr") setLanguage(g)
    } catch {
      /* ignore */
    }
  }, [setLanguage])

  useEffect(() => {
    if (langPersistSkip.current) {
      langPersistSkip.current = false
      return
    }
    try {
      localStorage.setItem("grandma:lang", lang)
    } catch {
      /* ignore */
    }
  }, [lang])

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
      districtsForProvince(business.province).map((d) => ({
        value: d,
        label: d,
        keywords: d.toLowerCase(),
      })),
    [business.province]
  )

  const onLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith("image/")) {
      setErr(pickLang(ERR.logoType, lang))
      return
    }
    if (f.size > 2_500_000) {
      setErr(pickLang(ERR.logoSize, lang))
      return
    }
    setErr(null)
    const reader = new FileReader()
    reader.onload = () => {
      setBusiness((b) => ({ ...b, logoDataUrl: reader.result as string }))
    }
    reader.readAsDataURL(f)
    e.target.value = ""
  }

  useEffect(() => {
    setLines((prev) => {
      const byId = new Map(prev.map((r) => [r.id, r]))
      return picks.map((p) => {
        const ex = byId.get(p.id)
        if (ex) {
          return { ...ex, profitRwf: ex.profitRwf ?? 0 }
        }
        const base = linesFromPicks([p])[0]
        return base
      })
    })
  }, [picks])

  const runSearch = useCallback(async (q: string) => {
    const t = q.trim()
    if (t.length < 2) {
      setSearchHits([])
      return
    }
    setSearchLoading(true)
    setErr(null)
    try {
      const params = new URLSearchParams({
        globalSearch: t,
        limit: "24",
        Currency: "RWF",
      })
      const sec = shopCategoryToSectorSlug(business.category)
      if (sec) params.set("sector", sec)
      const res = await fetch(`/api/fetchSuggestions?${params}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      })
      if (!res.ok) throw new Error(`Search failed (${res.status})`)
      const json = await res.json()
      const raw: GlobalResult[] = json.products || []
      const filtered = filterProductsByRelevance(raw, t, 10).slice(0, 20)
      setSearchHits(filtered)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Search error")
      setSearchHits([])
    } finally {
      setSearchLoading(false)
    }
  }, [business.category])

  useEffect(() => {
    if (step !== 2 || !business.category) {
      setCategoryPreview([])
      return
    }
    let cancelled = false
    ;(async () => {
      setCategoryPreviewLoading(true)
      try {
        const sector = shopCategoryToSectorSlug(business.category)
        const params = new URLSearchParams({
          globalSearch: "in",
          limit: "48",
          Currency: "RWF",
        })
        if (sector) params.set("sector", sector)
        const res = await fetch(`/api/fetchSuggestions?${params}`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
        })
        if (!res.ok) throw new Error(`Catalog load (${res.status})`)
        const json = await res.json()
        const raw: GlobalResult[] = json.products || []
        if (!cancelled) setCategoryPreview(raw.slice(0, 20))
      } catch {
        if (!cancelled) setCategoryPreview([])
      } finally {
        if (!cancelled) setCategoryPreviewLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [step, business.category])

  useEffect(() => {
    const id = setTimeout(() => {
      runSearch(searchQ)
    }, 350)
    return () => clearTimeout(id)
  }, [searchQ, runSearch])

  const addPick = (p: GlobalResult) => {
    const pick = toPick(p)
    setPicks((prev) => {
      if (prev.some((x) => x.id === pick.id)) return prev
      return [...prev, pick]
    })
  }

  const removePick = (id: string) => {
    setPicks((prev) => prev.filter((x) => x.id !== id))
  }

  /** S7/S8: no catalog hit — add a blank line; temp Niki + stock after seller is created. */
  const addCustomPick = () => {
    const id = `custom-${Date.now()}`
    setPicks((prev) => {
      if (prev.some((x) => x.id === id)) return prev
      return [
        ...prev,
        {
          id,
          nikiCode: "",
          name: "New item — edit name",
          refSellingPrice: 0,
          isCustom: true,
        },
      ]
    })
  }

  const updateLine = (id: string, patch: Partial<ShopLineDraft>) => {
    setLines((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const validateStep1 = () => {
    type Check = { ok: boolean; fieldId: string; tri: Tri }
    const checks: Check[] = [
      { ok: !!business.companyName.trim(), fieldId: "seller-field-companyName", tri: ERR.missingCompanyName },
      { ok: business.password.trim().length >= 6, fieldId: "seller-field-password", tri: ERR.missingPassword },
      { ok: !!business.phone.trim(), fieldId: "seller-field-phone", tri: ERR.missingPhone },
      { ok: !!business.ownerName.trim(), fieldId: "seller-field-owner", tri: ERR.missingOwner },
      { ok: !!business.category, fieldId: "seller-field-category", tri: ERR.missingCategory },
      { ok: !!business.province, fieldId: "seller-field-province", tri: ERR.missingProvince },
      { ok: !!business.district.trim(), fieldId: "seller-field-district", tri: ERR.missingDistrict },
      { ok: !!business.locationSector.trim(), fieldId: "seller-field-locationSector", tri: ERR.missingLocationSector },
      { ok: !!business.cellule.trim(), fieldId: "seller-field-cellule", tri: ERR.missingCellule },
      { ok: !!business.village.trim(), fieldId: "seller-field-village", tri: ERR.missingVillage },
    ]
    const first = checks.find((c) => !c.ok)
    if (first) {
      const msg = `${pickLang(first.tri, lang)} ${pickLang(ERR.step1ScrollHint, lang)}`
      setErr(msg)
      window.setTimeout(() => {
        document.getElementById(first.fieldId)?.scrollIntoView({ behavior: "smooth", block: "center" })
      }, 80)
      return false
    }
    setErr(null)
    return true
  }

  const validateLinesForSubmit = () => {
    for (const row of lines) {
      if (row.isCustom && !row.name.trim()) {
        setErr(pickLang(ERR.step2LineInvalid, lang))
        window.setTimeout(() => {
          document.getElementById(`seller-line-${row.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
        }, 80)
        return false
      }
      if (row.quantity < 1 || row.salePrice < 1) {
        setErr(pickLang(ERR.step2LineInvalid, lang))
        window.setTimeout(() => {
          document.getElementById(`seller-line-${row.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
        }, 80)
        return false
      }
    }
    return true
  }

  const locationSectorOptions = useMemo(
    () => cellsForDistrict(business.district),
    [business.district]
  )

  const celluleOptions = useMemo(
    () => cellulesForDistrictSector(business.district, business.locationSector),
    [business.district, business.locationSector]
  )

  const villageOptions = useMemo(
    () =>
      villagesForDistrictSectorCellule(business.district, business.locationSector, business.cellule),
    [business.district, business.locationSector, business.cellule]
  )

  const searchActive = searchQ.trim().length >= 2
  const catalogList = searchActive ? searchHits : categoryPreview
  const catalogLoading = searchActive ? searchLoading : categoryPreviewLoading

  const goNext = () => {
    if (step === 1) {
      if (!validateStep1()) return
      setStep(2)
    }
  }

  const goBack = () => {
    setErr(null)
    if (step === 1) return
    setStep(1)
  }

  const submit = async () => {
    if (picks.length === 0) {
      setErr(pickLang(ERR.step2, lang))
      return
    }
    if (!validateLinesForSubmit()) return
    setErr(null)
    setSubmitting(true)
    setDoneMsg(null)
    try {
      const prov = provinceById(business.province)
      const locationSummary = [
        prov ? pickLang(prov.tri, lang) : "",
        business.district,
        business.locationSector,
        business.cellule,
        business.village,
        business.street,
      ]
        .filter(Boolean)
        .join(" · ")

      const [ownerFirst, ...ownerRest] = business.ownerName.trim().split(/\s+/)
      const ownerLast = ownerRest.join(" ")

      const regRes = await fetch("/api/grandma/sellers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: business.password,
          firstName: ownerFirst || "Owner",
          lastName: ownerLast,
          companyName: business.companyName.trim(),
          tel: business.phone.trim(),
          phone: business.phone.trim(),
          location: locationSummary,
          sector: shopCategoryToSectorSlug(business.category),
          delivery_mode: business.deliveryPref,
          momo_code: business.momoCode.trim(),
        }),
      })
      const regJson = (await regRes.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        ishyigaAccount?: string
      }
      if (!regRes.ok || !regJson?.ok) {
        throw new Error(regJson?.error || "Seller account registration failed")
      }
      const ishyiga = String(regJson.ishyigaAccount || "").trim()
      if (!ishyiga) {
        throw new Error("Registration succeeded but no ishyiga account was returned")
      }

      const bulkLines = lines.filter((row) => String(row.nikiCode ?? "").trim().length > 0)
      const tempLines = lines.filter((row) => !String(row.nikiCode ?? "").trim())

      let inserted = 0
      if (bulkLines.length > 0) {
        const stockRes = await fetch("/api/grandma/sellers/stock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sellerAccount: ishyiga,
            lines: bulkLines.map((row) => ({
              nikiCode: row.nikiCode,
              name: row.name,
              quantity: row.quantity,
              salePrice: row.salePrice,
              profitRwf: row.profitRwf,
              descriptionKeywords: row.descriptionKeywords,
            })),
          }),
        })
        const stockJson = (await stockRes.json().catch(() => ({}))) as {
          ok?: boolean
          inserted?: number
          error?: string
          code?: string
          upstreamStatus?: number
          upstreamUrl?: string
        }
        if (!stockRes.ok || !stockJson?.ok) {
          const bits = [stockJson?.error || "Could not save stock lines (Java API)"]
          if (typeof stockJson?.upstreamStatus === "number") {
            bits.push(`HTTP ${stockJson.upstreamStatus}`)
          }
          if (typeof stockJson?.upstreamUrl === "string" && stockJson.upstreamUrl) {
            bits.push(stockJson.upstreamUrl)
          }
          if (stockJson?.code === "GRANDMA_NOT_JSON") {
            bits.push(
              "Deploy the WAR that includes GrandmaSellerStockServlet, or open that URL in the browser — if you see an HTML error page, the servlet path is missing on Tomcat."
            )
          }
          throw new Error(bits.join(" — "))
        }
        inserted = typeof stockJson.inserted === "number" ? stockJson.inserted : 0
      }

      let tempOk = 0
      const sectorSlug = shopCategoryToSectorSlug(business.category)
      for (const row of tempLines) {
        const cost = Math.max(0, row.salePrice - (row.profitRwf || 0))
        const tr = await fetch("/api/grandma/sellers/items/temp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sellerAccount: ishyiga,
            itemName: row.name.trim() || "Custom item",
            sectorSlug,
            costPrice: cost,
            salePrice: Math.max(1, row.salePrice),
            quantity: Math.max(1, row.quantity),
          }),
        })
        const tj = (await tr.json().catch(() => ({}))) as { ok?: boolean; error?: string }
        if (!tr.ok || !tj?.ok) {
          throw new Error(tj?.error || "Could not save custom item (grandma_niki_items_temp + stock)")
        }
        tempOk++
      }

      const { password: _omitPwd, ...businessSafe } = business
      const payload = {
        business: {
          ...businessSafe,
          sellerAccount: ishyiga,
          locationSummary,
        },
        catalog: picks,
        lines,
        submittedAt: new Date().toISOString(),
      }
      const res = await fetch("/api/onboarding/crazy-shopping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Save failed")
      let msg = String(json.message || "Saved.")
      msg += ` ${inserted} bulk stock row(s) in seller_add_stock`
      if (tempOk > 0) {
        msg += `; ${tempOk} custom line(s) (PEND-… temp + stock).`
      } else {
        msg += "."
      }
      if (json.persisted) {
        msg += " Draft logged."
      }
      msg += ` Seller account: ${ishyiga}.`
      setDoneMsg(msg)

      login({
        id: business.email.trim(),
        email: business.email.trim(),
        name: business.ownerName,
        role: "supplier",
        phone: business.phone,
        location: locationSummary,
        ishyigaAccount: ishyiga,
        dbRole: "SELLER",
        businessName: business.companyName,
        businessCategory: business.category,
        momo: business.momoCode,
      })

      window.setTimeout(() => {
        router.push("/seller")
        setStep(1)
        setBusiness(initialBusiness)
        setPicks([])
        setLines([])
        setSearchQ("")
        setSearchHits([])
        setCategoryPreview([])
      }, 900)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Submit error")
    } finally {
      setSubmitting(false)
    }
  }

  const cardClass =
    "rounded-2xl border-[#dbe7f3] bg-white shadow-[0_8px_18px_rgba(24,151,224,.08)]"

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
                <div className="truncate text-xs text-white/90">{pickLang(SELLER_UI.pageSubtitle, lang)}</div>
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
            { n: 1, tri: SELLER_UI.stepBusiness },
            { n: 2, tri: SELLER_UI.stepItemsStock },
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
          <div className="rounded-xl border border-red-200 bg-red-50/95 px-3 py-2 text-sm text-red-800 shadow-sm">
            {err}
          </div>
        )}
        {doneMsg && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/95 px-3 py-2 text-sm text-emerald-900 shadow-sm">
            <Check className="h-4 w-4 shrink-0" />
            {doneMsg}
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs font-medium text-[#1897e0]">
          <Link href="/forgot-password" className="hover:underline">
            Forgot password?
          </Link>
          <Link href="/login" className="hover:underline">
            Sign in
          </Link>
        </div>

        {step === 1 && (
          <Card className={cardClass}>
            <CardHeader>
              <CardTitle className="text-[#17324d]">{pickLang(SELLER_UI.cardStep1, lang)}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div id="seller-field-companyName" className="sm:col-span-2 space-y-2 scroll-mt-24">
                <FieldLabel lang={lang} tri={L.companyName} />
                <Input
                  id="companyName"
                  value={business.companyName}
                  onChange={(e) => setBusiness((b) => ({ ...b, companyName: e.target.value }))}
                  placeholder="e.g. Cassa Blanca Liquor Ltd"
                />
              </div>
              <p className="sm:col-span-2 text-sm text-[#6f8399] rounded-xl border border-[#dbe7f3] bg-[#f7fbff] px-3 py-2">
                Sign in with your <strong className="text-[#17324d]">phone number</strong> after registration — no email
                required.
              </p>
              <div id="seller-field-password" className="space-y-2 scroll-mt-24">
                <FieldLabel lang={lang} tri={L.password} />
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={business.password}
                  onChange={(e) => setBusiness((b) => ({ ...b, password: e.target.value }))}
                />
              </div>
              <div id="seller-field-phone" className="space-y-2 scroll-mt-24">
                <FieldLabel lang={lang} tri={L.phone} />
                <Input
                  id="phone"
                  value={business.phone}
                  onChange={(e) => setBusiness((b) => ({ ...b, phone: e.target.value }))}
                  placeholder="250…"
                />
              </div>
              <div className="space-y-2">
                <FieldLabel lang={lang} tri={L.momo} />
                <Input
                  id="momoCode"
                  value={business.momoCode}
                  onChange={(e) => setBusiness((b) => ({ ...b, momoCode: e.target.value }))}
                />
              </div>
              <div id="seller-field-owner" className="space-y-2 scroll-mt-24">
                <FieldLabel lang={lang} tri={L.owner} />
                <Input
                  id="ownerName"
                  value={business.ownerName}
                  onChange={(e) => setBusiness((b) => ({ ...b, ownerName: e.target.value }))}
                />
              </div>

              <div className="sm:col-span-2 space-y-3">
                <FieldLabel lang={lang} tri={L.delivery} />
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {DELIVERY_MODES.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setBusiness((b) => ({ ...b, deliveryPref: d.id }))}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-[14px] border p-3 text-center shadow-[0_8px_18px_rgba(24,151,224,.06)] transition-all",
                        business.deliveryPref === d.id
                          ? "border-2 border-[#1897e0] bg-[#f2f9ff]"
                          : "border-[#dbe7f3] bg-white hover:bg-[#f7fbff]"
                      )}
                    >
                      <span className="text-2xl leading-none" aria-hidden>
                        {d.icon}
                      </span>
                      <span className="text-sm font-bold text-[#17324d]">{pickLang(d.tri, lang)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-2 space-y-2">
                <FieldLabel lang={lang} tri={L.logo} />
                <div className="flex flex-wrap items-center gap-4">
                  {business.logoDataUrl ? (
                    <div className="relative h-20 w-20 overflow-hidden rounded-lg border bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={business.logoDataUrl} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        aria-label="Remove logo"
                        className="absolute right-1 top-1 rounded-full bg-background/90 p-1 shadow"
                        onClick={() => setBusiness((b) => ({ ...b, logoDataUrl: null }))}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : null}
                  <Input
                    type="file"
                    accept="image/*"
                    className="max-w-xs cursor-pointer"
                    onChange={onLogoFile}
                  />
                </div>
              </div>

              <div id="seller-field-category" className="space-y-2 sm:col-span-2 scroll-mt-24">
                <FieldLabel lang={lang} tri={L.category} />
                <Select
                  value={business.category || undefined}
                  onValueChange={(v) => setBusiness((b) => ({ ...b, category: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={pickLang(SELLER_UI.selectCategory, lang)} />
                  </SelectTrigger>
                  <SelectContent>
                    {BUSINESS_CATEGORIES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div id="seller-field-province" className="sm:col-span-2 space-y-2 scroll-mt-24">
                <FieldLabel lang={lang} tri={L.province} />
                <GeoCombobox
                  value={business.province}
                  onChange={(v) =>
                    setBusiness((b) => ({
                      ...b,
                      province: v,
                      district: "",
                      locationSector: "",
                      cellule: "",
                      village: "",
                    }))
                  }
                  options={provinceOptions}
                  placeholder={pickLang(SELLER_UI.searchProvince, lang)}
                />
              </div>
              <div id="seller-field-district" className="space-y-2 scroll-mt-24">
                <FieldLabel lang={lang} tri={L.district} />
                <GeoCombobox
                  value={business.district}
                  onChange={(v) =>
                    setBusiness((b) => ({
                      ...b,
                      district: v,
                      locationSector: "",
                      cellule: "",
                      village: "",
                    }))
                  }
                  options={districtOptions}
                  placeholder={
                    business.province
                      ? pickLang(SELLER_UI.searchDistrict, lang)
                      : pickLang(SELLER_UI.selectProvinceFirst, lang)
                  }
                  disabled={!business.province}
                  emptyText={pickLang(SELLER_UI.noDistricts, lang)}
                />
              </div>
              <div id="seller-field-locationSector" className="space-y-2 scroll-mt-24">
                <FieldLabel lang={lang} tri={L.locationSector} />
                <Select
                  value={business.locationSector || undefined}
                  onValueChange={(v) =>
                    setBusiness((b) => ({ ...b, locationSector: v, cellule: "", village: "" }))
                  }
                  disabled={!business.district || locationSectorOptions.length === 0}
                >
                  <SelectTrigger id="locationSector">
                    <SelectValue placeholder={pickLang(SELLER_UI.selectLocationSector, lang)} />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {locationSectorOptions.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div id="seller-field-cellule" className="space-y-2 scroll-mt-24">
                <FieldLabel lang={lang} tri={L.cellule} />
                <Select
                  value={business.cellule || undefined}
                  onValueChange={(v) => setBusiness((b) => ({ ...b, cellule: v, village: "" }))}
                  disabled={!business.locationSector || celluleOptions.length === 0}
                >
                  <SelectTrigger id="cellule">
                    <SelectValue placeholder={pickLang(SELLER_UI.selectCellule, lang)} />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {celluleOptions.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div id="seller-field-village" className="space-y-2 sm:col-span-2 scroll-mt-24">
                <FieldLabel lang={lang} tri={L.village} />
                <Select
                  value={business.village || undefined}
                  onValueChange={(v) => setBusiness((b) => ({ ...b, village: v }))}
                  disabled={!business.cellule || villageOptions.length === 0}
                >
                  <SelectTrigger id="village">
                    <SelectValue placeholder={pickLang(SELLER_UI.selectVillage, lang)} />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {villageOptions.map((vil, i) => (
                      <SelectItem key={`${vil}-${i}`} value={vil}>
                        {vil}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <FieldLabel lang={lang} tri={L.street} />
                <Input
                  id="street"
                  value={business.street}
                  onChange={(e) => setBusiness((b) => ({ ...b, street: e.target.value }))}
                  placeholder="Street, building, landmark…"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card className={cardClass}>
            <CardHeader>
              <CardTitle className="text-[#17324d]">{pickLang(SELLER_UI.cardStep2Title, lang)}</CardTitle>
              <CardDescription className="text-[#6f8399]">
                {pickLang(SELLER_UI.cardStep2Desc, lang)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="search" className="text-[#17324d]">
                  {pickLang(SELLER_UI.searchProducts, lang)}
                </Label>
                <Input
                  id="search"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="Whiskey, paracetamol, brand…"
                />
                {!searchActive && (
                  <p className="text-xs text-[#6f8399]">{pickLang(SELLER_UI.typeToSearchMore, lang)}</p>
                )}
              </div>
              {!searchActive && (
                <p className="text-sm font-medium text-[#17324d]">
                  {pickLang(SELLER_UI.categorySuggested, lang)}
                </p>
              )}
              <div className="max-h-[min(70vh,28rem)] divide-y overflow-y-auto rounded-xl border border-[#dbe7f3] bg-white">
                {catalogLoading && (
                  <div className="flex items-center gap-2 p-3 text-sm text-[#6f8399]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {pickLang(SELLER_UI.searching, lang)}
                  </div>
                )}
                {!catalogLoading && searchActive && searchHits.length === 0 && (
                  <div className="flex flex-col gap-2 border-t border-[#eef4fb] p-3">
                    <p className="text-xs text-[#6f8399]">{pickLang(SELLER_UI.noHits, lang)}</p>
                    <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={addCustomPick}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add it yourself
                    </Button>
                  </div>
                )}
                {!catalogLoading &&
                  catalogList.map((p) => (
                    <div key={catalogKey(p)} className="flex items-center justify-between gap-2 p-3 text-sm">
                      <div className="flex min-w-0 flex-1 items-start gap-2">
                        <ProductImageFallback
                          source={asProductImageSource(p)}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded-lg border border-[#eef4fb] bg-white object-contain"
                        />
                        <div className="min-w-0">
                          <div className="truncate font-medium text-[#17324d]">
                            {p.item_commercial_name || p.item_code}
                          </div>
                          <div className="truncate text-xs text-[#6f8399]">
                            NIKI: {getNikiCodeFromSource(p) || "—"}
                            {p.selling_price != null && (
                              <span className="ml-2">ref {numPrice(p.selling_price)} RWF</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button type="button" size="sm" variant="secondary" onClick={() => addPick(p)}>
                        <Plus className="h-4 w-4 mr-1" />
                        {pickLang(SELLER_UI.add, lang)}
                      </Button>
                    </div>
                  ))}
                {!catalogLoading && !searchActive && catalogList.length === 0 && (
                  <div className="p-3 text-sm text-[#6f8399]">{pickLang(SELLER_UI.noHits, lang)}</div>
                )}
              </div>
              <div>
                <div className="mb-2 text-sm font-semibold text-[#17324d]">
                  {pickLang(SELLER_UI.selected, lang)} ({picks.length})
                </div>
                {picks.length === 0 ? (
                  <p className="text-sm text-[#6f8399]">{pickLang(SELLER_UI.addOneItem, lang)}</p>
                ) : (
                  <div className="space-y-3">
                    {picks.map((p) => {
                      const row = lines.find((l) => l.id === p.id)
                      if (!row) return null
                      return (
                        <div
                          key={row.id}
                          id={`seller-line-${row.id}`}
                          className="scroll-mt-24 rounded-2xl border border-[#dbe7f3] bg-white p-3 shadow-[0_4px_14px_rgba(24,151,224,.06)]"
                        >
                          <div className="flex gap-3">
                            <ProductImageFallback
                              source={{ ...row, item_commercial_name: row.name } as ProductImageSource}
                              alt=""
                              className="h-14 w-14 shrink-0 rounded-xl border border-[#eef4fb] bg-white object-contain"
                            />
                            <div className="min-w-0 flex-1">
                              {row.isCustom ? (
                                <Input
                                  className="font-semibold text-[#17324d]"
                                  value={row.name}
                                  onChange={(e) => updateLine(row.id, { name: e.target.value })}
                                />
                              ) : (
                                <div className="font-semibold leading-tight text-[#17324d]">{row.name}</div>
                              )}
                              <div className="mt-0.5 break-all text-xs text-[#6f8399]">
                                {pickLang(SELLER_UI.thNiki, lang)}: {row.nikiCode || "—"}
                              </div>
                              {row.refSellingPrice != null && row.refSellingPrice > 0 && (
                                <div className="mt-1 text-xs text-[#6f8399]">
                                  ref {Math.round(row.refSellingPrice)} RWF
                                </div>
                              )}
                            </div>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="shrink-0"
                              onClick={() => removePick(p.id)}
                              aria-label="Remove"
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                          <div className="mt-3 rounded-xl border border-[#dbe7f3] bg-[#f7fbff]/50 p-3">
                            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                              <div className="space-y-1.5">
                                <div className="text-xs font-semibold text-[#17324d]">
                                  {pickLang(SELLER_UI.thProfit, lang)}
                                </div>
                                <RwfPriceInput
                                  min={0}
                                  value={row.profitRwf ?? 0}
                                  onCommit={(n) => updateLine(row.id, { profitRwf: n })}
                                  className="h-10 border-[#dbe7f3] bg-white font-medium"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <div className="text-xs font-semibold text-[#17324d]">
                                  {pickLang(SELLER_UI.thSale, lang)}
                                </div>
                                <RwfPriceInput
                                  min={0}
                                  value={row.salePrice}
                                  onCommit={(n) => updateLine(row.id, { salePrice: n })}
                                  className="h-10 border-[#dbe7f3] bg-white text-right font-semibold"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <div className="text-xs font-semibold text-[#17324d]">
                                  {pickLang(SELLER_UI.thKeywords, lang)}
                                </div>
                                <Input
                                  className="h-10 border-[#dbe7f3] bg-white font-mono text-sm"
                                  value={row.descriptionKeywords}
                                  onChange={(e) =>
                                    updateLine(row.id, { descriptionKeywords: e.target.value })
                                  }
                                  placeholder={pickLang(SELLER_UI.placeholderNikiCode, lang)}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <div className="text-xs font-semibold text-[#17324d]">
                                  {pickLang(SELLER_UI.thIngano, lang)}
                                </div>
                                <IntegerQtyInput
                                  min={1}
                                  value={row.quantity}
                                  onCommit={(n) => updateLine(row.id, { quantity: n })}
                                  className="h-10 border-[#dbe7f3] bg-white text-center font-semibold"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap justify-between gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            className="border-[#dbe7f3] bg-white text-[#17324d] hover:bg-[#f7fbff]"
            onClick={goBack}
            disabled={step === 1 || submitting}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            {pickLang(SELLER_UI.back, lang)}
          </Button>
          <div className="flex gap-2">
            {step === 1 ? (
              <Button
                type="button"
                disabled={submitting}
                onClick={goNext}
                className="bg-gradient-to-r from-[#1897e0] to-[#127fc0] text-white shadow-[0_10px_20px_rgba(24,151,224,.22)] hover:opacity-95"
              >
                {pickLang(SELLER_UI.next, lang)}
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                disabled={submitting}
                onClick={submit}
                className="bg-gradient-to-r from-[#1897e0] to-[#127fc0] text-white shadow-[0_10px_20px_rgba(24,151,224,.22)] hover:opacity-95"
              >
                {submitting ? (
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
            )}
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}
