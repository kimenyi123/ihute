"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { isBarOrRestaurant } from "@/lib/constants"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { LocationCaptureDialog } from "@/components/location-capture-dialog"
import { Slider } from "@/components/ui/slider"
import { useLocationStoreEnhanced, type LocationData } from "@/lib/location-store-enhanced"
import { getProductImageSrc, NO_IMAGE_URL } from "@/lib/image-utils"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Loader2,
  MessageSquare,
  Phone,
  SlidersHorizontal,
  Smartphone,
  Trash2,
} from "lucide-react"
import { grandmaApiService } from "@/lib/grandma-api-service"
import { getUserPreferences, toggleUserPreference, saveUserPreferences, getCurrentUserId, loadUserPreferences } from "@/lib/user-preferences-api"
import {
  GRANDMA_APP_VERSION,
  GRANDMA_OUTBOUND,
  GRANDMA_PATHS,
  writeGrandmaSignupRole,
} from "@/lib/grandma-urls"
import {
  GRANDMA_REORDER_STORAGE_KEY,
  type GrandmaReorderPayload,
} from "@/lib/grandma-reorder"
import { notifyGrandmaOrderPlaced } from "@/lib/grandma-order-live"
import { saveGrandmaPendingOrder } from "@/lib/grandma-pending-order"
import {
  buildGrandmaBillingReferenceTail,
  buildGrandmaMtnUssd,
  computeIhutePlatformFeeRwf,
  stripShopMomoLabel,
} from "@/lib/grandma-order-billing"
import { GRANDMA_CATEGORY_TO_SECTOR_SLUG } from "@/lib/seller-category-sector"
import { fetchSectorStatsFromApi, productCountFromSupplierRow } from "@/lib/fetch-suggestions-helpers"
import { useAuthStore } from "@/lib/auth-store"
import { useOrdersStore } from "@/lib/orders-store"
import { grandmaUserCanUseSellerWorkspace } from "@/lib/auth-login-client"
import { useLanguageStore } from "@/lib/language-store"
import { GrandmaSellerDashboard } from "@/components/grandma-seller-dashboard"
import { GrandmaSellerItemsPanel } from "@/components/grandma-seller-items-panel"
import { digitsOnly, normalizePhoneDigitsForAuth, normalizeRwandaMobileE164 } from "@/lib/rwanda-phone"
import { lineSellingPriceFromProductRow } from "@/lib/package-price"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { matchMoMoSmsToOrderTotal, type MoMoSmsMatchResult } from "@/lib/momo-payment-sms-match"
import { Button } from "@/components/ui/button"

export type Category =
  | "Boutique"
  | "Supermarket"
  | "Pharmacy"
  | "Restaurant"
  | "Liquor Store"
  | "Bakery"
  | "Veterinary"
  | "Others"

type Product = {
  id: number
  category: Category
  name: string
  price: number
  emoji: string
  imageUrl?: string
  /**
   * Kaos `ITEM_CODE` / `item_key_words` for stock decrement — must match `seller_add_stock`, not `liveKey`
   * (e.g. Burrows uses `liveKey` like `nickname:dedupe…` which must never be sent as `itemCode`).
   */
  stockLineCode?: string
  /** Stable key for live-catalog rows (dedupe + React keys) */
  liveKey?: string
  /** Live API `in_stock` — only set for injected catalog rows */
  liveInStock?: boolean
  /** Menu / famille label from live API (filters) */
  liveCategory?: string
  /** Sellable units on hand (inventory line quantity); omit when unknown. */
  stockQty?: number
  qty: number
}

type BurrowsApiProduct = {
  item_commercial_name?: string
  item_name?: string
  selling_price?: number | string
  price?: number | string
  image_url?: string
  item_image_url?: string
  image?: string
  IMAGE_URL?: string
  item_image?: string
  photo_url?: string
  famille?: string
  FAMILLE?: string
  item_department?: string
  ITEM_CODE?: string
  item_code?: string
  item_key_words?: string
  NIKI_CODE?: string
  niki_code?: string
  item_state?: string
  item_packet?: string
  stock?: number | string
  in_stock?: boolean
  category?: string

}

type BurrowsApiSeller = {
  ISHYIGA_ACCOUNT?: string
  OWNER?: string
  SELLER_NAMES?: string
  NICKNAME?: string
  PREFERRED_CATEGORIES?: string
  DEPARTMENT?: string
  products?: BurrowsApiProduct[]
}

type BurrowsApiResponse = { ok: boolean; sellers?: BurrowsApiSeller[] }

type LogisticsId = "human" | "bike" | "moto"
type LogisticsOption = { id: LogisticsId; icon: string; label: string; baseRwf: number; rwfPerKm: number }

/** Buyer chooses delivery vs collecting at shop — avoids mixing modes. */
type FulfillmentMode = "delivery" | "pickup"

type PaymentId = "momo" | "airtel" | "bk" | "cash"
type PaymentMode = { id: PaymentId; label: string; iconSrc: string }

/** Kaos {@code OrdersServlet} {@code paymentName} values */
function grandmaPaymentToOrdersPaymentName(id: PaymentId): string {
  switch (id) {
    case "momo":
      return "MOMO"
    case "airtel":
      return "AIRTEL_MONEY"
    case "bk":
      return "BANK_TRANSFER"
    case "cash":
      return "PAY_ON_DELIVERY"
    default:
      return "PAY_ON_DELIVERY"
  }
}

type ShopFilterTab = "favorites" | "reorder" | "trending" | "onsale"

type ItemsSortId = "default" | "name" | "price_asc" | "price_desc"

type ShopEntry = {
  id: string
  name: string
  category: Category
  tagline: string
  favorite: boolean
  orderedBefore: boolean
  trending: boolean
  onSale: boolean
  /** km — used when “location sort” is on */
  distanceKm: number
  momo: string
  /** optional — from API; otherwise derived deterministically from id */
  rating?: number
  reviewCount?: number
  /** under `public/` — e.g. `/img/shops/sawa.png` */
  logoSrc: string
  /** Stock / catalog lines for this supplier row from browse API (home card totals). */
  stockLineCount?: number
  /** merchant payout — demo; replace with API */
  bankName?: string
  payoutAccount?: string
}

const GRANDMA_ORDERED_SHOPS_LS = "ihute:grandma:orderedShopIds" as const

function readGrandmaOrderedShopIdsFromStorage(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(GRANDMA_ORDERED_SHOPS_LS)
    if (!raw) return []
    const p = JSON.parse(raw) as unknown
    if (!Array.isArray(p)) return []
    return [...new Set(p.map((x) => String(x).trim()).filter(Boolean))]
  } catch {
    return []
  }
}

function persistGrandmaOrderedShopIds(ids: string[]) {
  try {
    window.localStorage.setItem(GRANDMA_ORDERED_SHOPS_LS, JSON.stringify(ids.slice(0, 80)))
  } catch {
    /* ignore */
  }
}

/** After a successful Grandma checkout — powers the “Reorder” shop filter. */
function appendGrandmaOrderedShopId(shopId: string): string[] {
  const id = String(shopId ?? "").trim()
  if (!id) return readGrandmaOrderedShopIdsFromStorage()
  const prev = readGrandmaOrderedShopIdsFromStorage()
  const next = [id, ...prev.filter((x) => x !== id)].slice(0, 80)
  persistGrandmaOrderedShopIds(next)
  return next
}

function supplierRowSuggestsOnSale(supplier: Record<string, unknown>): boolean {
  const pos = (v: unknown) => {
    const x = Number(v)
    return Number.isFinite(x) && x > 0
  }
  const truthy = (v: unknown) => v === true || v === "true" || v === "1" || v === 1
  if (truthy(supplier.on_sale) || truthy(supplier.ON_SALE) || truthy(supplier.onSale)) return true
  if (truthy(supplier.has_promo) || truthy(supplier.HAS_PROMO)) return true
  if (pos(supplier.promo_count) || pos(supplier.PROMO_COUNT)) return true
  if (pos(supplier.discount_items) || pos(supplier.DISCOUNT_ITEMS)) return true
  return false
}

/** Live sector list has no “trending” flag — approximate with top stock-line counts per category. */
function annotateShopTrendingByCategory(shops: ShopEntry[]): ShopEntry[] {
  const groups = new Map<Category, ShopEntry[]>()
  for (const s of shops) {
    const g = groups.get(s.category) ?? []
    g.push(s)
    groups.set(s.category, g)
  }
  return shops.map((s) => {
    const peers = groups.get(s.category) ?? [s]
    const sorted = [...peers].sort((a, b) => (b.stockLineCount ?? 0) - (a.stockLineCount ?? 0))
    const lim = Math.min(12, Math.max(4, Math.ceil(sorted.length * 0.22)))
    const idx = Math.max(0, Math.min(lim, sorted.length) - 1)
    const t = sorted[idx]?.stockLineCount ?? 0
    const trending = t > 0 && (s.stockLineCount ?? 0) >= t
    return { ...s, trending }
  })
}

/** `supplier_ACCOUNT` or `supplier_ACCOUNT__Pharmacy` → Kaos seller account (no prefix / sector suffix). */
function sellerAccountFromGrandmaShopId(shopId: string | null | undefined): string {
  const raw = String(shopId ?? "").replace(/^supplier_/, "").trim()
  const i = raw.indexOf("__")
  return i === -1 ? raw : raw.slice(0, i)
}

function sameGrandmaSeller(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  return sellerAccountFromGrandmaShopId(a) === sellerAccountFromGrandmaShopId(b)
}

/** Normalize seller account from API fields to compare with `sellerAccountFromGrandmaShopId(shop.id)`. */
function normalizeSellerKeyFromSearch(raw: unknown): string {
  const s = String(raw ?? "").trim()
  if (!s) return ""
  const synthetic = s.toLowerCase().startsWith("supplier_") ? s : `supplier_${s}__x`
  return sellerAccountFromGrandmaShopId(synthetic).toUpperCase()
}

/** Collect seller accounts from global search JSON (products + suppliers). */
function collectSellerAccountsFromGlobalSearchJson(json: Record<string, unknown>): Set<string> {
  const out = new Set<string>()
  const add = (raw: unknown) => {
    const k = normalizeSellerKeyFromSearch(raw)
    if (k) out.add(k)
  }
  const products = Array.isArray(json.products) ? json.products : []
  for (const p of products) {
    if (!p || typeof p !== "object") continue
    const o = p as Record<string, unknown>
    add(
      o.supplier_account ??
        o.SELLER_ISHYIGA_ACCOUNT ??
        o.supplierAccount ??
        o.ISHYIGA_ACCOUNT ??
        o.seller_account ??
        o.SELLER_ACCOUNT,
    )
  }
  for (const arr of [json.suppliersByProduct, json.suppliersByName]) {
    const rows = Array.isArray(arr) ? arr : []
    for (const s of rows) {
      if (!s || typeof s !== "object") continue
      const o = s as Record<string, unknown>
      add(
        o.supplier_account ??
          o.SELLER_ISHYIGA_ACCOUNT ??
          o.supplierAccount ??
          o.ISHYIGA_ACCOUNT ??
          o.seller_account,
      )
    }
  }
  return out
}

function numPriceish(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v
  const s = String(v ?? "")
    .replace(/,/g, "")
    .replace(/[^\d.\-]/g, "")
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

/** Catalog row looks discounted (list vs selling) or explicit promo flags. */
function productRowLooksDiscounted(o: Record<string, unknown>): boolean {
  const sell = numPriceish(o.selling_price ?? o.SALE_PRICE_INCLUSIVE ?? o.UNITY_PRICE ?? o.price ?? o.PRICE)
  const list = numPriceish(
    o.list_price ??
      o.LIST_PRICE ??
      o.PV ??
      o.MRP ??
      o.rrp ??
      o.RRP ??
      o.prix_public ??
      o.RECOMMENDED_RETAIL_PRICE ??
      o.MSRP,
  )
  if (list > 0 && sell > 0 && sell < list * 0.995) return true
  const d = String(o.on_sale ?? o.ON_SALE ?? o.promo ?? o.PROMO ?? o.has_discount ?? "").toLowerCase()
  return d === "true" || d === "1" || d === "yes" || d === "y"
}

/** Seller keys (uppercase) that have at least one discounted line in a fetchSuggestions JSON body. */
function collectDiscountedSellerAccountsFromSearchJson(json: Record<string, unknown>): Set<string> {
  const out = new Set<string>()
  const products = Array.isArray(json.products) ? json.products : []
  for (const p of products) {
    if (!p || typeof p !== "object") continue
    const o = p as Record<string, unknown>
    if (!productRowLooksDiscounted(o)) continue
    const k = normalizeSellerKeyFromSearch(
      o.supplier_account ??
        o.SELLER_ISHYIGA_ACCOUNT ??
        o.supplierAccount ??
        o.ISHYIGA_ACCOUNT ??
        o.seller_account ??
        o.SELLER_ACCOUNT,
    )
    if (k) out.add(k)
  }
  return out
}

function isPreferredGrandmaShop(shopId: string, preferredIds: string[]): boolean {
  return preferredIds.some((pid) => pid === shopId || sameGrandmaSeller(pid, shopId))
}

/**
 * Supplier-products endpoint can return multiple JSON shapes depending on servlet branch:
 * - { products: [...] }
 * - [...]
 * - { data: [...] } / { supplierProducts: [...] }
 * - [{ products: [...] }, ...] with optional product_count hints
 */
function extractSupplierProductsCount(payload: unknown): number {
  const fromNumericField = (o: Record<string, unknown>): number | null => {
    const raw = o.total ?? o.totalCount ?? o.count ?? o.product_count ?? o.productCount ?? o.PRODUCT_COUNT
    const n = Number(raw)
    if (!Number.isFinite(n)) return null
    return Math.max(0, Math.floor(n))
  }
  const countRows = (rows: unknown[]): number => {
    if (!rows.length) return 0
    const hasNestedProducts = rows.some((r) => {
      if (!r || typeof r !== "object") return false
      return Array.isArray((r as Record<string, unknown>).products)
    })
    if (!hasNestedProducts) return rows.length
    return rows.reduce<number>((sum, row) => {
      if (!row || typeof row !== "object") return sum
      const o = row as Record<string, unknown>
      if (Array.isArray(o.products)) return sum + o.products.length
      const pc = Number(o.product_count ?? o.productCount ?? o.PRODUCT_COUNT ?? 0)
      return sum + (Number.isFinite(pc) ? Math.max(0, Math.floor(pc)) : 0)
    }, 0)
  }

  if (Array.isArray(payload)) return countRows(payload)
  if (payload && typeof payload === "object") {
    const o = payload as Record<string, unknown>
    const hinted = fromNumericField(o)
    if (hinted !== null) return hinted
    if (Array.isArray(o.products)) return countRows(o.products)
    if (Array.isArray(o.data)) return countRows(o.data)
    if (Array.isArray(o.supplierProducts)) return countRows(o.supplierProducts)
    if (Array.isArray(o.items)) return countRows(o.items)
  }
  return 0
}

type OfferRow = {
  id: string
  shopId: string
  shopName: string
  shopDistanceKm: number
  productId: number
  productName: string
  productEmoji: string
  priceRwf: number
  productMenuCategory: string | null
}

type GrandmaLang = "en" | "rw" | "fr"
type AppMode = "buyer" | "seller"
type SellerView = "home" | "orders" | "items"
const PREFERRED_ALL_ID = "__ALL__"

function formatStoredLocation(loc: LocationData | null, fallback: string): string {
  if (!loc) return fallback
  const parts = [loc.cell, loc.district, loc.province].filter(Boolean)
  return parts.length ? parts.join(" · ") : fallback
}

const GRANDMA_LABELS: Record<
  GrandmaLang,
  {
    demoLocation: string
    titleHome: string
    shopsPrefix: string
    titleSummary: string
    titlePayment: string
    settings: string
    settingsSub: string
    language: string
    langEn: string
    langRw: string
    langFr: string
    setLocation: string
    locationCurrent: string
    noLocationYet: string
    preferredShops: string
    preferredHint: string
    paymentMode: string
    payingTo: string
    bankName: string
    account: string
    yourLocation: string
    yourPhone: string
    yourPhoneHint: string
    paymentGuestPhoneLabel: string
    paymentGuestPhonePlaceholder: string
    paymentGuestPhoneNote: string
    orderSubmitNeedPhone: string
    eta: string
    etaSub: string
    etaSubNoMode: string
    paymentModeSection: string
    shopsIntro: string
    sortDistance: string
    sectorPanelShops: string
    sectorPanelItems: string
    footerHome: string
    footerShops: string
    footerItems: string
    footerSummary: string
    footerPay: string
    footerDashboard: string
    footerDashboardShort: string
    sectionLogistics: string
    logisticsNote: string
    logisticsNotePickup: string
    fulfillmentSectionTitle: string
    fulfillmentDeliveryTitle: string
    fulfillmentDeliverySub: string
    fulfillmentPickupTitle: string
    fulfillmentPickupSub: string
    fulfillmentDeliveryModesHint: string
    etaAtShop: string
    etaPickupSub: string
    summaryLineItems: string
    summaryLineItemsTotal: string
    summaryLineLogisticsRow: string
    summaryLineGrandTotal: string
    preferredBadge: string
    logHuman: string
    logBike: string
    logMoto: string
    amountShop: string
    ihuteFees: string
    taxes: string
    amountLogistics: string
    totalPay: string
    sendOrder: string
    stockOnHandLabel: string
    stockExceededLine: string
    stockExceededPayBlock: string
    stockExceededSubmit: string
    deliveryPerson: string
    hobbies: string
    kmToShop: string
    reviewers: string
    tapCouriers: string
    closestToShop: string
    top5Available: string
    myOrders: string
    viewMyOrders: string
    signInForOrders: string
    signIn: string
    logOut: string
    reorderSplashTitle: string
    reorderSplashSub: string
    versionLabel: string
    settingsModeHint: string
    settingsFormBuyerTitle: string
    settingsFormSellerTitle: string
    settingsSellerIntro: string
    settingsApplyClose: string
    settingsOpenSellerHome: string
    settingsOpenSellerOrders: string
    settingsOpenSellerItems: string
    settingsSellerNeedLogin: string
    settingsSellerTapDenied: string
    /** Seller home — best seller card & top-up panel */
    sellerDashBestSelling: string
    sellerDashBestSellingSubtitle: string
    sellerDashBestSellingEmpty: string
    sellerDashUnitsSold: string
    sellerDashLineRevenue: string
    sellerDashShareRevenue: string
    sellerDashTopUpTitle: string
    sellerDashTopUpSubtitle: string
    sellerDashBulletRestock: string
    sellerDashBulletPopular: string
    sellerDashBulletFulfillQueue: string
    sellerDashGrowthIdle: string
    sellerDashCtaStock: string
    /** Opens Shop with Me (NIKI catalog) to add / source products */
    sellerDashCtaNikiStock: string
    sellerDashCtaOrders: string
    sellerDashDeliveredTail: string
    payStepPanelTitle: string
    payStepDemoNote: string
    payStepCommissionNote: string
    payStepMtnTitle: string
    payStepMtnPayer: string
    payStepMtnDial: string
    payStepAirtelTitle: string
    payStepAirtelPayer: string
    payStepAirtelDial: string
    payStepAirtelHelp: string
    payStepBkTitle: string
    payStepBkHelp: string
    payStepBkCardNumber: string
    payStepBkExpiry: string
    payStepBkCvc: string
    payStepBkOtp: string
    payStepBkOtpSms: string
    payStepBkPin: string
    payStepBkPinHint: string
    payStepCashTitle: string
    payStepCashConfirm: string
    payStepCopy: string
    payStepCopied: string
    payStepErrPhone: string
    payStepErrBkCard: string
    payStepErrBkExpiry: string
    payStepErrBkCvc: string
    payStepErrBkOtp: string
    payStepErrBkPin: string
    payStepErrCash: string
    payStepMtnNoUssd: string
    payStepMomoPin: string
    payStepAutoPayHintMtn: string
    payStepAutoPayHintAirtel: string
    payStepProcessing: string
    payStepErrMtnPin: string
    payStepErrAirtelPin: string
    payStepCardsAccepted: string
    payStepAfterCheckoutHint: string
    payStepReadMoMoSmsTitle: string
    payStepReadMoMoSmsHint: string
    payStepVerifySms: string
    payStepPaymentPaidMatched: string
    payStepPaymentPaidMatchedWithTxn: string
    payStepDialMomo: string
    payStepPaymentMismatch: string
    payStepPaymentNoAmountInSms: string
    payStepSendOrderLocked: string
    payStepErrMomoSms: string
  }
> = {
  en: {
    demoLocation: "Kacyiru, Gasabo - (set your address in settings)",
    titleHome: "Ishyiga Ihute",
    shopsPrefix: "Shops ·",
    titleSummary: "Order Summary",
    titlePayment: "Payment Mode",
    settings: "Settings",
    settingsSub: "Language, location, shops & payment",
    language: "Language",
    langEn: "English",
    langRw: "Kinyarwanda",
    langFr: "Français",
    setLocation: "Set my location",
    locationCurrent: "Current",
    noLocationYet: "Not set yet — tap to choose GPS or district",
    preferredShops: "Preferred shops",
    preferredHint: "We show these first in your shop list.",
    paymentMode: "Preferred payment mode",
    payingTo: "Paying to",
    bankName: "Bank name",
    account: "Account",
    yourLocation: "Your location",
    yourPhone: "Your phone (delivery)",
    yourPhoneHint: "The shop uses this to reach you. Leave blank to use your Ihute account phone when signed in.",
    paymentGuestPhoneLabel: "Mobile Money & updates",
    paymentGuestPhonePlaceholder: "07… · same wallet we notify",
    paymentGuestPhoneNote: "Optional when signed in with a phone on your account.",
    orderSubmitNeedPhone: "Add your mobile number to pay and receive order updates.",
    eta: "Estimated time of arrival",
    etaSub: "From ~{km} km · {mode} delivery",
    etaSubNoMode: "~{km} km from the shop. Choose a delivery option on Summary to see arrival time.",
    paymentModeSection: "Payment Mode",
    sortDistance: " Sorted by distance.",
    shopsIntro:
      "Choose a shop in {cat}. Favorites and shops you used before are listed first.{sort}",
    sectorPanelShops: "shops",
    sectorPanelItems: "items",
    footerHome: "Home",
    footerShops: "Shops",
    footerItems: "Items",
    footerSummary: "Summary",
    footerPay: "Pay",
    footerDashboard: "Open supplier dashboard",
    footerDashboardShort: "Dashboard",
    sectionLogistics: "Shipment · Logistics",
    logisticsNote:
      "Delivery fee uses distance to this shop ({km} km) and the option you pick (replace with your pricing API).",
    logisticsNotePickup:
      "Self pickup: you collect the order at this shop. No delivery fee — logistics is RWF 0.",
    fulfillmentSectionTitle: "How do you want to receive this order?",
    fulfillmentDeliveryTitle: "Delivery",
    fulfillmentDeliverySub: "Bring it to my address (delivery fee applies).",
    fulfillmentPickupTitle: "Self pickup",
    fulfillmentPickupSub: "I will collect at the shop (no delivery fee).",
    fulfillmentDeliveryModesHint: "Choose how it travels to you:",
    etaAtShop: "At shop",
    etaPickupSub: "Pickup at the shop — no courier ETA. Coordinate with the seller after ordering.",
    summaryLineItems: "Items",
    summaryLineItemsTotal: "Items total",
    summaryLineLogisticsRow: "Logistics",
    summaryLineGrandTotal: "Grand total",
    preferredBadge: "Preferred",
    logHuman: "Human",
    logBike: "Bike",
    logMoto: "Moto",
    amountShop: "Amount to shop",
    ihuteFees: "Ihute fee (1%, from shop — not on your total)",
    taxes: "Taxes",
    amountLogistics: "Amount to logistics",
    totalPay: "Total amount to pay",
    sendOrder: "Send Order",
    stockOnHandLabel: "In stock: {n}",
    stockExceededLine: "You asked for {requested} — only {available} in stock.",
    stockExceededPayBlock: "Match your quantities to stock before paying.",
    stockExceededSubmit: "Reduce quantities to available stock before sending the order.",
    deliveryPerson: "Delivery person",
    hobbies: "Hobbies",
    kmToShop: "km to shop",
    reviewers: "reviewers",
    tapCouriers: "Tap to see top 5 couriers closest to the shop",
    closestToShop: "Closest to shop",
    top5Available: "top 5 available",
    myOrders: "My orders",
    viewMyOrders: "View my orders",
    signInForOrders: "Sign in to see your orders",
    signIn: "Sign in",
    logOut: "Log out",
    reorderSplashTitle: "Adding to your cart…",
    reorderSplashSub: "Loading this shop’s items.",
    versionLabel: "Version",
    settingsModeHint: "Choose Buyer or Seller to show the matching form below. Tap Done when finished.",
    settingsFormBuyerTitle: "Buyer preferences",
    settingsFormSellerTitle: "Seller / shop",
    settingsSellerIntro: "Jump to a screen, then tap Done to close settings.",
    settingsApplyClose: "Done",
    settingsOpenSellerHome: "Dashboard",
    settingsOpenSellerOrders: "Orders queue",
    settingsOpenSellerItems: "Items & stock",
    settingsSellerNeedLogin: "Sign in with your shop account to use seller mode.",
    settingsSellerTapDenied: "Sign in with a shop account to switch to Seller.",
    sellerDashBestSelling: "Best selling",
    sellerDashBestSellingSubtitle: "Live from delivered orders",
    sellerDashBestSellingEmpty:
      "Mark orders as delivered to see your #1 product, units sold, and tailored restock ideas.",
    sellerDashUnitsSold: "units sold",
    sellerDashLineRevenue: "Line revenue",
    sellerDashShareRevenue: "{{pct}}% of line revenue · {{rwf}}",
    sellerDashTopUpTitle: "Top-up sale",
    sellerDashTopUpSubtitle: "Short actions that keep your shop stocked and your queue moving.",
    sellerDashBulletRestock: "Restock priority: {{name}} — {{units}} units on delivered orders.",
    sellerDashBulletPopular: "Also selling well: {{name}} ({{units}} units).",
    sellerDashBulletFulfillQueue: "{{n}} open orders — fulfilling updates these insights faster.",
    sellerDashGrowthIdle: "Deliver orders with line items to unlock best-seller and top-up tips here.",
    sellerDashCtaStock: "Stock & catalog",
    sellerDashCtaNikiStock: "Add stock (NIKI)",
    sellerDashCtaOrders: "Open orders",
    sellerDashDeliveredTail: "{{n}} delivered",
    payStepPanelTitle: "Complete this payment method",
    payStepDemoNote: "",
    payStepCommissionNote:
      "The 1% Ihute line is written into your order reference for company commission (from the shop; not added to your total).",
    payStepMtnTitle: "MTN MoMo",
    payStepMtnPayer: "Wallet number (07…)",
    payStepMtnDial: "USSD — copy & dial",
    payStepAirtelTitle: "Airtel Money",
    payStepAirtelPayer: "Wallet number (07…)",
    payStepAirtelDial: "USSD — copy & dial",
    payStepAirtelHelp: "Pay from the Airtel Money app or *500# to the merchant number shown above.",
    payStepBkTitle: "Card (BK)",
    payStepBkHelp: "Enter your card details as required by your bank.",
    payStepBkCardNumber: "Card number",
    payStepBkExpiry: "Expiry (MM/YY)",
    payStepBkCvc: "CVC",
    payStepBkOtp: "OTP from SMS",
    payStepBkOtpSms: "Code to {mask} — enter the 6 digits from SMS.",
    payStepBkPin: "Mobile banking PIN",
    payStepBkPinHint: "Enter your 4-digit PIN.",
    payStepCashTitle: "Cash on delivery",
    payStepCashConfirm: "I will pay cash when I receive the order.",
    payStepCopy: "Copy",
    payStepCopied: "Copied",
    payStepErrPhone: "Enter a valid Rwandan mobile number (07…).",
    payStepErrBkCard: "Enter 13–16 digits for the card number.",
    payStepErrBkExpiry: "Enter a valid expiry (MM/YY, not in the past).",
    payStepErrBkCvc: "Enter 3 or 4 digits for CVC.",
    payStepErrBkOtp: "Enter 6 digits for the OTP.",
    payStepErrBkPin: "Enter 4 digits for the PIN.",
    payStepErrCash: "Confirm cash on delivery to continue.",
    payStepMtnNoUssd: "MoMo merchant code missing — use the number above or ask the shop.",
    payStepMomoPin: "Wallet PIN",
    payStepAutoPayHintMtn: "Payment runs automatically when your 5-digit MTN MoMo PIN is complete.",
    payStepAutoPayHintAirtel: "Payment runs automatically when your 4-digit Airtel Money PIN is complete.",
    payStepProcessing: "Processing…",
    payStepErrMtnPin: "Enter your 5-digit MTN MoMo PIN.",
    payStepErrAirtelPin: "Enter your 4-digit Airtel Money PIN.",
    payStepCardsAccepted: "Cards accepted",
    payStepAfterCheckoutHint: "You get an order ID and a track link — no sign-in required to buy.",
    payStepReadMoMoSmsTitle: "Paste MoMo SMS (read confirmation)",
    payStepReadMoMoSmsHint:
      "After paying, copy the MTN message here. We match the RWF amount to your total ({total} RWF).",
    payStepVerifySms: "Match to my total",
    payStepPaymentPaidMatched: "Paid — SMS amount matches your order total.",
    payStepPaymentPaidMatchedWithTxn:
      "Paid — amount matches your order. MoMo TxId: {txnId}.",
    payStepDialMomo: "Dial",
    payStepPaymentMismatch: "Not matched — SMS shows {got} RWF but your total is {expected} RWF.",
    payStepPaymentNoAmountInSms: "No RWF amount found — paste the full MoMo SMS.",
    payStepSendOrderLocked: "Pay with MoMo, paste the confirmation SMS, then the Send button will appear.",
    payStepErrMomoSms: "Confirm MoMo payment with the SMS before sending the order.",
  },
  rw: {
    demoLocation: "Kacyiru, Gasabo — hindura aho uri mu bigenga.",
    titleHome: "Ishyiga Ihute",
    shopsPrefix: "Amaduka ·",
    titleSummary: "Incamake y'itumiza",
    titlePayment: "Uburyo bwo kwishyura",
    settings: "Ibigenga",
    settingsSub: "Hindura ururimi, aho uri, amaduka n'uburyo bwo kwishyura.",
    language: "Ururimi",
    langEn: "English",
    langRw: "Ikinyarwanda",
    langFr: "Igifaransa",
    setLocation: "Shyiraho aho uri",
    locationCurrent: "Aho uri ubu",
    noLocationYet: "Ntibyanditswe — kanda uhitemo aho uherereye.",
    preferredShops: "Amaduka ukunda",
    preferredHint: "Aya maduka ni yo agaragara mbere mu rutonde rwawe.",
    paymentMode: "Uburyo bwo kwishyura",
    payingTo: "Aho wishyurira",
    bankName: "Izina ry'ibanki",
    account: "Konti",
    yourLocation: "Aho uri",
    yourPhone: "Telefoni yawe",
    yourPhoneHint: "Iduka rizaguhamagara kuri iyi nimero. Niba winjiye ku konti yawe, ntibikenewe.",
    paymentGuestPhoneLabel: "Nimero ya MoMo n'amakuru y'itumiza",
    paymentGuestPhonePlaceholder: "07… · nimero yo kwishyuriraho",
    paymentGuestPhoneNote: "Ntibisabwa niba winjiye ku konti ifite nimero ya telefoni.",
    orderSubmitNeedPhone: "Andika nimero ya telefoni yawe kugira ngo wishyure kandi ubone amakuru y'itumiza.",
    eta: "Igihe ugereranyije cyo kugera",
    etaSub: "Km ~{km} · {mode}",
    etaSubNoMode: "Hitamo uburyo bwo kubigeza iwawe ku ncamake kugira ngo urebe igihe cyo kugera.",
    paymentModeSection: "Uburyo bwo kwishyura",
    sortDistance: " Bitondetswe hakurikijwe intera.",
    shopsIntro: "Hitamo iduka muri {cat}. Ayo uhitamo kenshi ni yo abanza.{sort}",
    sectorPanelShops: "amaduka",
    sectorPanelItems: "ibicuruzwa",
    footerHome: "Ahabanza",
    footerShops: "Amaduka",
    footerItems: "Ibicuruzwa",
    footerSummary: "Incamake",
    footerPay: "Ishyura",
    footerDashboard: "Ikibaho cy'iduka",
    footerDashboardShort: "Ikibaho",
    sectionLogistics: "Ubugendesheje",
    logisticsNote: "Igiciro cy'ubugendesheje gishingiye ku ntera kugera ku iduka ({km} km) n'uburyo wahisemo.",
    logisticsNotePickup: "Ujya kwakira ku iduka ubwawe. Nta giciro cy'ubugendesheje — ni RWF 0.",
    fulfillmentSectionTitle: "Ushaka kubona ibi bitumize gute?",
    fulfillmentDeliveryTitle: "Kubigezaho",
    fulfillmentDeliverySub: "Binkugezaho aho ndi (igiciro cy'ubugendesheje kihari).",
    fulfillmentPickupTitle: "Kwakira ku iduka",
    fulfillmentPickupSub: "Nzajya kwakira ku iduka ubwanjye (nta giciro cy'ubugendesheje).",
    fulfillmentDeliveryModesHint: "Hitamo uburyo bwo kubigeza iwawe:",
    etaAtShop: "Ku iduka",
    etaPickupSub: "Urakira ku iduka — nta gihe cy'umugendesheje. Vugana n'iduka nyuma yo gutumiza.",
    summaryLineItems: "Ibicuruzwa",
    summaryLineItemsTotal: "Igiciro cy'ibicuruzwa",
    summaryLineLogisticsRow: "Ubugendesheje",
    summaryLineGrandTotal: "Igiciro cyose hamwe",
    preferredBadge: "Uhitamo",
    logHuman: "Ku maguru",
    logBike: "Igare",
    logMoto: "Moto",
    amountShop: "Amafaranga y'iduka",
    ihuteFees: "Ihute 1% — iva ku iduka, ntiyongerwa ku wishyura wawe",
    taxes: "Imisoro",
    amountLogistics: "Amafaranga y'ubugendesheje",
    totalPay: "Igiciro cyose",
    sendOrder: "Ohereza itumiza",
    stockOnHandLabel: "Iboneka: {n}",
    stockExceededLine: "Wasabye {requested} — ariko muri sitoki hari {available} gusa.",
    stockExceededPayBlock: "Gabanya ingano uhujeje n'ibiri muri sitoki mbere yo kwishyura.",
    stockExceededSubmit: "Gabanya ingano uhujeje n'ibiri muri sitoki mbere yo kohereza.",
    deliveryPerson: "Umugendesheje",
    hobbies: "Ibyishimo",
    kmToShop: "Km kugera ku iduka",
    reviewers: "abasubirije",
    tapCouriers: "Kanda urebe abagendesheje 5 bari hafi y'iduka",
    closestToShop: "Bari hafi y'iduka",
    top5Available: "5 bahari",
    myOrders: "Ibyo natumije",
    viewMyOrders: "Reba ibyo natumije",
    signInForOrders: "Injira urebe ibyo watumije",
    signIn: "Injira",
    logOut: "Sohoka",
    reorderSplashTitle: "Turimo gutegura…",
    reorderSplashSub: "Turimo gukusanyiriza ibicuruzwa by'iri duka.",
    versionLabel: "Verisiyo",
    settingsModeHint: "Hitamo Umuguzi cyangwa Umucuruzi kugira ngo urebe ibijyanye. Umaze, kanda Funga.",
    settingsFormBuyerTitle: "Ibyo umuguzi ahitamo",
    settingsFormSellerTitle: "Iduka / Umucuruzi",
    settingsSellerIntro: "Hitamo aho ushaka kujya hepfo, umaze kanda Funga.",
    settingsApplyClose: "Funga",
    settingsOpenSellerHome: "Ikibaho",
    settingsOpenSellerOrders: "Amatumiza",
    settingsOpenSellerItems: "Ibicuruzwa na sitoki",
    settingsSellerNeedLogin: "Injira na konti y'iduka kugira ngo ukoreshe uburyo bw'umucuruzi.",
    settingsSellerTapDenied: "Injira na konti y'iduka kugira ngo ujye ku buryo bw'umucuruzi.",
    sellerDashBestSelling: "Igicuruzwa kigurishwa cyane",
    sellerDashBestSellingSubtitle: "Amakuru avuye ku bitumijwe byageze",
    sellerDashBestSellingEmpty:
      "Emeza ko ibitumijwe byageze kugira ngo urebe igicuruzwa kigurishwa cyane, ingano n'ibyo gusubiza muri sitoki.",
    sellerDashUnitsSold: "byagurishijwe",
    sellerDashLineRevenue: "Amafaranga yinjiye",
    sellerDashShareRevenue: "{{pct}}% y'amafaranga · {{rwf}}",
    sellerDashTopUpTitle: "Gusubiza muri sitoki",
    sellerDashTopUpSubtitle: "Ibikorwa bigufi bigufasha kuguma ufite ibicuruzwa bihagije mu iduka.",
    sellerDashBulletRestock: "Ongeraho muri sitoki: {{name}} — ingano {{units}} ku matumiza yageze.",
    sellerDashBulletPopular: "Nacyo kikunzwe: {{name}} ({{units}}).",
    sellerDashBulletFulfillQueue: "Ufite ibitumijwe {{n}} bitararangira — bikore byihuse kugira ngo ubone amakuru mashya.",
    sellerDashGrowthIdle: "Rangiza ibitumijwe bifite ibicuruzwa kugira ngo ubone amakuru y'ubucuruzi hano.",
    sellerDashCtaStock: "Sitoki n'ibicuruzwa",
    sellerDashCtaNikiStock: "Ongeraho sitoki (NIKI)",
    sellerDashCtaOrders: "Ibitumijwe",
    sellerDashDeliveredTail: "{{n}} yageze",
    payStepPanelTitle: "Rangiza kwishyura",
    payStepDemoNote: "",
    payStepCommissionNote:
      "1% ya Ihute yandikwa ku makuru y'itumiza (komisio y'ikompanyi, ku iduka; ntiyongerwa ku wishyura wawe).",
    payStepMtnTitle: "MTN MoMo",
    payStepMtnPayer: "Nimero ya MoMo (07…)",
    payStepMtnDial: "USSD — koporora ukore",
    payStepAirtelTitle: "Airtel Money",
    payStepAirtelPayer: "Nimero ya Airtel (07…)",
    payStepAirtelDial: "USSD — koporora ukore",
    payStepAirtelHelp: "Ishyura kuri *500# cyangwa muri app ya Airtel kuri nimero y'umucuruzi iri hejuru.",
    payStepBkTitle: "Ikarita (BK)",
    payStepBkHelp: "Andika amakuru y'ikarita yawe uko ibanki ibisaba.",
    payStepBkCardNumber: "Nimero y'ikarita",
    payStepBkExpiry: "Igihe irangirira (MM/YY)",
    payStepBkCvc: "CVC",
    payStepBkOtp: "OTP yoherejwe kuri SMS",
    payStepBkOtpSms: "Imibare 6 yoherejwe kuri telefoni yawe.",
    payStepBkPin: "PIN y'ibanki kuri telefoni",
    payStepBkPinHint: "Andika PIN y'ibanki yawe (imibare 4).",
    payStepCashTitle: "Kwishyura mu ntoki",
    payStepCashConfirm: "Nzishyura mu ntoki igihe nazakira ibyo natumije.",
    payStepCopy: "Koporora",
    payStepCopied: "Byakopoye",
    payStepErrPhone: "Andika nimero ya telefoni y'u Rwanda iboneye (07…).",
    payStepErrBkCard: "Andika imibare 13–16 ya nimero y'ikarita.",
    payStepErrBkExpiry: "Andika neza igihe irangirira (MM/YY, itararenza).",
    payStepErrBkCvc: "Andika imibare 3 cyangwa 4 ya CVC.",
    payStepErrBkOtp: "Andika imibare 6 ya OTP.",
    payStepErrBkPin: "Andika imibare 4 ya PIN.",
    payStepErrCash: "Emeza ko uzishyura mu ntoki kugira ngo ukomeze.",
    payStepMtnNoUssd: "Nimero ya MoMo y'umucuruzi ntiboneka — koresha nimero iri hejuru cyangwa ubaze iduka.",
    payStepMomoPin: "PIN",
    payStepAutoPayHintMtn: "Kwishyura gutangira uko gusa PIN ya MTN irangiye (imibare 5).",
    payStepAutoPayHintAirtel: "Kwishyura gutangira uko gusa PIN ya Airtel irangiye (imibare 4).",
    payStepProcessing: "Birimo gutunganywa…",
    payStepErrMtnPin: "Andika PIN ya MTN MoMo (imibare 5).",
    payStepErrAirtelPin: "Andika PIN ya Airtel Money (imibare 4).",
    payStepCardsAccepted: "Amakarita yemewe",
    payStepAfterCheckoutHint: "Uhabwa nimero y'itumiza na link yo gukurikirana — ntusabwe kwinjira mbere.",
    payStepReadMoMoSmsTitle: "Shyiraho SMS ya MoMo (kwemeza kwishyura)",
    payStepReadMoMoSmsHint:
      "Nyuma yo kwishyura, koporora ubutumwa bwa MTN ubushyire hano. Tugereranya amafaranga n'igiciro ({total} RWF).",
    payStepVerifySms: "Gereranya n'igiciro",
    payStepPaymentPaidMatched: "Byishyuwe — amafaranga muri SMS ahuye n'igiciro.",
    payStepPaymentPaidMatchedWithTxn:
      "Byishyuwe — amafaranga ahuye n'igiciro. Nimero y'ubwishyu: {txnId}.",
    payStepDialMomo: "Hamagara",
    payStepPaymentMismatch: "Ntibihuye — SMS irerekana {got} RWF ariko igiciro cyawe ni {expected} RWF.",
    payStepPaymentNoAmountInSms: "Nta mafaranga yabonetse — shyiraho SMS yose ya MoMo.",
    payStepSendOrderLocked:
      "Ishyura ukoresheje MoMo, shyiraho SMS y'ikimenyetso, noneho buto ya Ohereza izagaragara.",
    payStepErrMomoSms: "Emeza kwishyura ukoresheje SMS ya MoMo mbere yo kohereza itumiza.",
  },
  fr: {
    demoLocation: "Kacyiru, Gasabo — définition dans les réglages",
    titleHome: "Ishyiga Ihute",
    shopsPrefix: "Magasins ·",
    titleSummary: "Récapitulatif",
    titlePayment: "Mode de paiement",
    settings: "Réglages",
    settingsSub: "Langue, position, magasins et paiement",
    language: "Langue",
    langEn: "English",
    langRw: "Kinyarwanda",
    langFr: "Français",
    setLocation: "Définir ma position",
    locationCurrent: "Actuelle",
    noLocationYet: "Non défini — appuyez pour GPS ou district",
    preferredShops: "Magasins préférés",
    preferredHint: "Ils apparaissent en premier dans la liste.",
    paymentMode: "Mode de paiement préféré",
    payingTo: "Payer à",
    bankName: "Banque",
    account: "Compte",
    yourLocation: "Votre position",
    yourPhone: "Votre téléphone (livraison)",
    yourPhoneHint: "Le magasin vous joint sur ce numéro. Laissez vide pour utiliser le téléphone de votre compte Ihute si vous êtes connecté.",
    paymentGuestPhoneLabel: "Mobile Money & suivi",
    paymentGuestPhonePlaceholder: "07… · même numéro pour payer",
    paymentGuestPhoneNote: "Facultatif si vous êtes connecté avec un téléphone sur le compte.",
    orderSubmitNeedPhone: "Ajoutez votre mobile pour payer et recevoir les mises à jour.",
    eta: "Heure d'arrivée estimée",
    etaSub: "Depuis ~{km} km · livraison {mode}",
    etaSubNoMode: "À ~{km} km du magasin. Choisissez une livraison sur le récapitulatif pour voir l’heure d’arrivée.",
    paymentModeSection: "Mode de paiement",
    sortDistance: " Triés par distance.",
    shopsIntro: "Choisissez un magasin dans {cat}. Favoris et commandes passées en premier.{sort}",
    sectorPanelShops: "magasins",
    sectorPanelItems: "articles",
    footerHome: "Accueil",
    footerShops: "Magasins",
    footerItems: "Articles",
    footerSummary: "Récapitulatif",
    footerPay: "Payer",
    footerDashboard: "Ouvrir le tableau vendeur",
    footerDashboardShort: "Tableau",
    sectionLogistics: "Livraison · Logistique",
    logisticsNote:
      "Les frais utilisent la distance jusqu'à ce magasin ({km} km) et le mode choisi.",
    logisticsNotePickup:
      "Retrait au magasin : vous récupérez la commande sur place. Pas de frais de livraison (0 RWF).",
    fulfillmentSectionTitle: "Comment souhaitez-vous recevoir cette commande ?",
    fulfillmentDeliveryTitle: "Livraison",
    fulfillmentDeliverySub: "À mon adresse (frais de livraison).",
    fulfillmentPickupTitle: "Retrait au magasin",
    fulfillmentPickupSub: "Je viens chercher au magasin (sans frais de livraison).",
    fulfillmentDeliveryModesHint: "Choisissez le mode de transport :",
    etaAtShop: "Au magasin",
    etaPickupSub: "Retrait sur place — pas d’ETA coursier. Coordonnez-vous avec le vendeur après commande.",
    summaryLineItems: "Articles",
    summaryLineItemsTotal: "Total articles",
    summaryLineLogisticsRow: "Logistique",
    summaryLineGrandTotal: "Total général",
    preferredBadge: "Favori",
    logHuman: "À pied",
    logBike: "Vélo",
    logMoto: "Moto",
    amountShop: "Montant au magasin",
    ihuteFees: "Frais Ihute (1 %) — payés par la boutique, pas sur votre total",
    taxes: "Taxes",
    amountLogistics: "Montant logistique",
    totalPay: "Total à payer",
    sendOrder: "Envoyer la commande",
    stockOnHandLabel: "En stock : {n}",
    stockExceededLine: "Vous demandez {requested} — seulement {available} en stock.",
    stockExceededPayBlock: "Ajustez les quantités au stock avant de payer.",
    stockExceededSubmit: "Réduisez les quantités au stock disponible avant d’envoyer.",
    deliveryPerson: "Livreur",
    hobbies: "Loisirs",
    kmToShop: "km jusqu'au magasin",
    reviewers: "avis",
    tapCouriers: "Appuyez pour voir les 5 livreurs les plus proches",
    closestToShop: "Les plus proches du magasin",
    top5Available: "top 5 disponibles",
    myOrders: "Mes commandes",
    viewMyOrders: "Voir mes commandes",
    signInForOrders: "Connectez-vous pour voir vos commandes",
    signIn: "Connexion",
    logOut: "Déconnexion",
    reorderSplashTitle: "Ajout au panier…",
    reorderSplashSub: "Chargement des articles du magasin.",
    versionLabel: "Version",
    settingsModeHint:
      "Choisissez Acheteur ou Vendeur pour afficher le formulaire correspondant. Terminé pour revenir à l’app.",
    settingsFormBuyerTitle: "Préférences acheteur",
    settingsFormSellerTitle: "Boutique / vendeur",
    settingsSellerIntro: "Ouvrez un écran ci-dessous, ou Terminé puis utilisez la barre du bas.",
    settingsApplyClose: "Terminé",
    settingsOpenSellerHome: "Accueil boutique",
    settingsOpenSellerOrders: "File des commandes",
    settingsOpenSellerItems: "Articles & stock",
    settingsSellerNeedLogin: "Connectez-vous avec un compte boutique pour le mode vendeur.",
    settingsSellerTapDenied: "Compte boutique requis pour passer en mode vendeur.",
    sellerDashBestSelling: "Meilleure vente",
    sellerDashBestSellingSubtitle: "Données des commandes livrées",
    sellerDashBestSellingEmpty:
      "Marquez des commandes comme livrées pour voir votre produit n°1, les quantités et des idées de réassort.",
    sellerDashUnitsSold: "unités vendues",
    sellerDashLineRevenue: "CA lignes",
    sellerDashShareRevenue: "{{pct}}% du CA lignes · {{rwf}}",
    sellerDashTopUpTitle: "Top-up vente",
    sellerDashTopUpSubtitle: "Actions courtes pour garder le stock et fluidifier la file commandes.",
    sellerDashBulletRestock: "Réassort prioritaire : {{name}} — {{units}} unités sur commandes livrées.",
    sellerDashBulletPopular: "Bien vendu aussi : {{name}} ({{units}} unités).",
    sellerDashBulletFulfillQueue: "{{n}} commandes ouvertes — les traiter actualise ces indicateurs.",
    sellerDashGrowthIdle: "Livrez des commandes avec lignes produit pour activer ce panneau.",
    sellerDashCtaStock: "Stock & catalogue",
    sellerDashCtaNikiStock: "Ajouter stock (NIKI)",
    sellerDashCtaOrders: "Commandes ouvertes",
    sellerDashDeliveredTail: "{{n}} livrée(s)",
    payStepPanelTitle: "Compléter ce mode de paiement",
    payStepDemoNote: "",
    payStepCommissionNote:
      "La ligne 1 % Ihute est inscrite dans la référence de commande (commission société, côté boutique — pas sur votre total).",
    payStepMtnTitle: "MTN Mobile Money",
    payStepMtnPayer: "Compte portefeuille (07…)",
    payStepMtnDial: "USSD — copier & composer",
    payStepAirtelTitle: "Airtel Money",
    payStepAirtelPayer: "Compte portefeuille (07…)",
    payStepAirtelDial: "USSD — copier & composer",
    payStepAirtelHelp: "Payer via *500# ou l’app vers le numéro marchand ci-dessus.",
    payStepBkTitle: "Carte bancaire",
    payStepBkHelp: "Saisissez vos informations conformément aux instructions de votre banque.",
    payStepBkCardNumber: "Numéro de carte",
    payStepBkExpiry: "Expiration (MM/AA)",
    payStepBkCvc: "CVC",
    payStepBkOtp: "OTP reçu par SMS",
    payStepBkOtpSms: "Code au {mask} — 6 chiffres.",
    payStepBkPin: "PIN banque mobile",
    payStepBkPinHint: "PIN à 4 chiffres.",
    payStepCashTitle: "Paiement à la livraison",
    payStepCashConfirm: "Je paierai en espèces à la réception.",
    payStepCopy: "Copier",
    payStepCopied: "Copié",
    payStepErrPhone: "Indiquez un mobile rwandais valide (07…).",
    payStepErrBkCard: "Saisissez 13 à 16 chiffres pour la carte.",
    payStepErrBkExpiry: "Indiquez une date d’expiration valide (MM/AA, non expirée).",
    payStepErrBkCvc: "Indiquez 3 ou 4 chiffres pour le CVC.",
    payStepErrBkOtp: "Indiquez 6 chiffres pour l'OTP.",
    payStepErrBkPin: "Indiquez 4 chiffres pour le PIN.",
    payStepErrCash: "Cochez la confirmation paiement à la livraison.",
    payStepMtnNoUssd: "Code marchand MoMo manquant — utilisez le numéro ci-dessus ou contactez le magasin.",
    payStepMomoPin: "PIN portefeuille",
    payStepAutoPayHintMtn: "Le paiement démarre tout seul quand le PIN MTN MoMo à 5 chiffres est complet.",
    payStepAutoPayHintAirtel: "Le paiement démarre tout seul quand le PIN Airtel Money à 4 chiffres est complet.",
    payStepProcessing: "Traitement…",
    payStepErrMtnPin: "Saisissez le PIN MTN MoMo à 5 chiffres.",
    payStepErrAirtelPin: "Saisissez le PIN Airtel Money à 4 chiffres.",
    payStepCardsAccepted: "Cartes acceptées",
    payStepAfterCheckoutHint: "Vous recevez un n° de commande et un lien de suivi — achat sans compte possible.",
    payStepReadMoMoSmsTitle: "Collez le SMS MoMo (confirmation)",
    payStepReadMoMoSmsHint:
      "Après paiement, collez le SMS MTN. Nous comparons au total ({total} RWF).",
    payStepVerifySms: "Comparer au total",
    payStepPaymentPaidMatched: "Payé — le SMS correspond au total.",
    payStepPaymentPaidMatchedWithTxn:
      "Payé — montant conforme. TxId MoMo : {txnId}.",
    payStepDialMomo: "Composer",
    payStepPaymentMismatch: "Écart — SMS {got} RWF, total {expected} RWF.",
    payStepPaymentNoAmountInSms: "Aucun montant RWF — collez le SMS complet.",
    payStepSendOrderLocked:
      "Payez par MoMo, collez le SMS, puis le bouton Envoyer apparaîtra.",
    payStepErrMomoSms: "Confirmez le paiement MoMo avec le SMS avant d'envoyer.",
  },
}

type GrandmaSmsPayCheck = "paid" | "mismatch" | "no_amount" | null

function humanizeGrandmaOrderBackendError(raw: string, lang: GrandmaLang): string {
  if (!raw?.trim()) return raw
  const low = raw.toLowerCase()
  if (low.includes("buyer") && low.includes("null") && low.includes("ishyiga")) {
    return GRANDMA_LABELS[lang].orderSubmitNeedPhone
  }
  if (low.includes("cannot read field") && low.includes("ishyiga_account") && low.includes("buyer")) {
    return GRANDMA_LABELS[lang].orderSubmitNeedPhone
  }
  return raw
}

function readGrandmaPrefs(): { lang: GrandmaLang; payment: PaymentId; preferred: string[]; mode: AppMode } {
  if (typeof window === "undefined") {
    return { lang: "rw", payment: "momo", preferred: [], mode: "buyer" }
  }
  let lang: GrandmaLang = "rw"
  const lsLang = localStorage.getItem("grandma:lang")
  if (lsLang === "en" || lsLang === "rw" || lsLang === "fr") lang = lsLang
  let payment: PaymentId = "momo"
  const lsPay = localStorage.getItem("grandma:payment")
  if (lsPay === "momo" || lsPay === "airtel" || lsPay === "bk" || lsPay === "cash") payment = lsPay
  let preferred: string[] = []
  try {
    const raw = localStorage.getItem("grandma:preferredShops")
    if (raw) {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) preferred = parsed.filter((x): x is string => typeof x === "string")
    }
  } catch {
    /* ignore */
  }
  const lsMode = localStorage.getItem("grandma:mode")
  const mode: AppMode = lsMode === "seller" ? "seller" : "buyer"
  return { lang, payment, preferred, mode }
}

