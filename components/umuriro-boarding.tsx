"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Check, Copy, Flame, Loader2, MessageSquare, Minus, Phone, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useLanguageStore } from "@/lib/language-store"
import { LanguageSelector } from "@/components/language-selector"
import { L, pickLang, SELLER_UI, UMURIRO_UI } from "@/lib/seller-register-i18n"
import { useAuthStore } from "@/lib/auth-store"
import { getShopPublicUrl } from "@/lib/shop-public-url"
import { filterProductsByRelevance } from "@/lib/search-utils"
import { shopCategoryToSectorSlug } from "@/lib/seller-category-sector"
import { isValidRwandaMobileE164, normalizeRwandaMobileE164 } from "@/lib/rwanda-phone"
import { cn } from "@/lib/utils"
import { GRANDMA_PATHS } from "@/lib/grandma-urls"
import { extractMerchantMomoCodeForUssd } from "@/lib/grandma-order-billing"
import { buildMoMoUssd } from "@/lib/momo-ussd"
import { generalSellingPrice, lineSellingPriceFromProductRow, resolveItemEmballageRaw } from "@/lib/package-price"
import { matchMoMoSmsToOrderTotal, type MoMoSmsMatchResult } from "@/lib/momo-payment-sms-match"

const LS_KEY = "ihute:umuriro:lastShop"

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

const cardClass =
  "min-w-0 w-full max-w-full overflow-x-hidden rounded-2xl border-[#dbe7f3] bg-white shadow-[0_8px_18px_rgba(24,151,224,.08)]"

type CatalogHit = {
  item_code?: string
  item_commercial_name?: string
  selling_price?: string | number
  item_emballage?: string | number
  [key: string]: unknown
}

function parseCatalogPriceRwf(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v
  const n = String(v ?? "")
    .replace(/[^\d.,-]/g, "")
    .replace(/,/g, "")
  const p = parseFloat(n)
  return Number.isFinite(p) ? p : 0
}

function catalogHitSellerLabel(p: CatalogHit): string {
  return String(
    p.SELLER_NAMES ?? p.supplier_name ?? p.OWNER ?? p.owner ?? "",
  ).trim()
}

function catalogHitSellerAccount(p: CatalogHit): string {
  return String(
    p.SELLER_ISHYIGA_ACCOUNT ?? p.item_seller_account ?? p.supplier_account ?? "",
  ).trim()
}

function shopNameMatchesCatalogHit(shop: string, p: CatalogHit): boolean {
  const sn = shop.trim().toLowerCase()
  if (!sn) return true
  const seller = catalogHitSellerLabel(p).toLowerCase()
  if (!seller) return false
  return seller === sn || seller.includes(sn) || sn.includes(seller)
}

/** Customer price from catalog row (API `final_selling_price` or seller `selling_price`). */
function catalogHitPriceRwf(p: CatalogHit): number {
  const row = p as Record<string, unknown>
  const finalRaw = row.final_selling_price
  if (finalRaw != null && finalRaw !== "") {
    const n = parseCatalogPriceRwf(finalRaw)
    if (n >= 1) return Math.round(n)
  }
  const fromLine = lineSellingPriceFromProductRow(row)
  if (fromLine >= 1) return Math.round(fromLine)
  const base =
    parseCatalogPriceRwf(row.selling_price) ||
    parseCatalogPriceRwf(row.SALE_PRICE_INCLUSIVE) ||
    parseCatalogPriceRwf(row.UNITY_PRICE) ||
    parseCatalogPriceRwf(row.price) ||
    parseCatalogPriceRwf(row.PRICE)
  if (base >= 1) {
    return Math.round(generalSellingPrice(base, resolveItemEmballageRaw(row)))
  }
  return 0
}

function productNameMatchesQuery(p: CatalogHit, q: string): boolean {
  const t = q.trim().toLowerCase()
  if (!t) return true
  const hay = `${p.item_commercial_name ?? ""} ${p.item_key_words ?? ""} ${p.item_code ?? ""}`.toLowerCase()
  const tokens = t.split(/\s+/).filter((x) => x.length >= 2)
  if (tokens.length === 0) return hay.includes(t)
  return tokens.every((tok) => hay.includes(tok))
}

function parseSupplierProductsResponse(json: unknown): CatalogHit[] {
  if (Array.isArray(json)) return json as CatalogHit[]
  if (json && typeof json === "object" && Array.isArray((json as { products?: unknown }).products)) {
    return (json as { products: CatalogHit[] }).products
  }
  return []
}

type UmuriroMode = "quick" | "advanced"
type UmuriroPayChannel = "momo" | "cash"
type SmsPayCheck = "paid" | "mismatch" | "no_amount" | null

type UmuriroCartLine = {
  id: string
  itemName: string
  itemCode?: string
  unitPriceRwf: number
  quantity: number
}

function cartLineKey(itemName: string, itemCode?: string): string {
  const code = (itemCode || "").trim().toLowerCase()
  if (code) return `code:${code}`
  return `name:${itemName.trim().toLowerCase()}`
}

