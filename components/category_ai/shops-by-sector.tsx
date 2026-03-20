"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Store } from "lucide-react"
import { useTranslation } from "@/hooks/use-translation"
import { usePrefsStore } from "@/lib/prefs-store"
import type { TranslationKey } from "@/lib/translations"
import { cn } from "@/lib/utils"

interface SectorCategory {
  categoryId: string
  nameKey: string
  descKey?: string
}

export interface ShopInfo {
  seller_account: string
  seller_name: string
  seller_location?: string
  /** Only when Java sends nickname / NICKNAME — required to open Shop With Me. */
  officialNickname: string | null
  /** Lines / SKUs from seller listing (product_count or products.length from backend). */
  stockLineCount?: number
}

const SECTOR_ORDER = ["bar-resto", "resto-bar", "pharmacy", "supermarket", "liquor-store", "coffee-shop", "boutique", "beauty", "general"]

const BAR_RESTO_IDS = ["resto-bar", "barrestaurant", "bar_resto", "barresto", "bar-resto"]

/**
 * Java fetchSuggestions often defaults to ~5 suppliers when `limit` is omitted.
 * @see docs/list-suppliers-with-products.md
 */
const LIST_SUPPLIERS_LIMIT = 500

/**
 * If admin omits a sector (or only inactive rows exist), we still try these IDs so shops like pharmacy appear.
 * nameKey must exist in translations (same keys as category grid).
 */
const FALLBACK_SECTORS: SectorCategory[] = [
  { categoryId: "pharmacy", nameKey: "pharmacy" },
  { categoryId: "bar-resto", nameKey: "barResto" },
  { categoryId: "supermarket", nameKey: "supermarket" },
  { categoryId: "liquor-store", nameKey: "liquorStore" },
  { categoryId: "coffee-shop", nameKey: "coffeeShop" },
  { categoryId: "boutique", nameKey: "boutique" },
  { categoryId: "beauty", nameKey: "beauty" },
  { categoryId: "general", nameKey: "generalStore" },
]

/** Optional logos by nickname (lowercase) or ISHYIGA account — add more as assets land in /public/shops/. */
const SHOP_LOGO_BY_KEY: Record<string, string> = {
  rite: "/shops/rite-pharmacy-logo.png",
  alg000005204: "/shops/rite-pharmacy-logo.png",
}

function sectorSortIndex(categoryId: string): number {
  const id = (categoryId || "").toLowerCase()
  const i = SECTOR_ORDER.indexOf(id)
  if (i >= 0) return i
  if (BAR_RESTO_IDS.includes(id)) return SECTOR_ORDER.indexOf("bar-resto")
  return 1000 + id.charCodeAt(0) ?? 9999
}

/**
 * DB column is often `nickname` (account_signup), but Java JSON may use camelCase or omit it at root.
 * Scan common keys + nested account/profile blobs.
 */
const SUPPLIER_NICKNAME_KEYS = [
  "nickname",
  "NICKNAME",
  "NickName",
  "nickName",
  "Nickname",
  "nick_name",
  "NICK_NAME",
  "seller_nickname",
  "SELLER_NICKNAME",
  "SellerNickname",
  "sellerNickname",
  "shop_nickname",
  "SHOP_NICKNAME",
  "ShopNickname",
  "supplier_nickname",
  "SUPPLIER_NICKNAME",
  "prefered_seller_nickname",
  "preferred_seller_nickname",
] as const

const NICKNAME_NEST_KEYS = ["account", "accountSignup", "account_signup", "profile", "supplier", "supplierInfo"] as const

function pickSupplierNickname(x: unknown): string | null {
  if (x == null || typeof x !== "object") return null
  const o = x as Record<string, unknown>
  for (const k of SUPPLIER_NICKNAME_KEYS) {
    const v = o[k]
    if (v != null && String(v).trim() !== "") return String(v).trim()
  }
  for (const nk of NICKNAME_NEST_KEYS) {
    const child = o[nk]
    if (child != null && typeof child === "object") {
      const found = pickSupplierNickname(child)
      if (found) return found
    }
  }
  return null
}