function shopPayReceivingAccount(shop: ShopEntry | null): { bankName: string; account: string } {
if (!shop) return { bankName: "—", account: "—" }
return {
bankName: shop.bankName ?? "Bank of Kigali",
account: shop.payoutAccount ?? shop.momo,
}
}

function getPaymentDetails(shop: ShopEntry | null, paymentMode: string): { bankName: string; account: string } {
if (!shop) return { bankName: "—", account: "—" }

switch (paymentMode) {
case "momo":
return {
bankName: "MTN MoMo",
account: stripShopMomoLabel(shop.momo ?? "") || "—",
}
case "airtel":
return {
bankName: "Airtel Money",
account: stripShopMomoLabel(shop.momo ?? "") || "—",
}
case "bk":
return {
bankName: shop.bankName ?? "Bank of Kigali",
account: shop.payoutAccount ?? "—"
}
case "cash":
return {
bankName: "Cash on Delivery",
account: "—"
}
default:
return shopPayReceivingAccount(shop)
}
}

function isGrandmaRwMobileDigits(raw: string): boolean {
  const n = normalizePhoneDigitsForAuth(raw.trim())
  return n.length === 12 && n.startsWith("2507")
}

const SHOP_LOGO_PATHS = [
"/img/shops/sawa.png",
"/img/shops/simba.png",
"/img/shops/spar.png",
"/img/shops/250strores.png",
] as const

/** Per-shop logos (override cycling assignment from `SHOP_LOGO_PATHS`) */
const SHOP_LOGO_OVERRIDE: Record<string, string> = {
  ph_rite: "/shops/rite-pharmacy-logo.png",
}

/** Set `NEXT_PUBLIC_GRANDMA_DEMO_SHOPS=1` in `.env.local` only if you want fake shops when the API returns none. */
const GRANDMA_SHOW_DEMO_SHOPS = process.env.NEXT_PUBLIC_GRANDMA_DEMO_SHOPS === "1"

const GRANDMA_NO_LIVE_SHOPS_HINT =
  "No shops for this category yet. Needs: LIVE account_seller and preferedcategories matching the sector (e.g. pharmacy → PHARMACY). Stock is only for product rows. Column name is preferedcategories (one r). Rebuild the WAR after backend changes."

/** Demo shops per category — only used when GRANDMA_SHOW_DEMO_SHOPS is on */
const MOCK_SHOPS: ShopEntry[] = (
  [
  {
    id: "bd1",
    name: "Mama Nadia",
    category: "Boutique",
    tagline: "Corner shop · drinks & bread",
    favorite: true,
    orderedBefore: true,
    trending: true,
    onSale: false,
    distanceKm: 0.8,
    momo: "MTN MoMo: 547255",
    rating: 4.8,
    reviewCount: 214,
    bankName: "Bank of Kigali",
    payoutAccount: "00012-9087654321",
  },
  {
    id: "bd2",
    name: "Kimisagara Mini Mart",
    category: "Boutique",
    tagline: "Open late",
    favorite: false,
    orderedBefore: true,
    trending: false,
    onSale: true,
    distanceKm: 2.1,
    momo: "MTN MoMo: 078***112",
  },
  {
    id: "bd3",
    name: "Nyamirambo Express",
    category: "Boutique",
    tagline: "Snacks & water",
    favorite: true,
    orderedBefore: false,
    trending: true,
    onSale: false,
    distanceKm: 3.4,
    momo: "Airtel: 073***901",
    rating: 4.5,
    reviewCount: 96,
  },
  {
    id: "sm1",
    name: "Ishyiga Market",
    category: "Supermarket",
    tagline: "Rice, oil, soap",
    favorite: true,
    orderedBefore: true,
    trending: true,
    onSale: false,
    distanceKm: 1.5,
    momo: "MTN MoMo: 540***220",
  },
  {
    id: "sm2",
    name: "City Basket",
    category: "Supermarket",
    tagline: "Weekly deals",
    favorite: false,
    orderedBefore: false,
    trending: true,
    onSale: true,
    distanceKm: 4.2,
    momo: "MTN MoMo: 079***445",
  },
  {
    id: "ph1",
    name: "PharmaCare Kacyiru",
    category: "Pharmacy",
    tagline: "Prescriptions & OTC",
    favorite: true,
    orderedBefore: true,
    trending: false,
    onSale: false,
    distanceKm: 2.0,
    momo: "MTN MoMo: 078***330",
  },
  {
    id: "ph2",
    name: "Remera Pharmacy",
    category: "Pharmacy",
    tagline: "Delivery in 30 min",
    favorite: false,
    orderedBefore: true,
    trending: true,
    onSale: true,
    distanceKm: 1.1,
    momo: "Airtel: 072***667",
  },
  {
    id: "ph_rite",
    name: "Rite Pharmacy",
    category: "Pharmacy",
    tagline: "Gisimenti branch · live products",
    favorite: true,
    orderedBefore: true,
    trending: true,
    onSale: false,
    distanceKm: 1.6,
    momo: "MTN MoMo: 079***816",
    bankName: "Bank of Kigali",
    payoutAccount: "RITE-00012-204",
    rating: 4.0,
    reviewCount: 254,
  },
  {
    id: "rs1",
    name: "Rolex House",
    category: "Restaurant",
    tagline: "Street food favorites",
    favorite: false,
    orderedBefore: true,
    trending: true,
    onSale: false,
    distanceKm: 0.9,
    momo: "MTN MoMo: 078***889",
  },
  {
    id: "rs_burrows",
    name: "Burrows",
    category: "Restaurant",
    tagline: "Live menu · testing",
    favorite: true,
    orderedBefore: true,
    trending: true,
    onSale: false,
    distanceKm: 0.4,
    momo: "MTN MoMo: 078***000",
  },
  {
    id: "rs2",
    name: "Lunch Box",
    category: "Restaurant",
    tagline: "Rice & beans daily",
    favorite: true,
    orderedBefore: false,
    trending: false,
    onSale: true,
    distanceKm: 2.7,
    momo: "MTN MoMo: 079***101",
  },
  {
    id: "lq1",
    name: "Skol Depot",
    category: "Liquor Store",
    tagline: "Cold beer",
    favorite: false,
    orderedBefore: true,
    trending: true,
    onSale: false,
    distanceKm: 1.8,
    momo: "MTN MoMo: 078***505",
  },
  {
    id: "lq2",
    name: "Weekend Cellar",
    category: "Liquor Store",
    tagline: "Weekend specials",
    favorite: false,
    orderedBefore: false,
    trending: false,
    onSale: true,
    distanceKm: 5.0,
    momo: "Airtel: 073***212",
  },
  {
    id: "bk1",
    name: "Warm Oven",
    category: "Bakery",
    tagline: "Fresh mandazi",
    favorite: true,
    orderedBefore: true,
    trending: true,
    onSale: false,
    distanceKm: 1.2,
    momo: "MTN MoMo: 078***414",
  },
  {
    id: "bk2",
    name: "Dawn Bread",
    category: "Bakery",
    tagline: "Morning batch",
    favorite: false,
    orderedBefore: false,
    trending: false,
    onSale: true,
    distanceKm: 3.0,
    momo: "MTN MoMo: 079***777",
  },
  {
    id: "vt1",
    name: "AgroVet Plus",
    category: "Veterinary",
    tagline: "Feed & basics",
    favorite: false,
    orderedBefore: true,
    trending: false,
    onSale: false,
    distanceKm: 4.5,
    momo: "MTN MoMo: 078***606",
  },
  {
    id: "vt2",
    name: "Livestock Corner",
    category: "Veterinary",
    tagline: "Bulk feed",
    favorite: true,
    orderedBefore: false,
    trending: true,
    onSale: true,
    distanceKm: 6.2,
    momo: "Airtel: 072***303",
  },
  {
    id: "ot1",
    name: "Corner Bits",
    category: "Others",
    tagline: "Household odds & ends",
    favorite: false,
    orderedBefore: true,
    trending: false,
    onSale: false,
    distanceKm: 2.3,
    momo: "MTN MoMo: 078***919",
  },
  {
    id: "ot2",
    name: "Everything Shop",
    category: "Others",
    tagline: "Matches, batteries…",
    favorite: false,
    orderedBefore: false,
    trending: true,
    onSale: true,
    distanceKm: 3.8,
    momo: "MTN MoMo: 079***424",
  },
  ] satisfies Omit<ShopEntry, "logoSrc">[]
).map((s, i) => ({
  ...s,
  logoSrc: SHOP_LOGO_OVERRIDE[s.id] ?? SHOP_LOGO_PATHS[i % SHOP_LOGO_PATHS.length],
}))

const SHOP_FILTER_TABS: { id: ShopFilterTab; label: string }[] = [
  { id: "favorites", label: "Favorites" },
  { id: "reorder", label: "Reorder" },
  { id: "trending", label: "Trending" },
  { id: "onsale", label: "On sale" },
]

const CATEGORIES: { name: Category; icon: string }[] = [
  { name: "Boutique", icon: "🏪" },
  { name: "Supermarket", icon: "🛒" },
  { name: "Pharmacy", icon: "💊" },
  { name: "Restaurant", icon: "🍽️" },
  { name: "Liquor Store", icon: "🍺" },
  { name: "Bakery", icon: "🥖" },
  { name: "Veterinary", icon: "🐾" },
  { name: "Others", icon: "◻️" },
]

/** Display names for the category grid + headers — follows Settings → Language */
const CATEGORY_LABELS: Record<GrandmaLang, Record<Category, string>> = {
  en: {
    Boutique: "Boutique",
    Supermarket: "Supermarket",
    Pharmacy: "Pharmacy",
    Restaurant: "Restaurant",
    "Liquor Store": "Liquor Store",
    Bakery: "Bakery",
    Veterinary: "Veterinary",
    Others: "Others",
  },
  rw: {
    Boutique: "Butike",
    Supermarket: "Alimantasiyo",
    Pharmacy: "Farumasi",
    Restaurant: "Resitora",
    "Liquor Store": "Inzoga",
    Bakery: "Imikati",
    Veterinary: "Amatungo",
    Others: "Ibindi",
  },
  fr: {
    Boutique: "Boutique",
    Supermarket: "Supermarché",
    Pharmacy: "Pharmacie",
    Restaurant: "Restaurant",
    "Liquor Store": "Boissons",
    Bakery: "Boulangerie",
    Veterinary: "Vétérinaire",
    Others: "Autres",
  },
}

function categoryLabel(cat: Category, lang: GrandmaLang): string {
  return CATEGORY_LABELS[lang][cat]
}

const INITIAL_PRODUCTS: Product[] = [
  { id: 1, category: "Boutique", name: "Inyange Milk", price: 500, emoji: "🥛", qty: 0 },
  { id: 2, category: "Boutique", name: "Sugar", price: 1250, emoji: "🧂", qty: 0 },
  { id: 3, category: "Boutique", name: "Mützig Beer", price: 1000, emoji: "🍺", qty: 0 },
  { id: 4, category: "Boutique", name: "Heineken 300ml", price: 1200, emoji: "🍾", qty: 0 },
  { id: 5, category: "Boutique", name: "Fanta Orange", price: 500, emoji: "🥤", qty: 0 },
  { id: 6, category: "Boutique", name: "Nyange Water 500ml", price: 300, emoji: "💧", qty: 0 },
  { id: 7, category: "Boutique", name: "Bread", price: 700, emoji: "🍞", qty: 0 },
  { id: 8, category: "Supermarket", name: "Rice", price: 1800, emoji: "🍚", qty: 0 },
  { id: 9, category: "Supermarket", name: "Cooking Oil", price: 2500, emoji: "🫗", qty: 0 },
  { id: 10, category: "Supermarket", name: "Soap", price: 800, emoji: "🧼", qty: 0 },
  { id: 11, category: "Pharmacy", name: "Paracetamol", price: 1000, emoji: "💊", qty: 0 },
  { id: 12, category: "Pharmacy", name: "ORS", price: 1500, emoji: "🧴", qty: 0 },
  { id: 13, category: "Restaurant", name: "Rolex", price: 1500, emoji: "🌯", qty: 0 },
  { id: 14, category: "Restaurant", name: "Rice & Beans", price: 2500, emoji: "🍛", qty: 0 },
  { id: 15, category: "Liquor Store", name: "Skol Lager", price: 900, emoji: "🍺", qty: 0 },
  { id: 16, category: "Bakery", name: "Mandazi", price: 200, emoji: "🥯", qty: 0 },
  { id: 17, category: "Veterinary", name: "Animal Feed", price: 4000, emoji: "🐄", qty: 0 },
  { id: 18, category: "Others", name: "Matches", price: 200, emoji: "🔥", qty: 0 },
]

const LOGISTICS: LogisticsOption[] = [
  { id: "human", icon: "🚶", label: "Human", baseRwf: 150, rwfPerKm: 85 },
  { id: "bike", icon: "🚲", label: "Bike", baseRwf: 200, rwfPerKm: 110 },
  { id: "moto", icon: "🏍", label: "Moto", baseRwf: 250, rwfPerKm: 145 },
]

const PAYMENTS: PaymentMode[] = [
  { id: "momo", label: "MTN MoMo", iconSrc: "/img/momo.png" },
  { id: "airtel", label: "Airtel Money", iconSrc: "/img/airtel.png" },
  { id: "bk", label: "Card (BK)", iconSrc: "/img/bk.png" },
  { id: "cash", label: "Cash on delivery", iconSrc: "/img/cash.png" },
]

/** Buyer grand total excludes this; fee is computed via {@link computeIhutePlatformFeeRwf} and stored on order REFERENCE. */
const TAXES_PLACEHOLDER = 0

function formatRwf(v: number): string {
  return `${Math.round(v).toLocaleString()} RWF`
}

function shopIdHash(id: string): number {
  if (!id) return 0
  return id.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)
}

