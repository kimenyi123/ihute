"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, Check, Loader2, MapPin, Plus, Trash2, X } from "lucide-react"
import type { GlobalResult } from "@/components/global-search"
import { filterProductsByRelevance } from "@/lib/search-utils"
import { getNikiCodeFromSource, getProductImageSrc, type ProductImageSource } from "@/lib/image-utils"
import { ProductImageFallback } from "@/components/product-image-fallback"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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
import { useRouter, useSearchParams } from "next/navigation"
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
import { shopCategoryToSectorSlug, GRANDMA_REGISTRATION_CATEGORY_VALUES, grandmaCategoryLabel, resolveGrandmaCategory, isPlaceholderGrandmaShopName } from "@/lib/seller-category-sector"
import { classifyBrowserGpsError, isShopGpsInRwanda } from "@/lib/grandma-seller-gps"
import { buildGrandmaSellerGpsPayload } from "@/lib/grandma-seller-gps-payload"

const BUSINESS_CATEGORIES = GRANDMA_REGISTRATION_CATEGORY_VALUES
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
  latitude: null,
  longitude: null,
  gpsAccuracy: null,
  shopNickname: "",
  logoDataUrl: null,
}

function normalizeShopNickname(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function getPhoneDigits(phone: string): string {
  return String(phone ?? "").replace(/\D/g, "")
}

function isValidPhone(phone: string): boolean {
  const digits = getPhoneDigits(phone)
  return digits.length >= 10 && digits.length <= 12
}

function isShopNicknameAllowed(raw: string): boolean {
  const value = raw.trim()
  if (!value) return true
  return /^[a-zA-Z0-9-]+$/.test(value)
}

function validateSellerField(fieldId: string, value: string, lang: Language): string | undefined {
  const trimmed = String(value ?? "").trim()
  switch (fieldId) {
    case "seller-field-companyName":
      if (!trimmed || isPlaceholderGrandmaShopName(trimmed)) {
        return pickLang(ERR.missingCompanyName, lang)
      }
      return undefined
    case "seller-field-password":
      return trimmed.length >= 6 ? undefined : pickLang(ERR.missingPassword, lang)
    case "seller-field-phone":
      return !trimmed
        ? pickLang(ERR.missingPhone, lang)
        : isValidPhone(trimmed)
        ? undefined
        : pickLang(ERR.invalidPhone, lang)
    case "seller-field-owner":
      return trimmed ? undefined : pickLang(ERR.missingOwner, lang)
    case "seller-field-category":
      return trimmed ? undefined : pickLang(ERR.missingCategory, lang)
    case "seller-field-province":
      return trimmed ? undefined : pickLang(ERR.missingProvince, lang)
    case "seller-field-district":
      return trimmed ? undefined : pickLang(ERR.missingDistrict, lang)
    case "seller-field-locationSector":
      return trimmed ? undefined : pickLang(ERR.missingLocationSector, lang)
    case "seller-field-cellule":
      return trimmed ? undefined : pickLang(ERR.missingCellule, lang)
    case "seller-field-village":
      return trimmed ? undefined : pickLang(ERR.missingVillage, lang)
    case "seller-field-shopNickname":
      return isShopNicknameAllowed(value) ? undefined : pickLang(ERR.shopNicknameInvalid, lang)
    default:
      return undefined
  }
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
  const searchParams = useSearchParams()
  const login = useAuthStore((s) => s.login)
  const authUser = useAuthStore((s) => s.user)
  const authHydrated = useAuthStore((s) => s.hasHydrated)
  const supplierNikiMode = searchParams.get("source") === "supplier"
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
  const [gpsPersistWarn, setGpsPersistWarn] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({})
  const [gpsCapturing, setGpsCapturing] = useState(false)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [confirmUseCurrentLocation, setConfirmUseCurrentLocation] = useState(false)

  /** True only after GPS capture succeeds (lat/lng set). */
  const locationSelected = business.latitude != null && business.longitude != null

  const lang = useLanguageStore((s) => s.language)
  const setLanguage = useLanguageStore((s) => s.setLanguage)

  const isStep1Valid = useMemo(() => {
    return (
      !!business.companyName.trim() &&
      !isPlaceholderGrandmaShopName(business.companyName) &&
      business.password.trim().length >= 6 &&
      isValidPhone(business.phone) &&
      !!business.ownerName.trim() &&
      !!business.category &&
      !!business.province &&
      !!business.district.trim() &&
      !!business.locationSector.trim() &&
      !!business.cellule.trim() &&
      !!business.village.trim() &&
      isShopNicknameAllowed(business.shopNickname)
    )
  }, [business])

  const langPersistSkip = useRef(true)
  useEffect(() => {
    try {
      const g = localStorage.getItem("grandma:lang")
      if (g === "en" || g === "rw" || g === "fr") setLanguage(g)
    } catch {
      /* ignore */
    }
  }, [setLanguage])

  /** Deep link from Grandma “Add stock (NIKI)” → NIKI catalog step (products during signup). */
  useEffect(() => {
    const stepParam = searchParams.get("step")
    const niki = searchParams.get("niki")
    const catalog = searchParams.get("catalog")
    if (stepParam === "2" || niki === "1" || catalog === "1") {
      setStep(2)
    }
  }, [searchParams])

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
    const fieldIds = [
      "seller-field-companyName",
      "seller-field-password",
      "seller-field-phone",
      "seller-field-owner",
      "seller-field-category",
      "seller-field-province",
      "seller-field-district",
      "seller-field-locationSector",
      "seller-field-cellule",
      "seller-field-village",
      "seller-field-shopNickname",
    ]

    const errors: Record<string, string> = {}
    for (const fieldId of fieldIds) {
      let value = ""
      switch (fieldId) {
        case "seller-field-companyName":
          value = business.companyName
          break
        case "seller-field-password":
          value = business.password
          break
        case "seller-field-phone":
          value = business.phone
          break
        case "seller-field-owner":
          value = business.ownerName
          break
        case "seller-field-category":
          value = business.category
          break
        case "seller-field-province":
          value = business.province
          break
        case "seller-field-district":
          value = business.district
          break
        case "seller-field-locationSector":
          value = business.locationSector
          break
        case "seller-field-cellule":
          value = business.cellule
          break
        case "seller-field-village":
          value = business.village
          break
        case "seller-field-shopNickname":
          value = business.shopNickname
          break
      }
      const error = validateSellerField(fieldId, value, lang)
      if (error) errors[fieldId] = error
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      const firstField = Object.keys(errors)[0]
      const firstMessage = errors[firstField]
      const msg = firstMessage
        ? `${firstMessage} ${pickLang(ERR.step1ScrollHint, lang)}`
        : pickLang(ERR.step1ScrollHint, lang)
      setErr(msg)
      window.setTimeout(() => {
        document.getElementById(firstField)?.scrollIntoView({ behavior: "smooth", block: "center" })
      }, 80)
      return false
    }

    setFieldErrors({})
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

  const requireLocationSelected = () => {
    if (locationSelected) return true
    const msg = pickLang(ERR.currentLocationRequired, lang)
    setFieldErrors((prev) => ({ ...prev, "seller-field-shop-location": msg }))
    setErr(msg)
    window.setTimeout(() => {
      document.getElementById("seller-field-shop-location")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      })
    }, 80)
    return false
  }

  const goNext = () => {
    if (step === 1) {
      if (!validateStep1()) return
      if (!requireLocationSelected()) return
      if (!confirmUseCurrentLocation) {
        const msg = pickLang(ERR.confirmUseCurrentLocationRequired, lang)
        setFieldErrors((prev) => ({ ...prev, "seller-field-confirm-location": msg }))
        setErr(msg)
        window.setTimeout(() => {
          document.getElementById("seller-field-shop-location")?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          })
        }, 80)
        return
      }
      setStep(2)
    }
  }

  const goBack = () => {
    setErr(null)
    if (step === 1) return
    setStep(1)
  }

  const captureShopGps = () => {
    setGpsError(null)
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsError(pickLang(ERR.gpsUnsupported, lang))
      return
    }
    setGpsCapturing(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        const accuracy =
          typeof pos.coords.accuracy === "number" && Number.isFinite(pos.coords.accuracy)
            ? pos.coords.accuracy
            : null
        if (!isShopGpsInRwanda(lat, lng)) {
          setBusiness((b) => ({ ...b, latitude: null, longitude: null, gpsAccuracy: null }))
          setConfirmUseCurrentLocation(false)
          setGpsError(pickLang(ERR.gpsOutsideRwanda, lang))
          setGpsCapturing(false)
          return
        }
        setBusiness((b) => ({
          ...b,
          latitude: lat,
          longitude: lng,
          gpsAccuracy: accuracy,
        }))
        setFieldErrors((prev) => ({
          ...prev,
          "seller-field-shop-location": undefined,
        }))
        setGpsError(null)
        setGpsCapturing(false)
      },
      (geoErr) => {
        const kind = classifyBrowserGpsError(geoErr)
        const msg =
          kind === "denied"
            ? pickLang(ERR.gpsPermissionDenied, lang)
            : kind === "unavailable"
              ? pickLang(ERR.gpsUnavailable, lang)
              : kind === "timeout"
                ? pickLang(ERR.gpsTimeout, lang)
                : pickLang(ERR.gpsUnavailable, lang)
        setGpsError(msg)
        setGpsCapturing(false)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }

  const submit = async () => {
    if (picks.length === 0) {
      setErr(pickLang(ERR.step2, lang))
      return
    }
    if (!validateLinesForSubmit()) return

    if (supplierNikiMode) {
      if (!authHydrated || authUser?.role !== "supplier" || !authUser.ishyigaAccount?.trim()) {
        setErr("Your supplier session is unavailable. Sign in again and retry.")
        return
      }

      const supplierAccount = authUser.ishyigaAccount.trim()
      const bulkLines = lines.filter((row) => String(row.nikiCode ?? "").trim().length > 0)
      if (bulkLines.length === 0) {
        setErr("Select at least one NIKI product before submitting.")
        return
      }

      setErr(null)
      setSubmitting(true)
      setDoneMsg(null)
      try {
        const stockRes = await fetch("/api/grandma/sellers/stock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sellerAccount: supplierAccount,
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
        }
        if (!stockRes.ok || !stockJson.ok) {
          throw new Error(stockJson.error || "Could not save stock lines")
        }

        const inserted = typeof stockJson.inserted === "number" ? stockJson.inserted : bulkLines.length
        setDoneMsg(`${inserted} NIKI product(s) added to your stock.`)
        setLines([])
        setPicks([])
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : "Could not save stock lines")
      } finally {
        setSubmitting(false)
      }
      return
    }

    if (!locationSelected) {
      const msg = pickLang(ERR.currentLocationRequired, lang)
      setFieldErrors((prev) => ({ ...prev, "seller-field-shop-location": msg }))
      setErr(msg)
      setStep(1)
      window.setTimeout(() => {
        document.getElementById("seller-field-shop-location")?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        })
      }, 80)
      return
    }
    if (!confirmUseCurrentLocation) {
      const msg = pickLang(ERR.confirmUseCurrentLocationRequired, lang)
      setFieldErrors((prev) => ({ ...prev, "seller-field-confirm-location": msg }))
      setErr(msg)
      setStep(1)
      window.setTimeout(() => {
        document.getElementById("seller-field-shop-location")?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        })
      }, 80)
      return
    }
    setErr(null)
    setSubmitting(true)
    setDoneMsg(null)
    setGpsPersistWarn(null)
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

      const nickNorm = normalizeShopNickname(business.shopNickname)
      const regBody: Record<string, unknown> = {
        password: business.password,
        firstName: ownerFirst || "Owner",
        lastName: ownerLast,
        companyName: business.companyName.trim(),
        tel: business.phone.trim(),
        phone: business.phone.trim(),
        location: locationSummary,
        shopAddress: locationSummary,
        sector: shopCategoryToSectorSlug(business.category),
        delivery_mode: business.deliveryPref,
        momo_code: business.momoCode.trim(),
      }
      if (nickNorm) {
        regBody.nickname = nickNorm
      }
      if (
        business.latitude != null &&
        business.longitude != null &&
        Number.isFinite(business.latitude) &&
        Number.isFinite(business.longitude)
      ) {
        const gpsFields = buildGrandmaSellerGpsPayload({
          latitude: business.latitude,
          longitude: business.longitude,
          gpsAccuracy: business.gpsAccuracy,
        })
        if (gpsFields) {
          Object.assign(regBody, gpsFields)
        }
      }
      const regRes = await fetch("/api/grandma/sellers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(regBody),
      })
      const regJson = (await regRes.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        code?: string
        ishyigaAccount?: string
        gpsPersist?: { ok?: boolean; skipped?: boolean; reason?: string | null }
      }
      if (!regRes.ok || !regJson?.ok) {
        if (regJson?.code === "NICKNAME_EXISTS") {
          throw new Error(
            regJson?.error ||
              "This shop nickname is already taken. Choose another or leave it blank."
          )
        }
        throw new Error(regJson?.error || "Seller account registration failed")
      }
      const ishyiga = String(regJson.ishyigaAccount || "").trim()
      if (!ishyiga) {
        throw new Error("Registration succeeded but no ishyiga account was returned")
      }
      // Account create succeeded; GPS sync is secondary — warn without failing registration.
      const gpsSyncFailed = regJson.gpsPersist != null && regJson.gpsPersist.ok === false
      const gpsWarnMsg = gpsSyncFailed
        ? pickLang(SELLER_UI.gpsPersistIncomplete, lang)
        : null

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
      setGpsPersistWarn(gpsWarnMsg)

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
        setGpsPersistWarn(null)
      }, gpsWarnMsg ? 4500 : 900)
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
        {gpsPersistWarn && (
          <div
            className="rounded-xl border border-amber-200 bg-amber-50/95 px-3 py-2 text-sm text-amber-950 shadow-sm"
            role="status"
          >
            {gpsPersistWarn}
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
                  onChange={(e) => {
                    setBusiness((b) => ({ ...b, companyName: e.target.value }))
                    setFieldErrors((prev) => ({ ...prev, "seller-field-companyName": undefined }))
                  }}
                  onBlur={() => {
                    const error = validateSellerField("seller-field-companyName", business.companyName, lang)
                    setFieldErrors((prev) => ({ ...prev, "seller-field-companyName": error }))
                  }}
                  placeholder="e.g. Cassa Blanca Liquor Ltd"
                  aria-invalid={fieldErrors["seller-field-companyName"] ? "true" : undefined}
                  aria-describedby={fieldErrors["seller-field-companyName"] ? "seller-field-companyName-error" : undefined}
                  className={fieldErrors["seller-field-companyName"] ? "aria-invalid:ring-destructive/40 aria-invalid:border-destructive" : ""}
                />
                {fieldErrors["seller-field-companyName"] ? (
                  <p id="seller-field-companyName-error" className="text-sm text-destructive">{fieldErrors["seller-field-companyName"]}</p>
                ) : null}
              </div>
              <div id="seller-field-shopNickname" className="sm:col-span-2 space-y-2 scroll-mt-24">
                <FieldLabel lang={lang} tri={L.shopNickname} />
                <Input
                  id="shopNickname"
                  value={business.shopNickname}
                  onChange={(e) => {
                    setBusiness((b) => ({ ...b, shopNickname: e.target.value }))
                    setFieldErrors((prev) => ({ ...prev, "seller-field-shopNickname": undefined }))
                  }}
                  onBlur={() => {
                    setBusiness((b) => ({ ...b, shopNickname: normalizeShopNickname(b.shopNickname) }))
                    const error = validateSellerField("seller-field-shopNickname", business.shopNickname, lang)
                    setFieldErrors((prev) => ({ ...prev, "seller-field-shopNickname": error }))
                  }}
                  placeholder="e.g. cassablanca"
                  className={cn("font-mono", fieldErrors["seller-field-shopNickname"] ? "aria-invalid:ring-destructive/40 aria-invalid:border-destructive" : "")}
                  autoComplete="off"
                  aria-invalid={fieldErrors["seller-field-shopNickname"] ? "true" : undefined}
                  aria-describedby={fieldErrors["seller-field-shopNickname"] ? "seller-field-shopNickname-error" : undefined}
                />
                {fieldErrors["seller-field-shopNickname"] ? (
                  <p id="seller-field-shopNickname-error" className="text-sm text-destructive">{fieldErrors["seller-field-shopNickname"]}</p>
                ) : (
                  <p className="text-xs text-[#6f8399]">
                    Letters, numbers, hyphens only — used for Shop With Me links. Leave blank to set later in the
                    dashboard.
                  </p>
                )}
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
                  onChange={(e) => {
                    setBusiness((b) => ({ ...b, password: e.target.value }))
                    setFieldErrors((prev) => ({ ...prev, "seller-field-password": undefined }))
                  }}
                  onBlur={() => {
                    const error = validateSellerField("seller-field-password", business.password, lang)
                    setFieldErrors((prev) => ({ ...prev, "seller-field-password": error }))
                  }}
                  aria-invalid={fieldErrors["seller-field-password"] ? "true" : undefined}
                  aria-describedby={fieldErrors["seller-field-password"] ? "seller-field-password-error" : undefined}
                  className={fieldErrors["seller-field-password"] ? "aria-invalid:ring-destructive/40 aria-invalid:border-destructive" : ""}
                />
                {fieldErrors["seller-field-password"] ? (
                  <p id="seller-field-password-error" className="text-sm text-destructive">{fieldErrors["seller-field-password"]}</p>
                ) : null}
              </div>
              <div id="seller-field-phone" className="space-y-2 scroll-mt-24">
                <FieldLabel lang={lang} tri={L.phone} />
                <Input
                  id="phone"
                  value={business.phone}
                  inputMode="numeric"
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 12)
                    setBusiness((b) => ({ ...b, phone: digits }))
                    setFieldErrors((prev) => ({ ...prev, "seller-field-phone": undefined }))
                  }}
                  onBlur={() => {
                    const error = validateSellerField("seller-field-phone", business.phone, lang)
                    setFieldErrors((prev) => ({ ...prev, "seller-field-phone": error }))
                  }}
                  placeholder="250…"
                  aria-invalid={fieldErrors["seller-field-phone"] ? "true" : undefined}
                  aria-describedby={fieldErrors["seller-field-phone"] ? "seller-field-phone-error" : undefined}
                  className={fieldErrors["seller-field-phone"] ? "aria-invalid:ring-destructive/40 aria-invalid:border-destructive" : ""}
                />
                {fieldErrors["seller-field-phone"] ? (
                  <p id="seller-field-phone-error" className="text-sm text-destructive">{fieldErrors["seller-field-phone"]}</p>
                ) : null}
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
                  onChange={(e) => {
                    setBusiness((b) => ({ ...b, ownerName: e.target.value }))
                    setFieldErrors((prev) => ({ ...prev, "seller-field-owner": undefined }))
                  }}
                  onBlur={() => {
                    const error = validateSellerField("seller-field-owner", business.ownerName, lang)
                    setFieldErrors((prev) => ({ ...prev, "seller-field-owner": error }))
                  }}
                  aria-invalid={fieldErrors["seller-field-owner"] ? "true" : undefined}
                  aria-describedby={fieldErrors["seller-field-owner"] ? "seller-field-owner-error" : undefined}
                  className={fieldErrors["seller-field-owner"] ? "aria-invalid:ring-destructive/40 aria-invalid:border-destructive" : ""}
                />
                {fieldErrors["seller-field-owner"] ? (
                  <p id="seller-field-owner-error" className="text-sm text-destructive">{fieldErrors["seller-field-owner"]}</p>
                ) : null}
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
                  onValueChange={(v) => {
                    setBusiness((b) => ({ ...b, category: v }))
                    const error = validateSellerField("seller-field-category", v, lang)
                    setFieldErrors((prev) => ({ ...prev, "seller-field-category": error }))
                  }}
                >
                  <SelectTrigger
                    className={fieldErrors["seller-field-category"] ? "border-destructive text-destructive focus-visible:ring-destructive/50" : ""}
                  >
                    <SelectValue placeholder={pickLang(SELLER_UI.selectCategory, lang)} />
                  </SelectTrigger>
                  <SelectContent>
                    {BUSINESS_CATEGORIES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {grandmaCategoryLabel(resolveGrandmaCategory(s), lang)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErrors["seller-field-category"] ? (
                  <p className="text-sm text-destructive">{fieldErrors["seller-field-category"]}</p>
                ) : null}
              </div>

              <div id="seller-field-province" className="sm:col-span-2 space-y-2 scroll-mt-24">
                <FieldLabel lang={lang} tri={L.province} />
                <GeoCombobox
                  value={business.province}
                  className={fieldErrors["seller-field-province"] ? "border-destructive text-destructive focus-visible:ring-destructive/50" : ""}
                  onChange={(v) => {
                    setBusiness((b) => ({
                      ...b,
                      province: v,
                      district: "",
                      locationSector: "",
                      cellule: "",
                      village: "",
                    }))
                    setFieldErrors((prev) => ({ ...prev, "seller-field-province": undefined }))
                  }}
                  options={provinceOptions}
                  placeholder={pickLang(SELLER_UI.searchProvince, lang)}
                />
                {fieldErrors["seller-field-province"] ? (
                  <p className="text-sm text-destructive">{fieldErrors["seller-field-province"]}</p>
                ) : null}
              </div>
              <div id="seller-field-district" className="space-y-2 scroll-mt-24">
                <FieldLabel lang={lang} tri={L.district} />
                <GeoCombobox
                  value={business.district}
                  className={fieldErrors["seller-field-district"] ? "border-destructive text-destructive focus-visible:ring-destructive/50" : ""}
                  onChange={(v) => {
                    setBusiness((b) => ({
                      ...b,
                      district: v,
                      locationSector: "",
                      cellule: "",
                      village: "",
                    }))
                    setFieldErrors((prev) => ({ ...prev, "seller-field-district": undefined }))
                  }}
                  options={districtOptions}
                  placeholder={
                    business.province
                      ? pickLang(SELLER_UI.searchDistrict, lang)
                      : pickLang(SELLER_UI.selectProvinceFirst, lang)
                  }
                  disabled={!business.province}
                  emptyText={pickLang(SELLER_UI.noDistricts, lang)}
                />
                {fieldErrors["seller-field-district"] ? (
                  <p className="text-sm text-destructive">{fieldErrors["seller-field-district"]}</p>
                ) : null}
              </div>
              <div id="seller-field-locationSector" className="space-y-2 scroll-mt-24">
                <FieldLabel lang={lang} tri={L.locationSector} />
                <Select
                  value={business.locationSector || undefined}
                  onValueChange={(v) => {
                    setBusiness((b) => ({ ...b, locationSector: v, cellule: "", village: "" }))
                    const error = validateSellerField("seller-field-locationSector", v, lang)
                    setFieldErrors((prev) => ({ ...prev, "seller-field-locationSector": error }))
                  }}
                  disabled={!business.district || locationSectorOptions.length === 0}
                >
                  <SelectTrigger
                    id="locationSector"
                    className={fieldErrors["seller-field-locationSector"] ? "border-destructive text-destructive focus-visible:ring-destructive/50" : ""}
                  >
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
                {fieldErrors["seller-field-locationSector"] ? (
                  <p className="text-sm text-destructive">{fieldErrors["seller-field-locationSector"]}</p>
                ) : null}
              </div>
              <div id="seller-field-cellule" className="space-y-2 scroll-mt-24">
                <FieldLabel lang={lang} tri={L.cellule} />
                <Select
                  value={business.cellule || undefined}
                  onValueChange={(v) => {
                    setBusiness((b) => ({ ...b, cellule: v, village: "" }))
                    const error = validateSellerField("seller-field-cellule", v, lang)
                    setFieldErrors((prev) => ({ ...prev, "seller-field-cellule": error }))
                  }}
                  disabled={!business.locationSector || celluleOptions.length === 0}
                >
                  <SelectTrigger
                    id="cellule"
                    className={fieldErrors["seller-field-cellule"] ? "border-destructive text-destructive focus-visible:ring-destructive/50" : ""}
                  >
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
                {fieldErrors["seller-field-cellule"] ? (
                  <p className="text-sm text-destructive">{fieldErrors["seller-field-cellule"]}</p>
                ) : null}
              </div>
              <div id="seller-field-village" className="space-y-2 sm:col-span-2 scroll-mt-24">
                <FieldLabel lang={lang} tri={L.village} />
                <Select
                  value={business.village || undefined}
                  onValueChange={(v) => {
                    setBusiness((b) => ({ ...b, village: v }))
                    const error = validateSellerField("seller-field-village", v, lang)
                    setFieldErrors((prev) => ({ ...prev, "seller-field-village": error }))
                  }}
                  disabled={!business.cellule || villageOptions.length === 0}
                >
                  <SelectTrigger
                    id="village"
                    className={fieldErrors["seller-field-village"] ? "border-destructive text-destructive focus-visible:ring-destructive/50" : ""}
                  >
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
                {fieldErrors["seller-field-village"] ? (
                  <p className="text-sm text-destructive">{fieldErrors["seller-field-village"]}</p>
                ) : null}
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

              <div
                id="seller-field-shop-location"
                className="sm:col-span-2 space-y-3 overflow-visible rounded-xl border border-[#dbe7f3] bg-[#f7fbff] p-4 scroll-mt-24"
              >
                <div>
                  <FieldLabel lang={lang} tri={L.shopLocation} />
                  <p className="mt-1 text-xs text-[#6f8399]">
                    {pickLang(L.locationStatus, lang)}
                    {": "}
                    {business.latitude != null && business.longitude != null ? (
                      <span className="font-medium text-emerald-700">
                        ✓ {pickLang(L.locationCaptured, lang)}
                      </span>
                    ) : (
                      <span>{pickLang(L.locationNotCaptured, lang)}</span>
                    )}
                  </p>
                </div>
                <div className="relative flex w-full items-center gap-2 sm:w-auto">
                  {!locationSelected && !gpsCapturing ? (
                    <span
                      className="shop-gps-arrow-hint pointer-events-none shrink-0 text-blue-600"
                      aria-hidden
                    >
                      <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
                    </span>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "relative z-0 w-full border-[#dbe7f3] bg-white text-[#17324d] hover:bg-white sm:w-auto",
                      fieldErrors["seller-field-shop-location"] && !locationSelected
                        ? "shop-gps-btn-attention border-blue-400"
                        : "",
                    )}
                    disabled={gpsCapturing || submitting}
                    onClick={captureShopGps}
                    aria-invalid={fieldErrors["seller-field-shop-location"] ? "true" : undefined}
                    aria-describedby={
                      fieldErrors["seller-field-shop-location"]
                        ? "seller-field-shop-location-error"
                        : undefined
                    }
                  >
                    {gpsCapturing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {pickLang(L.locationCapturing, lang)}
                      </>
                    ) : locationSelected ? (
                      <>
                        <MapPin className="mr-2 h-4 w-4" aria-hidden />
                        {pickLang(L.useCurrentLocation, lang)}
                      </>
                    ) : (
                      <>
                        <span className="shop-gps-icon-hint shop-gps-icon-ring-hint mr-2 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-emerald-600 bg-white">
                          <MapPin className="h-3 w-3 text-emerald-700" aria-hidden />
                        </span>
                        {pickLang(L.useCurrentLocation, lang)}
                      </>
                    )}
                  </Button>
                </div>
                {fieldErrors["seller-field-shop-location"] ? (
                  <p
                    id="seller-field-shop-location-error"
                    className="text-sm font-medium text-destructive"
                    role="alert"
                  >
                    {fieldErrors["seller-field-shop-location"]}
                  </p>
                ) : null}
                {gpsError ? <p className="text-sm text-destructive">{gpsError}</p> : null}
                <div className="pt-1">
                  <div className="flex items-start gap-2.5">
                    <Checkbox
                      id="seller-confirm-use-current-location"
                      checked={confirmUseCurrentLocation}
                      disabled={submitting || !locationSelected}
                      onCheckedChange={(v) => {
                        if (!locationSelected) {
                          void requireLocationSelected()
                          return
                        }
                        const checked = v === true
                        setConfirmUseCurrentLocation(checked)
                        if (checked) {
                          setFieldErrors((prev) => ({
                            ...prev,
                            "seller-field-confirm-location": undefined,
                          }))
                          setErr(null)
                        }
                      }}
                      aria-invalid={fieldErrors["seller-field-confirm-location"] ? "true" : undefined}
                      aria-describedby={
                        fieldErrors["seller-field-confirm-location"]
                          ? "seller-field-confirm-location-error"
                          : undefined
                      }
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0 rounded-[4px] border-2 bg-white shadow-none",
                        "border-[#334155] transition-colors duration-200 ease-out",
                        "focus-visible:ring-2 focus-visible:ring-emerald-500/35 focus-visible:ring-offset-1",
                        "data-[state=checked]:border-emerald-600 data-[state=checked]:bg-emerald-600 data-[state=checked]:text-white",
                        "[&_svg]:h-3 [&_svg]:w-3 [&_svg]:stroke-[3]",
                        !locationSelected ? "opacity-50" : "",
                        fieldErrors["seller-field-confirm-location"]
                          ? "border-destructive focus-visible:ring-destructive/30"
                          : "",
                      )}
                    />
                    <Label
                      htmlFor="seller-confirm-use-current-location"
                      className={cn(
                        "min-w-0 flex-1 text-[13px] font-normal leading-snug text-[#17324d]",
                        locationSelected ? "cursor-pointer" : "cursor-not-allowed opacity-60",
                      )}
                    >
                      {pickLang(L.confirmUseCurrentLocation, lang)}
                    </Label>
                  </div>
                  {fieldErrors["seller-field-confirm-location"] ? (
                    <p
                      id="seller-field-confirm-location-error"
                      className="mt-1.5 text-sm font-medium text-destructive"
                      role="alert"
                    >
                      {fieldErrors["seller-field-confirm-location"]}
                    </p>
                  ) : null}
                </div>
                {/* Coordinates kept in form state only — not shown in the UI */}
                <input type="hidden" name="latitude" value={business.latitude ?? ""} readOnly />
                <input type="hidden" name="longitude" value={business.longitude ?? ""} readOnly />
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
                disabled={!isStep1Valid || submitting}
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