/** Best-effort count of catalog lines (aligns with seller_add_stock / catalog rows when backend sends them). */
function pickStockLineCount(x: Record<string, unknown>): number | undefined {
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined)
  const pc =
    n(x.product_count) ??
    n(x.productCount) ??
    n(x.PRODUCT_COUNT) ??
    (Array.isArray(x.products) ? x.products.length : undefined)
  if (pc != null && pc >= 0) return Math.round(pc)
  const stock = n(x.in_stock_products) ?? n(x.inStockProducts)
  return stock != null && stock >= 0 ? Math.round(stock) : undefined
}

/** Shared mapping for `listSuppliersWithProducts` JSON (one network round-trip for sector). */
export function mapListSuppliersWithProductsToShops(arr: unknown[]): ShopInfo[] {
  return (arr || []).map((x: any) => {
    const rec = x as Record<string, unknown>
    return {
      seller_account: x.seller_account ?? x.ACC ?? x.ISHYIGA_ACCOUNT ?? "",
      seller_name: x.seller_name ?? x.OWNER ?? x.SELLER_NAMES ?? "Shop",
      seller_location: x.seller_location ?? x.LOCATION,
      officialNickname: pickSupplierNickname(x),
      stockLineCount: pickStockLineCount(rec),
    }
  }).filter((s: ShopInfo) => s.seller_account || s.seller_name)
}

function shopLogoSrc(shop: ShopInfo): string | null {
  const nick = (shop.officialNickname || "").toString().trim().toLowerCase()
  const acct = (shop.seller_account || "").toString().trim().toLowerCase()
  if (nick && SHOP_LOGO_BY_KEY[nick]) return SHOP_LOGO_BY_KEY[nick]
  if (acct && SHOP_LOGO_BY_KEY[acct]) return SHOP_LOGO_BY_KEY[acct]
  return null
}

