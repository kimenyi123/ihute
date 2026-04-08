"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Check, Copy, Flame, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { cn } from "@/lib/utils"

const LS_KEY = "ihute:umuriro:lastShop"

/** Same category list as buyer onboarding / home — drives fetchSuggestions `sector` filter. */
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
  "rounded-2xl border-[#dbe7f3] bg-white shadow-[0_8px_18px_rgba(24,151,224,.08)]"

/** Minimal product row from fetchSuggestions — do not import `global-search` (large module can blank the page). */
type CatalogHit = {
  item_code?: string
  item_commercial_name?: string
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "")
}

function buildUssd(momoDigits: string, totalRwf: number): string {
  const d = momoDigits.trim()
  const t = Math.max(0, Math.round(totalRwf))
  return `*182*${d}*${t}#`
}

export function UmuriroBoarding() {
  const lang = useLanguageStore((s) => s.language)
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const hasHydrated = useAuthStore((s) => s.hasHydrated)

  const [shopName, setShopName] = useState("")
  const [momoCode, setMomoCode] = useState("")
  const [shopCategory, setShopCategory] = useState("")
  const [itemName, setItemName] = useState("")
  const [itemSuggestions, setItemSuggestions] = useState<CatalogHit[]>([])
  const [itemSearchLoading, setItemSearchLoading] = useState(false)
  const [itemOpen, setItemOpen] = useState(false)
  const itemWrapRef = useRef<HTMLDivElement>(null)
  const itemFetchRef = useRef<AbortController | null>(null)
  const [unitPrice, setUnitPrice] = useState("")
  const [quantity, setQuantity] = useState("1")

  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [doneMsg, setDoneMsg] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (!raw) return
      const o = JSON.parse(raw) as { shopName?: string; momoCode?: string; shopCategory?: string }
      if (o.shopName) setShopName(o.shopName)
      if (o.momoCode) setMomoCode(o.momoCode)
      if (o.shopCategory) setShopCategory(o.shopCategory)
    } catch {
      /* ignore */
    }
  }, [])

  const totalRwf = useMemo(() => {
    const p = parseFloat(unitPrice.replace(",", "."))
    const q = parseFloat(quantity.replace(",", "."))
    if (!Number.isFinite(p) || !Number.isFinite(q) || p < 0 || q < 1) return 0
    return Math.round(p * q)
  }, [unitPrice, quantity])

  const momoDigits = useMemo(() => digitsOnly(momoCode), [momoCode])
  const ussd = useMemo(() => buildUssd(momoDigits, totalRwf), [momoDigits, totalRwf])

  const persistLocalShop = () => {
    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({
          shopName: shopName.trim(),
          momoCode: momoCode.trim(),
          shopCategory: shopCategory.trim(),
        })
      )
    } catch {
      /* ignore */
    }
  }

  const runItemSearch = useCallback(
    async (q: string) => {
      const t = q.trim()
      if (t.length < 2 || !shopCategory.trim()) {
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
        const params = new URLSearchParams({
          globalSearch: t,
          limit: "8",
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
        const raw: CatalogHit[] = Array.isArray(json.products) ? json.products : []
        const filtered = filterProductsByRelevance(raw, t, 10).slice(0, 5)
        if (!ac.signal.aborted) setItemSuggestions(filtered)
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return
        if (!ac.signal.aborted) setItemSuggestions([])
      } finally {
        if (!ac.signal.aborted) setItemSearchLoading(false)
      }
    },
    [shopCategory]
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
  }, [shopCategory])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const el = itemWrapRef.current
      if (!el || el.contains(e.target as Node)) return
      setItemOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [])

  const pickItemSuggestion = (p: CatalogHit) => {
    const label = String(p.item_commercial_name || p.item_code || "").trim()
    if (label) setItemName(label)
    setItemSuggestions([])
    setItemOpen(false)
  }

  const itemSuggestionLabel = (p: CatalogHit) =>
    String(p.item_commercial_name || p.item_code || "—").trim()

  const validate = (): boolean => {
    if (!shopName.trim()) {
      setErr("Enter shop name.")
      return false
    }
    if (!momoDigits || momoDigits.length < 6) {
      setErr("Enter a valid MoMo code (digits).")
      return false
    }
    if (!shopCategory.trim()) {
      setErr(pickLang(UMURIRO_UI.chooseCategory, lang))
      return false
    }
    if (!itemName.trim()) {
      setErr("Enter item name.")
      return false
    }
    const p = parseFloat(unitPrice.replace(",", "."))
    if (!Number.isFinite(p) || p < 1) {
      setErr("Enter a valid price (RWF).")
      return false
    }
    const q = parseFloat(quantity.replace(",", "."))
    if (!Number.isFinite(q) || q < 1) {
      setErr("Enter quantity (at least 1).")
      return false
    }
    if (totalRwf < 1) {
      setErr("Total must be at least 1 RWF.")
      return false
    }
    return true
  }

  const sectorSlug = shopCategory ? shopCategoryToSectorSlug(shopCategory) : ""

  const submit = async () => {
    setErr(null)
    setDoneMsg(null)
    if (!hasHydrated || !isAuthenticated || !user) {
      setErr(pickLang(UMURIRO_UI.loginRequired, lang))
      return
    }
    if (!validate()) return

    setLoading(true)
    try {
      const p = parseFloat(unitPrice.replace(",", "."))
      const q = parseFloat(quantity.replace(",", "."))
      const payload = {
        kind: "umuriro" as const,
        incompleteSeller: true as const,
        savedBy: {
          email: user.email,
          name: user.name,
          phone: user.phone || "",
        },
        shop: {
          companyName: shopName.trim(),
          momoCode: momoCode.trim(),
          momoDigits,
          shopCategory: shopCategory.trim(),
          sectorSlug: sectorSlug || undefined,
        },
        line: {
          itemName: itemName.trim(),
          unitPriceRwf: Math.round(p),
          quantity: Math.round(q),
          totalRwf,
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
      setDoneMsg(
        `${pickLang(UMURIRO_UI.savedOk, lang)} ${json.persisted ? "" : "(" + String(json.message || "") + ")"}`
      )
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

  const canSubmit = hasHydrated && isAuthenticated && !!user

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
                <div className="truncate text-lg font-bold leading-tight">Umuriro</div>
                <div className="truncate text-xs text-white/90">{pickLang(UMURIRO_UI.pageSubtitle, lang)}</div>
              </div>
            </div>
            <div className="shrink-0 [&_button]:border-white/40 [&_button]:text-white [&_button]:hover:bg-white/15">
              <LanguageSelector />
            </div>
          </div>
        </header>

        <div className="space-y-4 px-3 pt-4">
          {hasHydrated && !canSubmit && (
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
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="space-y-2">
                <Label className="text-[#17324d]">{pickLang(UMURIRO_UI.shoppingAt, lang)}</Label>
                <Input
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  className="border-[#dbe7f3]"
                  autoComplete="organization"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[#17324d]">{pickLang(L.momo, lang)}</Label>
                <Input
                  value={momoCode}
                  onChange={(e) => setMomoCode(e.target.value)}
                  className="border-[#dbe7f3]"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[#17324d]">{pickLang(UMURIRO_UI.shopCategory, lang)}</Label>
                <p className="text-xs text-[#6f8399]">{pickLang(UMURIRO_UI.shopCategoryHint, lang)}</p>
                <Select value={shopCategory} onValueChange={setShopCategory}>
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
              <div className="space-y-1">
                <Label className="text-[#17324d]">{pickLang(UMURIRO_UI.imBuying, lang)}</Label>
                <p className="text-xs text-[#6f8399]">{pickLang(UMURIRO_UI.imBuyingHint, lang)}</p>
                <div className="relative" ref={itemWrapRef}>
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
                  {itemOpen && shopCategory.trim() && itemName.trim().length >= 2 && (
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
                          return (
                            <button
                              key={key}
                              type="button"
                              role="option"
                              className="flex w-full min-w-0 cursor-pointer px-3 py-2 text-left text-sm text-[#17324d] hover:bg-[#f0f8ff]"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => pickItemSuggestion(p)}
                            >
                              <span className="truncate">{label}</span>
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
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-[#17324d]">{pickLang(UMURIRO_UI.unitPrice, lang)}</Label>
                  <Input
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    className="border-[#dbe7f3]"
                    inputMode="decimal"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#17324d]">{pickLang(UMURIRO_UI.quantity, lang)}</Label>
                  <Input
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="border-[#dbe7f3]"
                    inputMode="numeric"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-[#dbe7f3] bg-[#f7fbff]/60 px-3 py-2 text-sm">
                <span className="font-semibold text-[#17324d]">{pickLang(UMURIRO_UI.totalLabel, lang)}: </span>
                <span className="tabular-nums text-[#127fc0]">{totalRwf.toLocaleString()} RWF</span>
              </div>

              <div className="space-y-2">
                <Label className="text-[#17324d]">{pickLang(UMURIRO_UI.ussdLabel, lang)}</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="min-w-0 flex-1 break-all rounded-lg bg-[#17324d]/5 px-2 py-2 text-xs font-mono text-[#17324d]">
                    {momoDigits.length >= 6 && totalRwf > 0 ? ussd : "—"}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 border-[#dbe7f3]"
                    onClick={copyUssd}
                    disabled={momoDigits.length < 6 || totalRwf < 1}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
                    {pickLang(UMURIRO_UI.copyUssd, lang)}
                  </Button>
                </div>
                <p className="text-xs text-[#6f8399]">*182 × MoMo digits × total (RWF) #</p>
              </div>

              <Button
                type="button"
                disabled={loading || !canSubmit}
                onClick={submit}
                className={cn(
                  "w-full bg-gradient-to-r from-[#1897e0] to-[#127fc0] text-white shadow-[0_10px_20px_rgba(24,151,224,.22)] hover:opacity-95",
                  !canSubmit && "opacity-60"
                )}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {pickLang(SELLER_UI.saving, lang)}
                  </>
                ) : (
                  pickLang(UMURIRO_UI.saveAndPay, lang)
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