function newCartLineId(): string {
  return `um-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "")
}

function buildUssd(merchantCode: string, totalRwf: number): string {
  const code = merchantCode.trim()
  const t = Math.max(0, Math.round(totalRwf))
  if (!code || t < 1) return ""
  return buildMoMoUssd(code, t)
}

export function UmuriroBoarding() {
  const lang = useLanguageStore((s) => s.language)
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  const touchSession = useAuthStore((s) => s.touchSession)

  const [mode, setMode] = useState<UmuriroMode>("quick")
  const [shopName, setShopName] = useState("")
  const [momoCode, setMomoCode] = useState("")
  const [shopPhoneOptional, setShopPhoneOptional] = useState("")
  const [shopCategory, setShopCategory] = useState("")
  const [itemName, setItemName] = useState("")
  const [itemSuggestions, setItemSuggestions] = useState<CatalogHit[]>([])
  const [itemSearchLoading, setItemSearchLoading] = useState(false)
  const [itemOpen, setItemOpen] = useState(false)
  const itemWrapRef = useRef<HTMLDivElement>(null)
  const itemFetchRef = useRef<AbortController | null>(null)
  const supplierResolveRef = useRef<AbortController | null>(null)
  const [resolvedSupplierAccount, setResolvedSupplierAccount] = useState<string | null>(null)
  const [unitPrice, setUnitPrice] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [pendingItemCode, setPendingItemCode] = useState<string | null>(null)
  const [cartLines, setCartLines] = useState<UmuriroCartLine[]>([])

  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [doneMsg, setDoneMsg] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [trackDialogOpen, setTrackDialogOpen] = useState(false)
  const [payChannel, setPayChannel] = useState<UmuriroPayChannel>("momo")
  const [momoSmsPaste, setMomoSmsPaste] = useState("")
  const [smsPayCheck, setSmsPayCheck] = useState<SmsPayCheck>(null)
  const [smsMatchResult, setSmsMatchResult] = useState<MoMoSmsMatchResult | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (!raw) return
      const o = JSON.parse(raw) as {
        shopName?: string
        momoCode?: string
        shopPhoneOptional?: string
        shopCategory?: string
      }
      if (o.shopName) setShopName(o.shopName)
      if (o.momoCode) setMomoCode(o.momoCode)
      if (o.shopPhoneOptional) setShopPhoneOptional(o.shopPhoneOptional)
      if (o.shopCategory) setShopCategory(o.shopCategory)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (user && isAuthenticated) touchSession()
  }, [user, isAuthenticated, touchSession])

  const draftLineTotalRwf = useMemo(() => {
    const p = parseFloat(unitPrice.replace(",", "."))
    const q = parseFloat(quantity.replace(",", "."))
    if (!Number.isFinite(p) || !Number.isFinite(q) || p < 1 || q < 1) return 0
    return Math.round(p * q)
  }, [unitPrice, quantity])

  const cartTotalRwf = useMemo(
    () =>
      cartLines.reduce(
        (sum, line) => sum + Math.round(line.unitPriceRwf * line.quantity),
        0,
      ),
    [cartLines],
  )

  const totalRwf = cartTotalRwf

  const momoDigits = useMemo(() => extractMerchantMomoCodeForUssd(momoCode), [momoCode])
  const ussd = useMemo(() => buildUssd(momoDigits, totalRwf), [momoDigits, totalRwf])

  /** `tel:` href for USSD — `#` must be `%23` for many mobile dialers. */
  const ussdTelHref = useMemo(() => {
    if (!momoDigits || momoDigits.length < 6 || totalRwf < 1) return ""
    const s = buildUssd(momoDigits, totalRwf)
    return `tel:${s.replace(/#/g, "%23")}`
  }, [momoDigits, totalRwf])

  const shopPhoneE164 = useMemo(() => {
    const r = normalizeRwandaMobileE164(shopPhoneOptional)
    return r && isValidRwandaMobileE164(r) ? r : null
  }, [shopPhoneOptional])

  const persistLocalShop = () => {
    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({
          shopName: shopName.trim(),
          momoCode: momoCode.trim(),
          shopPhoneOptional: shopPhoneOptional.trim(),
          shopCategory: shopCategory.trim(),
        })
      )
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    const sn = shopName.trim()
    if (sn.length < 2) {
      setResolvedSupplierAccount(null)
      return
    }
    supplierResolveRef.current?.abort()
    const ac = new AbortController()
    supplierResolveRef.current = ac
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const params = new URLSearchParams({ globalSearch: sn, limit: "8", Currency: "RWF" })
          const sec = shopCategoryToSectorSlug(shopCategory)
          if (sec) params.set("sector", sec)
          const res = await fetch(`/api/fetchSuggestions?${params}`, {
            cache: "no-store",
            headers: { Accept: "application/json" },
            signal: ac.signal,
          })
          if (!res.ok) return
          const json = (await res.json()) as {
            suppliersByName?: CatalogHit[]
            suppliersByProduct?: CatalogHit[]
          }
          const suppliers = [
            ...(Array.isArray(json.suppliersByName) ? json.suppliersByName : []),
            ...(Array.isArray(json.suppliersByProduct) ? json.suppliersByProduct : []),
          ]
          const snL = sn.toLowerCase()
          let bestAcc: string | null = null
          let bestScore = 0
          for (const s of suppliers) {
            const name = catalogHitSellerLabel(s) || String(s.supplier_name ?? "").trim()
            const acc = catalogHitSellerAccount(s) || String(s.supplier_account ?? "").trim()
            if (!acc) continue
            const nl = name.toLowerCase()
            let score = 0
            if (nl === snL) score = 100
            else if (nl.includes(snL) || snL.includes(nl)) score = 60
            else continue
            if (score > bestScore) {
              bestScore = score
              bestAcc = acc
            }
          }
          if (!ac.signal.aborted) setResolvedSupplierAccount(bestAcc)
        } catch (e) {
          if (e instanceof Error && e.name === "AbortError") return
          if (!ac.signal.aborted) setResolvedSupplierAccount(null)
        }
      })()
    }, 450)
    return () => {
      window.clearTimeout(timer)
      ac.abort()
    }
  }, [shopName, shopCategory])

  const runItemSearch = useCallback(
    async (q: string) => {
      const t = q.trim()
      if (t.length < 2) {
        itemFetchRef.current?.abort()
        itemFetchRef.current = null
        setItemSuggestions([])
        setItemSearchLoading(false)
        return
      }
      if (mode === "advanced" && !shopCategory.trim()) {
        itemFetchRef.current?.abort()
        itemFetchRef.current = null
        setItemSuggestions([])
        setItemSearchLoading(false)
        return
      }
      itemFetchRef.current?.abort()
      const ac = new AbortController()
      itemFetchRef.current = ac
      setItemSearchLoading(true)
      try {
        const shop = shopName.trim()
        let raw: CatalogHit[] = []

        if (resolvedSupplierAccount) {
          const sp = new URLSearchParams({
            supplierProducts: resolvedSupplierAccount,
            limit: "2000",
            Currency: "RWF",
          })
          const sRes = await fetch(`/api/fetchSuggestions?${sp}`, {
            cache: "no-store",
            headers: { Accept: "application/json" },
            signal: ac.signal,
          })
          if (sRes.ok) {
            const sJson = await sRes.json()
            raw = parseSupplierProductsResponse(sJson).filter((p) => productNameMatchesQuery(p, t))
          }
        }

        if (raw.length === 0) {
          const params = new URLSearchParams({
            globalSearch: t,
            limit: "12",
            Currency: "RWF",
          })
          const sec = shopCategoryToSectorSlug(shopCategory)
          if (sec) params.set("sector", sec)
          const res = await fetch(`/api/fetchSuggestions?${params}`, {
            cache: "no-store",
            headers: { Accept: "application/json" },
            signal: ac.signal,
          })
          if (!res.ok) throw new Error(`Search failed (${res.status})`)
          const json = await res.json()
          raw = Array.isArray(json.products) ? json.products : []
          if (shop) {
            const forShop = raw.filter((p) => shopNameMatchesCatalogHit(shop, p))
            if (forShop.length > 0) raw = forShop
          }
        }

        const filtered = filterProductsByRelevance(raw, t, 8)
        const ordered = shop
          ? [...filtered].sort((a, b) => {
              const am = shopNameMatchesCatalogHit(shop, a) ? 1 : 0
              const bm = shopNameMatchesCatalogHit(shop, b) ? 1 : 0
              return bm - am || (b as { finalScore?: number }).finalScore! - (a as { finalScore?: number }).finalScore!
            })
          : filtered
        if (!ac.signal.aborted) setItemSuggestions(ordered.slice(0, 6))
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return
        if (!ac.signal.aborted) setItemSuggestions([])
      } finally {
        if (!ac.signal.aborted) setItemSearchLoading(false)
      }
    },
    [mode, shopCategory, shopName, resolvedSupplierAccount]
  )

  useEffect(() => {
    const id = setTimeout(() => {
      void runItemSearch(itemName)
    }, 500)
    return () => clearTimeout(id)
  }, [itemName, runItemSearch])

  useEffect(() => {
    setItemSuggestions([])
    setItemOpen(false)
    setUnitPrice("")
  }, [shopCategory])

  useEffect(() => {
    setUnitPrice("")
  }, [resolvedSupplierAccount])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const el = itemWrapRef.current
      if (!el || el.contains(e.target as Node)) return
      setItemOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [])

  const applyPickedCatalogHit = (p: CatalogHit) => {
    const label = String(p.item_commercial_name || p.item_code || "").trim()
    if (label) setItemName(label)
    const code = String(p.item_code ?? "").trim()
    setPendingItemCode(code || null)
    const priceRwf = catalogHitPriceRwf(p)
    setUnitPrice(priceRwf >= 1 ? String(Math.round(priceRwf)) : "")
    setQuantity("1")
    setItemSuggestions([])
    setItemOpen(false)
  }

  const addCurrentLineToCart = () => {
    setErr(null)
    const name = itemName.trim()
    const p = parseFloat(unitPrice.replace(",", "."))
    const q = parseFloat(quantity.replace(",", "."))
    if (!name) {
      setErr("Enter item name.")
      return
    }
    if (!Number.isFinite(p) || p < 1) {
      setErr("Enter a valid price (RWF).")
      return
    }
    if (!Number.isFinite(q) || q < 1) {
      setErr("Enter quantity (at least 1).")
      return
    }
    const roundedPrice = Math.round(p)
    const roundedQty = Math.round(q)
    const key = cartLineKey(name, pendingItemCode ?? undefined)

    setCartLines((prev) => {
      const idx = prev.findIndex(
        (line) => cartLineKey(line.itemName, line.itemCode) === key,
      )
      if (idx >= 0) {
        const next = [...prev]
        const existing = next[idx]!
        next[idx] = {
          ...existing,
          quantity: existing.quantity + roundedQty,
          unitPriceRwf: roundedPrice,
        }
        return next
      }
      return [
        ...prev,
        {
          id: newCartLineId(),
          itemName: name,
          itemCode: pendingItemCode ?? undefined,
          unitPriceRwf: roundedPrice,
          quantity: roundedQty,
        },
      ]
    })

    setItemName("")
    setUnitPrice("")
    setQuantity("1")
    setPendingItemCode(null)
    setItemOpen(false)
  }

  const removeCartLine = (id: string) => {
    setCartLines((prev) => prev.filter((line) => line.id !== id))
  }

  const updateCartLineQty = (id: string, nextQty: number) => {
    const q = Math.max(1, Math.round(nextQty))
    setCartLines((prev) =>
      prev.map((line) => (line.id === id ? { ...line, quantity: q } : line)),
    )
  }

  const itemSuggestionLabel = (p: CatalogHit) =>
    String(p.item_commercial_name || p.item_code || "—").trim()

  const validate = (m: UmuriroMode): boolean => {
    if (!shopName.trim()) {
      setErr("Enter shop name.")
      return false
    }
    if (!momoDigits || momoDigits.length < 6) {
      setErr("Enter a valid MoMo code (digits).")
      return false
    }
    if (m === "advanced" && !shopCategory.trim()) {
      setErr(pickLang(UMURIRO_UI.chooseCategory, lang))
      return false
    }
    if (cartLines.length < 1) {
      setErr(pickLang(UMURIRO_UI.emptyCartError, lang))
      return false
    }
    if (totalRwf < 1) {
      setErr("Total must be at least 1 RWF.")
      return false
    }
    return true
  }

  const verifyMoMoSms = useCallback(() => {
    setSmsPayCheck(null)
    setSmsMatchResult(null)
    if (payChannel !== "momo" || totalRwf < 1) return
    const t = momoSmsPaste.trim()
    if (!t) return
    const r = matchMoMoSmsToOrderTotal(t, totalRwf)
    setSmsMatchResult(r)
    if (!r.candidates.length) setSmsPayCheck("no_amount")
    else if (r.matched) setSmsPayCheck("paid")
    else setSmsPayCheck("mismatch")
  }, [payChannel, totalRwf, momoSmsPaste])

  useEffect(() => {
    setSmsPayCheck(null)
    setSmsMatchResult(null)
  }, [payChannel, totalRwf])

  const sectorSlug =
    mode === "advanced" && shopCategory ? shopCategoryToSectorSlug(shopCategory) : ""

  const submit = async () => {
    setErr(null)
    setDoneMsg(null)
    setTrackDialogOpen(false)
    if (!hasHydrated) return
    if (!isAuthenticated || !user) {
      setErr(pickLang(UMURIRO_UI.loginRequired, lang))
      return
    }
    if (!validate(mode)) return

    setLoading(true)
    try {
      const orderLines = cartLines.map((line) => ({
        itemName: line.itemName,
        itemCode: line.itemCode,
        unitPriceRwf: line.unitPriceRwf,
        quantity: line.quantity,
        lineTotalRwf: Math.round(line.unitPriceRwf * line.quantity),
      }))
      const first = orderLines[0]!
      const payload = {
        kind: "umuriro" as const,
        umuriroMode: mode,
        incompleteSeller: true as const,
        savedBy: {
          email: user.email,
          name: user.name,
          phone: user.phone || "",
        },
        policy: {
          createdBy: {
            email: user.email,
            name: user.name,
            phone: user.phone || "",
          },
          adjustmentRwf: 100,
        },
        shop: {
          companyName: shopName.trim(),
          momoCode: momoCode.trim(),
          momoDigits,
          ...(mode === "advanced"
            ? {
                shopPhoneOptional: shopPhoneOptional.trim() || undefined,
                shopCategory: shopCategory.trim(),
                sectorSlug: sectorSlug || undefined,
              }
            : {}),
        },
        lines: orderLines,
        line: {
          itemName: first.itemName,
          unitPriceRwf: first.unitPriceRwf,
          quantity: first.quantity,
          totalRwf,
        },
        payment: {
          channel: payChannel,
          momoSmsMatched: payChannel === "momo" ? smsPayCheck === "paid" : null,
        },
        ussd,
        submittedAt: new Date().toISOString(),
      }

      const res = await fetch("/api/onboarding/umuriro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Save failed")

      persistLocalShop()

      if (mode === "quick") {
        const ridStr = typeof json.rid === "string" ? json.rid : ""
        const persisted = json.persisted === true
        const base = pickLang(UMURIRO_UI.orderSentQuick, lang)
        const extra =
          persisted && ridStr
            ? ` · ${pickLang(UMURIRO_UI.savedDraftStored, lang).replace("{rid}", ridStr)}`
            : !persisted
              ? ` — ${pickLang(UMURIRO_UI.savedEchoShort, lang)}`
              : ""
        setDoneMsg(`${base}${extra}`)
        setCartLines([])
      } else {
        setDoneMsg(pickLang(UMURIRO_UI.orderSentAdvanced, lang))
        setTrackDialogOpen(true)
        setCartLines([])
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }

  const copyUssd = async () => {
    try {
      await navigator.clipboard.writeText(ussd)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setErr("Could not copy. Select the code manually.")
    }
  }

  const canSave = hasHydrated && isAuthenticated && !!user
  const isAdvanced = mode === "advanced"

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#eef4fb] text-[#17324d]">
      <div className="mx-auto min-h-screen w-full min-w-0 max-w-[430px] overflow-x-hidden bg-gradient-to-b from-[#f7fbff] to-[#eef4fb] pb-28">
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
                <div className="truncate text-lg font-bold leading-tight">
                  {pickLang(UMURIRO_UI.pageTitle, lang)}
                </div>
                {hasHydrated && isAuthenticated && user?.name ? (
                  <div className="truncate text-sm font-semibold leading-snug text-white/95">{user.name}</div>
                ) : null}
              </div>
            </div>
            <div className="shrink-0 [&_button]:border-white/40 [&_button]:text-white [&_button]:hover:bg-white/15">
              <LanguageSelector />
            </div>
          </div>
        </header>

        <div className="min-w-0 space-y-4 px-3 pt-4">
          <Dialog open={trackDialogOpen} onOpenChange={setTrackDialogOpen}>
            <DialogContent className="max-h-[90vh] max-w-[min(100vw-1.5rem,420px)] gap-3 overflow-y-auto border-[#dbe7f3] bg-white p-4 sm:p-5">
              <DialogHeader className="space-y-2 text-left">
                <DialogTitle className="text-[#17324d]">{pickLang(UMURIRO_UI.trackDialogTitle, lang)}</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-[#17324d]">{pickLang(UMURIRO_UI.trackDialogBody, lang)}</p>
              {user?.email ? (
                <div className="rounded-xl border border-[#dbe7f3] bg-[#f7fbff] px-3 py-2 text-sm">
                  <span className="text-[#6f8399]">Email: </span>
                  <span className="font-medium">{user.email}</span>
                </div>
              ) : null}
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  className="w-full bg-gradient-to-r from-[#1897e0] to-[#127fc0] text-white"
                  asChild
                >
                  <Link href={GRANDMA_PATHS.buyerOrders}>{pickLang(UMURIRO_UI.goToMyOrders, lang)}</Link>
                </Button>
                <p className="text-center text-xs text-[#6f8399]">{pickLang(UMURIRO_UI.needBuyerAccount, lang)}</p>
                <Button type="button" variant="outline" className="w-full border-[#dbe7f3]" asChild>
                  <Link href="/register/buyer">{pickLang(UMURIRO_UI.createBuyer, lang)}</Link>
                </Button>
              </div>
              <DialogFooter className="sm:justify-stretch">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={() => setTrackDialogOpen(false)}
                >
                  OK
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {hasHydrated && !canSave && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/95 px-3 py-2 text-sm text-amber-950">
              {pickLang(UMURIRO_UI.loginRequired, lang)}{" "}
              <Link href="/login" className="font-semibold text-[#127fc0] underline">
                {pickLang(UMURIRO_UI.signIn, lang)}
              </Link>
            </div>
          )}

          {err && (
            <div className="rounded-xl border border-red-200 bg-red-50/95 px-3 py-2 text-sm text-red-800 shadow-sm">
              {err}
            </div>
          )}

          {doneMsg && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50/95 px-3 py-2 text-sm text-emerald-900 shadow-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0" />
              {doneMsg}
            </div>
          )}

          <Card className={cardClass}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-1.5 text-[#17324d]">
                <span>{pickLang(UMURIRO_UI.cardTitle, lang)}</span>
                <Flame
                  className="h-[1.1em] w-[1.1em] shrink-0 text-orange-500"
                  strokeWidth={2}
                  aria-hidden
                />
              </CardTitle>
              <div
                className="mt-3 flex gap-1 rounded-xl border border-[#dbe7f3] bg-[#f7fbff] p-1"
                role="group"
                aria-label="Umuriro mode"
              >
                <button
                  type="button"
                  onClick={() => {
                    setMode("quick")
                    setErr(null)
                    setItemOpen(false)
                  }}
                  className={cn(
                    "min-h-10 flex-1 rounded-lg px-2 text-sm font-semibold transition-colors",
                    mode === "quick"
                      ? "bg-white text-[#17324d] shadow-sm"
                      : "text-[#6f8399] hover:text-[#17324d]"
                  )}
                >
                  {pickLang(UMURIRO_UI.modeQuick, lang)}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("advanced")
                    setErr(null)
                  }}
                  className={cn(
                    "min-h-10 flex-1 rounded-lg px-2 text-sm font-semibold transition-colors",
                    mode === "advanced"
                      ? "bg-white text-[#17324d] shadow-sm"
                      : "text-[#6f8399] hover:text-[#17324d]"
                  )}
                >
                  {pickLang(UMURIRO_UI.modeAdvanced, lang)}
                </button>
              </div>
            </CardHeader>
            <CardContent className="grid min-w-0 gap-4 overflow-x-hidden">
              <div className="min-w-0 space-y-2">
                <Label className="text-[#17324d]">{pickLang(UMURIRO_UI.shoppingAt, lang)}</Label>
                <Input
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  className="border-[#dbe7f3]"
                  autoComplete="organization"
                />
              </div>

              {isAdvanced ? (
                <div className="grid min-w-0 grid-cols-2 gap-3 [grid-template-columns:minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="min-w-0 space-y-2">
                    <Label className="text-[#17324d]">{pickLang(L.momo, lang)}</Label>
                    <Input
                      value={momoCode}
                      onChange={(e) => setMomoCode(e.target.value)}
                      className="border-[#dbe7f3]"
                      inputMode="numeric"
                    />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label className="text-[#17324d]">{pickLang(UMURIRO_UI.phoneOptional, lang)}</Label>
                    <Input
                      value={shopPhoneOptional}
                      onChange={(e) => setShopPhoneOptional(e.target.value)}
                      className="border-[#dbe7f3]"
                      type="tel"
                      placeholder="250…"
                      inputMode="tel"
                      autoComplete="tel"
                    />
                  </div>
                </div>
              ) : (
                <div className="min-w-0 space-y-2">
                  <Label className="text-[#17324d]">{pickLang(L.momo, lang)}</Label>
                  <Input
                    value={momoCode}
                    onChange={(e) => setMomoCode(e.target.value)}
                    className="border-[#dbe7f3]"
                    inputMode="numeric"
                  />
                </div>
              )}

              {isAdvanced ? (
                <div className="min-w-0 space-y-2">
                  <Label className="text-[#17324d]">{pickLang(UMURIRO_UI.shopCategory, lang)}</Label>
                  <p className="text-xs text-[#6f8399]">{pickLang(UMURIRO_UI.shopCategoryHint, lang)}</p>
                  <Select value={shopCategory} onValueChange={setShopCategory}>
                    <SelectTrigger className="min-w-0 border-[#dbe7f3]">
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
              ) : null}

              <div className="min-w-0 space-y-1">
                <Label className="text-[#17324d]">{pickLang(UMURIRO_UI.imBuying, lang)}</Label>
                <p className="text-xs text-[#6f8399]">{pickLang(UMURIRO_UI.imBuyingHint, lang)}</p>
                <div className="relative min-w-0" ref={itemWrapRef}>
                  <Input
                    value={itemName}
                    onChange={(e) => {
                      setItemName(e.target.value)
                      setItemOpen(true)
                    }}
                    onFocus={() => setItemOpen(true)}
                    className="border-[#dbe7f3]"
                    autoComplete="off"
                    aria-autocomplete="list"
                    aria-expanded={itemOpen}
                  />
                  {itemOpen &&
                    itemName.trim().length >= 2 &&
                    (isAdvanced ? shopCategory.trim() : true) && (
                      <div
                        className="absolute left-0 right-0 top-full z-40 mt-1 max-h-40 overflow-y-auto rounded-xl border border-[#dbe7f3] bg-white py-1 shadow-[0_8px_24px_rgba(24,151,224,.15)]"
                        role="listbox"
                      >
                        {itemSearchLoading && (
                          <div className="flex items-center gap-2 px-3 py-2 text-sm text-[#6f8399]">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {pickLang(SELLER_UI.searching, lang)}
                          </div>
                        )}
                        {!itemSearchLoading &&
                          itemSuggestions.map((p, i) => {
                            const key = `${p.item_code ?? ""}-${p.item_commercial_name ?? ""}-${i}`
                            const label = itemSuggestionLabel(p)
                            const priceRwf = catalogHitPriceRwf(p)
                            return (
                              <button
                                key={key}
                                type="button"
                                role="option"
                                className="flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left text-sm text-[#17324d] hover:bg-[#f0f8ff]"
                                onMouseDown={(e) => {
                                  e.preventDefault()
                                  applyPickedCatalogHit(p)
                                }}
                              >
                                <span className="min-w-0 truncate">{label}</span>
                                {priceRwf >= 1 ? (
                                  <span className="shrink-0 text-xs font-bold text-emerald-800">
                                    {priceRwf.toLocaleString()} RWF
                                  </span>
                                ) : null}
                              </button>
                            )
                          })}
                        {!itemSearchLoading &&
                          itemName.trim().length >= 2 &&
                          itemSuggestions.length === 0 && (
                            <div className="px-3 py-2 text-xs text-[#6f8399]">
                              {pickLang(UMURIRO_UI.noCatalogMatchInCategory, lang)}
                            </div>
                          )}
                      </div>
                    )}
                </div>
              </div>
              <div className="grid min-w-0 grid-cols-2 gap-3 [grid-template-columns:minmax(0,1fr)_minmax(0,1fr)]">
                <div className="min-w-0 space-y-2">
                  <Label className="text-[#17324d]">{pickLang(UMURIRO_UI.unitPrice, lang)}</Label>
                  <Input
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    className="border-[#dbe7f3]"
                    inputMode="decimal"
                  />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label className="text-[#17324d]">{pickLang(UMURIRO_UI.quantity, lang)}</Label>
                  <Input
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="border-[#dbe7f3]"
                    inputMode="numeric"
                  />
                </div>
              </div>

              {draftLineTotalRwf > 0 ? (
                <p className="text-xs text-[#6f8399]">
                  {pickLang(UMURIRO_UI.quantity, lang)} × {pickLang(UMURIRO_UI.unitPrice, lang)}:{" "}
                  <span className="font-semibold tabular-nums text-[#127fc0]">
                    {draftLineTotalRwf.toLocaleString()} RWF
                  </span>
                </p>
              ) : null}

              <Button
                type="button"
                variant="outline"
                className="w-full border-[#1897e0]/40 bg-[#f0f8ff] font-semibold text-[#127fc0] hover:bg-[#e8f4fc]"
                onClick={addCurrentLineToCart}
              >
                <Plus className="mr-2 h-4 w-4" aria-hidden />
                {pickLang(UMURIRO_UI.addToList, lang)}
              </Button>

              <div className="min-w-0 space-y-2 rounded-xl border border-[#dbe7f3] bg-[#f7fbff]/80 px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-[#17324d]">
                    {pickLang(UMURIRO_UI.cartTitle, lang)}
                  </span>
                  {cartLines.length > 0 ? (
                    <span className="text-xs font-semibold text-[#6f8399]">
                      {pickLang(UMURIRO_UI.cartItemCount, lang).replace(
                        "{count}",
                        String(cartLines.length),
                      )}
                    </span>
                  ) : null}
                </div>

                {cartLines.length === 0 ? (
                  <p className="text-xs leading-snug text-[#6f8399]">
                    {pickLang(UMURIRO_UI.cartEmpty, lang)}
                  </p>
                ) : (
                  <ul className="max-h-52 space-y-2 overflow-y-auto">
                    {cartLines.map((line) => {
                      const lineTotal = Math.round(line.unitPriceRwf * line.quantity)
                      return (
                        <li
                          key={line.id}
                          className="rounded-lg border border-[#dbe7f3] bg-white px-2.5 py-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-[#17324d]">
                                {line.itemName}
                              </p>
                              <p className="text-xs text-[#6f8399]">
                                {line.unitPriceRwf.toLocaleString()} RWF × {line.quantity}
                              </p>
                            </div>
                            <p className="shrink-0 text-sm font-bold tabular-nums text-emerald-800">
                              {lineTotal.toLocaleString()}
                            </p>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 border-[#dbe7f3]"
                                aria-label={`${pickLang(UMURIRO_UI.quantity, lang)} -`}
                                onClick={() => updateCartLineQty(line.id, line.quantity - 1)}
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </Button>
                              <span className="min-w-[2rem] text-center text-sm font-bold tabular-nums">
                                {line.quantity}
                              </span>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 border-[#dbe7f3]"
                                aria-label={`${pickLang(UMURIRO_UI.quantity, lang)} +`}
                                onClick={() => updateCartLineQty(line.id, line.quantity + 1)}
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-red-700 hover:bg-red-50 hover:text-red-800"
                              onClick={() => removeCartLine(line.id)}
                            >
                              <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden />
                              {pickLang(UMURIRO_UI.removeItem, lang)}
                            </Button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              <div className="rounded-xl border border-[#1897e0]/25 bg-[#f0f8ff] px-3 py-2.5 text-sm">
                <span className="font-semibold text-[#17324d]">{pickLang(UMURIRO_UI.totalLabel, lang)}: </span>
                <span className="text-base font-bold tabular-nums text-[#127fc0]">
                  {totalRwf.toLocaleString()} RWF
                </span>
              </div>

              <div className="min-w-0 space-y-3 border-t border-[#dbe7f3] pt-4">
                <div className="space-y-2">
                  <Label className="text-[#17324d]">{pickLang(UMURIRO_UI.payHowTitle, lang)}</Label>
                  <div
                    className="flex gap-1 rounded-xl border border-[#dbe7f3] bg-[#f7fbff] p-1"
                    role="group"
                    aria-label={pickLang(UMURIRO_UI.payHowTitle, lang)}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setPayChannel("momo")
                        setSmsPayCheck(null)
                        setSmsMatchResult(null)
                      }}
                      className={cn(
                        "min-h-9 flex-1 rounded-lg px-2 text-xs font-semibold sm:text-sm",
                        payChannel === "momo"
                          ? "bg-white text-[#17324d] shadow-sm"
                          : "text-[#6f8399] hover:text-[#17324d]",
                      )}
                    >
                      {pickLang(UMURIRO_UI.payMomo, lang)}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPayChannel("cash")
                        setSmsPayCheck(null)
                        setSmsMatchResult(null)
                      }}
                      className={cn(
                        "min-h-9 flex-1 rounded-lg px-2 text-xs font-semibold sm:text-sm",
                        payChannel === "cash"
                          ? "bg-white text-[#17324d] shadow-sm"
                          : "text-[#6f8399] hover:text-[#17324d]",
                      )}
                    >
                      {pickLang(UMURIRO_UI.payCash, lang)}
                    </button>
                  </div>
                </div>

                {payChannel === "cash" ? (
                  <div className="rounded-xl border border-[#dbe7f3] bg-[#fffbeb] px-3 py-2 text-sm text-[#92400e]">
                    {pickLang(UMURIRO_UI.paymentCashSkipSms, lang)}
                  </div>
                ) : (
                  <>
                    {!isAdvanced ? (
                      <div className="min-w-0 space-y-2">
                        <Label className="text-[#17324d]">{pickLang(UMURIRO_UI.payWithMomo, lang)}</Label>
                        <p className="text-xs text-[#6f8399]">{pickLang(UMURIRO_UI.ussdLabel, lang)}</p>
                        <div className="flex min-w-0 flex-wrap items-stretch gap-2 sm:items-center">
                          <code className="min-w-0 flex-1 break-all rounded-lg bg-[#17324d]/5 px-2 py-2 text-xs font-mono leading-relaxed text-[#17324d]">
                            {momoDigits.length >= 6 && totalRwf > 0 ? ussd : "—"}
                          </code>
                          <div className="flex shrink-0 gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="border-[#dbe7f3]"
                              onClick={copyUssd}
                              disabled={momoDigits.length < 6 || totalRwf < 1}
                            >
                              {copied ? <Check className="h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
                              {pickLang(UMURIRO_UI.copyUssd, lang)}
                            </Button>
                            {ussdTelHref ? (
                              <Button type="button" variant="outline" size="sm" className="border-[#dbe7f3]" asChild>
                                <a href={ussdTelHref}>
                                  <Phone className="mr-1 h-4 w-4" aria-hidden />
                                  {pickLang(UMURIRO_UI.dialMomo, lang)}
                                </a>
                              </Button>
                            ) : (
                              <Button type="button" variant="outline" size="sm" className="border-[#dbe7f3]" disabled>
                                <Phone className="mr-1 h-4 w-4" aria-hidden />
                                {pickLang(UMURIRO_UI.dialMomo, lang)}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="min-w-0 space-y-2">
                        <Label className="text-[#17324d]">{pickLang(UMURIRO_UI.ussdLabel, lang)}</Label>
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <code className="min-w-0 flex-1 break-all rounded-lg bg-[#17324d]/5 px-2 py-2 text-xs font-mono text-[#17324d]">
                            {momoDigits.length >= 1 && totalRwf > 0 ? ussd : "—"}
                          </code>
                          <div className="flex shrink-0 gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="border-[#dbe7f3]"
                              onClick={copyUssd}
                              disabled={momoDigits.length < 1 || totalRwf < 1}
                            >
                              {copied ? <Check className="h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
                              {pickLang(UMURIRO_UI.copyUssd, lang)}
                            </Button>
                            {ussdTelHref ? (
                              <Button type="button" variant="outline" size="sm" className="border-[#dbe7f3]" asChild>
                                <a href={ussdTelHref}>
                                  <Phone className="mr-1 h-4 w-4" aria-hidden />
                                  {pickLang(UMURIRO_UI.dialMomo, lang)}
                                </a>
                              </Button>
                            ) : (
                              <Button type="button" variant="outline" size="sm" className="border-[#dbe7f3]" disabled>
                                <Phone className="mr-1 h-4 w-4" aria-hidden />
                                {pickLang(UMURIRO_UI.dialMomo, lang)}
                              </Button>
                            )}
                          </div>
                        </div>
                        {shopPhoneE164 ? (
                          <p className="text-xs text-emerald-800">
                            {pickLang(UMURIRO_UI.sellerSmsAfterSave, lang).replace("{phone}", shopPhoneE164)}
                          </p>
                        ) : null}
                      </div>
                    )}

                    <div className="min-w-0 space-y-2 rounded-xl border border-[#dbe7f3] bg-white px-3 py-3">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 shrink-0 text-[#127fc0]" aria-hidden />
                        <span className="text-sm font-semibold text-[#17324d]">
                          {pickLang(UMURIRO_UI.readMoMoSmsTitle, lang)}
                        </span>
                      </div>
                      <p className="text-xs text-[#6f8399]">
                        {pickLang(UMURIRO_UI.readMoMoSmsHint, lang).replace(
                          "{total}",
                          totalRwf.toLocaleString(),
                        )}
                      </p>
                      <Textarea
                        value={momoSmsPaste}
                        onChange={(e) => {
                          setMomoSmsPaste(e.target.value)
                          setSmsPayCheck(null)
                          setSmsMatchResult(null)
                        }}
                        className="min-h-[88px] resize-y border-[#dbe7f3] text-sm"
                        placeholder="MTN MoMo…"
                        aria-label={pickLang(UMURIRO_UI.readMoMoSmsTitle, lang)}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="w-full border-[#dbe7f3] bg-[#f7fbff] text-[#17324d] hover:bg-[#eef6ff]"
                        onClick={() => void verifyMoMoSms()}
                        disabled={totalRwf < 1 || !momoSmsPaste.trim()}
                      >
                        {pickLang(UMURIRO_UI.verifySms, lang)}
                      </Button>
                      {smsPayCheck === "paid" ? (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-2 text-xs font-medium text-emerald-900">
                          {pickLang(UMURIRO_UI.paymentPaidMatched, lang)}
                        </div>
                      ) : null}
                      {smsPayCheck === "no_amount" ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-2 text-xs text-amber-950">
                          {pickLang(UMURIRO_UI.paymentNoAmountInSms, lang)}
                        </div>
                      ) : null}
                      {smsPayCheck === "mismatch" && smsMatchResult ? (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-2 py-2 text-xs text-red-900">
                          {pickLang(UMURIRO_UI.paymentMismatch, lang)
                            .replace("{got}", String(smsMatchResult.amount ?? "—"))
                            .replace("{expected}", totalRwf.toLocaleString())}
                        </div>
                      ) : null}
                    </div>
                  </>
                )}
              </div>

              <Button
                type="button"
                disabled={loading}
                onClick={submit}
                className="min-w-0 w-full max-w-full bg-gradient-to-r from-[#1897e0] to-[#127fc0] text-white shadow-[0_10px_20px_rgba(24,151,224,.22)] hover:opacity-95"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {pickLang(SELLER_UI.saving, lang)}
                  </>
                ) : (
                  pickLang(UMURIRO_UI.saveOrder, lang)
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