function extractNumericPrice(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v
  const s = String(v ?? "").replace(/[^\d.]/g, "")
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

/** Uniquely identify a catalog line (avoids duplicate React keys when API repeats the same SKU). */
function liveItemDedupeKey(p: BurrowsApiProduct, rowIndex: number): string {
  const code = String(p.ITEM_CODE ?? p.item_code ?? p.item_key_words ?? "").trim()
  const state = String(p.item_state ?? "").trim()
  const packet = String(p.item_packet ?? "").trim()
  const price = String(p.selling_price ?? p.price ?? "").trim()
  const name = String(p.item_commercial_name ?? p.item_name ?? "").trim()
  const core = [code, state, packet, price, name].join("\u241e")
  return core || `__idx_${rowIndex}`
}

function emojiForRestaurantItem(name: string): string {
  const n = name.toLowerCase()
  if (/salad/.test(n)) return "🥗"
  if (/pizza/.test(n)) return "🍕"
  if (/rice/.test(n)) return "🍛"
  if (/burger/.test(n)) return "🍔"
  if (/avocado/.test(n)) return "🥑"
  if (/macaroni|pasta/.test(n)) return "🍝"
  if (/coffee/.test(n)) return "☕"
  return "🍽️"
}

function emojiForPharmacyItem(name: string): string {
  const n = name.toLowerCase()
  if (/syrup|sachet|oral/.test(n)) return "🧴"
  if (/cream|ointment|gel/.test(n)) return "🧪"
  if (/inject|ampoule|vial/.test(n)) return "💉"
  if (/tablet|capsule|comp\.|mg|ml/.test(n)) return "💊"
  return "💊"
}

function emojiForLiveCategory(category: Category, name: string): string {
  if (category === "Pharmacy") return emojiForPharmacyItem(name)
  return emojiForRestaurantItem(name)
}

const PHARMACY_PLACEHOLDER_IMAGES = [
  "/pharmacy-medicine-pills-bottles.jpg",
  "/paracetamol-medicine-pills.jpg",
  "/aspirin-medicine-pills.jpg",
  "/ibuprofen-medicine-tablets.jpg",
  "/cough-syrup-bottle.jpg",
  "/vitamin-c-supplement-bottle.jpg",
  "/bandages-medical-pack.jpg",
  "/digital-thermometer.png",
  "/hand-sanitizer-bottle.jpg",
  "/medical-face-masks-box.jpg",
  "/medicines/amoxicillin.png",
] as const

const RESTAURANT_PLACEHOLDER_IMAGES = ["/restaurant-food-dining-bar.jpg", "/coffee-shop-cafe-espresso.jpg"] as const

/** Spread placeholder picks so nearby list items rarely share the same stock photo. */
function placeholderMixIndex(seed: string, modulo: number): number {
  const a = Math.abs(shopIdHash(seed))
  const b = Math.abs(shopIdHash([...seed].reverse().join("")))
  const c = seed.length * 2654435761
  return Math.abs((a ^ b ^ c) >>> 0) % modulo
}

function livePlaceholderImageUrl(category: Category, seed: string): string {
  if (category === "Pharmacy") {
    const i = placeholderMixIndex(seed, PHARMACY_PLACEHOLDER_IMAGES.length)
    return PHARMACY_PLACEHOLDER_IMAGES[i]
  }
  if (category === "Restaurant") {
    const i = placeholderMixIndex(seed, RESTAURANT_PLACEHOLDER_IMAGES.length)
    return RESTAURANT_PLACEHOLDER_IMAGES[i]
  }
  return "/placeholder.jpg"
}

/** Same resolution as `/shop-with-me` (enriched URL → KAOS per NIKI code → none). */
function liveCatalogThumbUrl(
  p: BurrowsApiProduct,
  category: Category,
  nickname: string,
  dedupeKey: string,
  displayName: string
): string {
  const resolved = getProductImageSrc(p as Record<string, unknown>)
  if (resolved !== NO_IMAGE_URL) return resolved
  return livePlaceholderImageUrl(category, `${nickname}\u241e${dedupeKey}\u241e${displayName}`)
}

function offerId(shopId: string, productId: number): string {
  return `${shopId}::${productId}`
}

const FILTER_MENU_OTHER = "Other"
/** Canonical bucket for menu filter state / OfferRow (lowercase). */
const MENU_FILTER_OTHER_CANON = "other"

/**
 * Same rules as `components/shop-with-me.tsx` → `categorizeProduct` when famille is missing.
 */
function categorizeBurrowsApiProduct(p: BurrowsApiProduct): string {
  const keywords = String(p.item_key_words || "").toLowerCase()
  const itemState = String(p.item_state || "").toLowerCase()
  const name = String(p.item_commercial_name || p.item_name || "").toLowerCase()

  if (keywords.includes("wine") || itemState.includes("wine") || name.includes("wine")) return "Wine"
  if (
    keywords.includes("beer") ||
    itemState.includes("beer") ||
    name.includes("beer") ||
    keywords.includes("lager") ||
    name.includes("lager")
  ) {
    return "Beer"
  }
  if (
    keywords.includes("gin") ||
    keywords.includes("vodka") ||
    keywords.includes("whisky") ||
    keywords.includes("rum") ||
    keywords.includes("tequila") ||
    itemState.includes("liquor") ||
    name.includes("gin") ||
    name.includes("vodka")
  ) {
    return "Spirits"
  }
  if (keywords.includes("bread") || keywords.includes("cake") || keywords.includes("bakery") || itemState.includes("bakery")) {
    return "Bakery"
  }
  if (keywords.includes("snack") || keywords.includes("chips") || keywords.includes("crisp")) return "Snacks"
  if (
    keywords.includes("juice") ||
    keywords.includes("soda") ||
    keywords.includes("water") ||
    keywords.includes("drink") ||
    itemState.includes("beverage")
  ) {
    return "Beverages"
  }
  if (keywords.includes("food") || keywords.includes("meal") || itemState.includes("food")) return "Food"
  return "Other"
}

/**
 * Match `shop-with-me` section grouping: famille/FAMILLE first, else API category, else keyword fallback.
 */
function resolveLiveMenuSectionCategory(p: BurrowsApiProduct): string {
  const fam = p.famille ?? p.FAMILLE
  if (fam != null && String(fam).trim()) return String(fam).trim()
  const cat = p.category
  if (cat != null && String(cat).trim()) return String(cat).trim()
  return categorizeBurrowsApiProduct(p)
}

function menuCategoryCanon(raw: string | null | undefined): string {
  const s = String(raw ?? "").trim().replace(/\s+/g, " ")
  if (!s) return MENU_FILTER_OTHER_CANON
  return s.toLowerCase()
}

function menuCategoryTitleFromCanon(canon: string): string {
  if (canon === MENU_FILTER_OTHER_CANON) return FILTER_MENU_OTHER
  return canon
    .split(" ")
    .map((w) => (w.length ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ")
}

function priceHistogramCounts(prices: number[], binCount: number): number[] {
  const bins = Array.from({ length: binCount }, () => 0)
  if (!prices.length) return bins
  const lo = Math.min(...prices)
  const hi = Math.max(...prices)
  if (hi <= lo) {
    bins[Math.floor(binCount / 2)] = prices.length
    return bins
  }
  for (const p of prices) {
    const t = (p - lo) / (hi - lo)
    const i = Math.min(binCount - 1, Math.floor(t * binCount))
    bins[i] += 1
  }
  return bins
}

function productMatchesMenuCategory(p: Product, selectedCanon: string | null): boolean {
  if (selectedCanon == null) return true
  if (p.qty > 0) return true
  // Supplier Redis catalog rows often have no `liveCategory`; menu filter would hide all rows.
  if (!p.liveCategory?.trim()) return true
  return menuCategoryCanon(p.liveCategory) === selectedCanon
}

function offerMatchesMenuCategory(o: OfferRow, selectedCanon: string | null): boolean {
  if (selectedCanon == null) return true
  const ok = o.productMenuCategory ?? MENU_FILTER_OTHER_CANON
  return ok === selectedCanon
}

function shopProductPriceRwf(shop: ShopEntry, product: Product): number {
  const h = Math.abs(shopIdHash(`${shop.id}-${product.id}`))
  // Deterministic per-shop offer points in 25 RWF steps (e.g. 500, 525, 600…)
  // This is intentional for the "ALL shops" mode so the same item differs by shop.
  const deltas = [0, 25, 50, 75, 100, 125, 150] as const
  const delta = deltas[h % deltas.length]
  // occasional discount for variety
  const discount = h % 9 === 0 ? 25 : 0
  return Math.max(25, product.price + delta - discount)
}

const OFFERS_PER_PRODUCT = 3

/** Full supplier catalog for page 3 — must match product-grid / Kaos (not the old 50-row cap). */
const GRANDMA_SUPPLIER_CATALOG_LIMIT = 10_000

type GrandmaInventoryLine = {
  id: number
  itemName: string
  nikiCode: string
  quantity: number
  salePrice: number
  costPrice: number
}

function parseStockQtyValue(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === "") return null
  if (typeof raw === "boolean") return raw ? null : 0
  const n = Math.floor(Number(String(raw).replace(/,/g, "").trim()))
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

function stockQtyFromCatalogRow(row: Record<string, unknown>): number | null {
  for (const key of [
    "QUANTITY",
    "quantity",
    "QTY",
    "qty",
    "stock",
    "STOCK",
    "STOCK_QTY",
    "item_qty",
    "ITEM_QTY",
    "available_qty",
    "AVAILABLE_QTY",
  ]) {
    const v = parseStockQtyValue(row[key])
    if (v != null) return v
  }
  return null
}

/** Known stock cap for cart clamping; null = unknown (do not cap). */
function productStockOnHand(p: Product): number | null {
  if (typeof p.stockQty === "number" && Number.isFinite(p.stockQty)) {
    return Math.max(0, Math.floor(p.stockQty))
  }
  if (p.liveInStock === false) return 0
  return null
}

function clampQtyForProduct(p: Product, qty: number): number {
  const cap = productStockOnHand(p)
  const safe = Math.max(0, Math.floor(Number(qty) || 0))
  if (cap == null) return safe
  return Math.min(safe, cap)
}

/** Stable React/cart id per DB stock line (not per SKU — multiple lots stay separate). */
function grandmaProductIdFromStockLine(baseSupplierId: string, line: GrandmaInventoryLine): number {
  if (Number.isFinite(line.id) && line.id > 0) return 1_000_000 + Math.floor(line.id)
  const seed = `${baseSupplierId}:${line.nikiCode}:${line.itemName}:${line.salePrice}`
  return 1_000_000 + (Math.abs(shopIdHash(seed)) % 899_000)
}

/** Stable demo rating per shop until API provides `rating` */
function shopDisplayRating(s: ShopEntry): number {
  if (s.rating != null) return s.rating
  const h = Math.abs(shopIdHash(s.id))
  return Number((3.6 + (h % 14) / 10).toFixed(1))
}

function shopDisplayReviews(s: ShopEntry): number {
  if (s.reviewCount != null) return s.reviewCount
  const h = Math.abs(shopIdHash(s.id))
  return 12 + (h % 280)
}

function logisticsQuote(opt: LogisticsOption, distanceKm: number): number {
  const km = Math.max(0, distanceKm)
  return Math.round(opt.baseRwf + opt.rwfPerKm * km)
}

/**
 * ETA window (minutes): prep + travel by distance & mode.
 * Human (walk) is slowest per km; moto fastest — same short trip must not beat motorbike on foot.
 */
function deliveryEtaRange(distanceKm: number, mode: LogisticsId | null): { lo: number; hi: number } {
  const km = Math.max(0, distanceKm)
  const kmEff = Math.max(0.2, km)
  const prepMin = 7
  const minPerKm =
    mode === "human"
      ? 11
      : mode === "bike"
        ? 3.8
        : mode === "moto"
          ? 1.65
          : 4.5
  const travelMin = kmEff * minPerKm
  const core = prepMin + travelMin
  const lo = Math.round(core * 0.86)
  const hi = Math.round(core * 1.16)
  return {
    lo: Math.max(mode === "human" ? 13 : 8, lo),
    hi: Math.max(lo + 4, hi),
  }
}

type CourierProfile = {
  id: string
  name: string
  avatarEmoji: string
  hobbies: string
  rating: number
  reviewCount: number
  /** km from courier to pickup shop (demo — replace with live GPS) */
  distanceToShopKm: number
}

// Dynamic courier fetching function
const fetchAvailableCouriers = async (shopLocation?: { lat: number; lng: number }): Promise<CourierProfile[]> => {
  try {
    // TODO: Replace with actual API endpoint for couriers
    // For now, return empty array or mock data until API is ready
    console.log('Fetching available couriers for location:', shopLocation)
    
    // Example API call (replace with actual endpoint):
    // const response = await fetch(`/api/couriers?lat=${shopLocation?.lat}&lng=${shopLocation?.lng}`)
    // const couriers = await response.json()
    // return couriers.map(transformCourierData)
    
    // Return empty array until API is implemented
    return []
  } catch (error) {
    console.error('Failed to fetch couriers:', error)
    return []
  }
}

// Transform courier data from API to CourierProfile format
const transformCourierData = (courier: any): CourierProfile => {
  return {
    id: courier.id || courier.driver_id,
    name: courier.name || courier.driver_name,
    avatarEmoji: courier.avatar_emoji || "",
    hobbies: courier.hobbies || courier.bio || "Delivery specialist",
    rating: courier.rating || courier.rating_star || 4.0,
    reviewCount: courier.review_count || courier.total_ratings || 0,
    distanceToShopKm: courier.distance_to_shop || courier.distance_km || 0,
  }
}

// Fallback empty courier pool for when API is not ready
const COURIER_POOL: CourierProfile[] = []

function courierStarGlyphs(rating: number): string {
  const f = Math.min(5, Math.max(0, Math.round(rating)))
  return "".repeat(f) + "".repeat(5 - f)
}

type PrescriptionSlot = { id: string; file: File; url: string }

type PageId = 1 | 2 | 3 | 4 | 5
type SellerOrderStatus = "new" | "paid" | "preparing" | "sent" | "rejected"
type SellerViewFilter = "open" | "served" | "rejected"
type SellerOrder = {
  id: string
  ref: string
  /** Full delivery / buyer address line for display */
  area: string
  /** Buyer display name from backend (BUYER_NAMES, BUYER_OWNER, …) */
  buyerName: string
  /** Buyer phone for display and tel/sms links */
  buyerPhone: string
  /** Optional delivery / logistics fee from backend (served-order sales tile). */
  deliveryFeeRwf?: number
  /** Minutes since order time (when backend sends a timestamp). */
  remainingMin: number
  distanceKm: number
  logisticsIcon: string
  amountRwf: number
  paymentIconSrc?: string
  paymentStatus?: "paid" | "pending" | "failed"
  paymentTime?: string
  paymentLabel?: string
  paymentCode?: string
  transactionId?: string
  /** From shared server meta (seller marked payment / pending). */
  sellerPaymentAck?: "paid" | "pending"
  /** True when BUYER_LOCATION was merged from buyer track / client-meta. */
  buyerDeliveryFromBuyerSync?: boolean
  lines: { icon: string; name: string; qty: number; totalRwf?: number }[]
  status: SellerOrderStatus
}

function mapBackendOrderStatusToSellerStatus(raw: string): SellerOrderStatus {
  const s = (raw || "").toLowerCase().trim()
  if (s.includes("reject") || s.includes("cancel")) return "rejected"
  if (s === "delivered" || s === "completed" || s.includes("closed") || s === "sent") return "sent"
  if (s === "processing" || s === "preparing" || s === "invoice" || s === "in-transit") return "preparing"
  if (s === "paid" || s === "paid_in_full") return "paid"
  return "new"
}

function formatSellerOrderDateTime(value: unknown): string {
  if (value == null || value === "") return ""
  const s = String(value).trim()
  if (!s) return ""
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) return s.replace(/\.\d+Z?$/i, "").slice(0, 19)
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  const h = String(d.getHours()).padStart(2, "0")
  const min = String(d.getMinutes()).padStart(2, "0")
  const sec = String(d.getSeconds()).padStart(2, "0")
  return `${y}-${m}-${day} ${h}:${min}:${sec}`
}

function parseSellerOrderTimeMs(value: unknown): number {
  if (value == null || value === "") return Date.now()
  let s = String(value).trim()
  if (!s) return Date.now()
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s)) s = s.replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})/, "$1T$2")
  const t = Date.parse(s)
  return Number.isNaN(t) ? Date.now() : t
}

function pickFirstNonEmptyString(raw: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = raw[k]
    const s = String(v ?? "").trim()
    if (s) return s
  }
  return ""
}

/**
 * Prefer delivery / buyer location (backend spellings vary).
 * When buyer updated address on track (`/api/orders/client-meta`), list merge sets `_buyerAddressFromSync`
 * and `BUYER_LOCATION` — that must win over stale `DELIVERY_LOCATION` from `listSellerOrders`.
 */
function pickBuyerDeliveryAddress(raw: Record<string, unknown>): string {
  if (raw._buyerAddressFromSync) {
    const synced = String(raw.BUYER_LOCATION ?? raw.buyer_location ?? "").trim()
    if (synced) return synced
  }
  return pickFirstNonEmptyString(raw, [
    "DELIVERY_LOCATION",
    "delivery_location",
    "BUYER_LOCATION",
    "buyer_location",
    "BUYER_ADDRESS",
    "buyer_address",
    "DELIVERY_ADDRESS",
    "delivery_address",
  ])
}

function pickBuyerDisplayName(raw: Record<string, unknown>): string {
  return pickFirstNonEmptyString(raw, [
    "BUYER_NAMES",
    "BUYER_NAME",
    "buyer_name",
    "BUYER_OWNER",
    "buyer_owner",
    "BUYER_OWNER_NAME",
    "buyerOwnerName",
    "BUYER_FULL_NAME",
    "buyerFullName",
  ])
}

function pickBuyerPhone(raw: Record<string, unknown>): string {
  return pickFirstNonEmptyString(raw, [
    "BUYER_PHONE",
    "BUYER_TEL",
    "buyer_phone",
    "buyer_tel",
    "BUYER_TEL1",
    "BUYER_MOBILE",
    "TEL",
    "PHONE",
    "phone",
  ])
}

function sellerOrderTelHref(phone: string): string {
  const t = phone.trim()
  if (!t) return "#"
  const e164 = normalizeRwandaMobileE164(t)
  if (e164) return `tel:${e164}`
  const d = digitsOnly(t)
  if (d.length >= 9) return `tel:+${d}`
  return `tel:${encodeURIComponent(t)}`
}

function sellerOrderSmsHref(phone: string): string {
  const t = phone.trim()
  if (!t) return "#"
  const e164 = normalizeRwandaMobileE164(t)
  if (e164) return `sms:${e164}`
  const d = digitsOnly(t)
  if (d.length >= 9) return `sms:+${d}`
  return `sms:${encodeURIComponent(t)}`
}

/** WhatsApp — opens app for chat / voice / video call (user chooses in WhatsApp). */
function sellerOrderWhatsAppHref(phone: string): string {
  const t = phone.trim()
  if (!t) return "#"
  let d = digitsOnly(t)
  if (d.startsWith("250") && d.length >= 12) return `https://wa.me/${d}`
  if (d.length === 10 && d.startsWith("0")) d = `250${d.slice(1)}`
  if (d.length === 9 && (d.startsWith("7") || d.startsWith("8"))) d = `250${d}`
  if (d.length >= 11) return `https://wa.me/${d}`
  return "#"
}

type ServedSkuAgg = { name: string; units: number; revenueRwf: number }

function aggregateServedOrderProducts(orders: SellerOrder[]): {
  ranked: ServedSkuAgg[]
  totalLineRevenue: number
} {
  const served = orders.filter((o) => o.status === "sent")
  const byKey = new Map<string, ServedSkuAgg>()
  let totalLineRevenue = 0
  for (const o of served) {
    for (const L of o.lines) {
      const name = (L.name || "Item").trim() || "Item"
      const qty = Math.max(0, Number(L.qty) || 0)
      const lineRev = Math.max(0, L.totalRwf ?? 0)
      totalLineRevenue += lineRev
      const key = name.toLowerCase()
      const cur = byKey.get(key) ?? { name, units: 0, revenueRwf: 0 }
      cur.name = name
      cur.units += qty
      cur.revenueRwf += lineRev
      byKey.set(key, cur)
    }
  }
  const ranked = [...byKey.values()].sort((a, b) => {
    if (b.units !== a.units) return b.units - a.units
    return b.revenueRwf - a.revenueRwf
  })
  return { ranked, totalLineRevenue }
}

function mapRawSellerOrderToGrandma(raw: Record<string, unknown>): SellerOrder {
  const id = String(raw.ID_ORDER ?? raw.id_order ?? raw.id ?? "").trim() || `tmp-${Date.now()}`
  const createdRaw =
    raw.heure ?? raw.HEURE ?? raw.CREATED_AT ?? raw.created_at ?? raw.ORDER_DATE ?? raw.order_date
  const createdStr = formatSellerOrderDateTime(createdRaw)
  const ageMin = Math.max(0, Math.floor((Date.now() - parseSellerOrderTimeMs(createdRaw)) / 60_000))

  const amount = Number(raw.AMOUNT ?? raw.amount ?? 0)
  const deliveryFeeRaw = Number(
    raw.DELIVERY_FEE ?? raw.delivery_fee ?? raw.LOGISTICS_FEE ?? raw.logistics_fee ?? raw.DELIVERY ?? 0,
  )
  const buyerLoc = pickBuyerDeliveryAddress(raw)
  const buyerName = pickBuyerDisplayName(raw)
  const buyerPhone = pickBuyerPhone(raw)
  const orderNumber = String(raw.ORDER_NUMBER ?? raw.order_number ?? "").trim()
  const ref = orderNumber || id

  const items = Array.isArray(raw.items) ? (raw.items as Record<string, unknown>[]) : []
  const lines = items.map((it) => {
    const qty = Number(it.QUANTITY ?? it.qty ?? 0)
    const unit = Number(it.UNIT_PRICE ?? it.unitPrice ?? it.price ?? 0)
    const total = Number(it.total ?? qty * unit)
    const name = String(it.ITEM_NAME ?? it.name ?? "Item").trim() || "Item"
    const lineTotal = total > 0 ? total : qty * unit
    return { icon: "📦", name, qty, totalRwf: lineTotal > 0 ? lineTotal : undefined }
  })

  const paymentName = String(raw.PAYMENT_NAME ?? raw.payment_name ?? "").trim()
  const paymentStatusRaw = String(raw.PAYMENT_STATUS ?? raw.payment_status ?? "").toUpperCase()
  let paymentStatus: "paid" | "pending" | "failed" = "pending"
  if (/(PAID|SUCCESS|UMUSADA)/i.test(paymentStatusRaw)) paymentStatus = "paid"
  if (/(FAIL|REJECT)/i.test(paymentStatusRaw)) paymentStatus = "failed"

  const paymentLabel = [paymentName, paymentStatusRaw].filter(Boolean).join(" · ") || paymentName || ""

  let paymentIconSrc: string | undefined
  if (/momo|mtn/i.test(paymentName)) paymentIconSrc = "/img/momo.png"
  else if (/airtel/i.test(paymentName)) paymentIconSrc = "/img/airtel.png"
  else if (/cash|cod|delivery/i.test(paymentName)) paymentIconSrc = "/img/cash.png"

  const rekisi = String(raw.REKISI_STATUS ?? raw.rekisi_status ?? raw.LOGISTICS ?? "").toLowerCase()
  let logisticsIcon = "🚚"
  if (rekisi.includes("bike") || rekisi.includes("bicycle")) logisticsIcon = "🚲"
  if (rekisi.includes("moto") || rekisi.includes("motor")) logisticsIcon = "🏍"
  if (rekisi.includes("walk") || rekisi.includes("human")) logisticsIcon = "🚶"

  const os = mapBackendOrderStatusToSellerStatus(String(raw.ORDER_STATUS ?? raw.order_status ?? "open"))

  const sellerAckRaw = String(raw._sellerPaymentAck ?? "").toLowerCase()
  let sellerPaymentAck: "paid" | "pending" | undefined
  if (sellerAckRaw === "paid") sellerPaymentAck = "paid"
  else if (sellerAckRaw === "pending") sellerPaymentAck = "pending"

  const buyerDeliveryFromBuyerSync = Boolean(raw._buyerAddressFromSync)

  return {
    id,
    ref,
    area: buyerLoc || "—",
    buyerName,
    buyerPhone,
    buyerDeliveryFromBuyerSync,
    deliveryFeeRwf: Number.isFinite(deliveryFeeRaw) && deliveryFeeRaw > 0 ? deliveryFeeRaw : undefined,
    remainingMin: ageMin,
    distanceKm: 0,
    logisticsIcon,
    amountRwf: amount,
    paymentIconSrc,
    paymentStatus,
    paymentTime: createdStr || undefined,
    paymentLabel: paymentLabel || undefined,
    paymentCode: String(raw.PAYMENT_CODE ?? raw.payment_code ?? "").trim() || undefined,
    transactionId: String(raw.TRANSACTION_ID ?? raw.transaction_id ?? "").trim() || undefined,
    sellerPaymentAck,
    lines,
    status: os,
  }
}