/** Fetch sectors from homepage categories, then for each sector fetch sellers and show shops grouped by sector. */
export function ShopsBySector() {
  const { t } = useTranslation()
  const [sectors, setSectors] = useState<SectorCategory[]>([])
  const [shopsBySector, setShopsBySector] = useState<Record<string, ShopInfo[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch("/api/admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "getHomepageCategories" }),
        })
        const data = await res.json()
        if (cancelled || !res.ok || !data.ok || !data.categories?.length) {
          if (!cancelled) setSectors([])
          return
        }
        const list: SectorCategory[] = (data.categories as any[])
          .filter((c: any) => c.isActive !== false)
          .map((c: any) => ({
            categoryId: c.categoryId || c.id || "",
            nameKey: c.nameKey || c.categoryId || "generalStore",
            descKey: c.descKey,
          }))
        const seenIds = new Set(list.map((s) => (s.categoryId || "").toLowerCase()).filter(Boolean))
        const hasAnyBarResto = [...seenIds].some((id) => BAR_RESTO_IDS.includes(id))
        for (const f of FALLBACK_SECTORS) {
          const id = f.categoryId.toLowerCase()
          if (seenIds.has(id)) continue
          if (id === "bar-resto" && hasAnyBarResto) continue
          list.push({ ...f })
          seenIds.add(id)
        }
        if (!cancelled) setSectors(list)

        const bySector: Record<string, ShopInfo[]> = {}
        for (const sector of list) {
          const sid = (sector.categoryId || "").trim().toLowerCase()
          if (!sid) continue
          try {
            const url = `/api/fetchSuggestions?listSuppliersWithProducts=${encodeURIComponent(sid)}&Currency=RWF&limit=${LIST_SUPPLIERS_LIMIT}`
            const r = await fetch(url, { cache: "no-store" })
            const raw: any = r.ok ? await r.json() : []
            const arr: any[] = Array.isArray(raw) ? raw : []
            const shops: ShopInfo[] = mapListSuppliersWithProductsToShops(arr)
            if (shops.length > 0 && !cancelled) bySector[sid] = shops
          } catch (_) {
            // skip sector on error
          }
        }
        if (!cancelled) setShopsBySector(bySector)
      } catch (_) {
        if (!cancelled) setSectors([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const orderedSectors = useMemo(
    () =>
      [...sectors]
        .sort((a, b) => sectorSortIndex(a.categoryId) - sectorSortIndex(b.categoryId))
        .filter((s) => (shopsBySector[s.categoryId]?.length ?? 0) > 0),
    [sectors, shopsBySector]
  )

  const totalActiveShops = useMemo(() => {
    const seen = new Set<string>()
    for (const sec of orderedSectors) {
      for (const shop of shopsBySector[sec.categoryId] ?? []) {
        const key = (shop.seller_account || shop.officialNickname || shop.seller_name).toString().trim().toLowerCase()
        if (key) seen.add(key)
      }
    }
    return seen.size
  }, [orderedSectors, shopsBySector])

  if (loading) {
    return (
      <section className="py-8 md:py-12">
        <div className="container mx-auto px-4 text-center text-muted-foreground">Loading shops…</div>
      </section>
    )
  }

  if (orderedSectors.length === 0) {
    return (
      <section className="py-8 md:py-12">
        <div className="container mx-auto px-4 text-center text-muted-foreground">No shops grouped by sector at the moment.</div>
      </section>
    )
  }

  return (
    <section className="py-8 md:py-12">
      <div className="container mx-auto px-4 space-y-10">
        <div className="text-center mb-8">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground inline-flex flex-wrap items-center justify-center gap-2">
            <span>All shops</span>
            <span
              className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-sm font-semibold tabular-nums"
              title="Active shops (unique sellers)"
            >
              {totalActiveShops}
            </span>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Grouped by sector</p>
        </div>
        {orderedSectors.map((sector) => {
          const shops = shopsBySector[sector.categoryId] ?? []
          if (shops.length === 0) return null
          return (
            <div key={sector.categoryId}>
              <h3 className="text-lg font-semibold text-foreground mb-3 flex flex-wrap items-center gap-2">
                <Store className="h-5 w-5 text-muted-foreground shrink-0" />
                <span>{t(sector.nameKey as TranslationKey)}</span>
                <span
                  className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums"
                  title="Shops in this sector"
                >
                  {shops.length}
                </span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {shops.map((shop) => {
                  const canLink = Boolean((shop.officialNickname || "").trim())
                  const href = canLink
                    ? `/shop-with-me/${encodeURIComponent((shop.officialNickname || "").trim().toLowerCase())}`
                    : ""
                  const logo = shopLogoSrc(shop)
                  const lines = shop.stockLineCount
                  const cardKey = `${shop.seller_account || "na"}-${shop.seller_name}`

                  const card = (
                    <Card
                      className={cn(
                        "h-full border transition-all",
                        canLink ? "hover:shadow-md cursor-pointer" : "opacity-80 border-dashed cursor-not-allowed"
                      )}
                      title={canLink ? undefined : t("shopsListLinkDisabledHint" as TranslationKey)}
                    >
                      <CardContent className="p-3 flex flex-col items-center justify-center text-center min-h-[112px]">
                        <div className="rounded-lg bg-muted/50 p-2 mb-1.5 size-[52px] flex items-center justify-center overflow-hidden">
                          {logo ? (
                            <Image
                              src={logo}
                              alt=""
                              width={44}
                              height={44}
                              className="object-contain max-h-[44px] w-auto"
                            />
                          ) : (
                            <Store className="h-6 w-6 text-muted-foreground" />
                          )}
                        </div>
                        <span className="text-sm font-medium text-foreground line-clamp-2">{shop.seller_name}</span>
                        {shop.seller_location && (
                          <span className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{shop.seller_location}</span>
                        )}
                        <span
                          className={cn(
                            "text-[11px] mt-1.5 line-clamp-1 w-full",
                            canLink ? "text-primary font-medium" : "text-amber-700 dark:text-amber-500"
                          )}
                        >
                          <span className="text-muted-foreground font-normal">{t("shopsListNickname" as TranslationKey)}: </span>
                          {canLink ? (
                            <span className="tabular-nums">@{shop.officialNickname!.trim()}</span>
                          ) : (
                            <span>{t("shopsListNoNickname" as TranslationKey)}</span>
                          )}
                        </span>
                        {lines != null && (
                          <span
                            className="text-[11px] text-muted-foreground mt-1 tabular-nums"
                            title="Catalog lines (from seller stock / product list)"
                          >
                            {lines} items
                          </span>
                        )}
                      </CardContent>
                    </Card>
                  )

                  return canLink ? (
                    <Link key={cardKey} href={href} className="block">
                      {card}
                    </Link>
                  ) : (
                    <div key={cardKey} className="block" aria-disabled="true">
                      {card}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/**
 * Same card grid as “Shops” on the main page, for one sector only (e.g. Pharmacy on /category_ai/pharmacy).
 * Links open Shop With Me. Area / location: use header filter + prefs-store (no duplicate UI here).
 */
export function ShopsForSingleSector({
  shops,
  loading,
  className,
}: {
  shops: ShopInfo[]
  loading: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const locationPref = usePrefsStore((s) => s.location)

  const filteredShops = useMemo(() => {
    const pref = (locationPref || "").trim().toLowerCase()
    if (!pref) return shops
    return shops.filter((s) => {
      const loc = (s.seller_location || "").toLowerCase()
      const name = (s.seller_name || "").toLowerCase()
      return loc.includes(pref) || name.includes(pref)
    })
  }, [shops, locationPref])

  return (
    <div className={cn("space-y-4", className)}>
      {loading && (
        <div className="text-center py-10 text-muted-foreground">Loading shops…</div>
      )}

      {!loading && filteredShops.length === 0 && (
        <div className="text-center py-10 rounded-lg border border-dashed text-muted-foreground text-sm">
          No shops match this sector or filter. Try the main search (top) or another area.
        </div>
      )}

      {!loading && filteredShops.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filteredShops.map((shop) => {
            const canLink = Boolean((shop.officialNickname || "").trim())
            const href = canLink
              ? `/shop-with-me/${encodeURIComponent((shop.officialNickname || "").trim().toLowerCase())}`
              : ""
            const logo = shopLogoSrc(shop)
            const lines = shop.stockLineCount
            const cardKey = `${shop.seller_account || "na"}-${shop.seller_name}`

            const card = (
              <Card
                className={cn(
                  "h-full min-h-[120px] border transition-all",
                  canLink ? "hover:shadow-md cursor-pointer" : "opacity-80 border-dashed cursor-not-allowed"
                )}
                title={canLink ? undefined : t("shopsListLinkDisabledHint" as TranslationKey)}
              >
                <CardContent className="p-3 flex flex-col items-center justify-center text-center">
                  <div className="rounded-lg bg-muted/50 p-2 mb-1.5 size-[52px] flex items-center justify-center overflow-hidden">
                    {logo ? (
                      <Image
                        src={logo}
                        alt=""
                        width={44}
                        height={44}
                        className="object-contain max-h-[44px] w-auto"
                      />
                    ) : (
                      <Store className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <span className="text-sm font-medium text-foreground line-clamp-2">{shop.seller_name}</span>
                  {shop.seller_location && (
                    <span className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{shop.seller_location}</span>
                  )}
                  <span
                    className={cn(
                      "text-[11px] mt-1.5 line-clamp-1 w-full",
                      canLink ? "text-primary font-medium" : "text-amber-700 dark:text-amber-500"
                    )}
                  >
                    <span className="text-muted-foreground font-normal">{t("shopsListNickname" as TranslationKey)}: </span>
                    {canLink ? (
                      <span className="tabular-nums">@{shop.officialNickname!.trim()}</span>
                    ) : (
                      <span>{t("shopsListNoNickname" as TranslationKey)}</span>
                    )}
                  </span>
                  {lines != null && (
                    <span className="text-[11px] text-muted-foreground mt-1 tabular-nums">{lines} items</span>
                  )}
                </CardContent>
              </Card>
            )

            return canLink ? (
              <Link key={cardKey} href={href} className="block">
                {card}
              </Link>
            ) : (
              <div key={cardKey} className="block" aria-disabled="true">
                {card}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