export default function GrandmaPage() {
  const router = useRouter()
  const locationData = useLocationStoreEnhanced((s) => s.location)
  const [page, setPage] = useState<PageId>(1)
  const [category, setCategory] = useState<Category>("Boutique")
  const [search, setSearch] = useState("")
  const [shopSearch, setShopSearch] = useState("")
  /** Seller accounts (uppercase) returned by global product search — shops are included if they sell matching items. */
  const [shopProductSearchAccounts, setShopProductSearchAccounts] = useState<string[]>([])
  const [shopProductSearchLoading, setShopProductSearchLoading] = useState(false)
  /** Shop ids the buyer has successfully ordered from on this device (localStorage). */
  const [grandmaOrderedShopIds, setGrandmaOrderedShopIds] = useState<string[]>([])
  /** SELLER_ISHYIGA_ACCOUNT keys (uppercase) from buyer order history — powers Reorder when LS is empty. */
  const [reorderHistorySellerKeys, setReorderHistorySellerKeys] = useState<string[]>([])
  /** Sellers that had discounted catalog hits in sector-wide search probes — powers On sale. */
  const [onsaleSellerAccounts, setOnsaleSellerAccounts] = useState<string[]>([])
  const [shopTab, setShopTab] = useState<ShopFilterTab | null>(null)
  const [useLocationSort, setUseLocationSort] = useState(false)
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null)
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS)
  const [burrowsLiveCount, setBurrowsLiveCount] = useState<number>(0)
  const [burrowsLiveLoading, setBurrowsLiveLoading] = useState(false)
  const [burrowsLiveError, setBurrowsLiveError] = useState<string | null>(null)
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false)
  const [imagePreviewSrc, setImagePreviewSrc] = useState<string>("")
  const [imagePreviewTitle, setImagePreviewTitle] = useState<string>("")
  const [selectedLogistics, setSelectedLogistics] = useState<LogisticsId>("moto")
  const [fulfillmentMode, setFulfillmentMode] = useState<FulfillmentMode>("delivery")
  const [appMode, setAppMode] = useState<AppMode>("buyer")
  const [sellerView, setSellerView] = useState<SellerView>("home")
  const language = useLanguageStore((s) => s.language) as GrandmaLang
  const setLanguage = useLanguageStore((s) => s.setLanguage)
  const [preferredShopIds, setPreferredShopIds] = useState<string[]>([])
  const [selectedPayment, setSelectedPayment] = useState<PaymentId>("momo")
  const [grandmaCashConfirm, setGrandmaCashConfirm] = useState(false)
  const [stockQtyAttempts, setStockQtyAttempts] = useState<Record<number, number>>({})
  const [grandmaMomoSmsPaste, setGrandmaMomoSmsPaste] = useState("")
  const [grandmaSmsPayCheck, setGrandmaSmsPayCheck] = useState<GrandmaSmsPayCheck>(null)
  const [grandmaSmsMatchResult, setGrandmaSmsMatchResult] = useState<MoMoSmsMatchResult | null>(
    null
  )
  const [grandmaUssdCopied, setGrandmaUssdCopied] = useState(false)
  const [prefsHydrated, setPrefsHydrated] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  /** Mode highlighted in settings sheet (can be Seller before login succeeds). */
  const [settingsModePick, setSettingsModePick] = useState<AppMode>("buyer")
  const [settingsSellerGuardMsg, setSettingsSellerGuardMsg] = useState<string | null>(null)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [itemsSort, setItemsSort] = useState<ItemsSortId>("default")
  const [liveInStockOnly, setLiveInStockOnly] = useState(false)
  const [itemsMenuCategoryKey, setItemsMenuCategoryKey] = useState<string | null>(null)
  const [priceRangeRwf, setPriceRangeRwf] = useState<[number, number] | null>(null)
  const [locationDialogOpen, setLocationDialogOpen] = useState(false)
  const [orderNotes, setOrderNotes] = useState("")
  const [grandmaBuyerPhoneInput, setGrandmaBuyerPhoneInput] = useState("")
  const [grandmaOrderSubmitting, setGrandmaOrderSubmitting] = useState(false)
  const [grandmaOrderSubmitError, setGrandmaOrderSubmitError] = useState<string | null>(null)
  const grandmaOrderSubmitGuardRef = useRef(false)
  const [pendingReorder, setPendingReorder] = useState<GrandmaReorderPayload | null>(null)
  const [reorderSplashOpen, setReorderSplashOpen] = useState(false)
  /** True while fetchProducts() has started (sync) — apply-reorder effect must wait (React state may lag one frame). */
  const productFetchInFlightRef = useRef(false)
  const [prescriptionSlots, setPrescriptionSlots] = useState<PrescriptionSlot[]>([])
  const prescriptionInputRef = useRef<HTMLInputElement>(null)
  const [courierModalOpen, setCourierModalOpen] = useState(false)
  const [assignedCourierId, setAssignedCourierId] = useState<string | null>(null)
  const [sellerOnline, setSellerOnline] = useState(true)
  const [sellerOrders, setSellerOrders] = useState<SellerOrder[]>([])
  const [sellerOrdersLoading, setSellerOrdersLoading] = useState(false)
  const [sellerOrdersError, setSellerOrdersError] = useState<string | null>(null)
  const [sellerFilter, setSellerFilter] = useState<SellerViewFilter>("open")
  const [expandedSellerOrderId, setExpandedSellerOrderId] = useState<string | null>(null)
  const [sellerInventoryKpi, setSellerInventoryKpi] = useState<{ units: number; valueRwf: number }>({
    units: 0,
    valueRwf: 0,
  })
  const [sellerPaymentLocal, setSellerPaymentLocal] = useState<Record<string, "paid" | "pending">>({})
  
  // API state for real data
  const [apiShops, setApiShops] = useState<ShopEntry[]>([])
  const [shopsLoading, setShopsLoading] = useState(false)
  const [shopsError, setShopsError] = useState<string | null>(null)
  const [apiProducts, setApiProducts] = useState<Product[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [productsError, setProductsError] = useState<string | null>(null)
  
  // All available shops for settings (across all categories)
  const [allAvailableShops, setAllAvailableShops] = useState<ShopEntry[]>([])
  const [allShopsLoading, setAllShopsLoading] = useState(false)
  const [allShopsError, setAllShopsError] = useState<string | null>(null)
  /** Full per-sector item totals (Kaos `sectorStats`) for Home cards. */
  const [homeSectorItemsByCategory, setHomeSectorItemsByCategory] = useState<Partial<Record<Category, number>>>({})
  const [homeSectorItemsLoading, setHomeSectorItemsLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setHomeSectorItemsLoading(true)
    void (async () => {
      const next: Partial<Record<Category, number>> = {}
      await Promise.all(
        CATEGORIES.map(async (c) => {
          const slug = GRANDMA_CATEGORY_TO_SECTOR_SLUG[c.name]
          const s = await fetchSectorStatsFromApi(slug)
          if (!cancelled) next[c.name] = s.items
        }),
      )
      if (!cancelled) {
        setHomeSectorItemsByCategory(next)
        setHomeSectorItemsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  /** Debounced global product search so shop list can include stores that sell the query (e.g. “milk”), not only name/tagline matches. */
  useEffect(() => {
    let cancelled = false
    const q = shopSearch.trim()
    if (q.length < 2) {
      setShopProductSearchAccounts([])
      setShopProductSearchLoading(false)
      return
    }
    const ac = new AbortController()
    const tid = setTimeout(() => {
      if (cancelled) return
      void (async () => {
        setShopProductSearchLoading(true)
        try {
          const sector = GRANDMA_CATEGORY_TO_SECTOR_SLUG[category]?.trim()
          const params = new URLSearchParams({
            globalSearch: q,
            limit: "200",
            Currency: "RWF",
          })
          if (sector) params.set("sector", sector)
          const res = await fetch(`/api/fetchSuggestions?${params.toString()}`, {
            signal: ac.signal,
            cache: "no-store",
          })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const json = (await res.json()) as Record<string, unknown>
          const acc = collectSellerAccountsFromGlobalSearchJson(json)
          if (!cancelled) setShopProductSearchAccounts([...acc])
        } catch {
          if (!cancelled && !ac.signal.aborted) setShopProductSearchAccounts([])
        } finally {
          if (!cancelled && !ac.signal.aborted) setShopProductSearchLoading(false)
        }
      })()
    }, 380)
    return () => {
      cancelled = true
      clearTimeout(tid)
      ac.abort()
    }
  }, [shopSearch, category])

  useEffect(() => {
    setGrandmaOrderedShopIds(readGrandmaOrderedShopIdsFromStorage())
  }, [])

  const liveMenuNickname = useMemo(() => {
    if (selectedShopId === "rs_burrows") return "burrows"
    if (selectedShopId === "ph_rite") return "rite"
    return null
  }, [selectedShopId])
  const isLiveMenuSelected = useMemo(() => Boolean(liveMenuNickname), [liveMenuNickname])

  // Full supplier catalog (apiProducts) + optional live-menu rows (Burrows/Rite) — no sampling.
  const combinedProducts = useMemo(() => {
    if (!selectedShopId) {
      if (apiProducts.some((p) => p.qty > 0)) return apiProducts
      return []
    }
    const catalog = apiProducts
    const liveRows = isLiveMenuSelected ? products.filter((p) => p.id >= 100000) : []
    if (liveRows.length === 0) return catalog
    if (catalog.length === 0) return liveRows
    const qtyById = new Map<number, number>()
    for (const p of [...catalog, ...liveRows, ...products]) qtyById.set(p.id, p.qty)
    const seen = new Set<string>()
    const merged: Product[] = []
    const push = (p: Product) => {
      const key = (p.stockLineCode || p.liveKey || `${p.id}:${p.name}`).trim().toLowerCase()
      if (!key || seen.has(key)) return
      seen.add(key)
      merged.push({ ...p, qty: qtyById.get(p.id) ?? p.qty })
    }
    for (const p of catalog) push(p)
    for (const p of liveRows) push(p)
    return merged
  }, [apiProducts, selectedShopId, products, isLiveMenuSelected])

  const selectedProducts = useMemo(() => combinedProducts.filter((p) => p.qty > 0), [combinedProducts])
  const itemsCount = useMemo(() => selectedProducts.reduce((a, p) => a + p.qty, 0), [selectedProducts])
  const itemsTotal = useMemo(() => selectedProducts.reduce((a, p) => a + p.qty * p.price, 0), [selectedProducts])

  const grandmaStockLineIssues = useMemo(() => {
    const issues: {
      id: number
      name: string
      requested: number
      available: number
      qty: number
    }[] = []
    for (const p of combinedProducts) {
      if (p.qty < 1) continue
      const cap = productStockOnHand(p)
      if (cap == null) continue
      const attempt = stockQtyAttempts[p.id]
      const overAttempt = attempt != null && attempt > cap
      const overQty = p.qty > cap
      if (!overAttempt && !overQty) continue
      issues.push({
        id: p.id,
        name: p.name,
        requested: overAttempt ? attempt : p.qty,
        available: cap,
        qty: Math.min(p.qty, cap),
      })
    }
    return issues
  }, [combinedProducts, stockQtyAttempts])

  const hasGrandmaStockBlock = grandmaStockLineIssues.length > 0

  /** Home grid counts: shops from browse rows, items from full `sectorStats` totals. */
  const grandmaHomeSectorCounts = useMemo(() => {
    const next = {} as Record<Category, { shops: number; items: number }>
    for (const { name } of CATEGORIES) {
      next[name] = { shops: 0, items: 0 }
    }
    for (const s of allAvailableShops) {
      const bucket = next[s.category]
      if (!bucket) continue
      bucket.shops += 1
      bucket.items += s.stockLineCount ?? 0
    }
    for (const { name } of CATEGORIES) {
      const fullItems = homeSectorItemsByCategory[name]
      if (Number.isFinite(fullItems)) {
        // Prefer full DB item totals so card "ibintu" matches what users see in category flows.
        next[name].items = Math.max(0, Math.floor(Number(fullItems)))
      }
    }
    return next
  }, [allAvailableShops, homeSectorItemsByCategory])

  const selectedShop = useMemo(
    () => {
      if (!selectedShopId) return null

      const byExact = (list: ShopEntry[]) => list.find((s) => s.id === selectedShopId)
      const byAccount = (list: ShopEntry[]) => {
        const listMatch = list.filter((s) => sameGrandmaSeller(s.id, selectedShopId))
        if (listMatch.length === 0) return undefined
        if (listMatch.length === 1) return listMatch[0]
        const hit = listMatch.find((s) => s.category === category)
        return hit ?? listMatch[0]
      }

      const availableShop = byExact(allAvailableShops) ?? byAccount(allAvailableShops)
      if (availableShop) return availableShop

      const apiShop = byExact(apiShops) ?? byAccount(apiShops)
      if (apiShop) return apiShop

      return byExact(MOCK_SHOPS) ?? byAccount(MOCK_SHOPS) ?? null
    },
    [selectedShopId, allAvailableShops, apiShops, category]
  )

  const deliveryKm = selectedShop?.distanceKm ?? 0

  const logisticsTotal = useMemo(() => {
    if (fulfillmentMode === "pickup") return 0
    const opt = LOGISTICS.find((x) => x.id === selectedLogistics)
    return opt ? logisticsQuote(opt, deliveryKm) : 0
  }, [fulfillmentMode, selectedLogistics, deliveryKm])

  const etaRange = useMemo(
    () =>
      fulfillmentMode === "pickup"
        ? { lo: 0, hi: 0 }
        : deliveryEtaRange(deliveryKm, selectedLogistics),
    [deliveryKm, selectedLogistics, fulfillmentMode]
  )

  const couriersByDistance = useMemo(() => {
    const bump = selectedShopId ? (Math.abs(shopIdHash(selectedShopId)) % 50) / 500 : 0
    return [...COURIER_POOL]
      .map((c) => ({
        ...c,
        distanceToShopKm: Number(
          (c.distanceToShopKm + bump * ((shopIdHash(c.id) % 5) + 1) * 0.08).toFixed(2)
        ),
      }))
      .sort((a, b) => a.distanceToShopKm - b.distanceToShopKm)
  }, [selectedShopId])

  const topFiveCouriers = useMemo(() => couriersByDistance.slice(0, 5), [couriersByDistance])

  const featuredCourier = useMemo(() => {
    if (assignedCourierId) {
      return couriersByDistance.find((c) => c.id === assignedCourierId) ?? couriersByDistance[0]
    }
    return couriersByDistance[0]
  }, [couriersByDistance, assignedCourierId])

  useEffect(() => {
    if (!courierModalOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCourierModalOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [courierModalOpen])

  useEffect(() => {
    const prefs = readGrandmaPrefs()
    setLanguage(prefs.lang)
    setPreferredShopIds(prefs.preferred)
    setSelectedPayment(prefs.payment)
    setAppMode(prefs.mode)
    writeGrandmaSignupRole(prefs.mode === "seller" ? "seller" : "buyer")
    try {
      const lsLog = localStorage.getItem("grandma:buyerLogistics")
      if (lsLog === "human" || lsLog === "bike" || lsLog === "moto") setSelectedLogistics(lsLog)
      else setSelectedLogistics("moto")
    } catch {
      setSelectedLogistics("moto")
    }
    try {
      const lsFul = localStorage.getItem("grandma:fulfillmentMode")
      if (lsFul === "delivery" || lsFul === "pickup") setFulfillmentMode(lsFul)
      else setFulfillmentMode("delivery")
    } catch {
      setFulfillmentMode("delivery")
    }
    setPrefsHydrated(true)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined" || !prefsHydrated) return
    localStorage.setItem("grandma:payment", selectedPayment)
  }, [selectedPayment, prefsHydrated])
  useEffect(() => {
    setGrandmaUssdCopied(false)
    if (selectedPayment !== "cash") setGrandmaCashConfirm(false)
  }, [selectedPayment])

  useEffect(() => {
    if (typeof window === "undefined" || !prefsHydrated) return
    localStorage.setItem("grandma:preferredShops", JSON.stringify(preferredShopIds))
  }, [preferredShopIds, prefsHydrated])
  useEffect(() => {
    if (typeof window === "undefined" || !prefsHydrated) return
    localStorage.setItem("grandma:mode", appMode)
  }, [appMode, prefsHydrated])

  useEffect(() => {
    if (typeof window === "undefined" || !prefsHydrated) return
    try {
      localStorage.setItem("grandma:buyerLogistics", selectedLogistics)
    } catch {
      /* ignore */
    }
  }, [selectedLogistics, prefsHydrated])

  useEffect(() => {
    if (typeof window === "undefined" || !prefsHydrated) return
    try {
      localStorage.setItem("grandma:fulfillmentMode", fulfillmentMode)
    } catch {
      /* ignore */
    }
  }, [fulfillmentMode, prefsHydrated])

  useEffect(() => {
    if (fulfillmentMode === "pickup") setCourierModalOpen(false)
  }, [fulfillmentMode])

  useEffect(() => {
    if (appMode === "seller" || (page !== 2 && page !== 3)) setFilterSheetOpen(false)
  }, [page, appMode])

  // Live menu (Burrows + Rite) — inject live items into the current shop category list.
  useEffect(() => {
    if (!isLiveMenuSelected) {
      setBurrowsLiveLoading(false)
      setBurrowsLiveError(null)
      setBurrowsLiveCount(0)
      // remove any previously injected live items
      setProducts((prev) => prev.filter((p) => p.id < 100000))
      return
    }
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        setBurrowsLiveLoading(true)
        setBurrowsLiveError(null)
        const nickname = liveMenuNickname || "burrows"
        const targetCategory = (selectedShop?.category ?? "Restaurant") as Category
        const params = new URLSearchParams({ nickname })
        if (search.trim()) params.set("productSearch", search.trim())
        const res = await fetch(`/api/shop-with-me?${params.toString()}`, { cache: "no-store" })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as BurrowsApiResponse
        console.log('API Response data:', data)
        console.log('Data type:', Array.isArray(data) ? 'array' : typeof data)
        const sellers = data.sellers ?? []
        const seller = sellers[0]
        const list = seller?.products ?? []
        const uniqueRows: { key: string; p: BurrowsApiProduct }[] = []
        const seenKeys = new Set<string>()
        for (let i = 0; i < list.length; i++) {
          const p = list[i]
          const key = liveItemDedupeKey(p, i)
          if (seenKeys.has(key)) continue
          seenKeys.add(key)
          uniqueRows.push({ key, p })
        }
        const mapped: Product[] = uniqueRows
          .map(({ key, p }) => {
            const nameRaw = String(p.item_commercial_name ?? p.item_name ?? "").trim()
            const name = nameRaw || "Menu item"
            const id = 100000 + (Math.abs(shopIdHash(`${nickname}:${key}`)) % 899000)
            const price = extractNumericPrice(p.selling_price ?? p.price)
            const thumb = liveCatalogThumbUrl(p, targetCategory, nickname, key, name)
            const sectionLabel = resolveLiveMenuSectionCategory(p)
            const menuCat = menuCategoryTitleFromCanon(menuCategoryCanon(sectionLabel))
            const stockLineCode = String(
              p.ITEM_CODE ?? p.item_code ?? p.item_key_words ?? p.NIKI_CODE ?? p.niki_code ?? ""
            ).trim()
            return {
              id,
              category: targetCategory,
              name,
              price: price || 0,
              emoji: emojiForLiveCategory(targetCategory, name),
              imageUrl: thumb,
              liveKey: `${nickname}:${key}`,
              stockLineCode: stockLineCode || undefined,
              liveInStock: p.in_stock === true,
              liveCategory: menuCat,
              stockQty:
                parseStockQtyValue(p.stock) ??
                (p.in_stock === false ? 0 : undefined),
              qty: 0,
            } satisfies Product
          })
          .filter((p) => Boolean(p.name))
        if (cancelled) return
        setBurrowsLiveCount(mapped.length)
        setProducts((prev) => {
          const kept = prev.filter((p) => p.id < 100000)
          // preserve existing qty for same id
          const qtyById = new Map<number, number>()
          for (const p of prev) qtyById.set(p.id, p.qty)
          const merged = mapped.map((p) => ({ ...p, qty: qtyById.get(p.id) ?? 0 }))
          return [...kept, ...merged]
        })
      } catch (e: any) {
        if (!cancelled) {
          setBurrowsLiveError(e?.message || "Failed to load menu")
          setBurrowsLiveCount(0)
        }
      } finally {
        if (!cancelled) setBurrowsLiveLoading(false)
      }
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [isLiveMenuSelected, liveMenuNickname, selectedShop?.category, search])

  // Fetch all available shops for settings section
  useEffect(() => {
    const fetchAllShops = async () => {
      console.log('=== fetchAllShops called ===')
      setAllShopsLoading(true)
      setAllShopsError(null)
      
      try {
        // Sector slugs align with DB `preferedcategories` (e.g. pharmacy, liquor-store) — not bar-resto for liquor
        const categoryToSectorMap = GRANDMA_CATEGORY_TO_SECTOR_SLUG

        const allShops: any[] = []
        const categories = Object.keys(categoryToSectorMap)
        
        let browseFailures = 0
        // Fetch shops for each category
        for (const cat of categories) {
          try {
            const sector = categoryToSectorMap[cat]
            let suppliers: any[] = []

            const qs = new URLSearchParams({
              sector,
              limit: "500",
              Currency: "RWF",
            })
            const sectorUrl = `/api/sector-list-suppliers?${qs.toString()}`
            console.log(`=== Fetching ${cat} ===`)
            console.log(`Sector list URL: ${sectorUrl}`)
            const res = await fetch(sectorUrl, { cache: "no-store" })

            if (res.ok) {
              const data = await res.json()
              console.log(`Raw API response for ${cat}:`, data)
              if (Array.isArray(data) && data.length > 0) {
                suppliers = data
              } else if (data && typeof data === "object" && (data as { ok?: boolean }).ok === false) {
                browseFailures++
              }
            } else {
              browseFailures++
              console.warn(`Sector list failed for ${cat}: HTTP ${res.status}`)
            }

            // Production Grandma browse is the canonical seller endpoint; use it when the older sector servlet is empty.
            if (suppliers.length === 0) {
              const browseQs = new URLSearchParams({
                sector,
                sellerLimit: "500",
                productsPerSeller: "6",
                Currency: "RWF",
              })
              const browseUrl = `/api/grandma/suppliers/browse?${browseQs.toString()}`
              const browseRes = await fetch(browseUrl, { cache: "no-store" })
              if (browseRes.ok) {
                const browseData = await browseRes.json()
                if (Array.isArray(browseData) && browseData.length > 0) {
                  suppliers = browseData
                  console.log(`${cat} suppliers (grandma browse fallback):`, suppliers.length)
                } else if (browseData && typeof browseData === "object" && (browseData as { ok?: boolean }).ok === false) {
                  browseFailures++
                }
              } else {
                browseFailures++
                console.warn(`Grandma browse failed for ${cat}: HTTP ${browseRes.status}`)
              }
            }

            // Same SQL family as browse, different servlet path — helps if Grandma browse404/503 or returns [].
            if (suppliers.length === 0) {
              const legacyUrl = `/api/fetchSuggestions?listSuppliersBySector=${encodeURIComponent(sector)}&Currency=RWF`
              const res2 = await fetch(legacyUrl, { cache: "no-store" })
              if (res2.ok) {
                const data2 = await res2.json()
                if (Array.isArray(data2) && data2.length > 0) {
                  suppliers = data2.map((row: any) => ({
                    seller_account: row.SELLER_ISHYIGA_ACCOUNT || row.id,
                    seller_name: row.SELLER_NAMES || row.OWNER,
                    seller_momo: row.momo ?? row.MOMO,
                    seller_location: row.LOCATION,
                    product_count: row.product_count ?? row.productCount ?? row.PRODUCT_COUNT ?? row.items_count ?? row.ITEMS_COUNT,
                    products: Array.isArray(row.products) ? row.products : undefined,
                  }))
                  console.log(`${cat} suppliers (listSuppliersBySector fallback):`, suppliers.length)
                }
              }
            } else {
              console.log(`${cat} suppliers (sector-list):`, suppliers.length)
            }

            allShops.push(
              ...suppliers.map((supplier: any) => ({
                ...supplier,
                fetchedCategory: cat,
              }))
            )
          } catch (error) {
            browseFailures++
            console.warn(`Error fetching ${cat}:`, error)
          }
        }

        if (allShops.length === 0 && browseFailures > 0) {
          setAllShopsError(
            "Could not load shops from the backend. Is Tomcat running and BACKEND_URL / NEXT_PUBLIC_API_URL set to your context (e.g. http://localhost:8080/trading_ai)?"
          )
        }
        
        console.log('Total suppliers from all categories:', allShops.length)

        // One row per (seller, sector): same seller can appear in Pharmacy + Boutique — do not collapse to first sector only.
        const seenPair = new Set<string>()
        const uniqueSuppliers = allShops.filter((supplier: any) => {
          const baseId = String(
            supplier.ISHYIGA_ACCOUNT ?? supplier.seller_account ?? supplier.id ?? supplier.SELLER_ISHYIGA_ACCOUNT ?? "")
            .trim()
          if (!baseId) return false
          const fc = String(supplier.fetchedCategory ?? "")
          const key = `${baseId}::${fc}`
          if (seenPair.has(key)) return false
          seenPair.add(key)
          return true
        })

        console.log('Unique suppliers after deduplication:', uniqueSuppliers.length)

        // Transform all shops with consistent IDs
        const transformedShops = uniqueSuppliers.map((supplier: any, index: number) => {
          const baseId = String(supplier.ISHYIGA_ACCOUNT ?? supplier.seller_account ?? supplier.id ?? supplier.SELLER_ISHYIGA_ACCOUNT ?? "")
          const catTag = String(supplier.fetchedCategory ?? "Others").replace(/\s+/g, "_")
          const uniqueId = baseId ? `supplier_${baseId}__${catTag}` : `supplier_unknown_${Math.random()}`
          
          return {
            id: uniqueId,
            name: supplier.seller_name || supplier.seller_account || baseId,
            category: supplier.fetchedCategory as Category,
            tagline: "Local supplier",
            favorite: false,
            orderedBefore: false,
            trending: false,
            onSale: supplierRowSuggestsOnSale(supplier as Record<string, unknown>),
            distanceKm: Math.random() * 5 + 0.5, // Mock distance
            momo: `MTN MoMo: ${supplier.seller_momo || 'N/A'}`,
            rating: 4.0,
            reviewCount: 0,
            logoSrc: "/placeholder.jpg",
            stockLineCount: productCountFromSupplierRow(supplier),
          }
        })
        
        let shopsWithImages = transformedShops
        try {
          const imageRes = await fetch("/api/images/overrides?scope=shop", { cache: "no-store" })
          const imageData = await imageRes.json().catch(() => ({}))
          const imageMap = (imageData?.map ?? {}) as Record<string, string>
          if (imageMap && typeof imageMap === "object") {
            shopsWithImages = transformedShops.map((shop) => {
              const account = sellerAccountFromGrandmaShopId(shop.id).toUpperCase()
              const img = account ? imageMap[account] : ""
              return img ? { ...shop, logoSrc: img } : shop
            })
          }
        } catch {
          // keep default logos if override fetch fails
        }

        setAllAvailableShops(annotateShopTrendingByCategory(shopsWithImages))
        console.log('setAllAvailableShops called with:', transformedShops.length, 'shops')
        console.log('Shop IDs in allAvailableShops:', transformedShops.map(s => s.id))
        console.log('Current preferredShopIds:', preferredShopIds)
        
        // Load user preferences from backend and convert ID formats
        try {
          const userId = getCurrentUserId()
          const backendPreferences = await loadUserPreferences(userId, transformedShops)
          setPreferredShopIds(backendPreferences)
          console.log('Loaded preferences from backend:', backendPreferences)
        } catch (error) {
          console.error('Failed to load preferences from backend:', error)
        }
        
      } catch (error) {
        console.error('Failed to fetch all shops:', error)
        setAllShopsError('Failed to load shops')
      } finally {
        setAllShopsLoading(false)
      }
    }
    
    fetchAllShops()
  }, [])

  // Debug toggle rendering
  useEffect(() => {
    console.log('=== Toggle rendering debug ===')
    console.log('allAvailableShops.length:', allAvailableShops.length)
    console.log('allAvailableShops:', allAvailableShops.map(s => ({ id: s.id, name: s.name, checked: preferredShopIds.includes(s.id) })))
    console.log('preferredShopIds:', preferredShopIds)
    console.log('Settings panel open:', settingsOpen)
    
    // Log when shops are available for rendering
    if (allAvailableShops.length > 0) {
      console.log('=== RENDERING TOGGLES ===')
      console.log('Shops ready for toggle rendering:', allAvailableShops.length)
      console.log('Sample shop data:', allAvailableShops[0])
      
      // Check if toggle elements are in DOM
      setTimeout(() => {
        const toggleElements = document.querySelectorAll('input[type="checkbox"][data-shop-id]')
        console.log('Toggle checkboxes found in DOM:', toggleElements.length)
        
        // Log first few toggle elements
        for (let i = 0; i < Math.min(3, toggleElements.length); i++) {
          const element = toggleElements[i] as HTMLInputElement
          console.log(`Toggle ${i}:`, {
            id: element.getAttribute('data-shop-id'),
            checked: element.checked,
            visible: element.offsetParent !== null,
            className: element.className
          })
        }
      }, 100)
    }
  }, [allAvailableShops, preferredShopIds, settingsOpen])

  // Fetch real products data when a shop is selected
  useEffect(() => {
    console.log('=== Product fetching useEffect triggered ===')
    console.log('selectedShopId:', selectedShopId)
    console.log('selectedShop:', selectedShop)
    if (!selectedShopId || !selectedShop) {
      console.log('Product fetching skipped - missing selectedShopId or selectedShop')
      return
    }

    let cancelled = false
    const fetchProducts = async () => {
      productFetchInFlightRef.current = true
      try {
        setProductsLoading(true)
        setProductsError(null)
        
        console.log('Fetching products for shop:', selectedShopId, 'category:', selectedShop.category)

        // Extract supplier account for Redis pattern (ignore optional __Sector suffix)
        const baseSupplierId = sellerAccountFromGrandmaShopId(selectedShopId)

        const invQs = new URLSearchParams({ sellerAccount: baseSupplierId })
        const sugQs = new URLSearchParams({
          supplierProducts: baseSupplierId,
          limit: String(GRANDMA_SUPPLIER_CATALOG_LIMIT),
          Currency: "RWF",
        })
        const [invRes, sugRes] = await Promise.all([
          fetch(`/api/grandma/sellers/inventory?${invQs.toString()}`, { cache: "no-store" }),
          fetch(`/api/fetchSuggestions?${sugQs.toString()}`, { cache: "no-store" }),
        ])

        if (cancelled) return

        let suggestionRows: Record<string, unknown>[] = []
        if (sugRes.ok) {
          const data = (await sugRes.json()) as { products?: unknown[] } | unknown[]
          const raw = Array.isArray(data)
            ? data
            : data && typeof data === "object" && Array.isArray((data as { products?: unknown[] }).products)
              ? (data as { products: unknown[] }).products
              : []
          suggestionRows = raw.filter((p): p is Record<string, unknown> => Boolean(p) && typeof p === "object")
        }

        const enrichByCode = new Map<string, Record<string, unknown>>()
        for (const row of suggestionRows) {
          const code = String(
            row.ITEM_CODE ?? row.item_code ?? row.item_key_words ?? row.NIKI_CODE ?? row.niki_code ?? ""
          )
            .trim()
            .toUpperCase()
          if (code) enrichByCode.set(code, row)
        }

        let productImageMap: Record<string, string> = {}
        try {
          const mapRes = await fetch(
            `/api/images/overrides?scope=product&account=${encodeURIComponent(baseSupplierId)}`,
            { cache: "no-store" }
          )
          const mapData = await mapRes.json().catch(() => ({}))
          if (mapData?.ok && mapData?.map && typeof mapData.map === "object") {
            productImageMap = mapData.map as Record<string, string>
          }
        } catch {
          // keep backend product images when override fetch fails
        }

        const mapSuggestionRow = (product: Record<string, unknown>, lineId?: number): Product | null => {
          const name = String(
            product.item_commercial_name || product.ITEM_NAME || product.item_name || product.name || ""
          ).trim()
          if (!name) return null
          const numericPrice = Math.max(0, Math.round(lineSellingPriceFromProductRow(product)))
          const itemCode = String(
            product.ITEM_CODE ||
              product.item_code ||
              product.item_key_words ||
              product.NIKI_CODE ||
              product.niki_code ||
              ""
          ).trim()
          const id =
            lineId != null && lineId > 0
              ? 1_000_000 + lineId
              : grandmaProductIdFromStockLine(baseSupplierId, {
                  id: lineId ?? 0,
                  itemName: name,
                  nikiCode: itemCode,
                  quantity: 0,
                  salePrice: numericPrice,
                  costPrice: 0,
                })
          const overrideImage = itemCode ? productImageMap[itemCode.toUpperCase()] : ""
          const liveKey =
            lineId != null && lineId > 0
              ? `${itemCode || name}:${lineId}`
              : itemCode || name
          return {
            id,
            category: selectedShop.category,
            name,
            price: numericPrice,
            emoji: emojiForRestaurantItem(name),
            imageUrl:
              overrideImage ||
              String(product.image_url || product.item_image_url || product.IMAGE_URL || product.image || product.img || product.imageUrl || "") ||
              "/img/shops/default.png",
            qty: 0,
            stockLineCode: itemCode || undefined,
            liveKey,
            stockQty: stockQtyFromCatalogRow(product) ?? undefined,
          }
        }

        let transformedProducts: Product[] = []

        if (invRes.ok) {
          const invJson = (await invRes.json()) as { ok?: boolean; lines?: GrandmaInventoryLine[] }
          const invLines = Array.isArray(invJson?.lines) ? invJson.lines : []
          if (invJson?.ok && invLines.length > 0) {
            const fromInventory: Product[] = []
            for (const line of invLines) {
              const itemName = String(line.itemName ?? "").trim()
              if (!itemName) continue
              const nikiCode = String(line.nikiCode ?? "").trim()
              const enrich = nikiCode ? enrichByCode.get(nikiCode.toUpperCase()) : undefined
              const row = enrich ?? {}
              const name = String(
                row.item_commercial_name || row.ITEM_NAME || row.item_name || itemName
              ).trim()
              const saleFromInv = Number(line.salePrice)
              const numericPrice =
                Number.isFinite(saleFromInv) && saleFromInv > 0
                  ? Math.max(0, Math.round(saleFromInv))
                  : Math.max(0, Math.round(lineSellingPriceFromProductRow(row)))
              const id = grandmaProductIdFromStockLine(baseSupplierId, line)
              const overrideImage = nikiCode ? productImageMap[nikiCode.toUpperCase()] : ""
              fromInventory.push({
                id,
                category: selectedShop.category,
                name,
                price: numericPrice,
                emoji: emojiForRestaurantItem(name),
                imageUrl:
                  overrideImage ||
                  String(
                    row.image_url ||
                      row.item_image_url ||
                      row.IMAGE_URL ||
                      row.image ||
                      row.img ||
                      row.imageUrl ||
                      ""
                  ) ||
                  "/img/shops/default.png",
                qty: 0,
                stockLineCode: nikiCode || undefined,
                liveKey: `${nikiCode || name}:${line.id}`,
                stockQty: Math.max(0, Math.floor(Number(line.quantity) || 0)),
              })
            }
            transformedProducts = fromInventory
            console.log(
              "[grandma] Catalog from inventory:",
              transformedProducts.length,
              "lines (card stockLineCount:",
              selectedShop.stockLineCount ?? "?",
              ")"
            )
          }
        }

        if (transformedProducts.length === 0) {
          if (!sugRes.ok) throw new Error(`Catalog HTTP ${sugRes.status}`)
          transformedProducts = suggestionRows
            .map((row) => mapSuggestionRow(row))
            .filter((p): p is Product => p != null)
          console.log("[grandma] Catalog fallback fetchSuggestions:", transformedProducts.length, "rows")
        }

        setApiProducts(transformedProducts)
      } catch (error: any) {
        if (!cancelled) {
          console.error('Products fetch error:', error)
          setProductsError(error?.message || 'Failed to fetch products')
          setApiProducts([])
        }
      } finally {
        if (!cancelled) {
          setProductsLoading(false)
        }
        productFetchInFlightRef.current = false
      }
    }

    fetchProducts()
    
    return () => {
      cancelled = true
      productFetchInFlightRef.current = false
    }
  }, [selectedShopId, selectedShop])

  /** Summary (page 4) + Pay (page 5) — follows selected language */
  const tPay = GRANDMA_LABELS[language]

  /** Pay page (last screen) — fallback line follows selected language */
  const displayUserLocation = useMemo(
    () => formatStoredLocation(locationData, GRANDMA_LABELS[language].demoLocation),
    [locationData, language]
  )

  /** Settings location preview — English demo fallback for pay flow */
  const displayUserLocationEn = useMemo(
    () => formatStoredLocation(locationData, GRANDMA_LABELS.en.demoLocation),
    [locationData]
  )

  const settingsUi = GRANDMA_LABELS[language]

  const ihuteFees = useMemo(() => computeIhutePlatformFeeRwf(itemsTotal), [itemsTotal])
  const grandTotal = useMemo(
    () => itemsTotal + logisticsTotal + TAXES_PLACEHOLDER,
    [itemsTotal, logisticsTotal]
  )

  const grandmaMtnUssd = useMemo(() => {
    if (!selectedShop || selectedPayment !== "momo") return ""
    return buildGrandmaMtnUssd(selectedShop.momo ?? "", Math.round(grandTotal))
  }, [selectedShop, selectedPayment, grandTotal])

  const grandmaMtnUssdTelHref = useMemo(() => {
    if (!grandmaMtnUssd) return ""
    return `tel:${grandmaMtnUssd.replace(/#/g, "%23")}`
  }, [grandmaMtnUssd])

  const grandmaAirtelUssd = useMemo(() => {
    if (!selectedShop || selectedPayment !== "airtel") return ""
    return buildGrandmaMtnUssd(selectedShop.momo ?? "", Math.round(grandTotal))
  }, [selectedShop, selectedPayment, grandTotal])

  const grandmaAirtelUssdTelHref = useMemo(() => {
    if (!grandmaAirtelUssd) return ""
    return `tel:${grandmaAirtelUssd.replace(/#/g, "%23")}`
  }, [grandmaAirtelUssd])

  const selectLogisticsMode = (id: LogisticsId) => {
    setSelectedLogistics(id)
  }

  const addPrescriptionFiles = (list: FileList | null) => {
    if (!list?.length) return
    setPrescriptionSlots((prev) => {
      const next = [...prev]
      for (const file of Array.from(list)) {
        const id = `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`
        next.push({ id, file, url: URL.createObjectURL(file) })
      }
      return next
    })
  }

  const removePrescription = (id: string) => {
    setPrescriptionSlots((prev) => {
      const slot = prev.find((x) => x.id === id)
      if (slot) URL.revokeObjectURL(slot.url)
      return prev.filter((x) => x.id !== id)
    })
  }

  const grandmaBuyerSession = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  /** Must be true before treating `user` as final — avoids seller mode snapping back to buyer on load. */
  const authHasHydrated = useAuthStore((s) => s.hasHydrated)

  const grandmaPayerPhoneOk = useMemo(() => {
    const payerRaw = grandmaBuyerSession?.phone || grandmaBuyerPhoneInput.trim()
    return isGrandmaRwMobileDigits(payerRaw)
  }, [grandmaBuyerSession?.phone, grandmaBuyerPhoneInput])

  const verifyGrandmaMoMoSms = useCallback(() => {
    setGrandmaSmsPayCheck(null)
    setGrandmaSmsMatchResult(null)
    if (selectedPayment !== "momo" || grandTotal < 1) return
    const text = grandmaMomoSmsPaste.trim()
    if (!text) return
    const r = matchMoMoSmsToOrderTotal(text, Math.round(grandTotal))
    setGrandmaSmsMatchResult(r)
    if (!r.candidates.length) setGrandmaSmsPayCheck("no_amount")
    else if (r.matched) setGrandmaSmsPayCheck("paid")
    else setGrandmaSmsPayCheck("mismatch")
  }, [selectedPayment, grandTotal, grandmaMomoSmsPaste])

  useEffect(() => {
    setGrandmaSmsPayCheck(null)
    setGrandmaSmsMatchResult(null)
    if (selectedPayment !== "momo") setGrandmaMomoSmsPaste("")
  }, [selectedPayment, grandTotal])

  useEffect(() => {
    if (selectedPayment !== "momo") return
    const text = grandmaMomoSmsPaste.trim()
    if (text.length < 8) {
      if (!text) {
        setGrandmaSmsPayCheck(null)
        setGrandmaSmsMatchResult(null)
      }
      return
    }
    const timer = window.setTimeout(() => {
      const r = matchMoMoSmsToOrderTotal(text, Math.round(grandTotal))
      setGrandmaSmsMatchResult(r)
      if (!r.candidates.length) setGrandmaSmsPayCheck("no_amount")
      else if (r.matched) setGrandmaSmsPayCheck("paid")
      else setGrandmaSmsPayCheck("mismatch")
    }, 450)
    return () => window.clearTimeout(timer)
  }, [grandmaMomoSmsPaste, grandTotal, selectedPayment])

  const grandmaCanSendOrder = useMemo(() => {
    if (!selectedShop || selectedProducts.length === 0) return false
    if (hasGrandmaStockBlock) return false
    if (selectedPayment === "momo") {
      return grandmaSmsPayCheck === "paid" && grandmaPayerPhoneOk
    }
    if (selectedPayment === "airtel") {
      return grandmaSmsPayCheck === "paid" && grandmaPayerPhoneOk
    }
    if (selectedPayment === "cash") return grandmaCashConfirm
    return false
  }, [
    selectedShop,
    selectedProducts.length,
    hasGrandmaStockBlock,
    selectedPayment,
    grandmaSmsPayCheck,
    grandmaPayerPhoneOk,
    grandmaCashConfirm,
  ])

  useEffect(() => {
    setStockQtyAttempts({})
  }, [selectedShopId])

  const sellerShopLabel = useAuthStore((s) => {
    const u = s.user
    if (!u) return ""
    const biz = u.businessName?.trim()
    const nm = u.name?.trim()
    return biz || nm || "My shop"
  })
  const sellerIshyigaAccount = useAuthStore((s) => s.user?.ishyigaAccount ?? "")
  const sellerBusinessCategory = useAuthStore((s) => s.user?.businessCategory ?? "")
  /** Person line under shop title when both differ (e.g. business name vs owner name). */
  const sellerHeaderSubline = useAuthStore((s) => {
    const u = s.user
    if (!u) return ""
    const n = u.name?.trim() ?? ""
    if (n) return n
    return u.phone?.trim() ?? ""
  })
  const logout = useAuthStore((s) => s.logout)

  /** S1: persisted "seller" mode without a valid seller session → fall back to buyer (after auth rehydrate). */
  useEffect(() => {
    if (!prefsHydrated) return
    if (!authHasHydrated) return
    const st = useAuthStore.getState()
    if (appMode === "seller" && (!st.isAuthenticated || !grandmaUserCanUseSellerWorkspace(st.user))) {
      setAppMode("buyer")
      setSellerView("home")
      try {
        localStorage.setItem("grandma:mode", "buyer")
      } catch {
        /* ignore */
      }
    }
  }, [
    prefsHydrated,
    appMode,
    authHasHydrated,
    isAuthenticated,
    grandmaBuyerSession?.id,
    grandmaBuyerSession?.role,
    grandmaBuyerSession?.dualPharmacyRetail,
    grandmaBuyerSession?.dbRole,
    grandmaBuyerSession?.ishyigaAccount,
  ])

  const showSupplierDashboardNav =
    isAuthenticated && grandmaUserCanUseSellerWorkspace(grandmaBuyerSession) && appMode === "buyer"

  const sellerAccountForOrders = sellerIshyigaAccount.trim()
  const loadSellerOrders = useCallback(async () => {
    if (!sellerAccountForOrders || appMode !== "seller") return
    setSellerOrdersLoading(true)
    setSellerOrdersError(null)
    try {
      const allRaw: Record<string, unknown>[] = []
      let pageNum = 1
      const pageSizeCap = 100
      let reportedTotal = 0
      while (pageNum <= 40) {
        const res = await fetch("/api/seller-orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sellerAccount: sellerAccountForOrders, page: pageNum, pageSize: pageSizeCap }),
          cache: "no-store",
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || "Failed to load orders")
        const batch = json.orders ?? []
        reportedTotal = Number(json.total ?? 0)
        allRaw.push(...(Array.isArray(batch) ? batch : []))
        if (batch.length < pageSizeCap) break
        if (reportedTotal > 0 && allRaw.length >= reportedTotal) break
        pageNum += 1
      }
      const sorted = [...allRaw].sort((a, b) => {
        const aId = Number(a.ID_ORDER ?? a.id_order ?? a.id ?? 0)
        const bId = Number(b.ID_ORDER ?? b.id_order ?? b.id ?? 0)
        return bId - aId
      })
      setSellerOrders(sorted.map((r) => mapRawSellerOrderToGrandma(r)))
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load orders"
      setSellerOrdersError(msg)
      setSellerOrders([])
    } finally {
      setSellerOrdersLoading(false)
    }
  }, [sellerAccountForOrders, appMode])

  useEffect(() => {
    if (appMode !== "seller" || !sellerAccountForOrders) return
    void loadSellerOrders()
  }, [appMode, sellerAccountForOrders, loadSellerOrders])

  useEffect(() => {
    if (appMode !== "seller" || !sellerAccountForOrders) return
    if (sellerView !== "orders") return
    const t = setInterval(() => void loadSellerOrders(), 30_000)
    return () => clearInterval(t)
  }, [appMode, sellerAccountForOrders, sellerView, loadSellerOrders])

  useEffect(() => {
    if (appMode !== "seller" || !sellerAccountForOrders.trim()) return
    let cancelled = false
    void (async () => {
      try {
        const u = new URLSearchParams({ sellerAccount: sellerAccountForOrders.trim() })
        const res = await fetch(`/api/grandma/sellers/inventory?${u}`, { cache: "no-store" })
        const json = (await res.json()) as {
          ok?: boolean
          lines?: Array<{ quantity?: number; salePrice?: number }>
        }
        if (!res.ok || !json?.ok) return
        const lines = json.lines ?? []
        let units = 0
        let valueRwf = 0
        for (const r of lines) {
          const q = Number(r.quantity) || 0
          const sp = Number(r.salePrice) || 0
          units += q
          valueRwf += q * sp
        }
        if (!cancelled) setSellerInventoryKpi({ units, valueRwf })
      } catch {
        if (!cancelled) setSellerInventoryKpi({ units: 0, valueRwf: 0 })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [appMode, sellerAccountForOrders, sellerView])

  const persistSellerPaymentLocal = useCallback(async (orderId: string, status: "paid" | "pending") => {
    setSellerPaymentLocal((prev) => {
      const n = { ...prev }
      if (status === "pending") delete n[orderId]
      else n[orderId] = "paid"
      return n
    })
    try {
      if (status === "paid") {
        window.localStorage.setItem(`ihute:grandma:sellerPay:${orderId}`, "paid")
      } else {
        window.localStorage.removeItem(`ihute:grandma:sellerPay:${orderId}`)
      }
      const res = await fetch("/api/orders/client-meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          sellerPaymentAck: status === "paid" ? "paid" : null,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Could not sync payment note to server")
      }
      void loadSellerOrders()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Sync failed"
      window.alert(msg)
    }
  }, [loadSellerOrders])

  /** Sets backend order status to `invoice` (seller issued invoice — e.g. before payment clears). */
  const markOrderInvoice = useCallback(
    async (orderId: string) => {
      try {
        const res = await fetch("/api/orders/update-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: Number(orderId), status: "invoice" }),
        })
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
        if (!res.ok || !json?.ok) throw new Error(json?.error || "Could not set invoice status")
        void loadSellerOrders()
      } catch (e: unknown) {
        window.alert(e instanceof Error ? e.message : "Invoice update failed")
      }
    },
    [loadSellerOrders],
  )

  useEffect(() => {
    if (typeof window === "undefined" || !sellerOrders.length) return
    try {
      const next: Record<string, "paid" | "pending"> = {}
      for (const o of sellerOrders) {
        const v = window.localStorage.getItem(`ihute:grandma:sellerPay:${o.id}`)
        if (v === "paid" || v === "pending") next[o.id] = v
        if (o.sellerPaymentAck) next[o.id] = o.sellerPaymentAck
      }
      setSellerPaymentLocal((prev) => ({ ...prev, ...next }))
    } catch {
      /* ignore */
    }
  }, [sellerOrders])

  const updateSellerOrderStatus = useCallback(
    async (id: string, status: SellerOrderStatus) => {
      let snapshot: SellerOrder[] = []
      setSellerOrders((prev) => {
        snapshot = prev
        return prev.map((o) => (o.id === id ? { ...o, status } : o))
      })
      if (status === "rejected") {
        return
      }
      const apiStatus = status === "preparing" ? "processing" : status === "sent" ? "delivered" : null
      if (!apiStatus) return
      try {
        const res = await fetch("/api/orders/update-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: Number(id), status: apiStatus }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || !json?.ok) throw new Error((json as { error?: string })?.error || "Update failed")
        void loadSellerOrders()
      } catch (e: unknown) {
        setSellerOrders(snapshot)
        const msg = e instanceof Error ? e.message : "Could not update order"
        window.alert(msg)
      }
    },
    [loadSellerOrders],
  )

  const title = useMemo(() => {
    if (appMode === "seller") {
      if (sellerView === "home")
        return sellerShopLabel.trim() || GRANDMA_LABELS[language].titleHome
      if (sellerView === "items") return "Items"
      return "IHUTE.RW"
    }
    const catLabel = categoryLabel(category, language)
    switch (page) {
      case 1:
        return "Ishyiga Ihute"
      case 2:
        return `Shops · ${catLabel}`
      case 3:
        return catLabel
      case 4:
        return "Order Summary"
      default:
        return "Payment Mode"
    }
  }, [appMode, sellerView, page, category, language, sellerShopLabel])

  /** Shown under the home title when signed in — hidden for guests (no placeholder name). */
  const buyerHeaderName = useMemo(() => {
    if (!isAuthenticated) return ""
    const n = grandmaBuyerSession?.name?.trim()
    return n || ""
  }, [isAuthenticated, grandmaBuyerSession?.name])

  const shopsInCategory = useMemo(() => {
    console.log('=== shopsInCategory called ===')
    console.log('Current category:', category)
    console.log('allAvailableShops.length:', allAvailableShops.length)

    if (allShopsLoading) {
      return []
    }
    if (allAvailableShops.length > 0) {
      const filtered = allAvailableShops.filter((s) => s.category === category)
      console.log('Filtered shops for category:', filtered)
      return filtered
    }
    if (GRANDMA_SHOW_DEMO_SHOPS) {
      return MOCK_SHOPS.filter((s) => s.category === category)
    }
    return []
  }, [category, allAvailableShops, allShopsLoading])

  const reorderSellerKeySet = useMemo(() => {
    const set = new Set<string>()
    for (const id of grandmaOrderedShopIds) {
      const k = sellerAccountFromGrandmaShopId(id).toUpperCase()
      if (k) set.add(k)
    }
    for (const k of reorderHistorySellerKeys) {
      if (k) set.add(k.toUpperCase())
    }
    return set
  }, [grandmaOrderedShopIds, reorderHistorySellerKeys])

  const onsaleSellerKeysSet = useMemo(
    () => new Set(onsaleSellerAccounts.map((x) => String(x).trim().toUpperCase()).filter(Boolean)),
    [onsaleSellerAccounts],
  )

  useEffect(() => {
    if (!isAuthenticated || !grandmaBuyerSession?.ishyigaAccount) {
      setReorderHistorySellerKeys([])
      return
    }
    let cancel = false
    const ac = new AbortController()
    void (async () => {
      try {
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            buyerAccount: grandmaBuyerSession.ishyigaAccount,
            page: 1,
            pageSize: 50,
          }),
          cache: "no-store",
          signal: ac.signal,
        })
        if (!res.ok) return
        const json = (await res.json()) as { transactions?: unknown[]; orders?: unknown[] }
        const rawList = (Array.isArray(json.transactions)
          ? json.transactions
          : Array.isArray(json.orders)
            ? json.orders
            : []) as Record<string, unknown>[]
        const keys = new Set<string>()
        for (const raw of rawList) {
          const acc = String(raw.SELLER_ISHYIGA_ACCOUNT ?? raw.seller_account ?? "").trim()
          if (!acc) continue
          const base = acc.replace(/^supplier_/i, "").split("__")[0].trim()
          if (base) keys.add(base.toUpperCase())
        }
        if (!cancel) setReorderHistorySellerKeys([...keys])
      } catch {
        if (!cancel) setReorderHistorySellerKeys([])
      }
    })()
    return () => {
      cancel = true
      ac.abort()
    }
  }, [isAuthenticated, grandmaBuyerSession?.ishyigaAccount])

  useEffect(() => {
    const sector = GRANDMA_CATEGORY_TO_SECTOR_SLUG[category]?.trim()
    if (!sector || allAvailableShops.length === 0) {
      setOnsaleSellerAccounts([])
      return
    }
    let cancel = false
    const ac = new AbortController()
    const probes = ["a", "e", "i", "1"]
    const tid = setTimeout(() => {
      void (async () => {
        const merged = new Set<string>()
        for (const g of probes) {
          if (cancel || ac.signal.aborted) break
          try {
            const params = new URLSearchParams({
              globalSearch: g,
              limit: "120",
              Currency: "RWF",
              sector,
            })
            const res = await fetch(`/api/fetchSuggestions?${params.toString()}`, {
              signal: ac.signal,
              cache: "no-store",
            })
            if (!res.ok) continue
            const json = (await res.json()) as Record<string, unknown>
            collectDiscountedSellerAccountsFromSearchJson(json).forEach((x) => merged.add(x))
          } catch {
            /* ignore */
          }
        }
        if (!cancel) setOnsaleSellerAccounts([...merged])
      })()
    }, 600)
    return () => {
      cancel = true
      clearTimeout(tid)
      ac.abort()
    }
  }, [category, allAvailableShops.length])

  const shopListFilterResult = useMemo(() => {
    const qRaw = shopSearch.trim().toLowerCase()
    const tokens = qRaw.split(/\s+/).filter(Boolean)
    const productAccountSet = new Set(shopProductSearchAccounts)

    const shopMatchesQuery = (s: ShopEntry): boolean => {
      if (!tokens.length) return true
      const sellerKey = sellerAccountFromGrandmaShopId(s.id).toUpperCase()
      const productHit = productAccountSet.has(sellerKey)
      const hay = `${s.name} ${s.tagline} ${s.momo ?? ""} ${s.id}`.toLowerCase()
      const textHit = tokens.every((t) => hay.includes(t))
      return textHit || productHit
    }

    const prefBoost = (a: ShopEntry, b: ShopEntry) => {
      const pref =
        Number(isPreferredGrandmaShop(b.id, preferredShopIds)) -
        Number(isPreferredGrandmaShop(a.id, preferredShopIds))
      if (pref !== 0) return pref
      return 0
    }

    const shopOrderedRecently = (s: ShopEntry) => {
      const k = sellerAccountFromGrandmaShopId(s.id).toUpperCase()
      return reorderSellerKeySet.has(k) || s.orderedBefore
    }

    const sortList = (list: ShopEntry[]) =>
      [...list].sort((a, b) => {
        if (tokens.length && productAccountSet.size > 0) {
          const ak = sellerAccountFromGrandmaShopId(a.id).toUpperCase()
          const bk = sellerAccountFromGrandmaShopId(b.id).toUpperCase()
          const ap = productAccountSet.has(ak) ? 1 : 0
          const bp = productAccountSet.has(bk) ? 1 : 0
          if (ap !== bp) return bp - ap
        }
        const p = prefBoost(a, b)
        if (p !== 0) return p
        if (a.favorite !== b.favorite) return a.favorite ? -1 : 1
        if (shopOrderedRecently(a) !== shopOrderedRecently(b)) return shopOrderedRecently(b) ? -1 : 1
        if (useLocationSort) return a.distanceKm - b.distanceKm
        return a.name.localeCompare(b.name)
      })

    const applyTab = (list: ShopEntry[]): ShopEntry[] => {
      if (shopTab === "favorites") {
        if (preferredShopIds.includes(PREFERRED_ALL_ID)) return list
        const prefs = preferredShopIds.filter((x) => x !== PREFERRED_ALL_ID)
        return list.filter(
          (s) => s.favorite || (prefs.length > 0 && prefs.some((pid) => sameGrandmaSeller(pid, s.id))),
        )
      }
      if (shopTab === "reorder") {
        if (reorderSellerKeySet.size === 0) return []
        return list.filter((s) => reorderSellerKeySet.has(sellerAccountFromGrandmaShopId(s.id).toUpperCase()))
      }
      if (shopTab === "trending") return list.filter((s) => s.trending)
      if (shopTab === "onsale") {
        return list.filter((s) => {
          if (s.onSale) return true
          return onsaleSellerKeysSet.has(sellerAccountFromGrandmaShopId(s.id).toUpperCase())
        })
      }
      return list
    }

    const base = shopsInCategory
    let relaxedNote: string | null = null

    if (!tokens.length) {
      const list = shopTab ? applyTab(base) : base
      return { shops: sortList(list), relaxedNote: null }
    }

    const searchHits = base.filter(shopMatchesQuery)
    if (!shopTab) {
      return { shops: sortList(searchHits), relaxedNote: null }
    }

    const tabbed = applyTab(base)
    const tabAndSearch = tabbed.filter(shopMatchesQuery)
    if (tabAndSearch.length > 0) {
      return { shops: sortList(tabAndSearch), relaxedNote: null }
    }

    if (searchHits.length > 0) {
      relaxedNote =
        language === "rw"
          ? "Nta duka riri muri uyu muhuza (Reorder, …) rihuye n'uko wanditse — reba amaduka yose ahuye n'uko wanditse."
          : language === "fr"
            ? "Aucun commerce ne correspond à ce filtre + recherche — affichage de tous les commerces correspondant à votre recherche."
            : "No shop matches this filter plus your search — showing all shops that match your search."
      return { shops: sortList(searchHits), relaxedNote }
    }

    return { shops: sortList([]), relaxedNote: null }
  }, [
    shopsInCategory,
    shopSearch,
    shopTab,
    useLocationSort,
    preferredShopIds,
    language,
    shopProductSearchAccounts,
    grandmaOrderedShopIds,
    reorderSellerKeySet,
    onsaleSellerKeysSet,
  ])

  const visibleShops = shopListFilterResult.shops
  const shopSearchRelaxedNote = shopListFilterResult.relaxedNote

  const isAllPreferred = useMemo(() => preferredShopIds.includes(PREFERRED_ALL_ID), [preferredShopIds])
  const multiShopMode = useMemo(() => isAllPreferred && !selectedShopId, [isAllPreferred, selectedShopId])

  const offerShopsForCategory = useMemo(() => {
    // Use API shops if available, otherwise fall back to MOCK_SHOPS - COMMENTED OUT TO CONFIRM API INTEGRATION
    const apiShopsInCategory = apiShops.filter((s) => s.category === category)
    // const mockShopsInCategory = MOCK_SHOPS.filter((s) => s.category === category)
    // const inCat = apiShopsInCategory.length > 0 || shopsLoading ? apiShopsInCategory : mockShopsInCategory
    const inCat = apiShopsInCategory // Use only API shops
    
    const prefs = preferredShopIds.filter((x) => x !== PREFERRED_ALL_ID)
    if (prefs.length) return inCat.filter((s) => prefs.some((pid) => pid === s.id || sameGrandmaSeller(pid, s.id)))
    return inCat
  }, [category, preferredShopIds, apiShops, shopsLoading])

  /** Full item pool for price histogram / category chips (full catalog, no sampling). */
  const itemsFilterStatsSource = useMemo(() => {
    if (multiShopMode) return [] as Product[]
    let list = combinedProducts.filter((p) => p.category === category)
    const q = search.trim().toLowerCase()
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q))
    if (isLiveMenuSelected && liveInStockOnly) {
      list = list.filter((p) => p.liveInStock === true || p.qty > 0)
    }
    return list
  }, [multiShopMode, combinedProducts, category, search, isLiveMenuSelected, liveInStockOnly])

  const offersBaseList = useMemo((): OfferRow[] => {
    if (!multiShopMode) return []
    const q = search.trim().toLowerCase()
    return combinedProducts
      .filter((p) => p.category === category)
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .flatMap((p) => {
        const offers = offerShopsForCategory
          .map((shop) => ({
            shop,
            priceRwf: shopProductPriceRwf(shop, p),
          }))
          .sort((a, b) => a.priceRwf - b.priceRwf || a.shop.distanceKm - b.shop.distanceKm || a.shop.name.localeCompare(b.shop.name))
          .slice(0, OFFERS_PER_PRODUCT)
          .map(
            (x) =>
              ({
                id: offerId(x.shop.id, p.id),
                shopId: x.shop.id,
                shopName: x.shop.name,
                shopDistanceKm: x.shop.distanceKm,
                productId: p.id,
                productName: p.name,
                productEmoji: p.emoji,
                priceRwf: x.priceRwf,
                productMenuCategory: menuCategoryCanon(p.liveCategory),
              }) satisfies OfferRow
          )
        return offers
      })
  }, [multiShopMode, combinedProducts, category, search, offerShopsForCategory])

  const itemsPriceExtent = useMemo(() => {
    if (!itemsFilterStatsSource.length) return { min: 0, max: 0 }
    const prices = itemsFilterStatsSource.map((p) => p.price)
    return { min: Math.min(...prices), max: Math.max(...prices) }
  }, [itemsFilterStatsSource])

  const offersPriceExtent = useMemo(() => {
    if (!offersBaseList.length) return { min: 0, max: 0 }
    const prices = offersBaseList.map((o) => o.priceRwf)
    return { min: Math.min(...prices), max: Math.max(...prices) }
  }, [offersBaseList])

  const filterPriceExtent = useMemo(
    () => (multiShopMode ? offersPriceExtent : itemsPriceExtent),
    [multiShopMode, offersPriceExtent, itemsPriceExtent]
  )

  const filterHistogramPrices = useMemo(() => {
    if (multiShopMode) return offersBaseList.map((o) => o.priceRwf)
    return itemsFilterStatsSource.map((p) => p.price)
  }, [multiShopMode, offersBaseList, itemsFilterStatsSource])

  const filterMenuCategoryKeys = useMemo(() => {
    const canons = multiShopMode
      ? offersBaseList.map((o) => o.productMenuCategory ?? MENU_FILTER_OTHER_CANON)
      : itemsFilterStatsSource.map((p) => menuCategoryCanon(p.liveCategory))
    return [...new Set(canons)].sort((a, b) => a.localeCompare(b))
  }, [multiShopMode, offersBaseList, itemsFilterStatsSource])

  const filterHistogramBins = useMemo(
    () => priceHistogramCounts(filterHistogramPrices, 20),
    [filterHistogramPrices]
  )

  useEffect(() => {
    const { min, max } = filterPriceExtent
    if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) {
      setPriceRangeRwf(null)
      return
    }
    setPriceRangeRwf([min, max])
  }, [filterPriceExtent.min, filterPriceExtent.max, multiShopMode])

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase()
    // Single-shop mode: products are tagged with the shop’s sector; home `category` may still be another tab (e.g. after reorder).
    const effectiveCategory =
      !multiShopMode && selectedShop ? selectedShop.category : category
    let list = combinedProducts.filter((p) => {
      const qok = !q || p.name.toLowerCase().includes(q)
      // Always show lines already in cart — avoids empty list when sector tab / shop dedupe category / filters disagree.
      const catOk = p.category === effectiveCategory || p.qty > 0
      return catOk && qok
    })
    if (isLiveMenuSelected && liveInStockOnly) {
      list = list.filter((p) => p.liveInStock === true || p.qty > 0)
    }
    if (priceRangeRwf) {
      const [lo, hi] = priceRangeRwf
      if (Number.isFinite(lo) && Number.isFinite(hi) && hi >= lo) {
        list = list.filter((p) => p.price >= lo && p.price <= hi || p.qty > 0)
      }
    }
    list = list.filter((p) => productMatchesMenuCategory(p, itemsMenuCategoryKey))
    list = [...list]
    if (itemsSort === "name") list.sort((a, b) => a.name.localeCompare(b.name))
    else if (itemsSort === "price_asc") list.sort((a, b) => a.price - b.price || a.name.localeCompare(b.name))
    else if (itemsSort === "price_desc") list.sort((a, b) => b.price - a.price || a.name.localeCompare(b.name))
    return list
  }, [
    combinedProducts,
    category,
    selectedShop,
    multiShopMode,
    search,
    isLiveMenuSelected,
    liveInStockOnly,
    itemsSort,
    priceRangeRwf,
    itemsMenuCategoryKey,
  ])

  const showHeaderFilters = appMode === "buyer" && (page === 2 || page === 3)

  const visibleOffers = useMemo(() => {
    if (!multiShopMode) return [] as OfferRow[]
    let list = offersBaseList
    if (priceRangeRwf) {
      const [lo, hi] = priceRangeRwf
      if (Number.isFinite(lo) && Number.isFinite(hi) && hi >= lo) {
        list = list.filter((o) => o.priceRwf >= lo && o.priceRwf <= hi)
      }
    }
    list = list.filter((o) => offerMatchesMenuCategory(o, itemsMenuCategoryKey))
    return [...list].sort(
      (a, b) =>
        a.productName.localeCompare(b.productName) ||
        a.priceRwf - b.priceRwf ||
        a.shopDistanceKm - b.shopDistanceKm
    )
  }, [multiShopMode, offersBaseList, priceRangeRwf, itemsMenuCategoryKey])

  const clearGrandmaFilters = useCallback(() => {
    setShopTab(null)
    setUseLocationSort(false)
    setItemsSort("default")
    setLiveInStockOnly(false)
    setItemsMenuCategoryKey(null)
    const { min, max } = filterPriceExtent
    if (Number.isFinite(min) && Number.isFinite(max) && max >= min) setPriceRangeRwf([min, max])
    else setPriceRangeRwf(null)
  }, [filterPriceExtent.min, filterPriceExtent.max])

  const priceSliderStep = useMemo(() => {
    const { min, max } = filterPriceExtent
    if (max <= min) return 1
    return Math.max(1, Math.round((max - min) / 80))
  }, [filterPriceExtent])

  const findGrandmaProductById = useCallback(
    (id: number) => products.find((p) => p.id === id) ?? apiProducts.find((p) => p.id === id),
    [products, apiProducts],
  )

  const applyGrandmaProductQty = useCallback((id: number, requestedQty: number) => {
    const safe = Math.max(0, Math.floor(Number(requestedQty) || 0))
    let cap: number | null = null
    const patch = (prev: Product[]) => {
      const target = prev.find((p) => p.id === id)
      if (!target) return prev
      cap = productStockOnHand(target)
      const capped = clampQtyForProduct(target, safe)
      return prev.map((p) => (p.id === id ? { ...p, qty: capped } : p))
    }
    setProducts(patch)
    setApiProducts(patch)
    if (cap != null && safe > cap) {
      setStockQtyAttempts((a) => ({ ...a, [id]: safe }))
    } else {
      setStockQtyAttempts((a) => {
        const next = { ...a }
        delete next[id]
        return next
      })
    }
  }, [])

  const changeQty = (id: number, diff: number) => {
    const target = findGrandmaProductById(id)
    if (!target) return
    applyGrandmaProductQty(id, target.qty + diff)
  }

  const setQtyDirect = (id: number, nextQty: number) => {
    applyGrandmaProductQty(id, nextQty)
  }

  /** Cart qty field: blank when 0 (no leading “0”), digits only in onChange. */
  const qtyInputDisplay = (q: number) => {
    const n = Math.max(0, Math.floor(Number(q) || 0))
    return n === 0 ? "" : String(n)
  }

  const applyQtyFromInput = (id: number, raw: string) => {
    const digits = raw.replace(/\D/g, "")
    const stripped = digits.replace(/^0+/, "")
    if (stripped === "") {
      setQtyDirect(id, 0)
      return
    }
    const parsed = Number.parseInt(stripped, 10)
    if (Number.isFinite(parsed)) setQtyDirect(id, parsed)
  }

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = sessionStorage.getItem(GRANDMA_REORDER_STORAGE_KEY)
      if (!raw) return
      const p = JSON.parse(raw) as GrandmaReorderPayload
      if (p?.v !== 1 || !p.shopId || !Array.isArray(p.lines) || p.lines.length === 0) return
      sessionStorage.removeItem(GRANDMA_REORDER_STORAGE_KEY)
      setPendingReorder(p)
      setGrandmaOrderedShopIds(appendGrandmaOrderedShopId(p.shopId))
      setReorderSplashOpen(true)
      setSelectedShopId(p.shopId)
      setAppMode("buyer")
      setPage(3)
      setItemsMenuCategoryKey(null)
      setSearch("")
      const gc = p.grandmaCategory
      if (gc) {
        const cats: Category[] = [
          "Boutique",
          "Supermarket",
          "Pharmacy",
          "Restaurant",
          "Liquor Store",
          "Bakery",
          "Veterinary",
          "Others",
        ]
        const hit = cats.find((c) => c.toLowerCase() === gc.trim().toLowerCase())
        if (hit) setCategory(hit)
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (!pendingReorder) return
    if (!selectedShopId || !sameGrandmaSeller(selectedShopId, pendingReorder.shopId)) return
    if (!selectedShop || !sameGrandmaSeller(selectedShop.id, pendingReorder.shopId)) return
    if (productsLoading || productFetchInFlightRef.current) return

    type Line = GrandmaReorderPayload["lines"][number]
    const findProduct = (line: Line) => {
      const code = (line.itemCode || "").trim().toLowerCase()
      if (code) {
        const byCode = apiProducts.find((p) => (p.liveKey || "").trim().toLowerCase() === code)
        if (byCode) return byCode
      }
      const name = (line.name || "").trim().toLowerCase()
      if (name) {
        return apiProducts.find((p) => p.name.trim().toLowerCase() === name)
      }
      return undefined
    }

    const addQtyById = new Map<number, number>()
    for (const line of pendingReorder.lines) {
      const prod = findProduct(line)
      if (!prod) continue
      const q = Math.max(1, Math.floor(Number(line.qty) || 1))
      addQtyById.set(prod.id, (addQtyById.get(prod.id) ?? 0) + q)
    }

    if (addQtyById.size === 0) {
      setPendingReorder(null)
      setReorderSplashOpen(false)
      window.alert(
        "Could not match this order to the shop’s current catalog. Open the shop and add items manually.",
      )
      return
    }

    for (const [id, add] of addQtyById) {
      const target = apiProducts.find((x) => x.id === id) ?? products.find((x) => x.id === id)
      if (!target) continue
      applyGrandmaProductQty(id, target.qty + add)
    }

    setPendingReorder(null)
    setReorderSplashOpen(false)
    // Items tab (shop catalog + cart bar) — not home (1) or summary (4)
    setPage(3)
  }, [pendingReorder, productsLoading, selectedShopId, selectedShop, apiProducts, products, applyGrandmaProductQty])

  const goToPage = (p: PageId) => setPage(p)

  const goGrandmaHome = useCallback(() => {
    setAppMode("buyer")
    setSellerView("home")
    setPage(1)
  }, [])

  const goBack = () => {
    if (appMode === "seller") {
      if (sellerView === "orders" || sellerView === "items") {
        setSellerView("home")
        return
      }
      setAppMode("buyer")
      return
    }
    setPage((p) => (p > 1 ? ((p - 1) as PageId) : p))
  }

  const togglePreferredShop = async (id: string) => {
    if (id === PREFERRED_ALL_ID) {
      // Handle "All shops" toggle locally
      setPreferredShopIds((prev) => {
        return prev.includes(PREFERRED_ALL_ID) ? prev.filter((x) => x !== PREFERRED_ALL_ID) : [PREFERRED_ALL_ID]
      })
      return
    }

    try {
      const userId = getCurrentUserId()
      await toggleUserPreference(userId, id)
      
      setPreferredShopIds((prev) => {
        const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev.filter((x) => x !== PREFERRED_ALL_ID), id]
        return next
      })
    } catch (error) {
      console.error('Failed to toggle shop preference:', error)
      // Still update local state even if backend fails
      setPreferredShopIds((prev) => {
        const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev.filter((x) => x !== PREFERRED_ALL_ID), id]
        return next
      })
    }
  }
  const sellerOrdersFiltered = useMemo(() => {
    if (sellerFilter === "open") return sellerOrders.filter((o) => o.status === "new" || o.status === "paid" || o.status === "preparing")
    if (sellerFilter === "served") return sellerOrders.filter((o) => o.status === "sent")
    return sellerOrders.filter((o) => o.status === "rejected")
  }, [sellerOrders, sellerFilter])
  const sellerDashboard = useMemo(() => {
    const calc = (list: SellerOrder[]) => ({
      count: list.length,
      amount: list.reduce((sum, o) => sum + o.amountRwf, 0),
    })
    const open = calc(sellerOrders.filter((o) => o.status === "new" || o.status === "paid" || o.status === "preparing"))
    const served = calc(sellerOrders.filter((o) => o.status === "sent"))
    const rejected = calc(sellerOrders.filter((o) => o.status === "rejected"))
    return { open, served, rejected }
  }, [sellerOrders])

  const sellerHomeKpis = useMemo(() => {
    const served = sellerOrders.filter((o) => o.status === "sent")
    const deliverySum = served.reduce((s, o) => s + (o.deliveryFeeRwf ?? 0), 0)
    const salesRwf =
      deliverySum > 0 ? deliverySum : served.reduce((s, o) => s + o.amountRwf, 0)
    return {
      totalOrders: Math.max(1, sellerOrders.length),
      itemsStockUnits: sellerInventoryKpi.units,
      itemsStockValueRwf: sellerInventoryKpi.valueRwf,
      salesDeliveredCount: served.length,
      salesDeliveredRwf: salesRwf,
    }
  }, [sellerOrders, sellerInventoryKpi])

  const sellerRetailInsights = useMemo(() => {
    const dash = GRANDMA_LABELS[language]
    const { ranked, totalLineRevenue } = aggregateServedOrderProducts(sellerOrders)
    const best = ranked[0] ?? null
    const runners = ranked.slice(1, 3)
    let pctOfLines: number | null = null
    if (best && totalLineRevenue > 0) {
      pctOfLines = Math.min(100, Math.round((best.revenueRwf / totalLineRevenue) * 100))
    }

    const bullets: string[] = []
    if (best) {
      bullets.push(
        dash.sellerDashBulletRestock.replace("{{name}}", best.name).replace("{{units}}", String(best.units)),
      )
    }
    for (const r of runners) {
      if (bullets.length >= 3) break
      bullets.push(dash.sellerDashBulletPopular.replace("{{name}}", r.name).replace("{{units}}", String(r.units)))
    }
    if (sellerDashboard.open.count > 0 && bullets.length < 4) {
      bullets.push(dash.sellerDashBulletFulfillQueue.replace("{{n}}", String(sellerDashboard.open.count)))
    }
    if (!best && bullets.length === 0) {
      bullets.push(dash.sellerDashGrowthIdle)
    }

    return { best, pctOfLines, totalLineRevenue, bullets }
  }, [sellerOrders, sellerDashboard.open.count, language])

  const etaSubText = useMemo(() => {
    const tr = GRANDMA_LABELS[language]
    if (fulfillmentMode === "pickup") return tr.etaPickupSub
    const km = deliveryKm.toFixed(1)
    const mode =
      selectedLogistics === "human" ? tr.logHuman : selectedLogistics === "bike" ? tr.logBike : tr.logMoto
    return tr.etaSub.replace("{km}", km).replace("{mode}", mode)
  }, [language, deliveryKm, selectedLogistics, fulfillmentMode])

  const submitGrandmaOrder = useCallback(async () => {
    if (!selectedShop || selectedProducts.length === 0) {
      const msg =
        language === "rw"
          ? "Tangaho ibintu mbere."
          : language === "fr"
            ? "Ajoutez des articles avant de payer."
            : "Add items before sending your order."
      window.alert(msg)
      return
    }
    if (grandmaOrderSubmitGuardRef.current) return
    grandmaOrderSubmitGuardRef.current = true
    setGrandmaOrderSubmitting(true)
    setGrandmaOrderSubmitError(null)
    try {
      const sellerAccount = sellerAccountFromGrandmaShopId(selectedShop.id).trim()
      if (!sellerAccount) {
        setGrandmaOrderSubmitError("Invalid shop id")
        return
      }

      const authUser = useAuthStore.getState().user
      const buyerEmail =
        authUser?.email?.trim() || `guest_${Date.now()}@guest.ihute.local`
      const buyerName = authUser?.name?.trim() || "Guest"
      const phoneFromAccount = authUser?.phone?.replace(/\D/g, "").slice(0, 15) ?? ""
      const phoneFromInput = normalizePhoneDigitsForAuth(grandmaBuyerPhoneInput.trim()).slice(0, 15)
      const buyerPhone = (phoneFromAccount || phoneFromInput).slice(0, 15)

      const trSubmit = GRANDMA_LABELS[language]
      if (!buyerPhone) {
        setGrandmaOrderSubmitError(trSubmit.orderSubmitNeedPhone)
        return
      }

      if (selectedPayment === "momo" || selectedPayment === "airtel") {
        const payerRaw = phoneFromAccount || grandmaBuyerPhoneInput.trim()
        if (!isGrandmaRwMobileDigits(payerRaw)) {
          setGrandmaOrderSubmitError(trSubmit.payStepErrPhone)
          return
        }
      }
      if (selectedPayment === "cash" && !grandmaCashConfirm) {
        setGrandmaOrderSubmitError(trSubmit.payStepErrCash)
        return
      }
      if (selectedPayment === "momo" && grandmaSmsPayCheck !== "paid") {
        setGrandmaOrderSubmitError(trSubmit.payStepErrMomoSms)
        return
      }
      if (hasGrandmaStockBlock) {
        setGrandmaOrderSubmitError(trSubmit.stockExceededSubmit)
        return
      }

      const piRes = await fetch("/api/grandma/payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: selectedPayment,
          grandTotalRwf: Math.round(grandTotal),
          platformFeeRwf: ihuteFees,
          itemsSubtotalRwf: Math.round(itemsTotal),
          logisticsRwf: Math.round(logisticsTotal),
          sellerAccount,
        }),
      })
      const piJson = (await piRes.json().catch(() => ({}))) as {
        ok?: boolean
        intentId?: string
        error?: string
      }
      if (!piRes.ok || piJson.ok !== true || !piJson.intentId) {
        setGrandmaOrderSubmitError(
          piJson.error ||
            (language === "rw"
              ? "Kwemeza kwishyura byanze."
              : language === "fr"
                ? "Étape de paiement échouée."
                : "Payment confirmation failed."),
        )
        return
      }

      const payerDigits =
        selectedPayment === "momo" || selectedPayment === "airtel"
          ? normalizePhoneDigitsForAuth(buyerPhone)
          : undefined
      const billingTail = buildGrandmaBillingReferenceTail({
        intentId: String(piJson.intentId),
        ihuteFeeRwf: ihuteFees,
        itemsSubtotalRwf: Math.round(itemsTotal),
        logisticsRwf: Math.round(logisticsTotal),
        buyerGrandTotalRwf: Math.round(grandTotal),
        paymentChannel: selectedPayment,
        payerDigits,
      })

      const locParts = [
        locationData?.province,
        locationData?.district,
        locationData?.cell,
      ].filter(Boolean)
      const locFromGps = locParts.length ? locParts.join(" · ") : ""
      const buyerLocation = (
        authUser?.location?.trim() ||
        locFromGps ||
        displayUserLocationEn ||
        "NA"
      ).slice(0, 500)

      const momoDigits = selectedShop.momo.replace(/\D/g, "").slice(-12)
      const sellerPhone = momoDigits ? (momoDigits.startsWith("250") ? momoDigits : `250${momoDigits}`) : ""

      const items = selectedProducts.map((p) => {
        const code = String(p.stockLineCode ?? p.liveKey ?? p.id).trim()
        return {
          itemCode: code,
          item_key_words: code,
          ITEM_CODE: code,
          name: p.name,
          qty: p.qty,
          unitPrice: p.price,
        }
      })

      const referenceParts =
        fulfillmentMode === "pickup"
          ? ["SELF-PICKUP", orderNotes.trim()].filter(Boolean)
          : [`DELIVERY-${selectedLogistics}`, orderNotes.trim()].filter(Boolean)
      const baseRef = referenceParts.length ? referenceParts.join(" | ") : ""
      const reference = (baseRef + billingTail).slice(0, 500)

      const res = await fetch("/api/grandma/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerAccount,
          sellerName: selectedShop.name,
          sellerPhone,
          buyerEmail,
          buyerName,
          buyerPhone,
          buyerLocation,
          paymentName: grandmaPaymentToOrdersPaymentName(selectedPayment),
          currency: "RWF",
          items,
          reference,
          subtotal: Math.round(itemsTotal),
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        orderId?: number | string
        trackToken?: string
        error?: string
      }

      if (!res.ok || data.ok === false) {
        setGrandmaOrderSubmitError(
          humanizeGrandmaOrderBackendError(data.error || `Order failed (${res.status})`, language)
        )
        return
      }

      const oid = data.orderId
      if (oid == null || oid === "") {
        setGrandmaOrderSubmitError("No order id returned from server")
        return
      }

      try {
        localStorage.setItem("grandma:lastOrderId", String(oid))
        setGrandmaOrderedShopIds(appendGrandmaOrderedShopId(selectedShop.id))
      } catch {
        /* ignore */
      }

      const payLabel = grandmaPaymentToOrdersPaymentName(selectedPayment)
      const placedOrder = {
        id: String(oid),
        buyerName,
        buyerAccount: authUser?.ishyigaAccount?.trim() || "",
        sellerAccount,
        sellerId: sellerAccount,
        sellerName: selectedShop.name,
        seller: selectedShop.name,
        amount: Math.round(grandTotal),
        subtotal: Math.round(itemsTotal),
        orderStatus: "OPEN",
        status: "open" as const,
        paymentStatus: (payLabel.toLowerCase().includes("paid") ? "paid" : "pending") as
          | "paid"
          | "pending",
        paymentStatusRaw: payLabel,
        createdAt: new Date().toISOString(),
        items: items.map((it, idx) => ({
          id: String(it.itemCode || it.ITEM_CODE || idx),
          name: String(it.name),
          price: Number(it.unitPrice) || 0,
          qty: Number(it.qty) || 1,
        })),
        itemsCount: items.length,
        ...(data.trackToken ? { publicToken: String(data.trackToken) } : {}),
      }
      useOrdersStore.getState().upsertOrder(placedOrder)
      saveGrandmaPendingOrder(placedOrder)

      notifyGrandmaOrderPlaced(String(oid))

      setProducts((prev) => prev.map((x) => ({ ...x, qty: 0 })))
      setOrderNotes("")
      setPrescriptionSlots((prev) => {
        prev.forEach((s) => URL.revokeObjectURL(s.url))
        return []
      })
      setPage(1)

      const q = new URLSearchParams({
        orderId: String(oid),
        sellerName: selectedShop.name,
        buyerPhone,
        total: String(Math.round(grandTotal)),
        from: "grandma",
        autoWhatsApp: "1",
      })
      if (data.trackToken) q.set("trackToken", String(data.trackToken))
      if (payLabel) q.set("payment", payLabel)
      if (grandmaSmsMatchResult?.txId) q.set("momoTxId", grandmaSmsMatchResult.txId)
      router.push(`/order-success?${q.toString()}`)
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : "Order request failed"
      setGrandmaOrderSubmitError(humanizeGrandmaOrderBackendError(raw, language))
    } finally {
      grandmaOrderSubmitGuardRef.current = false
      setGrandmaOrderSubmitting(false)
    }
  }, [
    language,
    orderNotes,
    router,
    selectedProducts,
    selectedShop,
    selectedPayment,
    selectedLogistics,
    fulfillmentMode,
    locationData,
    displayUserLocationEn,
    grandTotal,
    grandmaBuyerPhoneInput,
    grandmaCashConfirm,
    grandmaSmsPayCheck,
    grandmaSmsMatchResult,
    hasGrandmaStockBlock,
    ihuteFees,
    itemsTotal,
    logisticsTotal,
  ])

  const featuredCourierSafe = useMemo(() => {
    const fc = featuredCourier
    return fc ?? COURIER_POOL[0] ?? {
      id: "default",
      name: "No couriers available",
      avatarEmoji: "ð¨",
      hobbies: "Delivery service unavailable",
      rating: 0,
      reviewCount: 0,
      distanceToShopKm: 0,
    }
  }, [featuredCourier])

  return (
    <div className={`app ${appMode === "seller" ? "seller-mode" : ""}`}>
      <style>{`
        :root{
          --blue:#1897e0;--blue-dark:#127fc0;--bg:#eef4fb;--card:#ffffff;--text:#17324d;
          --muted:#6f8399;--line:#dbe7f3;--green:#22c55e;
          --pay:#1897e0;--pay2:#127fc0;--pay-soft:#f0f8ff;--pay-ring:rgba(24,151,224,.24);
        }
        #page5-pay.page.active .primary-btn{background:linear-gradient(90deg,var(--pay),var(--pay2));box-shadow:0 10px 22px rgba(18,127,192,.22);}
        #page5-pay .pay-item{transition:border-color .2s ease,background .2s ease,box-shadow .2s ease;}
        #page5-pay .pay-item.active{border-color:#a8d7f4;background:var(--pay-soft);box-shadow:0 0 0 1px #d6ecfb;}
        #page5-pay .pay-item.active .radio{border-color:var(--pay);}
        #page5-pay .pay-item.active .radio::after{background:var(--pay);}
        #page5-pay .pay-input-tap:focus-visible{outline:none;box-shadow:0 0 0 3px var(--pay-ring);border-color:#2e9ad9!important;}
        *{box-sizing:border-box}
        body{margin:0;font-family:Arial, Helvetica, sans-serif;background:var(--bg);color:var(--text);}
        .app{max-width:430px;margin:0 auto;min-height:100vh;background:linear-gradient(180deg,#f7fbff 0%,#eef4fb 100%);padding-bottom:calc(120px + env(safe-area-inset-bottom));}
        .topbar{background:linear-gradient(90deg,var(--blue),#30acef,var(--blue-dark));color:#fff;padding:14px 16px;position:sticky;top:0;z-index:10;box-shadow:0 8px 20px rgba(0,0,0,.10);}
        .topbar-row{display:flex;align-items:center;gap:10px;}
        .back-btn,.more-btn,.orders-btn{border:none;background:rgba(255,255,255,.14);color:#fff;border-radius:10px;width:36px;height:36px;font-size:18px;cursor:pointer;flex-shrink:0;line-height:1;display:flex;align-items:center;justify-content:center;padding:0;}
        .buyer-header-name{display:block;margin-top:2px;font-size:11px;font-weight:700;opacity:.92;max-width:min(72vw,260px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .filter-trigger-btn{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:10px;background:rgba(255,255,255,.95);color:#17324d;border:1px solid rgba(255,255,255,.55);font-size:12px;font-weight:800;cursor:pointer;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,.08);}
        .filter-trigger-btn svg{flex-shrink:0;opacity:.9;}
        .brand{display:flex;align-items:center;gap:10px;flex:1;min-width:0;}
        .logo{width:34px;height:34px;border-radius:50%;background:#fff;display:block;overflow:hidden;border:2px solid rgba(255,255,255,.5);flex-shrink:0;box-shadow:0 1px 3px rgba(0,0,0,.12);padding:0;}
        button.logo{cursor:pointer;padding:0!important;padding-inline:0!important;margin:0;font:inherit;width:34px!important;height:34px!important;min-height:34px!important;border-radius:50%;background:#fff;border:2px solid rgba(255,255,255,.5);display:block;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.12);}
        .logo img{width:100%;height:100%;object-fit:cover;display:block;}
        .topbar-order-actions{display:flex;align-items:center;gap:6px;flex-shrink:0;}
        .shop-box .logo{width:48px;height:48px;border-radius:12px;border:1px solid var(--line);}
        .title{font-size:22px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .title.seller-title-wrap{white-space:normal;display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-width:0;}
        .title.seller-title-wrap .title-text{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:min(72vw,280px);}
        .seller-top-sub{font-size:11px;font-weight:600;line-height:1.2;opacity:0.9;max-width:min(72vw,280px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .title.title-filter{position:relative;}
        .title.title-filter:before{content:"⏷";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:34px;opacity:.14;pointer-events:none;}
        .title-text{position:relative;z-index:1;}
        .page{display:none;padding:14px;}
        .page.active{display:block}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
        .card{background:var(--card);border-radius:16px;border:1px solid var(--line);box-shadow:0 8px 18px rgba(24,151,224,.08);}
        .cat-card{padding:14px 10px 16px;text-align:center;cursor:pointer;display:flex;flex-direction:column;align-items:center;min-height:120px;}
        .cat-icon{font-size:34px;margin-bottom:8px;}
        .cat-name{font-size:16px;font-weight:700;line-height:1.2;color:var(--text);}
        .cat-card-footer{margin-top:auto;width:100%;padding-top:10px;border-top:1px solid var(--line);font-size:11px;color:var(--muted);line-height:1.35;}
        .cat-card-footer strong{font-weight:800;color:var(--text);}
        .search{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px 14px;margin-bottom:12px;box-shadow:0 8px 18px rgba(24,151,224,.08);}
        .search input{border:none;outline:none;width:100%;font-size:16px;background:transparent;}
        .reorder-btn{border:none;background:#e8f3ff;color:var(--blue-dark);border-radius:10px;padding:8px 10px;font-weight:700;cursor:pointer;}
        .shop-top-trio{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px;}
        .shop-trio-btn{border:none;background:#fff;border:1px solid var(--line);border-radius:12px;padding:10px 6px;font-weight:700;font-size:11px;cursor:pointer;color:var(--text);line-height:1.25;}
        .shop-trio-btn.on{background:#e8f7ed;border-color:#86efac;color:#166534;}
        .shop-filter-row{display:flex;gap:8px;overflow-x:auto;padding:4px 0 14px;scrollbar-width:thin;-webkit-overflow-scrolling:touch;}
        .shop-filter-pill{flex-shrink:0;padding:10px 14px;border-radius:999px;border:1px solid var(--line);background:#fff;font-weight:700;font-size:13px;cursor:pointer;color:var(--text);}
        .shop-filter-pill.active{background:var(--blue);color:#fff;border-color:var(--blue);}
        .shop-list{display:flex;flex-direction:column;gap:10px;}
        .shop-row{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px;display:flex;gap:12px;align-items:center;cursor:pointer;box-shadow:0 8px 18px rgba(24,151,224,.06);text-align:left;}
        .shop-row:active{transform:scale(.995);}
        .shop-avatar{width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#e0f2fe,#bae6fd);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;overflow:hidden;border:1px solid var(--line);}
        .shop-avatar img{width:100%;height:100%;object-fit:contain;display:block;background:#fff;}
        .shop-row-meta{flex:1;min-width:0;text-align:left;}
        .shop-row-name{font-size:16px;font-weight:700;text-align:left;}
        .shop-row-tag{color:var(--muted);font-size:13px;margin-top:4px;line-height:1.3;}
        .shop-row-items{color:var(--muted);font-size:12px;margin-top:4px;font-weight:700;}
        .shop-row-badges{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}
        .shop-badge{font-size:11px;font-weight:700;padding:4px 8px;border-radius:8px;background:#f1f8ff;color:var(--blue-dark);}
        .shop-badge.sale{background:#fef3c7;color:#92400e;}
        .shop-row-dist{font-size:13px;font-weight:700;color:var(--muted);white-space:nowrap;align-self:center;}
        .shop-row-rating{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-top:6px;font-size:13px;}
        .shop-stars{color:#f4b400;letter-spacing:-2px;}
        .shop-rating-num{font-weight:800;color:var(--text);}
        .shop-review-count{color:var(--muted);font-weight:600;}
        .shop-dist-pill{font-size:15px;font-weight:800;color:var(--blue-dark);background:#f1f8ff;border:1px solid var(--line);border-radius:12px;padding:10px 14px;white-space:nowrap;flex-shrink:0;align-self:center;}
        .shop-inline-rating{font-size:13px;color:var(--muted);margin-top:6px;font-weight:600;}
        .product-list{display:flex;flex-direction:column;gap:10px;}
        .product-row{background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px;display:grid;grid-template-columns:42px 1fr auto;gap:10px;align-items:center;box-shadow:0 8px 18px rgba(24,151,224,.06);text-align:left;}
        .emoji{font-size:28px;text-align:center;}
        .p-name{font-size:16px;font-weight:700;text-align:left;}
        .p-price{margin-top:4px;color:var(--muted);font-size:14px;text-align:left;}
        .qty{display:flex;align-items:center;gap:10px;background:#f1f8ff;border-radius:14px;padding:8px 10px;}
        .qty input{width:min(32vw,112px);min-width:88px;height:48px;border:2px solid var(--line);border-radius:12px;background:#fff;color:var(--text);font-weight:800;font-size:20px;text-align:center;padding:0 8px;outline:none;}
        .qty input:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(24,151,224,.18);}
        .bottom-bar{position:sticky;bottom:74px;margin-top:12px;background:linear-gradient(90deg,var(--blue),var(--blue-dark));color:#fff;border-radius:16px;padding:14px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-weight:700;box-shadow:0 10px 20px rgba(24,151,224,.22);cursor:pointer;}
        .bottom-bar:active{transform:scale(.995);}
        .bottom-bar-left{display:flex;align-items:center;gap:8px;}
        .bottom-cart{font-size:20px;line-height:1;}
        .section-title{font-size:14px;font-weight:700;text-transform:uppercase;color:var(--muted);margin:8px 4px 10px;letter-spacing:.3px;}
        .summary-card{padding:14px;margin-bottom:12px;}
        .summary-row{display:flex;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid var(--line);}
        .summary-row:last-child{border-bottom:none;}
        .summary-left{font-weight:700;}
        .summary-sub{color:var(--muted);font-size:13px;margin-top:4px;}
        .summary-item-row{align-items:flex-start;}
        .summary-item-main{flex:1;min-width:0;padding-right:4px;}
        .summary-item-end{display:flex;flex-direction:column;align-items:flex-end;gap:8px;flex-shrink:0;}
        .summary-remove-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:none;background:#fff;border:1px solid var(--line);border-radius:10px;padding:8px 10px;font-size:12px;font-weight:700;color:#b42318;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.04);}
        .summary-remove-btn svg{width:16px;height:16px;flex-shrink:0;}
        .summary-remove-btn:active{transform:scale(.98);background:#fff5f5;}
        .fulfillment-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;}
        .fulfill-sub{font-size:12px;font-weight:600;color:var(--muted);margin-top:6px;line-height:1.3;text-align:center;padding:0 4px;}
        .logistics-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px;}
        .log-option{background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px 8px;text-align:center;cursor:pointer;box-shadow:0 8px 18px rgba(24,151,224,.06);}
        .log-option.active{border:2px solid var(--blue);background:#f2f9ff;}
        .log-icon{font-size:28px;display:block;margin-bottom:6px;line-height:1;}
        .log-label{font-weight:700;font-size:14px;}
        .log-price{color:var(--muted);margin-top:4px;font-size:13px;font-weight:700;}
        .shop-box{display:flex;align-items:flex-start;gap:12px;padding:14px;margin-bottom:12px;}
        .shop-main{flex:1;min-width:0;}
        .shop-name{font-size:18px;font-weight:700;}
        .shop-code{color:var(--blue-dark);font-size:14px;margin-top:4px;word-break:break-word;}
        .action-row{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px;}
        .action-btn{border:none;background:#fff;color:var(--text);border:1px solid var(--line);border-radius:12px;padding:12px 8px;font-weight:700;cursor:pointer;box-shadow:0 8px 18px rgba(24,151,224,.06);}
        .order-extras-card{padding:14px;margin-bottom:12px;}
        .order-extras-label{font-size:13px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.3px;margin-bottom:8px;}
        .order-notes-input{width:100%;min-height:88px;border:1px solid var(--line);border-radius:12px;padding:12px;font-size:15px;font-family:inherit;resize:vertical;outline:none;}
        .order-notes-input:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(24,151,224,.15);}
        .prescription-card{padding:14px;margin-bottom:12px;}
        .prescription-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px;}
        .prescription-btn{border:none;background:#e8f3ff;color:var(--blue-dark);border:1px solid var(--line);border-radius:12px;padding:12px 16px;font-weight:700;cursor:pointer;font-size:15px;}
        .prescription-btn:active{transform:scale(.98);}
        .prescription-btn-block{width:100%;padding:14px 16px;text-align:center;font-size:15px;}
        .prescription-hidden{position:absolute;width:0;height:0;opacity:0;pointer-events:none;}
        .prescription-thumbs{display:flex;flex-wrap:wrap;gap:8px;}
        .prescription-thumb{position:relative;width:72px;height:72px;border-radius:10px;overflow:hidden;border:1px solid var(--line);background:#f1f8ff;}
        .prescription-thumb img{width:100%;height:100%;object-fit:cover;}
        .prescription-thumb button{position:absolute;top:2px;right:2px;width:22px;height:22px;border:none;border-radius:50%;background:rgba(0,0,0,.55);color:#fff;font-size:14px;line-height:1;cursor:pointer;padding:0;}
        .summary-pay-card{padding:14px;margin-bottom:12px;}
        .summary-pay-card .summary-pay-btn{margin:0;display:flex;align-items:center;justify-content:center;gap:12px;}
        .summary-pay-icon{font-size:26px;line-height:1;}
        .primary-btn{width:100%;border:none;border-radius:16px;padding:16px;font-size:20px;font-weight:700;color:#fff;background:linear-gradient(90deg,var(--blue),var(--blue-dark));cursor:pointer;box-shadow:0 10px 20px rgba(24,151,224,.22);}
        .note{padding:14px;font-size:13px;color:var(--muted);line-height:1.45;}
        .pay-details-card{padding:14px 16px;}
        .pay-detail-row{display:flex;justify-content:space-between;align-items:baseline;gap:14px;padding:10px 0;border-bottom:1px solid var(--line);font-size:14px;line-height:1.35;}
        .pay-detail-row:last-of-type{border-bottom:none;}
        .pay-detail-label{color:var(--muted);font-weight:700;flex-shrink:0;}
        .pay-detail-value{font-weight:800;color:var(--text);text-align:right;word-break:break-word;max-width:62%;}
        .pay-detail-sub{font-size:12px;font-weight:600;color:var(--muted);margin-top:4px;text-align:right;}
        .pay-item{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;margin-bottom:10px;cursor:pointer;}
        .pay-left{display:flex;align-items:center;gap:10px;font-weight:700;}
        .pay-logo{width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:8px;background:#fff;overflow:hidden;border:1px solid var(--line);}
        .pay-logo img{width:100%;height:100%;object-fit:contain;display:block;}
        .radio{width:20px;height:20px;border:2px solid var(--blue);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;}
        .pay-item.active .radio::after{content:'';width:10px;height:10px;background:var(--blue);border-radius:50%;display:block;}
        .breakdown{padding:14px;margin-top:12px;margin-bottom:12px;}
        .rider-card{padding:14px;margin-bottom:12px;cursor:pointer;border:1px solid var(--line);transition:box-shadow .15s;}
        .rider-card:hover{box-shadow:0 10px 24px rgba(24,151,224,.12);}
        .rider-card:focus-visible{outline:2px solid var(--blue);outline-offset:2px;}
        .rider-card-inner{display:flex;gap:12px;align-items:flex-start;}
        .rider-avatar{width:56px;height:56px;border-radius:50%;background:linear-gradient(145deg,#e0f2fe,#bae6fd);display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0;border:2px solid #fff;box-shadow:0 4px 12px rgba(24,151,224,.2);}
        .rider-body{flex:1;min-width:0;}
        .rider-name{font-size:17px;font-weight:800;}
        .rider-role{font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-top:2px;}
        .rider-hobbies{font-size:13px;color:var(--text);margin-top:8px;line-height:1.4;}
        .rider-hobbies span{color:var(--muted);font-weight:700;font-size:11px;text-transform:uppercase;display:block;margin-bottom:4px;}
        .rider-meta-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:8px;font-size:13px;}
        .rider-stars{color:#f4b400;font-weight:700;letter-spacing:-1px;}
        .rider-reviews{color:var(--muted);font-weight:600;}
        .rider-dist{margin-left:auto;font-size:14px;font-weight:800;color:var(--blue-dark);white-space:nowrap;}
        .rider-tap-hint{font-size:11px;color:var(--muted);margin-top:10px;text-align:center;}
        .courier-modal-backdrop{position:fixed;inset:0;background:rgba(15,40,60,.45);z-index:40;display:flex;align-items:flex-end;justify-content:center;padding:0;}
        .courier-modal{width:100%;max-width:430px;background:#fff;border-radius:20px 20px 0 0;max-height:78vh;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 -8px 32px rgba(0,0,0,.15);}
        .courier-modal-head{padding:16px 18px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:10px;}
        .courier-modal-title{font-size:17px;font-weight:800;}
        .courier-modal-sub{font-size:12px;color:var(--muted);margin-top:4px;}
        .courier-modal-close{border:none;background:var(--bg);width:36px;height:36px;border-radius:10px;font-size:20px;cursor:pointer;color:var(--text);}
        .courier-modal-list{overflow-y:auto;padding:10px 14px 24px;}
        .courier-modal-row{display:flex;gap:12px;padding:12px;border-radius:14px;border:1px solid var(--line);margin-bottom:10px;cursor:pointer;text-align:left;background:#fff;}
        .courier-modal-row:hover,.courier-modal-row:focus-visible{background:#f7fbff;border-color:var(--blue);}
        .courier-modal-row.selected{border-color:var(--blue);background:#eef6fc;}
        .courier-modal-rank{font-size:12px;font-weight:800;color:var(--muted);width:22px;flex-shrink:0;}
        .stars{color:#f4b400;font-weight:700;}
        .footer{position:fixed;left:50%;transform:translateX(-50%);bottom:0;width:100%;max-width:430px;background:rgba(255,255,255,.96);border-top:1px solid var(--line);display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:2px;padding:10px 6px calc(18px + env(safe-area-inset-bottom));z-index:20;}
        .footer.footer--supplier-6{grid-template-columns:repeat(6,minmax(0,1fr));}
        .footer button{border:none;background:none;color:var(--muted);font-size:10px;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;min-width:0;padding:4px 2px;}
        .footer button.active{color:var(--blue-dark);font-weight:700;}
        .footer .footer-dash-icon{width:22px;height:22px;color:var(--blue-dark);}
        .footer.footer--supplier-6 button{font-size:9px;}
        .seller-mode .page,.seller-mode .footer{display:none!important;}
        .seller-screen{padding:14px;}
        .seller-shop-head{display:flex;align-items:flex-start;justify-content:space-between;padding:12px 14px;margin-bottom:10px;gap:12px;}
        .seller-shop-head-left{min-width:0;flex:1;}
        .seller-shop-name{font-size:14px;font-weight:700;}
        .seller-shop-address{font-size:11px;color:var(--muted);margin-top:6px;line-height:1.35;max-width:100%;}
        .seller-online{display:flex;align-items:center;gap:8px;font-weight:700;font-size:13px;color:#1f2937;}
        .seller-dot{width:10px;height:10px;border-radius:50%;background:#22c55e;}
        .seller-switch{width:38px;height:22px;border-radius:999px;border:1px solid var(--line);background:#dbe7f3;position:relative;cursor:pointer;}
        .seller-switch.on{background:#2f7fe6;}
        .seller-switch::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .2s;}
        .seller-switch.on::after{left:19px;}
        .seller-order{padding:0;margin-bottom:12px;overflow:hidden;}
        .seller-dash{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px;}
        .seller-dash-btn{border:1px solid var(--line);background:#fff;border-radius:12px;padding:10px 8px;cursor:pointer;text-align:center;}
        .seller-dash-btn.active{background:#f2f9ff;border:2px solid var(--blue);}
        .seller-dash-icon{font-size:16px;line-height:1;}
        .seller-dash-title{font-size:11px;font-weight:800;color:#1f4f8a;margin-top:4px;}
        .seller-dash-meta{font-size:11px;color:var(--muted);margin-top:2px;}
        .seller-order-head{width:100%;background:linear-gradient(90deg,#2f7fe6,#2867c8);color:#fff;padding:8px 10px;display:flex;align-items:center;gap:8px;font-weight:800;cursor:pointer;white-space:nowrap;overflow:hidden;}
        .seller-order-head-top{display:flex;align-items:center;gap:8px;min-width:0;flex-shrink:0;}
        .seller-order-head-meta{display:flex;gap:6px;align-items:center;margin-left:auto;min-width:0;}
        .seller-order-meta-chip{font-size:11px;font-weight:800;padding:1px 7px;border-radius:999px;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.28);}
        .seller-order-body{padding:10px 12px;}
        .seller-row{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px;}
        .seller-row-buyer{flex-direction:column;align-items:flex-start;gap:4px;}
        .seller-row-buyer-line{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;width:100%;}
        .seller-buyer-kv{display:flex;flex-direction:column;gap:6px;width:100%;font-size:13px;line-height:1.35;color:#1f2937;}
        .seller-buyer-kv-row{display:flex;gap:8px;align-items:flex-start;}
        .seller-buyer-k{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);width:64px;flex-shrink:0;padding-top:2px;}
        .seller-buyer-v{min-width:0;flex:1;word-break:break-word;}
        .seller-buyer-v a{color:#1d4ed8;text-decoration:underline;font-weight:700;}
        .seller-actions a.seller-btn{text-decoration:none;display:block;text-align:center;}
        .seller-row-pills{display:flex;flex-shrink:0;gap:6px;align-items:center;}
        .seller-row-label-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px;}
        .seller-row-label{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);}
        .seller-buyer-sync{margin-left:6px;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.03em;color:#15803d;background:#dcfce7;border-radius:6px;padding:2px 6px;}
        .seller-address{font-size:16px;line-height:1;}
        .seller-loc{font-size:16px;line-height:1;}
        .seller-muted{color:var(--muted);}
        .seller-pay-block{background:#f8fbff;border:1px solid var(--line);border-radius:10px;padding:8px 10px;margin-bottom:8px;}
        .seller-pay-main{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:800;color:#1f2a44;}
        .seller-pay-logo{width:26px;height:26px;border-radius:6px;border:1px solid var(--line);background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;}
        .seller-pay-logo img{width:100%;height:100%;object-fit:contain;display:block;}
        .seller-pay-status{margin-left:auto;border-radius:8px;padding:2px 8px;font-size:11px;font-weight:900;line-height:1.2;}
        .seller-pay-status.paid{background:#dcfce7;color:#166534;border:1px solid #86efac;}
        .seller-pay-status.pending{background:#fef3c7;color:#92400e;border:1px solid #fcd34d;}
        .seller-pay-status.failed{background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;}
        .seller-pay-sub{font-size:11px;color:var(--muted);margin-top:6px;background:#eef2f7;border-radius:8px;padding:5px 8px;display:inline-block;}
        .seller-pay-local-note{display:block;margin-top:6px;font-size:10px;color:var(--muted);line-height:1.35;}
        .seller-pay-local-actions{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;}
        .seller-line{display:flex;justify-content:space-between;gap:8px;padding:2px 0;}
        .seller-line-name{display:flex;align-items:center;gap:6px;}
        .seller-line-icon{width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;border-radius:6px;background:#eef2ff;border:1px solid #dbe7f3;flex-shrink:0;}
        .seller-total{border-top:1px solid var(--line);margin-top:8px;padding-top:8px;font-size:15px;font-weight:900;text-align:center;color:#1d4f7f;}
        .seller-actions{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:10px;}
        .seller-actions.two{grid-template-columns:1fr 1fr;}
        .seller-btn{border:none;border-radius:10px;padding:10px 8px;font-size:13px;font-weight:800;cursor:pointer;}
        .seller-btn.call{background:#e6f7ec;color:#147c3d;}
        .seller-btn.sms{background:#e8f1ff;color:#2459a9;}
        .seller-btn.video{background:#eef2ff;color:#3730a3;}
        .seller-btn.reject{background:#fff0f0;color:#b42318;border:1px solid #f5caca;}
        .seller-btn.accept{background:linear-gradient(90deg,#2f7fe6,#2867c8);color:#fff;}
        .seller-btn.prepare{background:#fef9c3;color:#854d0e;border:1px solid #fde68a;}
        .seller-btn.sent{background:linear-gradient(90deg,#2f7fe6,#2867c8);color:#fff;}
        .seller-status-pill{display:inline-block;border-radius:999px;padding:4px 8px;font-size:11px;font-weight:800;}
        .seller-status-pill.accepted{background:#e7f7ec;color:#147c3d;}
        .seller-status-pill.rejected{background:#fff0f0;color:#b42318;}
      `}</style>

      <div className="topbar">
        <div className="topbar-row">
          <button className="back-btn" onClick={goBack} aria-label="Back">
            ←
          </button>
          <div className="brand">
            <button
              type="button"
              className="logo"
              onClick={goGrandmaHome}
              aria-label="Grandma home"
              title="Grandma home"
            >
              <img src="/img/logo.png" alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} />
            </button>
            <div
              className={`title ${
                appMode === "seller" ? "seller-title-wrap" : ""
              } ${
                appMode !== "seller" &&
                page !== 1 &&
                language === "rw" &&
                (category === "Restaurant" || category === "Pharmacy")
                  ? "title-filter"
                  : ""
              }`}
              id="pageTitle"
            >
              <span className="title-text">{title}</span>
              {appMode === "buyer" && buyerHeaderName ? (
                <span className="buyer-header-name">{buyerHeaderName}</span>
              ) : null}
              {appMode === "seller" &&
              isAuthenticated &&
              sellerHeaderSubline &&
              sellerHeaderSubline.trim() !== title.trim() ? (
                <span className="seller-top-sub">{sellerHeaderSubline}</span>
              ) : null}
            </div>
            {showHeaderFilters ? (
              <button
                type="button"
                className="filter-trigger-btn"
                aria-label="Open filters"
                onClick={() => setFilterSheetOpen(true)}
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden />
                <span>Filters</span>
              </button>
            ) : null}
          </div>
          {appMode === "buyer" ? (
            <div className="topbar-order-actions">
              <button
                type="button"
                className="orders-btn"
                aria-label="Quick Shop"
                title="Quick Shop"
                onClick={() =>
                  router.push(
                    `${GRANDMA_OUTBOUND.umuriro}?redirect=${encodeURIComponent(GRANDMA_PATHS.appRoot)}`,
                  )
                }
              >
                ⚡
              </button>
              <button
                type="button"
                className="orders-btn"
                aria-label={settingsUi.myOrders}
                title={settingsUi.myOrders}
                onClick={() => {
                  const target = GRANDMA_PATHS.buyerOrders
                  if (isAuthenticated) router.push(target)
                  else
                    router.push(
                      `${GRANDMA_PATHS.login}?redirect=${encodeURIComponent(target)}`,
                    )
                }}
              >
                📦
              </button>
            </div>
          ) : null}
          <button
            className="more-btn"
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            type="button"
          >
            ⚙
          </button>
        </div>
      </div>

      {appMode === "seller" && sellerView === "home" ? (
        <GrandmaSellerDashboard
          shopLabel={sellerShopLabel || "—"}
          openOrders={sellerDashboard.open}
          totalOrders={sellerHomeKpis.totalOrders}
          itemsStockUnits={sellerHomeKpis.itemsStockUnits}
          itemsStockValueRwf={sellerHomeKpis.itemsStockValueRwf}
          salesDeliveredCount={sellerHomeKpis.salesDeliveredCount}
          salesDeliveredRwf={sellerHomeKpis.salesDeliveredRwf}
          bestSelling={
            sellerRetailInsights.best
              ? {
                  name: sellerRetailInsights.best.name,
                  unitsSold: sellerRetailInsights.best.units,
                  revenueRwf: sellerRetailInsights.best.revenueRwf,
                  pctOfLineRevenue: sellerRetailInsights.pctOfLines,
                }
              : null
          }
          topUpBullets={sellerRetailInsights.bullets}
          copy={{
            bestTitle: GRANDMA_LABELS[language].sellerDashBestSelling,
            bestSubtitle: GRANDMA_LABELS[language].sellerDashBestSellingSubtitle,
            bestEmpty: GRANDMA_LABELS[language].sellerDashBestSellingEmpty,
            unitsSold: GRANDMA_LABELS[language].sellerDashUnitsSold,
            lineRevenue: GRANDMA_LABELS[language].sellerDashLineRevenue,
            shareTemplate: GRANDMA_LABELS[language].sellerDashShareRevenue,
            topUpTitle: GRANDMA_LABELS[language].sellerDashTopUpTitle,
            topUpSubtitle: GRANDMA_LABELS[language].sellerDashTopUpSubtitle,
            ctaStock: GRANDMA_LABELS[language].sellerDashCtaStock,
            ctaNikiStock: GRANDMA_LABELS[language].sellerDashCtaNikiStock,
            ctaOrders: GRANDMA_LABELS[language].sellerDashCtaOrders,
            deliveredTail: GRANDMA_LABELS[language].sellerDashDeliveredTail,
          }}
          formatRwf={formatRwf}
          onOrders={() => setSellerView("orders")}
          onClients={() => window.alert("Clients — coming soon")}
          onItems={() => setSellerView("items")}
          onNikiStock={() => {
            router.push("/register/seller?step=2")
          }}
          onSales={() => setSellerView("orders")}
        />
      ) : null}

      {appMode === "seller" && sellerView === "items" ? (
        <GrandmaSellerItemsPanel
          sellerAccount={sellerIshyigaAccount}
          businessCategoryLabel={sellerBusinessCategory}
          formatRwf={formatRwf}
        />
      ) : null}

      {appMode === "seller" && sellerView === "orders" ? (
        <section className="seller-screen">
          <div className="card seller-shop-head">
            <div className="seller-shop-head-left">
              <div className="seller-shop-name">{sellerShopLabel || "—"}</div>
              {grandmaBuyerSession?.location?.trim() ? (
                <p className="seller-shop-address">
                  Shop / seller address (not the buyer&apos;s delivery address): {grandmaBuyerSession.location.trim()}
                </p>
              ) : null}
            </div>
            <div className="seller-online">
              <span className="seller-dot" aria-hidden />
              ONLINE
              <button
                type="button"
                className={`seller-switch ${sellerOnline ? "on" : ""}`}
                aria-label="Toggle shop online status"
                onClick={() => setSellerOnline((v) => !v)}
              />
            </div>
          </div>
          {!sellerAccountForOrders ? (
            <div className="card note">
              Sign in with a seller account so your Ishyiga account loads — orders load from your supplier account.
            </div>
          ) : null}
          {sellerOrdersError ? (
            <div className="card note" style={{ color: "#b91c1c" }}>
              {sellerOrdersError}
            </div>
          ) : null}
          {sellerOrdersLoading && sellerOrders.length === 0 && sellerAccountForOrders ? (
            <div className="card note">Loading orders…</div>
          ) : null}
          <div className="seller-dash">
            <button
              type="button"
              className={`seller-dash-btn ${sellerFilter === "open" ? "active" : ""}`}
              onClick={() => {
                setSellerFilter("open")
                setExpandedSellerOrderId(null)
              }}
            >
              <div className="seller-dash-icon" aria-hidden>🟢</div>
              <div className="seller-dash-title">Open</div>
              <div className="seller-dash-meta">{sellerDashboard.open.count} / {formatRwf(sellerDashboard.open.amount)}</div>
            </button>
            <button
              type="button"
              className={`seller-dash-btn ${sellerFilter === "served" ? "active" : ""}`}
              onClick={() => {
                setSellerFilter("served")
                setExpandedSellerOrderId(null)
              }}
            >
              <div className="seller-dash-icon" aria-hidden>✅</div>
              <div className="seller-dash-title">Served</div>
              <div className="seller-dash-meta">{sellerDashboard.served.count} / {formatRwf(sellerDashboard.served.amount)}</div>
            </button>
            <button
              type="button"
              className={`seller-dash-btn ${sellerFilter === "rejected" ? "active" : ""}`}
              onClick={() => {
                setSellerFilter("rejected")
                setExpandedSellerOrderId(null)
              }}
            >
              <div className="seller-dash-icon" aria-hidden>❌</div>
              <div className="seller-dash-title">Rejected</div>
              <div className="seller-dash-meta">{sellerDashboard.rejected.count} / {formatRwf(sellerDashboard.rejected.amount)}</div>
            </button>
          </div>

          {sellerOrdersFiltered.map((order) => {
            const effectivePayment =
              sellerPaymentLocal[order.id] ?? order.sellerPaymentAck ?? order.paymentStatus ?? "pending"
            return (
            <div className="card seller-order" key={order.id}>
              <button
                type="button"
                className="seller-order-head"
                onClick={() => setExpandedSellerOrderId((prev) => (prev === order.id ? null : order.id))}
                aria-expanded={expandedSellerOrderId === order.id}
              >
                <div className="seller-order-head-top">
                  <span>Order #{order.id}</span>
                </div>
                <div className="seller-order-head-meta">
                  <span className="seller-order-meta-chip" title="Minutes since order">
                    ⏱ {Math.max(0, order.remainingMin)}m
                  </span>
                  <span className="seller-order-meta-chip">
                    {order.distanceKm > 0 ? `${order.distanceKm.toFixed(1)} km` : "—"}
                  </span>
                  <span className="seller-order-meta-chip" title="Logistics channel">
                    {order.logisticsIcon}
                  </span>
                  <span className="seller-order-meta-chip">
                    {order.lines.reduce((sum, line) => sum + line.qty, 0)}
                  </span>
                  <span className="seller-order-meta-chip">{formatRwf(order.amountRwf)}</span>
                  <span className="seller-order-meta-chip">{expandedSellerOrderId === order.id ? "▲" : "▼"}</span>
                </div>
              </button>
              {expandedSellerOrderId === order.id ? (
                <div className="seller-order-body">
                  <div className="seller-row seller-row-buyer">
                    <div className="seller-row-label-row">
                      <span className="seller-row-label">Buyer delivery</span>
                      {order.buyerDeliveryFromBuyerSync ? (
                        <span className="seller-buyer-sync">From buyer track</span>
                      ) : null}
                    </div>
                    <div className="seller-row-buyer-line">
                      <div className="seller-buyer-kv">
                        <div className="seller-buyer-kv-row">
                          <span className="seller-buyer-k">Name</span>
                          <span className="seller-buyer-v">{order.buyerName.trim() || "—"}</span>
                        </div>
                        <div className="seller-buyer-kv-row">
                          <span className="seller-buyer-k">Phone</span>
                          <span className="seller-buyer-v">
                            {order.buyerPhone.trim() ? (
                              <a href={sellerOrderTelHref(order.buyerPhone)}>{order.buyerPhone.trim()}</a>
                            ) : (
                              "—"
                            )}
                          </span>
                        </div>
                        <div className="seller-buyer-kv-row">
                          <span className="seller-buyer-k">Address</span>
                          <span className="seller-buyer-v">
                            <span className="seller-loc" aria-hidden>
                              📍{" "}
                            </span>
                            {order.area !== "—" ? order.area : "—"}
                          </span>
                        </div>
                        <div className="seller-buyer-kv-row seller-muted" style={{ fontSize: 11 }}>
                          <span className="seller-buyer-k">Order</span>
                          <span className="seller-buyer-v">#{order.ref}</span>
                        </div>
                      </div>
                      <span className="seller-row-pills">
                        {order.status === "sent" ? <span className="seller-status-pill accepted">SENT</span> : null}
                        {order.status === "rejected" ? <span className="seller-status-pill rejected">REJECTED</span> : null}
                      </span>
                    </div>
                  </div>
                  {order.paymentLabel ? (
                    <div className="seller-pay-block">
                      <div className="seller-pay-main">
                        <span className="seller-pay-logo" aria-hidden>
                          {order.paymentIconSrc ? <img src={order.paymentIconSrc} alt="" /> : null}
                        </span>
                        <span>{order.paymentLabel}</span>
                        <span className={`seller-pay-status ${effectivePayment}`}>
                          {effectivePayment.toUpperCase()}
                        </span>
                      </div>
                      <div className="seller-pay-sub">
                        {order.paymentCode ? `MoMo Code:${order.paymentCode}` : ""}
                        {order.paymentCode && order.transactionId ? " / " : ""}
                        {order.transactionId ? `Txn ID:${order.transactionId}` : ""}
                        {(order.paymentCode || order.transactionId) && order.paymentTime ? " / " : ""}
                        {order.paymentTime ? order.paymentTime : ""}
                        {order.paymentStatus === "pending" && effectivePayment === "paid" ? (
                          <span className="seller-pay-local-note">
                            You marked payment received on this device. MoMo may still show pending until the gateway
                            confirms.
                          </span>
                        ) : null}
                      </div>
                      {(order.paymentStatus ?? "pending") === "pending" ? (
                        <div className="seller-pay-local-actions">
                          <button
                            type="button"
                            className="seller-btn accept"
                            onClick={() => void persistSellerPaymentLocal(order.id, "paid")}
                          >
                            Payment received
                          </button>
                          <button
                            type="button"
                            className="seller-btn prepare"
                            onClick={() => void markOrderInvoice(order.id)}
                          >
                            Invoice
                          </button>
                          <button
                            type="button"
                            className="seller-btn sms"
                            onClick={() => void persistSellerPaymentLocal(order.id, "pending")}
                          >
                            Still pending
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {order.lines.length ? (
                    <>
                      {order.lines.map((line, lineIdx) => (
                        <div className="seller-line" key={`${order.id}-${line.name}-${lineIdx}`}>
                          <span className="seller-line-name">
                            <span className="seller-line-icon" aria-hidden>{line.icon}</span>
                            {line.name} x{line.qty}
                          </span>
                          <strong>{line.totalRwf ? formatRwf(line.totalRwf) : ""}</strong>
                        </div>
                      ))}
                      <div className="seller-total">TOTAL: {formatRwf(order.amountRwf)}</div>
                    </>
                  ) : null}

                  <div className="seller-actions">
                    {order.buyerPhone.trim() ? (
                      <a
                        href={sellerOrderTelHref(order.buyerPhone)}
                        className="seller-btn call"
                        title="Opens the phone dialer"
                      >
                        📞 Call
                      </a>
                    ) : (
                      <button type="button" className="seller-btn call" disabled style={{ opacity: 0.45 }}>
                        📞 Call
                      </button>
                    )}
                    {order.buyerPhone.trim() ? (
                      <a
                        href={sellerOrderSmsHref(order.buyerPhone)}
                        className="seller-btn sms"
                        title="Opens the SMS app"
                      >
                        💬 SMS
                      </a>
                    ) : (
                      <button type="button" className="seller-btn sms" disabled style={{ opacity: 0.45 }}>
                        💬 SMS
                      </button>
                    )}
                    {order.buyerPhone.trim() ? (
                      <a
                        href={sellerOrderWhatsAppHref(order.buyerPhone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="seller-btn video"
                        title="WhatsApp — chat, voice, or video call"
                      >
                        🎥 Video
                      </a>
                    ) : (
                      <button type="button" className="seller-btn video" disabled style={{ opacity: 0.45 }}>
                        🎥 Video
                      </button>
                    )}
                  </div>
                  {order.status === "rejected" ? (
                    <div className="seller-actions two" style={{ marginTop: 8 }}>
                      <span className="seller-status-pill rejected">REJECTED</span>
                    </div>
                  ) : null}
                  {(order.status === "new" || order.status === "paid") ? (
                    <div className="seller-actions two" style={{ marginTop: 8 }}>
                      <button type="button" className="seller-btn accept" onClick={() => updateSellerOrderStatus(order.id, "preparing")}>
                        ACCEPT ORDER
                      </button>
                      <button type="button" className="seller-btn reject" onClick={() => updateSellerOrderStatus(order.id, "rejected")}>
                        REJECT
                      </button>
                    </div>
                  ) : null}
                  {order.status === "preparing" ? (
                    <div className="seller-actions two" style={{ marginTop: 8 }}>
                      <button type="button" className="seller-btn prepare">
                        PREPARING
                      </button>
                      <button type="button" className="seller-btn sent" onClick={() => updateSellerOrderStatus(order.id, "sent")}>
                        SENT
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            )
          })}
          {sellerOrdersFiltered.length === 0 ? <div className="card note">No orders in this state.</div> : null}
        </section>
      ) : null}

      {/* Page 1 — sector grid (buyer home) */}
      <section className={`page ${page === 1 ? "active" : ""}`} id="page1">
        <div className="grid">
          {CATEGORIES.map((c) => {
            const stat = grandmaHomeSectorCounts[c.name]
            return (
              <div
                key={c.name}
                className="card cat-card"
                onClick={() => {
                  setCategory(c.name)
                  setSearch("")
                  setShopSearch("")
                  setShopTab(null)
                  setSelectedShopId(null)
                  // Business flow: if ALL is selected, go straight to items
                  goToPage(isAllPreferred ? 3 : 2)
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return
                  e.preventDefault()
                  setCategory(c.name)
                  setSearch("")
                  setShopSearch("")
                  setShopTab(null)
                  setSelectedShopId(null)
                  goToPage(isAllPreferred ? 3 : 2)
                }}
              >
                <div className="cat-icon">{c.icon}</div>
                <div className="cat-name">{categoryLabel(c.name, language)}</div>
                <div className="cat-card-footer">
                  {allShopsLoading || homeSectorItemsLoading ? (
                    <span>…</span>
                  ) : (
                    <>
                      <strong>{stat.shops}</strong> {tPay.sectorPanelShops}
                      <span aria-hidden> · </span>
                      <strong>{stat.items}</strong> {tPay.sectorPanelItems}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Page 2 — pick a shop for this category */}
      <section className={`page ${page === 2 ? "active" : ""}`} id="page2-shops">
        <p className="note" style={{ marginTop: 0, marginBottom: 12 }}>
          Choose a shop in <strong>{categoryLabel(category, language)}</strong>. Favorites and shops you used before are listed first.
          {useLocationSort ? " Sorted by distance." : ""}
        </p>

        <div className="shop-top-trio">
          <button
            type="button"
            className={`shop-trio-btn ${useLocationSort ? "on" : ""}`}
            onClick={() => setUseLocationSort((v) => !v)}
          >
            {useLocationSort ? "📍 Near me on" : "📍 Near me off"}
          </button>
          <button
            type="button"
            className="shop-trio-btn"
            onClick={() => {
              writeGrandmaSignupRole("seller")
              router.push(
                `${GRANDMA_OUTBOUND.registerSeller}?redirect=${encodeURIComponent(GRANDMA_PATHS.appRoot)}`,
              )
            }}
          >
            List your shop
          </button>
          <button
            type="button"
            className="shop-trio-btn"
            onClick={() => document.getElementById("shopList")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            ↓ Browse
          </button>
        </div>

        <div className="search">
          <span aria-hidden>🔎</span>
          <input
            value={shopSearch}
            onChange={(e) => setShopSearch(e.target.value)}
            placeholder="Search shops or products (e.g. milk, bread)"
            aria-label="Search shops or products"
          />
        </div>

        <div className="shop-filter-row" role="tablist" aria-label="Shop filters">
          {SHOP_FILTER_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={shopTab === t.id}
              className={`shop-filter-pill ${shopTab === t.id ? "active" : ""}`}
              onClick={() => setShopTab((prev) => (prev === t.id ? null : t.id))}
            >
              {t.label}
            </button>
          ))}
        </div>
        {shopSearchRelaxedNote ? (
          <p className="card note" style={{ marginTop: 8, marginBottom: 0, fontSize: 12, color: "#92400e", background: "#fffbeb", borderColor: "#fcd34d" }}>
            {shopSearchRelaxedNote}
          </p>
        ) : null}

        <div className="shop-list" id="shopList">
          {allShopsLoading ? (
            <div className="card note">Loading shops…</div>
          ) : shopsLoading ? (
            <div className="card note">Loading shops…</div>
          ) : shopsError ? (
            <div className="card note" style={{ color: "#b42318" }}>
              Error loading shops: {shopsError}
            </div>
          ) : allShopsError && allAvailableShops.length === 0 ? (
            <div className="card note" style={{ color: "#5a6b7a" }}>
              {allShopsError}
            </div>
          ) : null}
          {!allShopsLoading && !shopsLoading && !shopsError && visibleShops.length === 0 ? (
            <div className="card note">
              {!GRANDMA_SHOW_DEMO_SHOPS && allAvailableShops.length === 0 ? (
                <p style={{ marginBottom: 10, color: "#5a6b7a", fontSize: "0.92rem" }}>{GRANDMA_NO_LIVE_SHOPS_HINT}</p>
              ) : null}
              {shopSearch.trim() ? (
                shopProductSearchLoading ? (
                  <p style={{ margin: 0 }}>
                    {language === "rw"
                      ? "Turimo gushakisha ibicuruzya kugira ngo tubone amaduka abibamo…"
                      : language === "fr"
                        ? "Recherche des produits pour afficher les boutiques concernées…"
                        : "Searching the product catalog for shops that carry matching items…"}
                  </p>
                ) : language === "rw" ? (
                  <p style={{ margin: 0 }}>
                    Nta duka ryahuye na <strong>&quot;{shopSearch.trim()}&quot;</strong> ku izina cyangwa ibicuruzya.
                    {shopTab ? " Gerageza gukura filtere." : ""} Gerageza andi magambo cyangwa siba uko wanditse.
                  </p>
                ) : language === "fr" ? (
                  <p style={{ margin: 0 }}>
                    Aucun commerce ne correspond à <strong>&quot;{shopSearch.trim()}&quot;</strong> (nom ou produits du
                    catalogue).
                    {shopTab ? " Essayez de désactiver le filtre actif." : ""} Essayez d&apos;autres mots ou effacez la
                    recherche.
                  </p>
                ) : (
                  <p style={{ margin: 0 }}>
                    No shops match <strong>&quot;{shopSearch.trim()}&quot;</strong> by shop name, MoMo, or catalog
                    products
                    {shopTab ? " with the current filter." : "."} Try different words, clear the search box, or tap the
                    active filter again to turn it off.
                  </p>
                )
              ) : (
                <p style={{ margin: 0 }}>No shops match. Try another filter or search.</p>
              )}
            </div>
          ) : null}
          {!allShopsLoading && !shopsLoading && !shopsError && visibleShops.length > 0 ? (
            visibleShops.map((s) => (
              <div
                key={s.id}
                className="shop-row"
                onClick={() => {
                  setSelectedShopId(s.id)
                  setSearch("")
                  goToPage(3)
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    setSelectedShopId(s.id)
                    setSearch("")
                    goToPage(3)
                  }
                }}
              >
                <div className="shop-avatar" aria-hidden>
                  <img src={s.logoSrc} alt="" />
                </div>
                <div className="shop-row-meta">
                  <div className="shop-row-name">{s.name}</div>
                  <div className="shop-row-tag">{s.tagline}</div>
                  <div className="shop-row-items">
                    {`${Math.max(0, Math.floor(Number(s.stockLineCount ?? 0)))} ${tPay.sectorPanelItems}`}
                  </div>
                  <div className="shop-row-rating">
                    <span className="shop-stars" aria-hidden>
                      ★
                    </span>
                    <span className="shop-rating-num">{shopDisplayRating(s).toFixed(1)}</span>
                    <span className="shop-review-count">({shopDisplayReviews(s)} reviews)</span>
                  </div>
                  <div className="shop-row-badges">
                    {isPreferredGrandmaShop(s.id, preferredShopIds) ? (
                      <span className="shop-badge">★ Preferred</span>
                    ) : null}
                    {preferredShopIds.includes(PREFERRED_ALL_ID) ||
                    s.favorite ||
                    preferredShopIds
                      .filter((x) => x !== PREFERRED_ALL_ID)
                      .some((pid) => sameGrandmaSeller(pid, s.id)) ? (
                      <span className="shop-badge">★ Favorite</span>
                    ) : null}
                    {reorderSellerKeySet.has(sellerAccountFromGrandmaShopId(s.id).toUpperCase()) || s.orderedBefore ? (
                      <span className="shop-badge">Reorder</span>
                    ) : null}
                    {s.trending ? <span className="shop-badge">Trending</span> : null}
                    {s.onSale || onsaleSellerKeysSet.has(sellerAccountFromGrandmaShopId(s.id).toUpperCase()) ? (
                      <span className="shop-badge sale">On sale</span>
                    ) : null}
                  </div>
                </div>
                <div className="shop-row-dist">{s.distanceKm.toFixed(1)} km</div>
              </div>
            ))
          ) : null}
        </div>
      </section>

      {/* Page 3 — items */}
      <section className={`page ${page === 3 ? "active" : ""}`} id="page3-items">
        {selectedShop ? (
          <div className="card note" style={{ marginBottom: 12 }}>
            Shopping at <strong>{selectedShop.name}</strong>
            {isLiveMenuSelected ? (
              <span style={{ marginLeft: 8, color: "var(--muted)", fontWeight: 700 }}>
                · {burrowsLiveLoading ? "loading…" : `${burrowsLiveCount} items`}
              </span>
            ) : null}
            {isLiveMenuSelected && burrowsLiveError ? (
              <div style={{ marginTop: 6, color: "#b42318", fontSize: 12, fontWeight: 700 }}>
                Live menu error: {burrowsLiveError}
              </div>
            ) : null}
            {!isLiveMenuSelected && !productsLoading && !productsError ? (
              <span style={{ marginLeft: 8, color: "var(--muted)", fontWeight: 700 }}>
                · {visibleProducts.length.toLocaleString()} stock line
                {visibleProducts.length === 1 ? "" : "s"}
                {selectedShop.stockLineCount != null &&
                selectedShop.stockLineCount > 0 &&
                visibleProducts.length < selectedShop.stockLineCount
                  ? ` (${selectedShop.stockLineCount.toLocaleString()} in shop — loading more…)`
                  : ""}
              </span>
            ) : null}
          </div>
        ) : multiShopMode ? (
          <div className="card note" style={{ marginBottom: 12 }}>
            Showing best offers across shops (cheapest, then closest). Tap an item to choose the shop and add to cart.
          </div>
        ) : null}
        <div className="search">
          <span aria-hidden>🔎</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search item"
            aria-label="Search item"
          />
          <button className="reorder-btn" onClick={() => alert("Old orders / reorder")}>
            ↻
          </button>
        </div>

        <div className="product-list" id="productList">
          {productsLoading ? (
            <div className="card note">Loading products...</div>
          ) : productsError ? (
            <div className="card note" style={{ color: "#b42318" }}>
              Error loading products: {productsError}
            </div>
          ) : multiShopMode
            ? visibleOffers.map((o) => (
                <div
                  className="product-row"
                  key={o.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (o.shopId) setSelectedShopId(o.shopId)
                    changeQty(o.productId, 1)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      if (o.shopId) setSelectedShopId(o.shopId)
                      changeQty(o.productId, 1)
                    }
                  }}
                >
                  <div className="emoji">{o.productEmoji}</div>
                  <div>
                    <div className="p-name">{o.productName}</div>
                    <div className="p-price">
                      <strong style={{ color: "var(--text)" }}>{formatRwf(o.priceRwf)}</strong> · {o.shopName} ·{" "}
                      {o.shopDistanceKm.toFixed(1)} km
                    </div>
                  </div>
                  <div className="qty" aria-label="Set quantity">
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      value={qtyInputDisplay(products.find((p) => p.id === o.productId)?.qty ?? 0)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation()
                        if (o.shopId) setSelectedShopId(o.shopId)
                        applyQtyFromInput(o.productId, e.target.value)
                      }}
                      aria-label="Quantity"
                    />
                  </div>
                </div>
              ))
            : visibleProducts.length === 0 ? (
              <div className="card note">No products available for this shop.</div>
            ) : visibleProducts.map((p) => (
                <div className="product-row" key={p.liveKey ?? `p-${p.id}`}>
                  <div className="emoji" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        style={{ width: 34, height: 34, borderRadius: 10, objectFit: "cover", border: "1px solid var(--line)" }}
                        onClick={(e) => {
                          e.stopPropagation()
                          setImagePreviewTitle(p.name)
                          setImagePreviewSrc(p.imageUrl || "")
                          setImagePreviewOpen(true)
                        }}
                      />
                    ) : (
                      p.emoji
                    )}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="p-name">{p.name}</div>
                    <div className="p-price">{formatRwf(p.price)}</div>
                    {productStockOnHand(p) != null ? (
                      <div className="text-[11px] text-[#6f8399]" style={{ marginTop: 2 }}>
                        {tPay.stockOnHandLabel.replace("{n}", String(productStockOnHand(p)))}
                      </div>
                    ) : null}
                    {grandmaStockLineIssues.find((i) => i.id === p.id) ? (
                      <div
                        className="text-[11px] font-semibold text-amber-900"
                        style={{ marginTop: 4, lineHeight: 1.35 }}
                        role="alert"
                      >
                        {tPay.stockExceededLine
                          .replace(
                            "{requested}",
                            String(
                              grandmaStockLineIssues.find((i) => i.id === p.id)?.requested ?? p.qty,
                            ),
                          )
                          .replace(
                            "{available}",
                            String(
                              grandmaStockLineIssues.find((i) => i.id === p.id)?.available ??
                                productStockOnHand(p) ??
                                0,
                            ),
                          )}
                      </div>
                    ) : null}
                  </div>
                  <div className="qty">
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      value={qtyInputDisplay(p.qty)}
                      onChange={(e) => applyQtyFromInput(p.id, e.target.value)}
                      aria-label={`Quantity for ${p.name}`}
                    />
                  </div>
                </div>
              ))}
        </div>

        {imagePreviewOpen ? (
          <div
            className="courier-modal-backdrop"
            role="presentation"
            onClick={() => setImagePreviewOpen(false)}
          >
            <div
              className="courier-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Image preview"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="courier-modal-head">
                <div>
                  <div className="courier-modal-title">{imagePreviewTitle}</div>
                  <div className="courier-modal-sub">Tap outside to close</div>
                </div>
                <button
                  type="button"
                  className="courier-modal-close"
                  aria-label="Close"
                  onClick={() => setImagePreviewOpen(false)}
                >
                  ×
                </button>
              </div>
              <div style={{ padding: 14 }}>
                {imagePreviewSrc ? (
                  <img
                    src={imagePreviewSrc}
                    alt={imagePreviewTitle}
                    style={{ width: "100%", height: "auto", borderRadius: 14, border: "1px solid var(--line)" }}
                  />
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <div
          className="bottom-bar"
          onClick={() => goToPage(4)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              goToPage(4)
            }
          }}
          aria-label="Go to order summary"
        >
          <div id="bottomItems" className="bottom-bar-left">
            <span className="bottom-cart" aria-hidden>
              🛒
            </span>
            <span>
              {itemsCount} items
            </span>
          </div>
          <div id="bottomTotal">Total: {formatRwf(itemsTotal)}</div>
        </div>
        {hasGrandmaStockBlock ? (
          <div
            className="card note"
            style={{ marginTop: 10, color: "#92400e", borderColor: "#fcd34d", background: "#fffbeb" }}
            role="alert"
          >
            {tPay.stockExceededPayBlock}
            <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12, lineHeight: 1.45 }}>
              {grandmaStockLineIssues.map((issue) => (
                <li key={issue.id}>
                  {issue.name}:{" "}
                  {tPay.stockExceededLine
                    .replace("{requested}", String(issue.requested))
                    .replace("{available}", String(issue.available))}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>





      
{/* Page 3 — order lines (sits under .app, directly before #page3) */}
<div
  className={`page ${page === 4 ? "active" : ""}`}
  id="page4-order-head"
  aria-hidden={page !== 4}
>
  <div className="card summary-card">
    
    {/* HEADER */}
    <div className="summary-row">
      <div className="summary-left">
        Order Summary
      </div>

      <div id="summaryCount">
        {itemsCount} items
      </div>
    </div>

    {/* ITEMS */}
    <div id="summaryItems">
      {selectedProducts.length ? (
        selectedProducts.map((p) => (
          <div
            className="summary-row summary-item-row"
            key={p.id}
          >
            {/* LEFT SIDE */}
            <div className="summary-item-main">
              
              {/* PRODUCT NAME */}
              <div className="summary-left">
                {p.name} x{p.qty}
              </div>

              {/* PRODUCT PRICE */}
              <div className="summary-sub">
                {formatRwf(p.price)} each
              </div>

              {/* STOCK */}
              {productStockOnHand(p) != null ? (
                <div
                  className="summary-sub"
                  style={{ color: "#6f8399" }}
                >
                  {tPay.stockOnHandLabel.replace(
                    "{n}",
                    String(productStockOnHand(p)),
                  )}
                </div>
              ) : null}

              {/* STOCK WARNING */}
              {grandmaStockLineIssues.find(
                (i) => i.id === p.id,
              ) ? (
                <div
                  className="summary-sub"
                  style={{
                    color: "#92400e",
                    fontWeight: 600,
                  }}
                  role="alert"
                >
                  {tPay.stockExceededLine
                    .replace(
                      "{requested}",
                      String(
                        grandmaStockLineIssues.find(
                          (i) => i.id === p.id,
                        )?.requested ?? p.qty,
                      ),
                    )
                    .replace(
                      "{available}",
                      String(
                        grandmaStockLineIssues.find(
                          (i) => i.id === p.id,
                        )?.available ??
                          productStockOnHand(p) ??
                          0,
                      ),
                    )}
                </div>
              ) : null}
            </div>

            {/* RIGHT SIDE */}
            <div className="flex flex-col items-end gap-3">

              {/* REMOVE BUTTON */}
              <button
                type="button"
                aria-label={`Remove ${p.name} from cart`}
                onClick={() => setQtyDirect(p.id, 0)}
                className="flex items-center gap-2 border border-slate-200 rounded-2xl px-4 py-3 text-rose-600 font-semibold bg-white hover:bg-rose-50 transition"
              >
                <Trash2 size={18} />
                Remove
              </button>

              {/* EDIT QUANTITY */}
              <div className="flex items-center gap-3">

                {/* EDIT BUTTON */}
                <button
                  type="button"
                  className="border border-slate-200 rounded-2xl px-4 py-3 bg-white hover:bg-slate-50 transition text-slate-700 font-semibold"
                >
                  Edit Qty
                </button>

                {/* INPUT */}
                <input
                  type="number"
                  min={1}
                  value={p.qty}
                  onChange={(e) => {
                    const value = Number(e.target.value)

                    if (
                      !Number.isNaN(value) &&
                      value > 0
                    ) {
                      setQtyDirect(p.id, value)
                    }
                  }}
                  className="w-[90px] border border-slate-200 rounded-2xl px-4 py-3 text-center font-bold text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
              </div>

              {/* TOTAL */}
              <strong className="text-[20px] font-extrabold text-[#082552]">
                {formatRwf(p.qty * p.price)}
              </strong>
            </div>
          </div>
        ))
      ) : (
        <div className="note">
          No items selected yet.
        </div>
      )}
    </div>
  </div>
</div>















      {/* Page 4 — shipment, shop, totals, notes, pay */}
      <section className={`page ${page === 4 ? "active" : ""}`} id="page4-summary">
        <div className="section-title">{tPay.sectionLogistics}</div>
        <div className="order-extras-label" style={{ marginBottom: 8 }}>
          {tPay.fulfillmentSectionTitle}
        </div>
        <div className="fulfillment-row" role="group" aria-label={tPay.fulfillmentSectionTitle}>
          <div
            className={`log-option ${fulfillmentMode === "delivery" ? "active" : ""}`}
            onClick={() => setFulfillmentMode("delivery")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                setFulfillmentMode("delivery")
              }
            }}
          >
            <span className="log-icon" aria-hidden>
              🚚
            </span>
            <div className="log-label">{tPay.fulfillmentDeliveryTitle}</div>
            <div className="fulfill-sub">{tPay.fulfillmentDeliverySub}</div>
          </div>
          <div
            className={`log-option ${fulfillmentMode === "pickup" ? "active" : ""}`}
            onClick={() => setFulfillmentMode("pickup")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                setFulfillmentMode("pickup")
              }
            }}








          >
            <span className="log-icon" aria-hidden>
              🏪
            </span>
            <div className="log-label">{tPay.fulfillmentPickupTitle}</div>
            <div className="fulfill-sub">{tPay.fulfillmentPickupSub}</div>
          </div>
        </div>

        <p className="note" style={{ marginTop: 0, marginBottom: 10 }}>
          {fulfillmentMode === "delivery"
            ? tPay.logisticsNote.replace("{km}", deliveryKm.toFixed(1))
            : tPay.logisticsNotePickup}
        </p>

        <div className="card shop-box">
          <div className="logo">
            <img
              src={selectedShop?.logoSrc ?? "/img/logo.png"}
              alt=""
              aria-hidden
            />
          </div>
          <div className="shop-main">
            <div className="shop-name">{selectedShop?.name ?? "Select a shop"}</div>
            <div className="shop-code">{selectedShop?.momo ?? "—"}</div>
            {selectedShop ? (
              <div className="shop-inline-rating">
                ★ {shopDisplayRating(selectedShop).toFixed(1)} · {shopDisplayReviews(selectedShop)} reviews
              </div>
            ) : null}
          </div>
          <div className="shop-dist-pill" title="Distance to this shop">
            {selectedShop ? `${selectedShop.distanceKm.toFixed(1)} km` : "—"}
          </div>
        </div>

        {fulfillmentMode === "delivery" ? (
          <>
            <div className="order-extras-label" style={{ marginBottom: 8 }}>
              {tPay.fulfillmentDeliveryModesHint}
            </div>
            <div className="logistics-row" id="logisticsRow">
              {LOGISTICS.map((opt) => (
                <div
                  key={opt.id}
                  className={`log-option ${selectedLogistics === opt.id ? "active" : ""}`}
                  onClick={() => selectLogisticsMode(opt.id)}
                  role="button"
                  tabIndex={0}
                >
                  <span className="log-icon" aria-hidden>
                    {opt.icon}
                  </span>
                  <div className="log-label">
                    {opt.id === "human" ? tPay.logHuman : opt.id === "bike" ? tPay.logBike : tPay.logMoto}
                  </div>
                  <div className="log-price">{formatRwf(logisticsQuote(opt, deliveryKm))}</div>
                </div>
              ))}
            </div>
          </>
        ) : null}

        <div className="card summary-card">
          <div className="summary-row">
            <span>{tPay.summaryLineItems}</span>
            <strong id="sumItemsCount">{itemsCount}</strong>
          </div>
          <div className="summary-row">
            <span>{tPay.summaryLineItemsTotal}</span>
            <strong id="sumItemsTotal">{formatRwf(itemsTotal)}</strong>
          </div>
          <div className="summary-row" style={{ color: "var(--muted)", fontSize: 13 }}>
            <span>{tPay.ihuteFees}</span>
            <strong id="sumIhuteFees">{formatRwf(ihuteFees)}</strong>
          </div>
          <div className="summary-row">
            <span>{tPay.taxes}</span>
            <strong id="sumTaxes">{formatRwf(TAXES_PLACEHOLDER)}</strong>
          </div>
          <div className="summary-row">
            <span>{tPay.summaryLineLogisticsRow}</span>
            <strong id="sumLogistics">{formatRwf(logisticsTotal)}</strong>
          </div>
          <div className="summary-row">
            <span>{tPay.summaryLineGrandTotal}</span>
            <strong id="sumGrand">{formatRwf(grandTotal)}</strong>
          </div>
        </div>

        <div className="card order-extras-card">
          <div className="order-extras-label">Notes for this order</div>
          <textarea
            className="order-notes-input"
            placeholder="Allergies, delivery instructions, substitutions…"
            value={orderNotes}
            onChange={(e) => setOrderNotes(e.target.value)}
            aria-label="Order notes"
          />
        </div>

        <div className="card prescription-card">
          <div className="prescription-actions">
            <input
              ref={prescriptionInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="prescription-hidden"
              multiple
              onChange={(e) => {
                addPrescriptionFiles(e.target.files)
                e.target.value = ""
              }}
            />
            <button
              type="button"
              className="prescription-btn prescription-btn-block"
              onClick={() => prescriptionInputRef.current?.click()}
            >
              📷 Take or choose photo (if needed)
            </button>
          </div>
          {prescriptionSlots.length > 0 ? (
            <div className="prescription-thumbs">
              {prescriptionSlots.map((s) => (
                <div className="prescription-thumb" key={s.id}>
                  <img src={s.url} alt={s.file.name} />
                  <button type="button" aria-label="Remove photo" onClick={() => removePrescription(s.id)}>
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="card summary-pay-card">
          {hasGrandmaStockBlock ? (
            <p
              className="card note"
              style={{ marginBottom: 10, color: "#92400e", borderColor: "#fcd34d", background: "#fffbeb" }}
              role="alert"
            >
              {tPay.stockExceededPayBlock}
            </p>
          ) : null}
          <button
            type="button"
            className="primary-btn summary-pay-btn"
            disabled={hasGrandmaStockBlock}
            onClick={() => {
              if (hasGrandmaStockBlock) return
              goToPage(5)
            }}
          >
            <span className="summary-pay-icon" aria-hidden>
              💳
            </span>
            Pay
          </button>
        </div>
      </section>

      {/* Page 4 */}
      <section className={`page ${page === 5 ? "active" : ""}`} id="page5-pay">
        <div className="card pay-details-card">
          <div className="pay-detail-row">
            <span className="pay-detail-label">{tPay.payingTo}</span>
            <span className="pay-detail-value">{selectedShop?.name ?? "—"}</span>
          </div>
          <div className="pay-detail-row">
            <span className="pay-detail-label">{tPay.bankName}</span>
            <span className="pay-detail-value">{getPaymentDetails(selectedShop, selectedPayment).bankName}</span>
          </div>
          <div className="pay-detail-row">
            <span className="pay-detail-label">{tPay.account}</span>
            <span className="pay-detail-value">{getPaymentDetails(selectedShop, selectedPayment).account}</span>
          </div>
          <div className="pay-detail-row">
            <span className="pay-detail-label">{tPay.yourLocation}</span>
            <div className="flex items-center gap-2">
              <span className="pay-detail-value">{displayUserLocation}</span>
              <button
                type="button"
                onClick={() => setLocationDialogOpen(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-colors"
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {locationData ? "Change" : "Set Location"}
              </button>
            </div>
          </div>
          <div className="pay-detail-row">
            <span className="pay-detail-label">{tPay.eta}</span>
            <span className="pay-detail-value">
              {fulfillmentMode === "pickup" ? tPay.etaAtShop : `${etaRange.lo}–${etaRange.hi} min`}
            </span>
          </div>
          <div className="pay-detail-sub" style={{ paddingTop: 2 }}>
            {etaSubText}
          </div>
        </div>

        <div className="section-title">{tPay.paymentModeSection}</div>
        <div id="paymentList">
          {PAYMENTS.map((mode) => (
            <div
              key={mode.id}
              className={`card pay-item ${selectedPayment === mode.id ? "active" : ""}`}
              onClick={() => setSelectedPayment(mode.id)}
              role="button"
              tabIndex={0}
            >
              <div className="pay-left">
                <span className="pay-logo">
                  <img src={mode.iconSrc} alt="" aria-hidden />
                </span>
                <span>{mode.label}</span>
              </div>
              <span className="radio" aria-hidden />
            </div>
          ))}
        </div>

        {selectedShop && selectedPayment !== "bk" ? (
          <div
            className="card pay-method-form"
            style={{ textAlign: "left", marginTop: 12, marginBottom: 12, padding: "14px 16px" }}
          >
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text)" }}>{tPay.payStepPanelTitle}</div>
              {tPay.payStepDemoNote.trim() ? (
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, lineHeight: 1.35 }}>
                  {tPay.payStepDemoNote}
                </div>
              ) : null}
            </div>

            {!grandmaBuyerSession?.phone?.trim() ? (
              <div className="mb-4 space-y-2">
                <div className="flex items-start gap-2">
                  <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden />
                  <Label htmlFor="grandma-guest-phone" className="text-sm font-bold leading-snug text-emerald-950">
                    {tPay.paymentGuestPhoneLabel}
                  </Label>
                </div>
                <Input
                  id="grandma-guest-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder={tPay.paymentGuestPhonePlaceholder}
                  value={grandmaBuyerPhoneInput}
                  onChange={(e) => setGrandmaBuyerPhoneInput(e.target.value)}
                  className="pay-input-tap min-h-[48px] border-emerald-200 bg-white text-base focus-visible:ring-emerald-500/30"
                />
                <p className="text-xs leading-snug text-emerald-900/80">
                  {tPay.paymentGuestPhoneNote}{" "}
                  <a
                    href={`${GRANDMA_PATHS.login}?redirect=${encodeURIComponent(GRANDMA_PATHS.appRoot)}`}
                    className="font-semibold text-emerald-800 underline underline-offset-2"
                  >
                    {tPay.signIn}
                  </a>
                </p>
              </div>
            ) : null}

            {selectedPayment === "momo" ? (
              <div className="space-y-3">
                <div style={{ fontWeight: 700, fontSize: 13 }}>{tPay.payStepMtnTitle}</div>
                {grandmaMtnUssd ? (
                  <div>
                    <span className="text-xs font-bold text-[#166534]">{tPay.payStepMtnDial}</span>
                    <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "stretch" }}>
                      <code
                        style={{
                          flex: 1,
                          minWidth: 0,
                          wordBreak: "break-all",
                          fontSize: 12,
                          padding: "10px 10px",
                          background: "var(--pay-soft)",
                          borderRadius: 10,
                          border: "1px solid #bbf7d0",
                          lineHeight: 1.35,
                        }}
                      >
                        {grandmaMtnUssd}
                      </code>
                      <div className="flex shrink-0 gap-2 self-center">
                        <Button
                          type="button"
                          variant="outline"
                          className="border-blue-200 text-xs font-bold text-blue-900 hover:bg-blue-50"
                          onClick={() => {
                            void (async () => {
                              try {
                                await navigator.clipboard.writeText(grandmaMtnUssd)
                                setGrandmaUssdCopied(true)
                                window.setTimeout(() => setGrandmaUssdCopied(false), 2000)
                              } catch {
                                window.alert(grandmaMtnUssd)
                              }
                            })()
                          }}
                        >
                          {grandmaUssdCopied ? tPay.payStepCopied : tPay.payStepCopy}
                        </Button>
                        {grandmaMtnUssdTelHref ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="border-blue-200 text-xs font-bold text-blue-900 hover:bg-blue-50"
                            asChild
                          >
                            <a href={grandmaMtnUssdTelHref}>
                              <Phone className="mr-1 h-3.5 w-3.5" aria-hidden />
                              {tPay.payStepDialMomo}
                            </a>
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            className="border-blue-200 text-xs font-bold text-blue-900"
                            disabled
                          >
                            <Phone className="mr-1 h-3.5 w-3.5" aria-hidden />
                            {tPay.payStepDialMomo}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: "#b45309", margin: 0 }}>{tPay.payStepMtnNoUssd}</p>
                )}
                <div
                  className="min-w-0 space-y-2 rounded-xl border border-[#dbe7f3] bg-white px-3 py-3"
                  style={{ marginTop: 4 }}
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 shrink-0 text-[#127fc0]" aria-hidden />
                    <span className="text-sm font-semibold text-[#17324d]">{tPay.payStepReadMoMoSmsTitle}</span>
                  </div>
                  <p className="text-xs text-[#6f8399]">
                    {tPay.payStepReadMoMoSmsHint.replace(
                      "{total}",
                      Math.round(grandTotal).toLocaleString(),
                    )}
                  </p>
                  <Textarea
                    value={grandmaMomoSmsPaste}
                    onChange={(e) => {
                      setGrandmaMomoSmsPaste(e.target.value)
                      setGrandmaSmsPayCheck(null)
                      setGrandmaSmsMatchResult(null)
                    }}
                    className="min-h-[88px] resize-y border-[#dbe7f3] text-sm"
                    placeholder="MTN MoMo…"
                    aria-label={tPay.payStepReadMoMoSmsTitle}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full border-[#dbe7f3] bg-[#f7fbff] text-[#17324d] hover:bg-[#eef6ff]"
                    onClick={() => verifyGrandmaMoMoSms()}
                    disabled={grandTotal < 1 || !grandmaMomoSmsPaste.trim()}
                  >
                    {tPay.payStepVerifySms}
                  </Button>
                  {grandmaSmsPayCheck === "paid" ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-2 text-xs font-medium text-emerald-900">
                      {grandmaSmsMatchResult?.txId
                        ? tPay.payStepPaymentPaidMatchedWithTxn.replace(
                            "{txnId}",
                            grandmaSmsMatchResult.txId,
                          )
                        : tPay.payStepPaymentPaidMatched}
                    </div>
                  ) : null}
                  {grandmaSmsPayCheck === "no_amount" ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-2 text-xs text-amber-950">
                      {tPay.payStepPaymentNoAmountInSms}
                    </div>
                  ) : null}
                  {grandmaSmsPayCheck === "mismatch" && grandmaSmsMatchResult ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-2 py-2 text-xs text-red-900">
                      {tPay.payStepPaymentMismatch
                        .replace("{got}", String(grandmaSmsMatchResult.amount ?? "—"))
                        .replace("{expected}", Math.round(grandTotal).toLocaleString())}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : selectedPayment === "airtel" ? (
              <div className="space-y-3">
                <div style={{ fontWeight: 700, fontSize: 13 }}>{tPay.payStepAirtelTitle}</div>
                {grandmaAirtelUssd ? (
                  <div>
                    <span className="text-xs font-bold text-[#166534]">{tPay.payStepAirtelDial}</span>
                    <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "stretch" }}>
                      <code
                        style={{
                          flex: 1,
                          minWidth: 0,
                          wordBreak: "break-all",
                          fontSize: 12,
                          padding: "10px 10px",
                          background: "var(--pay-soft)",
                          borderRadius: 10,
                          border: "1px solid #bbf7d0",
                          lineHeight: 1.35,
                        }}
                      >
                        {grandmaAirtelUssd}
                      </code>
                      <div className="flex shrink-0 gap-2 self-center">
                        <Button
                          type="button"
                          variant="outline"
                          className="border-blue-200 text-xs font-bold text-blue-900 hover:bg-blue-50"
                          onClick={() => {
                            void (async () => {
                              try {
                                await navigator.clipboard.writeText(grandmaAirtelUssd)
                                setGrandmaUssdCopied(true)
                                window.setTimeout(() => setGrandmaUssdCopied(false), 2000)
                              } catch {
                                window.alert(grandmaAirtelUssd)
                              }
                            })()
                          }}
                        >
                          {grandmaUssdCopied ? tPay.payStepCopied : tPay.payStepCopy}
                        </Button>
                        {grandmaAirtelUssdTelHref ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="border-blue-200 text-xs font-bold text-blue-900 hover:bg-blue-50"
                            asChild
                          >
                            <a href={grandmaAirtelUssdTelHref}>
                              <Phone className="mr-1 h-3.5 w-3.5" aria-hidden />
                              {tPay.payStepDialMomo}
                            </a>
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            className="border-blue-200 text-xs font-bold text-blue-900"
                            disabled
                          >
                            <Phone className="mr-1 h-3.5 w-3.5" aria-hidden />
                            {tPay.payStepDialMomo}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
                <p style={{ fontSize: 11, color: "var(--muted)", margin: 0, lineHeight: 1.45 }}>{tPay.payStepAirtelHelp}</p>
                <div
                  className="min-w-0 space-y-2 rounded-xl border border-[#dbe7f3] bg-white px-3 py-3"
                  style={{ marginTop: 4 }}
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 shrink-0 text-[#127fc0]" aria-hidden />
                    <span className="text-sm font-semibold text-[#17324d]">{tPay.payStepReadMoMoSmsTitle}</span>
                  </div>
                  <p className="text-xs text-[#6f8399]">
                    {tPay.payStepReadMoMoSmsHint.replace(
                      "{total}",
                      Math.round(grandTotal).toLocaleString(),
                    )}
                  </p>
                  <Textarea
                    value={grandmaMomoSmsPaste}
                    onChange={(e) => {
                      setGrandmaMomoSmsPaste(e.target.value)
                      setGrandmaSmsPayCheck(null)
                      setGrandmaSmsMatchResult(null)
                    }}
                    className="min-h-[88px] resize-y border-[#dbe7f3] text-sm"
                    placeholder="Airtel Money…"
                    aria-label={tPay.payStepReadMoMoSmsTitle}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full border-[#dbe7f3] bg-[#f7fbff] text-[#17324d] hover:bg-[#eef6ff]"
                    onClick={() => verifyGrandmaMoMoSms()}
                    disabled={grandTotal < 1 || !grandmaMomoSmsPaste.trim()}
                  >
                    {tPay.payStepVerifySms}
                  </Button>
                  {grandmaSmsPayCheck === "paid" ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-2 text-xs font-medium text-emerald-900">
                      {grandmaSmsMatchResult?.txId
                        ? tPay.payStepPaymentPaidMatchedWithTxn.replace(
                            "{txnId}",
                            grandmaSmsMatchResult.txId,
                          )
                        : tPay.payStepPaymentPaidMatched}
                    </div>
                  ) : null}
                  {grandmaSmsPayCheck === "no_amount" ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-2 text-xs text-amber-950">
                      {tPay.payStepPaymentNoAmountInSms}
                    </div>
                  ) : null}
                  {grandmaSmsPayCheck === "mismatch" && grandmaSmsMatchResult ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-2 py-2 text-xs text-red-900">
                      {tPay.payStepPaymentMismatch
                        .replace("{got}", String(grandmaSmsMatchResult.amount ?? "—"))
                        .replace("{expected}", Math.round(grandTotal).toLocaleString())}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div style={{ fontWeight: 700, fontSize: 13 }}>{tPay.payStepCashTitle}</div>
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    cursor: "pointer",
                    fontSize: 13,
                    lineHeight: 1.45,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={grandmaCashConfirm}
                    onChange={(e) => setGrandmaCashConfirm(e.target.checked)}
                    style={{ marginTop: 3, width: 16, height: 16, flexShrink: 0 }}
                  />
                  <span>{tPay.payStepCashConfirm}</span>
                </label>
              </div>
            )}

            <p
              style={{
                fontSize: 11,
                color: "var(--muted)",
                margin: "14px 0 0",
                lineHeight: 1.45,
                borderTop: "1px solid var(--line)",
                paddingTop: 10,
              }}
            >
              {tPay.payStepCommissionNote}
            </p>
          </div>
        ) : null}

        <div className="card breakdown">
          <div className="summary-row">
            <span>{tPay.amountShop}</span>
            <strong id="payShop">{formatRwf(itemsTotal)}</strong>
          </div>
          <div className="summary-row" style={{ color: "var(--muted)", fontSize: 13 }}>
            <span>{tPay.ihuteFees}</span>
            <strong id="payIhuteFees">{formatRwf(ihuteFees)}</strong>
          </div>
          <div className="summary-row">
            <span>{tPay.taxes}</span>
            <strong id="payTaxes">{formatRwf(TAXES_PLACEHOLDER)}</strong>
          </div>
          <div className="summary-row">
            <span>{tPay.amountLogistics}</span>
            <strong id="payLogistics">{formatRwf(logisticsTotal)}</strong>
          </div>
          <div className="summary-row">
            <span>{tPay.totalPay}</span>
            <strong id="payTotal">{formatRwf(grandTotal)}</strong>
          </div>
        </div>

        {fulfillmentMode === "delivery" ? (
          <div
            className="card rider-card"
            onClick={() => setCourierModalOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                setCourierModalOpen(true)
              }
            }}
            role="button"
            tabIndex={0}
            aria-label="View couriers near the shop"
          >
            <div className="rider-card-inner">
              <div className="rider-avatar" aria-hidden>
                {featuredCourierSafe.avatarEmoji}
              </div>
              <div className="rider-body">
                <div className="rider-name">{featuredCourierSafe.name}</div>
                <div className="rider-role">{tPay.deliveryPerson}</div>
                <div className="rider-hobbies">
                  <span>{tPay.hobbies}</span>
                  {featuredCourierSafe.hobbies}
                </div>
                <div className="rider-meta-row">
                  <span className="rider-stars" aria-hidden>
                    {courierStarGlyphs(featuredCourierSafe.rating)}
                  </span>
                  <span className="rider-reviews">
                    {featuredCourierSafe.rating.toFixed(1)} · {featuredCourierSafe.reviewCount} {tPay.reviewers}
                  </span>
                  <span className="rider-dist">
                    {featuredCourierSafe.distanceToShopKm.toFixed(2)} {tPay.kmToShop}
                  </span>
                </div>
              </div>
            </div>
            <div className="rider-tap-hint">{tPay.tapCouriers}</div>
          </div>
        ) : null}

        {fulfillmentMode === "delivery" && courierModalOpen ? (
          <div
            className="courier-modal-backdrop"
            role="presentation"
            onClick={() => setCourierModalOpen(false)}
          >
            <div
              className="courier-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="courier-modal-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="courier-modal-head">
                <div>
                  <div className="courier-modal-title" id="courier-modal-title">
                    {tPay.closestToShop}
                  </div>
                  <div className="courier-modal-sub">
                    {selectedShop?.name ?? "Pickup shop"} · {tPay.top5Available}
                  </div>
                </div>
                <button
                  type="button"
                  className="courier-modal-close"
                  aria-label="Close"
                  onClick={() => setCourierModalOpen(false)}
                >
                  ×
                </button>
              </div>
              <div className="courier-modal-list">
                {topFiveCouriers.map((c, i) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`courier-modal-row ${assignedCourierId === c.id || (!assignedCourierId && i === 0) ? "selected" : ""}`}
                    onClick={() => {
                      setAssignedCourierId(c.id)
                      setCourierModalOpen(false)
                    }}
                  >
                    <span className="courier-modal-rank">{i + 1}</span>
                    <div className="rider-avatar" style={{ width: 48, height: 48, fontSize: 24 }} aria-hidden>
                      {c.avatarEmoji}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                      <div className="rider-name" style={{ fontSize: 15 }}>
                        {c.name}
                      </div>
                      <div className="rider-hobbies" style={{ marginTop: 6, fontSize: 12 }}>
                        {c.hobbies}
                      </div>
                      <div className="rider-meta-row" style={{ marginTop: 6 }}>
                        <span className="rider-stars">{courierStarGlyphs(c.rating)}</span>
                        <span className="rider-reviews">
                          {c.rating.toFixed(1)} · {c.reviewCount} {tPay.reviewers}
                        </span>
                      </div>
                    </div>
                    <div className="rider-dist" style={{ alignSelf: "center" }}>
                      {c.distanceToShopKm.toFixed(2)} km
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {grandmaOrderSubmitError ? (
          <div className="card note" style={{ color: "#b42318", marginBottom: 12 }}>
            {grandmaOrderSubmitError}
          </div>
        ) : null}
        {grandmaCanSendOrder ? (
          <button
            type="button"
            className="primary-btn inline-flex min-h-[52px] w-full items-center justify-center gap-2 transition-transform duration-150 active:scale-[0.99]"
            disabled={grandmaOrderSubmitting}
            onClick={() => void submitGrandmaOrder()}
          >
            {grandmaOrderSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
                <span>{tPay.payStepProcessing}</span>
              </>
            ) : (
              tPay.sendOrder
            )}
          </button>
        ) : (
          <p className="card note" style={{ marginBottom: 12, fontSize: 13, lineHeight: 1.45 }}>
            {hasGrandmaStockBlock
              ? tPay.stockExceededPayBlock
              : selectedPayment === "momo"
                ? tPay.payStepSendOrderLocked
                : selectedPayment === "cash"
                  ? tPay.payStepErrCash
                  : selectedPayment === "airtel"
                    ? tPay.payStepErrPhone
                    : tPay.payStepSendOrderLocked}
          </p>
        )}
        <p className="card note" style={{ marginTop: 12, fontSize: 12, color: "var(--muted)" }}>
          {tPay.payStepAfterCheckoutHint}
        </p>
      </section>

      <div className={cn("footer", showSupplierDashboardNav && "footer--supplier-6")}>
        <button type="button" className={page === 1 ? "active" : ""} onClick={() => goToPage(1)}>
          🏠<span>{settingsUi.footerHome}</span>
        </button>
        <button type="button" className={page === 2 ? "active" : ""} onClick={() => goToPage(2)}>
          🏬<span>{settingsUi.footerShops}</span>
        </button>
        <button type="button" className={page === 3 ? "active" : ""} onClick={() => goToPage(3)}>
          🛍️<span>{settingsUi.footerItems}</span>
        </button>
        <button type="button" className={page === 4 ? "active" : ""} onClick={() => goToPage(4)}>
          📦<span>{settingsUi.footerSummary}</span>
        </button>
        <button type="button" className={page === 5 ? "active" : ""} onClick={() => goToPage(5)}>
          💳<span>{settingsUi.footerPay}</span>
        </button>
        {showSupplierDashboardNav ? (
          <button
            type="button"
            title={settingsUi.footerDashboard}
            aria-label={settingsUi.footerDashboard}
            onClick={() => router.push("/supplier/dashboard")}
          >
            <LayoutDashboard className="footer-dash-icon" aria-hidden />
            <span>{settingsUi.footerDashboardShort}</span>
          </button>
        ) : null}
      </div>

      <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
        <SheetContent
          side="right"
          className="flex h-[100dvh] w-full max-w-[min(100vw,420px)] flex-col gap-0 overflow-hidden border-l p-0"
        >
          <SheetHeader className="shrink-0 border-b border-border px-4 py-4 text-left">
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>
              {page === 2
                ? "Refine which shops you see."
                : page === 3
                  ? "Price, category, and sort — same for restaurants (Resitora) and pharmacies (Farumasi), and for multi-shop offers."
                  : "Filters"}
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4">
            {page === 2 ? (
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Shops</div>
                <p className="mt-1 text-xs text-muted-foreground">Same options as the pills on the list.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {SHOP_FILTER_TABS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setShopTab((prev) => (prev === t.id ? null : t.id))}
                      className={cn(
                        "rounded-full border px-3 py-2 text-sm font-bold transition-colors",
                        shopTab === t.id
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-border bg-background text-foreground hover:bg-muted/60",
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setUseLocationSort((v) => !v)}
                  className={cn(
                    "mt-4 w-full rounded-xl border px-3 py-2.5 text-left text-sm font-bold transition-colors",
                    useLocationSort
                      ? "border-green-600 bg-green-50 text-green-900"
                      : "border-border bg-background hover:bg-muted/60",
                  )}
                >
                  {useLocationSort ? "Near me first · on" : "Near me first · off"}
                </button>
              </div>
            ) : null}

            {page === 3 ? (
              <div className="space-y-6">
                <div>
                  <div className="text-sm font-bold text-foreground">Price range (RWF)</div>
                  {filterHistogramPrices.length > 0 && filterPriceExtent.max >= filterPriceExtent.min ? (
                    <>
                      <div className="mt-3 flex h-11 w-full items-end gap-px rounded-md bg-muted/50 px-1 pb-0.5 pt-1">
                        {(() => {
                          const maxBin = Math.max(1, ...filterHistogramBins)
                          return filterHistogramBins.map((c, i) => (
                            <div
                              key={i}
                              className="min-w-0 flex-1 rounded-[2px] bg-slate-400/70"
                              style={{ height: `${Math.max(10, (c / maxBin) * 100)}%` }}
                              aria-hidden
                            />
                          ))
                        })()}
                      </div>
                      <div className="mt-4 px-1">
                        <Slider
                          min={filterPriceExtent.min}
                          max={filterPriceExtent.max}
                          step={priceSliderStep}
                          value={(() => {
                            const loE = filterPriceExtent.min
                            const hiE = filterPriceExtent.max
                            if (hiE <= loE) return [loE, hiE]
                            const lo = priceRangeRwf?.[0] ?? loE
                            const hi = priceRangeRwf?.[1] ?? hiE
                            return [
                              Math.min(Math.max(lo, loE), hiE),
                              Math.min(Math.max(hi, loE), hiE),
                            ] as [number, number]
                          })()}
                          onValueChange={(v) => setPriceRangeRwf([v[0], v[1]] as [number, number])}
                          disabled={filterPriceExtent.max <= filterPriceExtent.min}
                          className="w-full"
                        />
                      </div>
                      <div className="mt-2 flex justify-between text-xs font-semibold text-muted-foreground">
                        <span>{formatRwf(priceRangeRwf?.[0] ?? filterPriceExtent.min)}</span>
                        <span>
                          {(priceRangeRwf?.[1] ?? filterPriceExtent.max) >= filterPriceExtent.max &&
                          filterPriceExtent.max > filterPriceExtent.min
                            ? "No max"
                            : formatRwf(priceRangeRwf?.[1] ?? filterPriceExtent.max)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">No prices to filter yet.</p>
                  )}
                </div>

                {filterMenuCategoryKeys.length > 0 ? (
                  <div>
                    <div className="text-sm font-bold text-foreground">Category</div>
                    <div className="mt-3 max-h-52 overflow-y-auto pr-1">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setItemsMenuCategoryKey(null)}
                          className={cn(
                            "rounded-full border px-3 py-2 text-sm font-bold transition-colors",
                            itemsMenuCategoryKey === null
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "border-border bg-background text-foreground hover:bg-muted/60",
                          )}
                        >
                          Any
                        </button>
                        {filterMenuCategoryKeys.map((canon) => (
                          <button
                            key={canon}
                            type="button"
                            onClick={() => setItemsMenuCategoryKey(canon)}
                            className={cn(
                              "rounded-full border px-3 py-2 text-sm font-bold transition-colors",
                              itemsMenuCategoryKey === canon
                                ? "border-blue-600 bg-blue-600 text-white"
                                : "border-border bg-background text-foreground hover:bg-muted/60",
                            )}
                          >
                            {menuCategoryTitleFromCanon(canon)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}

                <div>
                  <div className="text-sm font-bold text-foreground">Sort</div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {(
                      [
                        ["default", "Default order"],
                        ["name", "Name A–Z"],
                        ["price_asc", "Price · low first"],
                        ["price_desc", "Price · high first"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setItemsSort(id)}
                        className={cn(
                          "rounded-xl border px-2 py-2.5 text-xs font-bold transition-colors sm:text-sm",
                          itemsSort === id
                            ? "border-blue-600 bg-blue-50 text-blue-900"
                            : "border-border bg-background text-foreground hover:bg-muted/60",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {isLiveMenuSelected ? (
                  <div className="space-y-4 border-t border-border pt-5">
                    <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Live menu</div>
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-3 hover:bg-muted/40">
                      <input
                        type="checkbox"
                        checked={liveInStockOnly}
                        onChange={(e) => setLiveInStockOnly(e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600"
                      />
                      <span>
                        <span className="block text-sm font-bold">In stock only</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">Hide lines the supplier marked out of stock.</span>
                      </span>
                    </label>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-border bg-background px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                className="text-sm font-bold text-foreground underline-offset-4 hover:underline"
                onClick={clearGrandmaFilters}
              >
                Clear all
              </button>
              <button
                type="button"
                className="rounded-xl bg-[#1a4d8c] px-5 py-2.5 text-sm font-bold text-white shadow-sm"
                onClick={() => setFilterSheetOpen(false)}
              >
                {page === 2 ? "Show shops" : "Show products"}
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet
        open={settingsOpen}
        onOpenChange={(open) => {
          setSettingsOpen(open)
          if (open) {
            setSettingsModePick(appMode)
            setSettingsSellerGuardMsg(null)
          } else {
            setSettingsSellerGuardMsg(null)
          }
        }}
      >
        <SheetContent
          side="right"
          className="flex h-full max-h-[100dvh] w-full max-w-[min(100vw,420px)] flex-col gap-0 overflow-hidden border-l p-0"
        >
          <SheetHeader className="shrink-0 border-b border-border px-4 py-4 text-left">
            <SheetTitle>{settingsUi.settings}</SheetTitle>
            <SheetDescription>{settingsUi.settingsSub}</SheetDescription>
            <p className="mt-2 text-xs text-muted-foreground">
              {settingsUi.versionLabel} {GRANDMA_APP_VERSION}
            </p>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <div className="space-y-6">
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Mode</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(["buyer", "seller"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setSettingsModePick(mode)
                        if (mode === "buyer") {
                          setSettingsSellerGuardMsg(null)
                          writeGrandmaSignupRole("buyer")
                          setAppMode("buyer")
                          setSellerView("home")
                          setPage(1)
                          try {
                            localStorage.setItem("grandma:mode", "buyer")
                          } catch {
                            /* ignore */
                          }
                          return
                        }
                        writeGrandmaSignupRole("seller")
                        const st = useAuthStore.getState()
                        const u = st.user
                        if (u && grandmaUserCanUseSellerWorkspace(u)) {
                          setSettingsSellerGuardMsg(null)
                          setAppMode("seller")
                          setPage(1)
                          setSellerView("home")
                          try {
                            localStorage.setItem("grandma:mode", "seller")
                          } catch {
                            /* ignore */
                          }
                          return
                        }
                        setSettingsSellerGuardMsg(settingsUi.settingsSellerTapDenied)
                      }}
                      className={cn(
                        "rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors",
                        settingsModePick === mode
                          ? "border-blue-600 bg-blue-50 text-blue-900 ring-2 ring-blue-600/30"
                          : "border-border bg-background text-foreground hover:bg-muted/60",
                      )}
                      aria-pressed={settingsModePick === mode}
                    >
                      {mode === "buyer" ? "Buyer" : "Seller"}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{settingsUi.settingsModeHint}</p>
                {settingsSellerGuardMsg ? (
                  <p className="mt-2 rounded-lg bg-green-50 px-2.5 py-2 text-sm font-medium text-green-800">
                    {settingsSellerGuardMsg}
                  </p>
                ) : null}
              </div>

              {appMode === "buyer" ? (
                <div className="space-y-6 rounded-xl border border-border bg-muted/20 p-3">
                  <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {settingsUi.settingsFormBuyerTitle}
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{settingsUi.myOrders}</div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {isAuthenticated ? settingsUi.viewMyOrders : settingsUi.signInForOrders}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSettingsOpen(false)
                        const target = GRANDMA_PATHS.buyerOrders
                        if (isAuthenticated) router.push(target)
                        else
                          router.push(
                            `${GRANDMA_PATHS.login}?redirect=${encodeURIComponent(target)}`,
                          )
                      }}
                      className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-left text-sm font-bold hover:bg-muted/60"
                    >
                      {isAuthenticated ? settingsUi.viewMyOrders : settingsUi.signIn}
                    </button>
                  </div>

                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{settingsUi.language}</div>
                    <div className="mt-2 flex gap-2">
                      {(["en", "rw", "fr"] as const).map((lang) => (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => setLanguage(lang)}
                          className={cn(
                            "min-w-0 flex-1 rounded-xl border px-2 py-2.5 text-xs font-bold transition-colors",
                            language === lang
                              ? "border-blue-600 bg-blue-50 text-blue-900"
                              : "border-border bg-background text-foreground hover:bg-muted/60",
                          )}
                        >
                          {lang === "en" ? settingsUi.langEn : lang === "rw" ? settingsUi.langRw : settingsUi.langFr}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{settingsUi.setLocation}</div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground">{settingsUi.locationCurrent}:</span>{" "}
                      {locationData ? displayUserLocationEn : settingsUi.noLocationYet}
                    </p>
                    <button
                      type="button"
                      onClick={() => setLocationDialogOpen(true)}
                      className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-left text-sm font-bold hover:bg-muted/60"
                    >
                      {settingsUi.setLocation}
                    </button>
                  </div>

                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{settingsUi.preferredShops}</div>
                    <p className="mt-1 text-xs text-muted-foreground">{settingsUi.preferredHint}</p>
                    <div className="mt-2 max-h-52 space-y-1 overflow-y-auto rounded-xl border border-border bg-background p-2">
                      <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 hover:bg-muted/50">
                        <input
                          type="checkbox"
                          checked={preferredShopIds.includes(PREFERRED_ALL_ID)}
                          onChange={() => togglePreferredShop(PREFERRED_ALL_ID)}
                          className="h-4 w-4 shrink-0 accent-blue-600"
                        />
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-white text-sm font-extrabold">
                          ALL
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">All shops</span>
                      </label>
                      <div className="space-y-4">
                        {allShopsLoading ? (
                          <div className="flex items-center justify-center py-4">
                            <div className="text-sm text-muted-foreground">Loading shops...</div>
                          </div>
                        ) : allShopsError ? (
                          <div className="flex items-center justify-center py-4">
                            <div className="text-sm text-red-500">Error loading shops</div>
                          </div>
                        ) : allAvailableShops.length > 0 ? (
                          allAvailableShops.map((shop) => (
                            <label
                              key={shop.id}
                              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50"
                            >
                              <input
                                type="checkbox"
                                data-shop-id={shop.id}
                                checked={isPreferredGrandmaShop(shop.id, preferredShopIds)}
                                onChange={() => togglePreferredShop(shop.id)}
                                className="h-4 w-4 shrink-0 accent-blue-600"
                              />
                              <img src={shop.logoSrc} alt="" className="h-8 w-8 shrink-0 rounded-md border border-border bg-white object-contain" />
                              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{shop.name}</span>
                            </label>
                          ))
                        ) : (
                          <div className="flex items-center justify-center py-4">
                            <div className="text-sm text-muted-foreground">No shops available</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{settingsUi.paymentMode}</div>
                    <div className="mt-2 space-y-2">
                      {PAYMENTS.map((mode) => (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => setSelectedPayment(mode.id)}
                          className={cn(
                            "flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-bold transition-colors",
                            selectedPayment === mode.id
                              ? "border-blue-600 bg-blue-50 text-blue-950"
                              : "border-border bg-background hover:bg-muted/60",
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-white">
                              <img src={mode.iconSrc} alt="" className="h-full w-full object-contain" />
                            </span>
                            <span className="min-w-0 leading-tight">{mode.label}</span>
                          </span>
                          <span
                            className={cn(
                              "h-4 w-4 shrink-0 rounded-full border-2",
                              selectedPayment === mode.id ? "border-blue-600 bg-blue-600" : "border-muted-foreground",
                            )}
                            aria-hidden
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-3">
                  <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {settingsUi.settingsFormSellerTitle}
                  </div>
                  {grandmaUserCanUseSellerWorkspace(grandmaBuyerSession) ? (
                    <>
                      <p className="text-sm text-muted-foreground">{settingsUi.settingsSellerIntro}</p>
                      <div className="text-base font-bold text-foreground">{sellerShopLabel || "—"}</div>
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                          {settingsUi.language}
                        </div>
                        <div className="mt-2 flex gap-2">
                          {(["en", "rw", "fr"] as const).map((lang) => (
                            <button
                              key={lang}
                              type="button"
                              onClick={() => setLanguage(lang)}
                              className={cn(
                                "min-w-0 flex-1 rounded-xl border px-2 py-2.5 text-xs font-bold transition-colors",
                                language === lang
                                  ? "border-blue-600 bg-blue-50 text-blue-900"
                                  : "border-border bg-background text-foreground hover:bg-muted/60",
                              )}
                            >
                              {lang === "en"
                                ? settingsUi.langEn
                                : lang === "rw"
                                  ? settingsUi.langRw
                                  : settingsUi.langFr}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <button
                          type="button"
                          className="rounded-xl border border-border bg-background px-3 py-2.5 text-left text-sm font-bold hover:bg-muted/60"
                          onClick={() => {
                            setSellerView("home")
                            setSettingsOpen(false)
                          }}
                        >
                          {settingsUi.settingsOpenSellerHome}
                        </button>
                        <button
                          type="button"
                          className="rounded-xl border border-border bg-background px-3 py-2.5 text-left text-sm font-bold hover:bg-muted/60"
                          onClick={() => {
                            setSellerView("orders")
                            setSettingsOpen(false)
                          }}
                        >
                          {settingsUi.settingsOpenSellerOrders}
                        </button>
                        <button
                          type="button"
                          className="rounded-xl border border-border bg-background px-3 py-2.5 text-left text-sm font-bold hover:bg-muted/60"
                          onClick={() => {
                            setSellerView("items")
                            setSettingsOpen(false)
                          }}
                        >
                          {settingsUi.settingsOpenSellerItems}
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">{settingsUi.settingsSellerNeedLogin}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 space-y-2 border-t border-border bg-background px-4 py-3">
            <button
              type="button"
              className="w-full rounded-xl bg-[#1a4d8c] px-4 py-3 text-sm font-bold text-white shadow-sm"
              onClick={() => setSettingsOpen(false)}
            >
              {settingsUi.settingsApplyClose}
            </button>
            {isAuthenticated ? (
              <button
                type="button"
                className="w-full rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-center text-sm font-bold text-red-900 transition-colors hover:bg-red-100"
                onClick={() => {
                  setSettingsOpen(false)
                  logout()
                  router.push(GRANDMA_PATHS.login)
                }}
              >
                {settingsUi.logOut}
              </button>
            ) : (
              <button
                type="button"
                className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-3 text-center text-sm font-bold text-blue-900 transition-colors hover:bg-blue-100"
                onClick={() => {
                  setSettingsOpen(false)
                  router.push(
                    `${GRANDMA_PATHS.login}?redirect=${encodeURIComponent(GRANDMA_PATHS.appRoot)}`,
                  )
                }}
              >
                {settingsUi.signIn}
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <LocationCaptureDialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen} />

      {reorderSplashOpen ? (
        <div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-[#17324d]/55 px-6 backdrop-blur-[2px]"
          role="alertdialog"
          aria-busy="true"
          aria-live="polite"
          aria-label={settingsUi.reorderSplashTitle}
        >
          <Loader2 className="h-12 w-12 shrink-0 animate-spin text-white" aria-hidden />
          <div className="max-w-[280px] rounded-2xl bg-white px-6 py-5 text-center shadow-xl">
            <p className="text-base font-bold text-[#17324d]">{settingsUi.reorderSplashTitle}</p>
            <p className="mt-2 text-sm text-[#6f8399]">{settingsUi.reorderSplashSub}</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}

