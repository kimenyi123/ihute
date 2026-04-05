"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/auth-store"
import { useCartStore } from "@/lib/cart-store"
import { isBarOrRestaurant } from "@/lib/constants"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { LocationCaptureDialog } from "@/components/location-capture-dialog"
import { Slider } from "@/components/ui/slider"
import { useLocationStoreEnhanced, type LocationData } from "@/lib/location-store-enhanced"
import { getProductImageSrc, NO_IMAGE_URL } from "@/lib/image-utils"
import { cn } from "@/lib/utils"
import {
  catalogItemCodeFromApi,
  fallbackLiveItemCode,
  sanitizeItemCodeForOrderDb,
} from "@/lib/catalog-item-code"
import { SlidersHorizontal } from "lucide-react"

type Category =
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
  /** Stable key for live-catalog rows (dedupe + React keys) */
  liveKey?: string
  /** ITEM_CODE / item_code / item_key_words — safe for Java NIKI_CODE (never use liveKey here). */
  liveOrderItemCode?: string
  /** Live API `in_stock` — only set for injected catalog rows */
  liveInStock?: boolean
  /** Menu / famille label from live API (filters) */
  liveCategory?: string
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
  item_state?: string
  item_packet?: string
  stock?: number | string
  in_stock?: boolean
  category?: string
  item_state?: string
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

type PaymentId = "momo" | "airtel" | "bk" | "cash"
type PaymentMode = { id: PaymentId; label: string; iconSrc: string }

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
  /** merchant payout — demo; replace with API */
  bankName?: string
  payoutAccount?: string
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
    eta: string
    etaSub: string
    etaSubNoMode: string
    paymentModeSection: string
    shopsIntro: string
    sortDistance: string
    footerHome: string
    footerShops: string
    footerItems: string
    footerSummary: string
    footerPay: string
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
    deliveryPerson: string
    hobbies: string
    kmToShop: string
    reviewers: string
    tapCouriers: string
    closestToShop: string
    top5Available: string
    yourAccount: string
    browsingAsGuest: string
    guestModeHint: string
    signIn: string
    signOut: string
    guestUser: string
    guestSubtitle: string
    openAllSettings: string
    accountMenuAria: string
  }
> = {
  en: {
    demoLocation: "Kacyiru, Gasabo — demo (set your address in settings)",
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
    eta: "Estimated time of arrival",
    etaSub: "From ~{km} km · {mode} delivery",
    etaSubNoMode: "~{km} km from the shop. Choose a delivery option on Summary to see arrival time.",
    paymentModeSection: "Payment Mode",
    sortDistance: " Sorted by distance.",
    shopsIntro:
      "Choose a shop in {cat}. Favorites and shops you used before are listed first.{sort}",
    footerHome: "Home",
    footerShops: "Shops",
    footerItems: "Items",
    footerSummary: "Summary",
    footerPay: "Pay",
    preferredBadge: "Preferred",
    logHuman: "Human",
    logBike: "Bike",
    logMoto: "Moto",
    amountShop: "Amount to shop",
    ihuteFees: "Ihute fees (1%)",
    taxes: "Taxes",
    amountLogistics: "Amount to logistics",
    totalPay: "Total amount to pay",
    sendOrder: "Send Order",
    deliveryPerson: "Delivery person",
    hobbies: "Hobbies",
    kmToShop: "km to shop",
    reviewers: "reviewers",
    tapCouriers: "Tap to see top 5 couriers closest to the shop",
    closestToShop: "Closest to shop",
    top5Available: "top 5 available",
    yourAccount: "Your account",
    browsingAsGuest: "Browsing as guest",
    guestModeHint:
      "Shop and check out without signing in. Use guest checkout on the cart page. Sign in anytime to sync orders and saved details.",
    signIn: "Sign in",
    signOut: "Sign out",
    guestUser: "Guest",
    guestSubtitle: "Not signed in — browse and check out on this device.",
    openAllSettings: "All settings",
    accountMenuAria: "Account and guest menu",
  },
  rw: {
    demoLocation: "Kacyiru, Gasabo — inyigo (shyiraho aderesi mu buryo)",
    titleHome: "Ishyiga Ihute",
    shopsPrefix: "Amaduka ·",
    titleSummary: "Incamake y'icyo ugiye gutumiza",
    titlePayment: "Uburyo bwo kwishyura",
    settings: "Igenamiterere",
    settingsSub: "Ururimi, aho uherereye, amaduka n'uburyo bwo kwishyura",
    language: "Ururimi",
    langEn: "English",
    langRw: "Ikinyarwanda",
    langFr: "Igifaransa",
    setLocation: "Shyiraho aho uherereye",
    locationCurrent: "Ubu",
    noLocationYet: "Ntacyo cyashyizweho — kanda uhitemo GPS cyangwa akarere",
    preferredShops: "Amaduka ukunda",
    preferredHint: "Dutanga aya mbere mu rutonde rw'amaduka.",
    paymentMode: "Uburyo bwo kwishyura wifuza",
    payingTo: "Wishyura",
    bankName: "Izina rya banki",
    account: "Konti",
    yourLocation: "Aho uherereye",
    eta: "Igihe cyateganyijwe cyo kugera",
    etaSub: "Kuva kuri km ~{km} · {mode}",
    etaSubNoMode: "Km ~{km} kuva ku iduka. Hitamo uburyo bwo kohereza ku incamake kugira ngo ubone igihe cyo kugera.",
    paymentModeSection: "Uburyo bwo kwishyura",
    sortDistance: " Byagenwe ku ntambwe.",
    shopsIntro: "Hitamo iduka muri {cat}. Ukunda n'ibyakoreshejwe mbere biri ku rutonde rwa mbere.{sort}",
    footerHome: "Ahabanza",
    footerShops: "Amaduka",
    footerItems: "Ibintu",
    footerSummary: "Incamake",
    footerPay: "Kwishyura",
    preferredBadge: "Ukunda",
    logHuman: "Umuntu",
    logBike: "Igare",
    logMoto: "Moto",
    amountShop: "Amafaranga y'iduka",
    ihuteFees: "Amafaranga ya Ihute (1%)",
    taxes: "Imisoro",
    amountLogistics: "Amafaranga y'uboherezi",
    totalPay: "Amafaranga yose",
    sendOrder: "Ohereza komande",
    deliveryPerson: "Uwohereza",
    hobbies: "Ibikundwa",
    kmToShop: "km kugera ku iduka",
    reviewers: "abasesenguzi",
    tapCouriers: "Kanda urebe aboherezi 5 ba mbere buri hafi y'iduka",
    closestToShop: "Bari hafi y'iduka",
    top5Available: "5 ba mbere bahari",
    yourAccount: "Konti yawe",
    browsingAsGuest: "Utariye konti",
    guestModeHint:
      "Gura utariye konti. Kuri cart hitamo guest checkout. Injira igihe icyo ari cyo kugira ngo uhagarike amaduka n'amabwiriza.",
    signIn: "Injira",
    signOut: "Sohoka",
    guestUser: "Guest",
    guestSubtitle: "Ntariye konti — shakisha ukoresheje iki gikoresho.",
    openAllSettings: "Igenamiterere ryose",
    accountMenuAria: "Konti cyangwa guest",
  },
  fr: {
    demoLocation: "Kacyiru, Gasabo — démo (définissez l'adresse dans les réglages)",
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
    eta: "Heure d'arrivée estimée",
    etaSub: "Depuis ~{km} km · livraison {mode}",
    etaSubNoMode: "À ~{km} km du magasin. Choisissez une livraison sur le récapitulatif pour voir l’heure d’arrivée.",
    paymentModeSection: "Mode de paiement",
    sortDistance: " Triés par distance.",
    shopsIntro: "Choisissez un magasin dans {cat}. Favoris et commandes passées en premier.{sort}",
    footerHome: "Accueil",
    footerShops: "Magasins",
    footerItems: "Articles",
    footerSummary: "Récapitulatif",
    footerPay: "Payer",
    preferredBadge: "Favori",
    logHuman: "À pied",
    logBike: "Vélo",
    logMoto: "Moto",
    amountShop: "Montant au magasin",
    ihuteFees: "Frais Ihute (1 %)",
    taxes: "Taxes",
    amountLogistics: "Montant logistique",
    totalPay: "Total à payer",
    sendOrder: "Envoyer la commande",
    deliveryPerson: "Livreur",
    hobbies: "Loisirs",
    kmToShop: "km jusqu'au magasin",
    reviewers: "avis",
    tapCouriers: "Appuyez pour voir les 5 livreurs les plus proches",
    closestToShop: "Les plus proches du magasin",
    top5Available: "top 5 disponibles",
    yourAccount: "Votre compte",
    browsingAsGuest: "Navigation en mode invité",
    guestModeHint:
      "Parcourez et payez sans compte (checkout invité sur le panier). Connectez-vous quand vous voulez pour synchroniser commandes et adresses.",
    signIn: "Se connecter",
    signOut: "Se déconnecter",
    guestUser: "Invité",
    guestSubtitle: "Non connecté — navigation et commande sur cet appareil.",
    openAllSettings: "Tous les réglages",
    accountMenuAria: "Compte et mode invité",
  },
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

/** Demo shops per category — replace with API + real GPS sort */
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
  { id: "momo", label: "MTN MoMo (Mokash loan @7%)", iconSrc: "/img/momo.png" },
  { id: "airtel", label: "Airtel Money", iconSrc: "/img/airtel.png" },
  { id: "bk", label: "BK (QuickLoan @3%)", iconSrc: "/img/bk.png" },
  { id: "cash", label: "Cash on Delivery", iconSrc: "/img/cash.png" },
]

/** 1% platform fee on items subtotal */
const IHUTE_FEE_RATE = 0.01
const TAXES_PLACEHOLDER = 0

function formatRwf(v: number): string {
  return `${Math.round(v).toLocaleString()} RWF`
}

function shopIdHash(id: string): number {
  return [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)
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
  // ASCII "|" avoids U+241E in keys (that byte sequence breaks MySQL latin1 NIKI_CODE if mistaken for itemCode) yatumaga command itagenda
  const core = [code, state, packet, price, name].join("|")
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
  return livePlaceholderImageUrl(category, `${nickname}|${dedupeKey}|${displayName}`)
}

function stableSample<T>(list: T[], take: number, seedKey: (x: T) => string): T[] {
  if (list.length <= take) return list
  const scored = list.map((x) => ({ x, s: Math.abs(shopIdHash(seedKey(x))) }))
  scored.sort((a, b) => a.s - b.s)
  return scored.slice(0, take).map((r) => r.x)
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

const COURIER_POOL: CourierProfile[] = [
  {
    id: "c1",
    name: "Emma Uwase",
    avatarEmoji: "👩‍🦱",
    hobbies: "I like football; I like flowers.",
    rating: 4.6,
    reviewCount: 128,
    distanceToShopKm: 0.42,
  },
  {
    id: "c2",
    name: "Jean Pierre N.",
    avatarEmoji: "👨‍🦰",
    hobbies: "I like cycling; I like jazz on Sundays.",
    rating: 4.8,
    reviewCount: 94,
    distanceToShopKm: 0.58,
  },
  {
    id: "c3",
    name: "Aline Mukamana",
    avatarEmoji: "👩‍🦳",
    hobbies: "I like cooking; I like kids' books.",
    rating: 4.4,
    reviewCount: 56,
    distanceToShopKm: 0.71,
  },
  {
    id: "c4",
    name: "David H.",
    avatarEmoji: "🧔",
    hobbies: "I like photography; I like tea.",
    rating: 4.9,
    reviewCount: 203,
    distanceToShopKm: 0.89,
  },
  {
    id: "c5",
    name: "Grace I.",
    avatarEmoji: "👩‍🦲",
    hobbies: "I like choir; I like mangoes.",
    rating: 4.5,
    reviewCount: 41,
    distanceToShopKm: 1.05,
  },
  {
    id: "c6",
    name: "Eric M.",
    avatarEmoji: "👨",
    hobbies: "I like running; I like electronics.",
    rating: 4.3,
    reviewCount: 88,
    distanceToShopKm: 1.22,
  },
]

function courierStarGlyphs(rating: number): string {
  const f = Math.min(5, Math.max(0, Math.round(rating)))
  return "★".repeat(f) + "☆".repeat(5 - f)
}

type PrescriptionSlot = { id: string; file: File; url: string }

type PageId = 1 | 2 | 3 | 4 | 5
type SellerOrderStatus = "new" | "paid" | "preparing" | "sent" | "rejected"
type SellerViewFilter = "open" | "served" | "rejected"
type SellerOrder = {
  id: number
  ref: string
  area: string
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
  lines: { icon: string; name: string; qty: number; totalRwf?: number }[]
  status: SellerOrderStatus
}

const SELLER_ORDERS_INIT: SellerOrder[] = [
  {
    id: 1,
    ref: "KGL-12",
    area: "Nyamirambo",
    remainingMin: 5,
    distanceKm: 1.2,
    logisticsIcon: "🏍",
    amountRwf: 3500,
    paymentIconSrc: "/img/momo.png",
    paymentStatus: "paid",
    paymentTime: "2024-04-24 08:09",
    paymentLabel: "MTN MoMo · Paid",
    paymentCode: "547255",
    transactionId: "MOMO-31MAR-99821",
    lines: [
      { icon: "🥛", name: "Milk", qty: 2, totalRwf: 1000 },
      { icon: "🧂", name: "Sugar", qty: 1, totalRwf: 2500 },
    ],
    status: "paid",
  },
  {
    id: 2,
    ref: "KGL-07",
    area: "Nyamirambo",
    remainingMin: 9,
    distanceKm: 2.8,
    logisticsIcon: "🚲",
    amountRwf: 1800,
    paymentIconSrc: "/img/cash.png",
    paymentStatus: "pending",
    paymentTime: "2024-04-24 09:14",
    paymentLabel: "Cash on Delivery",
    lines: [{ icon: "🍞", name: "Bread", qty: 2, totalRwf: 1400 }],
    status: "new",
  },
  {
    id: 3,
    ref: "NEW-22",
    area: "Nyamirambo",
    remainingMin: 14,
    distanceKm: 3.6,
    logisticsIcon: "🚶",
    amountRwf: 5200,
    paymentIconSrc: "/img/airtel.png",
    paymentStatus: "pending",
    paymentTime: "2024-04-24 10:22",
    paymentLabel: "Airtel Money · Pending",
    transactionId: "AIR-31MAR-23104",
    lines: [
      { icon: "🥤", name: "Fanta", qty: 4, totalRwf: 2000 },
      { icon: "🍪", name: "Biscuits", qty: 2, totalRwf: 3200 },
    ],
    status: "new",
  },
]

export default function GrandmaPage() {
  const router = useRouter()
  const locationData = useLocationStoreEnhanced((s) => s.location)
  const [page, setPage] = useState<PageId>(1)
  const [category, setCategory] = useState<Category>("Boutique")
  const [search, setSearch] = useState("")
  const [shopSearch, setShopSearch] = useState("")
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
  const [selectedLogistics, setSelectedLogistics] = useState<LogisticsId | null>(null)
  const [appMode, setAppMode] = useState<AppMode>("buyer")
  const [language, setLanguage] = useState<GrandmaLang>("rw")
  const [preferredShopIds, setPreferredShopIds] = useState<string[]>([])
  const [selectedPayment, setSelectedPayment] = useState<PaymentId>("momo")
  const [prefsHydrated, setPrefsHydrated] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [itemsSort, setItemsSort] = useState<ItemsSortId>("default")
  const [liveInStockOnly, setLiveInStockOnly] = useState(false)
  const [liveShowAll, setLiveShowAll] = useState(false)
  const [itemsMenuCategoryKey, setItemsMenuCategoryKey] = useState<string | null>(null)
  const [priceRangeRwf, setPriceRangeRwf] = useState<[number, number] | null>(null)
  const [locationDialogOpen, setLocationDialogOpen] = useState(false)
  const [orderNotes, setOrderNotes] = useState("")
  const [prescriptionSlots, setPrescriptionSlots] = useState<PrescriptionSlot[]>([])
  const prescriptionInputRef = useRef<HTMLInputElement>(null)
  const [courierModalOpen, setCourierModalOpen] = useState(false)
  const [assignedCourierId, setAssignedCourierId] = useState<string | null>(null)
  const [sellerOnline, setSellerOnline] = useState(true)
  const [sellerOrders, setSellerOrders] = useState<SellerOrder[]>(SELLER_ORDERS_INIT)
  const [sellerFilter, setSellerFilter] = useState<SellerViewFilter>("open")
  const [expandedSellerOrderId, setExpandedSellerOrderId] = useState<number | null>(null)

  const selectedProducts = useMemo(() => products.filter((p) => p.qty > 0), [products])
  const itemsCount = useMemo(() => selectedProducts.reduce((a, p) => a + p.qty, 0), [selectedProducts])
  const itemsTotal = useMemo(() => selectedProducts.reduce((a, p) => a + p.qty * p.price, 0), [selectedProducts])

  const selectedShop = useMemo(
    () => (selectedShopId ? MOCK_SHOPS.find((s) => s.id === selectedShopId) ?? null : null),
    [selectedShopId]
  )

  const liveMenuNickname = useMemo(() => {
    if (selectedShopId === "rs_burrows") return "burrows"
    if (selectedShopId === "ph_rite") return "rite"
    return null
  }, [selectedShopId])
  const isLiveMenuSelected = useMemo(() => Boolean(liveMenuNickname), [liveMenuNickname])

  const deliveryKm = selectedShop?.distanceKm ?? 0

  const logisticsTotal = useMemo(() => {
    if (!selectedLogistics) return 0
    const opt = LOGISTICS.find((x) => x.id === selectedLogistics)
    return opt ? logisticsQuote(opt, deliveryKm) : 0
  }, [selectedLogistics, deliveryKm])

  const etaRange = useMemo(
    () => deliveryEtaRange(deliveryKm, selectedLogistics),
    [deliveryKm, selectedLogistics]
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
    if (!selectedLogistics) setCourierModalOpen(false)
  }, [selectedLogistics])

  useEffect(() => {
    const prefs = readGrandmaPrefs()
    setLanguage(prefs.lang)
    setPreferredShopIds(prefs.preferred)
    setSelectedPayment(prefs.payment)
    setAppMode(prefs.mode)
    setPrefsHydrated(true)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined" || !prefsHydrated) return
    localStorage.setItem("grandma:lang", language)
  }, [language, prefsHydrated])
  useEffect(() => {
    if (typeof window === "undefined" || !prefsHydrated) return
    localStorage.setItem("grandma:payment", selectedPayment)
  }, [selectedPayment, prefsHydrated])
  useEffect(() => {
    if (typeof window === "undefined" || !prefsHydrated) return
    localStorage.setItem("grandma:preferredShops", JSON.stringify(preferredShopIds))
  }, [preferredShopIds, prefsHydrated])
  useEffect(() => {
    if (typeof window === "undefined" || !prefsHydrated) return
    localStorage.setItem("grandma:mode", appMode)
  }, [appMode, prefsHydrated])

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
        const apiUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/shop-with-me?${params.toString()}`
        console.log('[DEBUG] Fetching from:', apiUrl)
        const res = await fetch(apiUrl, { cache: "no-store" })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as BurrowsApiResponse
        console.log('[DEBUG] Grandma API Response:', data)
        const sellers = data.sellers ?? []
        console.log('[DEBUG] Grandma sellers count:', sellers.length)
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
        const sellerAccount = String(seller?.ISHYIGA_ACCOUNT ?? nickname ?? "live").trim() || "live"
        const mapped: Product[] = uniqueRows
          .map(({ key, p }) => {
            const nameRaw = String(p.item_commercial_name ?? p.item_name ?? "").trim()
            const name = nameRaw || "Menu item"
            const id = 100000 + (Math.abs(shopIdHash(`${nickname}:${key}`)) % 899000)
            const price = extractNumericPrice(p.selling_price ?? p.price)
            const thumb = liveCatalogThumbUrl(p, targetCategory, nickname, key, name)
            const sectionLabel = resolveLiveMenuSectionCategory(p)
            const menuCat = menuCategoryTitleFromCanon(menuCategoryCanon(sectionLabel))
            const fromApi = sanitizeItemCodeForOrderDb(catalogItemCodeFromApi(p))
            const orderItemCode = fromApi || fallbackLiveItemCode(sellerAccount.replace(/[^\w.-]/g, "_") || "live", id)
            return {
              id,
              category: targetCategory,
              name,
              price: price || 0,
              emoji: emojiForLiveCategory(targetCategory, name),
              imageUrl: thumb,
              liveKey: `${nickname}:${key}`,
              liveOrderItemCode: orderItemCode,
              liveInStock: p.in_stock === true,
              liveCategory: menuCat,
              qty: 0,
            } satisfies Product
          })
          .filter((p) => p.name && p.price > 0)
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

  /** Pay page (page 5) only — other screens stay English */
  const tPay = GRANDMA_LABELS[language]

  /** Pay page (last screen) — fallback line follows selected language */
  const displayUserLocation = useMemo(
    () => formatStoredLocation(locationData, GRANDMA_LABELS[language].demoLocation),
    [locationData, language]
  )

  const settingsUi = GRANDMA_LABELS[language]

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const authUser = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const authHydrated = useAuthStore((s) => s.hasHydrated)

  const profileLetter = useMemo(() => {
    if (!authHydrated) return null
    if (!isAuthenticated || !authUser?.name?.trim()) return "G"
    return authUser.name.trim().charAt(0).toUpperCase()
  }, [authHydrated, isAuthenticated, authUser?.name])

  const ihuteFees = useMemo(() => Math.round(itemsTotal * IHUTE_FEE_RATE), [itemsTotal])
  const grandTotal = useMemo(
    () => itemsTotal + logisticsTotal + ihuteFees + TAXES_PLACEHOLDER,
    [itemsTotal, logisticsTotal, ihuteFees]
  )

  const toggleLogistics = (id: LogisticsId) => {
    setSelectedLogistics((prev) => (prev === id ? null : id))
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

  const title = useMemo(() => {
    if (appMode === "seller") return "IHUTE.RW"
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
  }, [appMode, page, category, language])

  const shopsInCategory = useMemo(() => MOCK_SHOPS.filter((s) => s.category === category), [category])

  const visibleShops = useMemo(() => {
    const q = shopSearch.trim().toLowerCase()
    let list = shopsInCategory.filter(
      (s) => !q || s.name.toLowerCase().includes(q) || s.tagline.toLowerCase().includes(q)
    )
    const prefBoost = (a: ShopEntry, b: ShopEntry) => {
      const pref =
        Number(preferredShopIds.includes(b.id)) - Number(preferredShopIds.includes(a.id))
      if (pref !== 0) return pref
      return 0
    }
    if (shopTab === "favorites") list = list.filter((s) => s.favorite)
    else if (shopTab === "reorder") list = list.filter((s) => s.orderedBefore)
    else if (shopTab === "trending") list = list.filter((s) => s.trending)
    else if (shopTab === "onsale") list = list.filter((s) => s.onSale)
    else {
      list = [...list].sort((a, b) => {
        // Preferred shops (Settings) first — e.g. Burrows + Rite when you mark them
        const p = prefBoost(a, b)
        if (p !== 0) return p
        if (a.favorite !== b.favorite) return a.favorite ? -1 : 1
        if (a.orderedBefore !== b.orderedBefore) return a.orderedBefore ? -1 : 1
        if (useLocationSort) return a.distanceKm - b.distanceKm
        return a.name.localeCompare(b.name)
      })
      return list
    }
    list = [...list].sort((a, b) => {
      const p = prefBoost(a, b)
      if (p !== 0) return p
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1
      if (a.orderedBefore !== b.orderedBefore) return a.orderedBefore ? -1 : 1
      if (useLocationSort) return a.distanceKm - b.distanceKm
      return a.name.localeCompare(b.name)
    })
    return list
  }, [shopsInCategory, shopSearch, shopTab, useLocationSort, preferredShopIds])

  const isAllPreferred = useMemo(() => preferredShopIds.includes(PREFERRED_ALL_ID), [preferredShopIds])
  const multiShopMode = useMemo(() => isAllPreferred && !selectedShopId, [isAllPreferred, selectedShopId])

  const offerShopsForCategory = useMemo(() => {
    const inCat = MOCK_SHOPS.filter((s) => s.category === category)
    const prefs = preferredShopIds.filter((x) => x !== PREFERRED_ALL_ID)
    if (prefs.length) return inCat.filter((s) => prefs.includes(s.id))
    return inCat
  }, [category, preferredShopIds])

  /** Full item pool for price histogram / category chips (ignores live “sample 20”). */
  const itemsFilterStatsSource = useMemo(() => {
    if (multiShopMode) return [] as Product[]
    let list = products.filter((p) => p.category === category)
    const q = search.trim().toLowerCase()
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q))
    if (isLiveMenuSelected) {
      list = list.filter((p) => p.id >= 100000)
      if (liveInStockOnly) list = list.filter((p) => p.liveInStock === true)
    }
    return list
  }, [multiShopMode, products, category, search, isLiveMenuSelected, liveInStockOnly])

  const offersBaseList = useMemo((): OfferRow[] => {
    if (!multiShopMode) return []
    const q = search.trim().toLowerCase()
    return products
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
  }, [multiShopMode, products, category, search, offerShopsForCategory])

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
    let list = products.filter((p) => p.category === category && (!q || p.name.toLowerCase().includes(q)))
    if (isLiveMenuSelected) {
      list = list.filter((p) => p.id >= 100000)
      if (liveInStockOnly) list = list.filter((p) => p.liveInStock === true)
      const showAll = liveShowAll || Boolean(q)
      if (!showAll) list = stableSample(list, 20, (p) => `${p.liveKey ?? p.id}-${p.name}`)
    }
    if (priceRangeRwf) {
      const [lo, hi] = priceRangeRwf
      if (Number.isFinite(lo) && Number.isFinite(hi) && hi >= lo) {
        list = list.filter((p) => p.price >= lo && p.price <= hi)
      }
    }
    list = list.filter((p) => productMatchesMenuCategory(p, itemsMenuCategoryKey))
    list = [...list]
    if (itemsSort === "name") list.sort((a, b) => a.name.localeCompare(b.name))
    else if (itemsSort === "price_asc") list.sort((a, b) => a.price - b.price || a.name.localeCompare(b.name))
    else if (itemsSort === "price_desc") list.sort((a, b) => b.price - a.price || a.name.localeCompare(b.name))
    return list
  }, [
    products,
    category,
    search,
    isLiveMenuSelected,
    liveInStockOnly,
    liveShowAll,
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
    setLiveShowAll(false)
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

  const changeQty = (id: number, diff: number) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, qty: Math.max(0, p.qty + diff) } : p))
    )
  }

  const goToPage = (p: PageId) => setPage(p)
  const goBack = () => {
    if (appMode === "seller") return
    setPage((p) => (p > 1 ? ((p - 1) as PageId) : p))
  }

  const togglePreferredShop = (id: string) => {
    setPreferredShopIds((prev) => {
      if (id === PREFERRED_ALL_ID) {
        return prev.includes(PREFERRED_ALL_ID) ? prev.filter((x) => x !== PREFERRED_ALL_ID) : [PREFERRED_ALL_ID]
      }
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev.filter((x) => x !== PREFERRED_ALL_ID), id]
      return next
    })
  }
  const updateSellerOrderStatus = (id: number, status: SellerOrderStatus) => {
    setSellerOrders((prev) => prev.map((order) => (order.id === id ? { ...order, status } : order)))
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

  const etaSubText = useMemo(() => {
    const tr = GRANDMA_LABELS[language]
    const km = deliveryKm.toFixed(1)
    if (!selectedLogistics) return tr.etaSubNoMode.replace("{km}", km)
    const mode =
      selectedLogistics === "human" ? tr.logHuman : selectedLogistics === "bike" ? tr.logBike : tr.logMoto
    return tr.etaSub.replace("{km}", km).replace("{mode}", mode)
  }, [language, deliveryKm, selectedLogistics])

  const proceedToMainCartCheckout = useCallback(() => {
    if (!selectedShop || selectedProducts.length === 0) {
      const msg =
        language === "rw"
          ? "Shyiramo ibintu mbere yo kohereza komande."
          : language === "fr"
            ? "Ajoutez des articles avant de payer."
            : "Add items before sending your order."
      window.alert(msg)
      return
    }
    const st = useCartStore.getState()
    st.clear()
    st.clearTableInfo()
    const isBar =
      selectedShop.category === "Restaurant" || isBarOrRestaurant(selectedShop.name)
    const notesFirst = orderNotes.trim() || undefined
    selectedProducts.forEach((p, idx) => {
      const rowKey = String(p.liveKey ?? p.id)
      const itemCode = p.liveOrderItemCode
        ? p.liveOrderItemCode
        : p.liveKey
          ? fallbackLiveItemCode(selectedShop.id.replace(/[^\w.-]/g, "_") || "shop", p.id)
          : String(p.id)
      st.addItem(
        {
          id: rowKey,
          itemCode,
          name: p.name,
          price: p.price,
          image: p.imageUrl,
          supplierId: selectedShop.id,
          supplierName: selectedShop.name,
          momo: selectedShop.momo,
          isBarResto: isBar,
          notes: idx === 0 ? notesFirst : undefined,
        },
        p.qty
      )
    })
    setProducts((prev) => prev.map((x) => ({ ...x, qty: 0 })))
    setOrderNotes("")
    setPrescriptionSlots((prev) => {
      prev.forEach((s) => URL.revokeObjectURL(s.url))
      return []
    })
    setPage(1)
    router.push("/cart")
  }, [language, orderNotes, router, selectedProducts, selectedShop])

  const featuredCourierSafe = useMemo(() => {
    const fc = featuredCourier
    return fc ?? COURIER_POOL[0]
  }, [featuredCourier])

  return (
    <div className={`app ${appMode === "seller" ? "seller-mode" : ""}`}>
      <style>{`
        :root{
          --blue:#1897e0;--blue-dark:#127fc0;--bg:#eef4fb;--card:#ffffff;--text:#17324d;
          --muted:#6f8399;--line:#dbe7f3;--green:#22c55e;
        }
        *{box-sizing:border-box}
        body{margin:0;font-family:Arial, Helvetica, sans-serif;background:var(--bg);color:var(--text);}
        .app{max-width:430px;margin:0 auto;min-height:100vh;background:linear-gradient(180deg,#f7fbff 0%,#eef4fb 100%);padding-bottom:calc(120px + env(safe-area-inset-bottom));}
        .topbar{background:linear-gradient(90deg,var(--blue),#30acef,var(--blue-dark));color:#fff;padding:14px 16px;position:sticky;top:0;z-index:10;box-shadow:0 8px 20px rgba(0,0,0,.10);}
        .topbar-row{display:flex;align-items:center;gap:10px;}
        .back-btn,.more-btn{border:none;background:rgba(255,255,255,.14);color:#fff;border-radius:10px;width:36px;height:36px;font-size:18px;cursor:pointer;flex-shrink:0;line-height:1;}
        .profile-avatar-btn{border:none;background:rgba(255,255,255,.95);color:var(--blue-dark);border-radius:50%;width:36px;height:36px;font-size:15px;font-weight:800;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.1);border:1px solid rgba(255,255,255,.6);}
        .profile-avatar-btn:active{transform:scale(.96);}
        .filter-trigger-btn{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:10px;background:rgba(255,255,255,.95);color:#17324d;border:1px solid rgba(255,255,255,.55);font-size:12px;font-weight:800;cursor:pointer;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,.08);}
        .filter-trigger-btn svg{flex-shrink:0;opacity:.9;}
        .brand{display:flex;align-items:center;gap:10px;flex:1;min-width:0;}
        .logo{width:34px;height:34px;border-radius:10px;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;border:1px solid rgba(255,255,255,.35);flex-shrink:0;}
        .logo img{width:100%;height:100%;object-fit:contain;display:block;}
        .shop-box .logo{width:48px;height:48px;border-radius:12px;border:1px solid var(--line);}
        .title{font-size:22px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .title.title-filter{position:relative;}
        .title.title-filter:before{content:"⏷";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:34px;opacity:.14;pointer-events:none;}
        .title-text{position:relative;z-index:1;}
        .page{display:none;padding:14px;}
        .page.active{display:block}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
        .card{background:var(--card);border-radius:16px;border:1px solid var(--line);box-shadow:0 8px 18px rgba(24,151,224,.08);}
        .cat-card{padding:18px 10px;text-align:center;cursor:pointer;}
        .cat-icon{font-size:34px;margin-bottom:10px;}
        .cat-name{font-size:16px;font-weight:700;line-height:1.2;}
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
        .shop-row{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px;display:flex;gap:12px;align-items:center;cursor:pointer;box-shadow:0 8px 18px rgba(24,151,224,.06);}
        .shop-row:active{transform:scale(.995);}
        .shop-avatar{width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#e0f2fe,#bae6fd);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;overflow:hidden;border:1px solid var(--line);}
        .shop-avatar img{width:100%;height:100%;object-fit:contain;display:block;background:#fff;}
        .shop-row-meta{flex:1;min-width:0;}
        .shop-row-name{font-size:16px;font-weight:700;}
        .shop-row-tag{color:var(--muted);font-size:13px;margin-top:4px;line-height:1.3;}
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
        .product-row{background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px;display:grid;grid-template-columns:42px 1fr auto;gap:10px;align-items:center;box-shadow:0 8px 18px rgba(24,151,224,.06);}
        .emoji{font-size:28px;text-align:center;}
        .p-name{font-size:16px;font-weight:700;}
        .p-price{margin-top:4px;color:var(--muted);font-size:14px;}
        .qty{display:flex;align-items:center;gap:8px;background:#f1f8ff;border-radius:12px;padding:6px;}
        .qty button{width:30px;height:30px;border:none;border-radius:9px;background:#d8edfb;color:var(--blue-dark);font-size:20px;cursor:pointer;}
        .qty span{min-width:18px;text-align:center;font-weight:700;}
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
        .logistics-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px;}
        .log-option{background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px 8px;text-align:center;cursor:pointer;box-shadow:0 8px 18px rgba(24,151,224,.06);}
        .log-option.active{border:2px solid var(--blue);background:#f2f9ff;}
        .log-icon{font-size:24px;display:block;margin-bottom:6px;}
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
        .footer{position:fixed;left:50%;transform:translateX(-50%);bottom:0;width:100%;max-width:430px;background:rgba(255,255,255,.96);border-top:1px solid var(--line);display:flex;justify-content:space-around;padding:10px 6px calc(18px + env(safe-area-inset-bottom));z-index:20;}
        .footer button{border:none;background:none;color:var(--muted);font-size:10px;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;flex:1;min-width:0;padding:4px 2px;}
        .footer button.active{color:var(--blue-dark);font-weight:700;}
        .seller-mode .page,.seller-mode .footer{display:none!important;}
        .seller-screen{padding:14px;}
        .seller-shop-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;margin-bottom:10px;}
        .seller-shop-name{font-size:14px;font-weight:700;}
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
            <div className="logo">
              <img src="/img/logo.png" alt="Ishyiga" />
            </div>
            <div
              className={`title ${
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
          <button
            className="more-btn"
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            type="button"
          >
            ⚙
          </button>
          <Popover open={accountMenuOpen} onOpenChange={setAccountMenuOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="profile-avatar-btn"
                aria-label={settingsUi.accountMenuAria}
                aria-haspopup="dialog"
              >
                <span className="leading-none">{profileLetter ?? "·"}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              side="bottom"
              sideOffset={8}
              className="w-[min(100vw-24px,300px)] border-border p-0 shadow-lg"
            >
              <div className="border-b border-border px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {isAuthenticated && authUser ? settingsUi.yourAccount : settingsUi.guestUser}
                </p>
                {isAuthenticated && authUser ? (
                  <>
                    <p className="mt-1 truncate text-base font-bold text-foreground">{authUser.name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{authUser.email}</p>
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-base font-bold text-foreground">{settingsUi.browsingAsGuest}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{settingsUi.guestSubtitle}</p>
                  </>
                )}
              </div>
              <div className="flex flex-col gap-1 p-2">
                {isAuthenticated && authUser ? (
                  <button
                    type="button"
                    className="rounded-lg px-3 py-2.5 text-left text-sm font-bold text-foreground hover:bg-muted"
                    onClick={() => {
                      logout()
                      setAccountMenuOpen(false)
                    }}
                  >
                    {settingsUi.signOut}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="rounded-lg px-3 py-2.5 text-left text-sm font-bold text-foreground hover:bg-muted"
                    onClick={() => {
                      setAccountMenuOpen(false)
                      router.push(`/login?redirect=${encodeURIComponent("/grandma")}`)
                    }}
                  >
                    {settingsUi.signIn}
                  </button>
                )}
                <button
                  type="button"
                  className="rounded-lg px-3 py-2.5 text-left text-sm font-bold text-foreground hover:bg-muted"
                  onClick={() => {
                    setAccountMenuOpen(false)
                    setSettingsOpen(true)
                  }}
                >
                  {settingsUi.openAllSettings}
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {appMode === "seller" ? (
        <section className="seller-screen">
          <div className="card seller-shop-head">
            <div className="seller-shop-name">Nyamirambo Shop</div>
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

          {sellerOrdersFiltered.map((order) => (
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
                  <span className="seller-order-meta-chip">⏱ {Math.max(0, order.remainingMin)}m</span>
                  <span className="seller-order-meta-chip">{order.distanceKm.toFixed(1)} km</span>
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
                  <div className="seller-row">
                    <span>
                      <span className="seller-loc" aria-hidden>📍</span> {order.ref}, {order.area}
                    </span>
                    {order.status === "sent" ? <span className="seller-status-pill accepted">SENT</span> : null}
                    {order.status === "rejected" ? <span className="seller-status-pill rejected">REJECTED</span> : null}
                  </div>
                  {order.paymentLabel ? (
                    <div className="seller-pay-block">
                      <div className="seller-pay-main">
                        <span className="seller-pay-logo" aria-hidden>
                          {order.paymentIconSrc ? <img src={order.paymentIconSrc} alt="" /> : null}
                        </span>
                        <span>{order.paymentLabel}</span>
                        <span className={`seller-pay-status ${order.paymentStatus ?? "pending"}`}>
                          {(order.paymentStatus ?? "pending").toUpperCase()}
                        </span>
                      </div>
                      <div className="seller-pay-sub">
                        {order.paymentCode ? `MoMo Code:${order.paymentCode}` : ""}
                        {order.paymentCode && order.transactionId ? " / " : ""}
                        {order.transactionId ? `Txn ID:${order.transactionId}` : ""}
                        {(order.paymentCode || order.transactionId) && order.paymentTime ? " / " : ""}
                        {order.paymentTime ? order.paymentTime : ""}
                      </div>
                    </div>
                  ) : null}
                  {order.lines.length ? (
                    <>
                      {order.lines.map((line) => (
                        <div className="seller-line" key={`${order.id}-${line.name}`}>
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
                    <button type="button" className="seller-btn call">📞 Call</button>
                    <button type="button" className="seller-btn sms">💬 SMS</button>
                    <button type="button" className="seller-btn video">🎥 Video</button>
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
          ))}
          {sellerOrdersFiltered.length === 0 ? <div className="card note">No orders in this state.</div> : null}
        </section>
      ) : null}

      {/* Page 1 */}
      <section className={`page ${page === 1 ? "active" : ""}`} id="page1">
        <div className="grid">
          {CATEGORIES.map((c) => (
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
            >
              <div className="cat-icon">{c.icon}</div>
              <div className="cat-name">{categoryLabel(c.name, language)}</div>
            </div>
          ))}
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
            onClick={() => alert("List your shop on Ihute — seller onboarding (coming from your admin / API).")}
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
            placeholder="Search shops"
            aria-label="Search shops"
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

        <div className="shop-list" id="shopList">
          {visibleShops.length === 0 ? (
            <div className="card note">No shops match. Try another filter or search.</div>
          ) : (
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
                  <div className="shop-row-rating">
                    <span className="shop-stars" aria-hidden>
                      ★
                    </span>
                    <span className="shop-rating-num">{shopDisplayRating(s).toFixed(1)}</span>
                    <span className="shop-review-count">({shopDisplayReviews(s)} reviews)</span>
                  </div>
                  <div className="shop-row-badges">
                    {preferredShopIds.includes(s.id) ? (
                      <span className="shop-badge">★ Preferred</span>
                    ) : null}
                    {s.favorite ? <span className="shop-badge">★ Favorite</span> : null}
                    {s.orderedBefore ? <span className="shop-badge">Reorder</span> : null}
                    {s.trending ? <span className="shop-badge">Trending</span> : null}
                    {s.onSale ? <span className="shop-badge sale">On sale</span> : null}
                  </div>
                </div>
                <div className="shop-row-dist">{s.distanceKm.toFixed(1)} km</div>
              </div>
            ))
          )}
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
          {multiShopMode
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
                  <div className="qty" aria-label="Add to cart">
                    <button onClick={(e) => { e.stopPropagation(); if (o.shopId) setSelectedShopId(o.shopId); changeQty(o.productId, 1) }} aria-label="Add">
                      +
                    </button>
                    <span> </span>
                  </div>
                </div>
              ))
            : visibleProducts.map((p) => (
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
                  <div>
                    <div className="p-name">{p.name}</div>
                    <div className="p-price">{formatRwf(p.price)}</div>
                  </div>
                  <div className="qty">
                    <button onClick={() => changeQty(p.id, -1)} aria-label="Decrease">
                      −
                    </button>
                    <span>{p.qty}</span>
                    <button onClick={() => changeQty(p.id, 1)} aria-label="Increase">
                      +
                    </button>
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
      </section>

      {/* Page 3 — order lines (sits under .app, directly before #page3) */}
      <div className={`page ${page === 4 ? "active" : ""}`} id="page4-order-head" aria-hidden={page !== 4}>
        <div className="card summary-card">
          <div className="summary-row">
            <div className="summary-left">Order Summary</div>
            <div id="summaryCount">{itemsCount} items</div>
          </div>
          <div id="summaryItems">
            {selectedProducts.length ? (
              selectedProducts.map((p) => (
                <div className="summary-row" key={p.id}>
                  <div>
                    <div className="summary-left">
                      {p.name} x{p.qty}
                    </div>
                    <div className="summary-sub">{formatRwf(p.price)} each</div>
                  </div>
                  <strong>{formatRwf(p.qty * p.price)}</strong>
                </div>
              ))
            ) : (
              <div className="note">No items selected yet.</div>
            )}
          </div>
        </div>
      </div>

      {/* Page 4 — shipment, shop, totals, notes, pay */}
      <section className={`page ${page === 4 ? "active" : ""}`} id="page4-summary">
        <div className="section-title">Shipment / Logistics</div>
        <p className="note" style={{ marginTop: 0, marginBottom: 10 }}>
          Delivery fees use this shop’s distance ({deliveryKm.toFixed(1)} km) × mode rate (demo — replace with your pricing API).
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

        <div className="logistics-row" id="logisticsRow">
          {LOGISTICS.map((opt) => (
            <div
              key={opt.id}
              className={`log-option ${selectedLogistics === opt.id ? "active" : ""}`}
              onClick={() => toggleLogistics(opt.id)}
              role="button"
              tabIndex={0}
            >
              <span className="log-icon" aria-hidden>
                {opt.icon}
              </span>
              <div className="log-label">{opt.label}</div>
              <div className="log-price">{formatRwf(logisticsQuote(opt, deliveryKm))}</div>
            </div>
          ))}
        </div>

        <div className="card summary-card">
          <div className="summary-row">
            <span>Items</span>
            <strong id="sumItemsCount">{itemsCount}</strong>
          </div>
          <div className="summary-row">
            <span>Total Items</span>
            <strong id="sumItemsTotal">{formatRwf(itemsTotal)}</strong>
          </div>
          <div className="summary-row">
            <span>{tPay.ihuteFees}</span>
            <strong id="sumIhuteFees">{formatRwf(ihuteFees)}</strong>
          </div>
          <div className="summary-row">
            <span>Taxes</span>
            <strong id="sumTaxes">{formatRwf(TAXES_PLACEHOLDER)}</strong>
          </div>
          <div className="summary-row">
            <span>Logistics</span>
            <strong id="sumLogistics">{formatRwf(logisticsTotal)}</strong>
          </div>
          <div className="summary-row">
            <span>Grand Total</span>
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
          <button type="button" className="primary-btn summary-pay-btn" onClick={() => goToPage(5)}>
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
            <span className="pay-detail-value">{shopPayReceivingAccount(selectedShop).bankName}</span>
          </div>
          <div className="pay-detail-row">
            <span className="pay-detail-label">{tPay.account}</span>
            <span className="pay-detail-value">{shopPayReceivingAccount(selectedShop).account}</span>
          </div>
          <div className="pay-detail-row">
            <span className="pay-detail-label">{tPay.yourLocation}</span>
            <span className="pay-detail-value">{displayUserLocation}</span>
          </div>
          <div className="pay-detail-row">
            <span className="pay-detail-label">{tPay.eta}</span>
            <span className="pay-detail-value">
              {selectedLogistics ? (
                <>
                  {etaRange.lo}–{etaRange.hi} min
                </>
              ) : (
                "—"
              )}
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

        <div className="card breakdown">
          <div className="summary-row">
            <span>{tPay.amountShop}</span>
            <strong id="payShop">{formatRwf(itemsTotal)}</strong>
          </div>
          <div className="summary-row">
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

        {selectedLogistics ? (
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

        {selectedLogistics && courierModalOpen ? (
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

        <button type="button" className="primary-btn" onClick={proceedToMainCartCheckout}>
          {tPay.sendOrder}
        </button>
      </section>

      <div className="footer">
        <button className={page === 1 ? "active" : ""} onClick={() => goToPage(1)}>
          🏠<span>Home</span>
        </button>
        <button className={page === 2 ? "active" : ""} onClick={() => goToPage(2)}>
          🏬<span>Shops</span>
        </button>
        <button className={page === 3 ? "active" : ""} onClick={() => goToPage(3)}>
          🛍️<span>Items</span>
        </button>
        <button className={page === 4 ? "active" : ""} onClick={() => goToPage(4)}>
          📦<span>Summary</span>
        </button>
        <button className={page === 5 ? "active" : ""} onClick={() => goToPage(5)}>
          💳<span>Pay</span>
        </button>
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
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-3 hover:bg-muted/40">
                      <input
                        type="checkbox"
                        checked={liveShowAll}
                        onChange={(e) => setLiveShowAll(e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600"
                      />
                      <span>
                        <span className="block text-sm font-bold">Show full catalog</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          When off, only a sample shows until you search.
                        </span>
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

      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent
          side="right"
          className="flex w-full max-w-[min(100vw,420px)] flex-col gap-0 overflow-y-auto border-l p-0"
        >
          <SheetHeader className="border-b border-border px-4 py-4 text-left">
            <SheetTitle>{settingsUi.settings}</SheetTitle>
            <SheetDescription>{settingsUi.settingsSub}</SheetDescription>
          </SheetHeader>
          <div className="space-y-6 px-4 py-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {settingsUi.yourAccount}
              </div>
              {isAuthenticated && authUser ? (
                <div className="mt-2 space-y-2">
                  <p className="text-sm font-semibold text-foreground">{authUser.name}</p>
                  <p className="break-all text-xs text-muted-foreground">{authUser.email}</p>
                  <button
                    type="button"
                    onClick={() => {
                      logout()
                      setSettingsOpen(false)
                    }}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-left text-sm font-bold text-foreground hover:bg-muted/60"
                  >
                    {settingsUi.signOut}
                  </button>
                </div>
              ) : (
                <div className="mt-2 space-y-2">
                  <p className="text-sm font-bold text-foreground">{settingsUi.browsingAsGuest}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">{settingsUi.guestModeHint}</p>
                  <button
                    type="button"
                    onClick={() => {
                      router.push(`/login?redirect=${encodeURIComponent("/grandma")}`)
                      setSettingsOpen(false)
                    }}
                    className="w-full rounded-xl border border-blue-600 bg-blue-50 px-3 py-2.5 text-sm font-bold text-blue-950 hover:bg-blue-100"
                  >
                    {settingsUi.signIn}
                  </button>
                </div>
              )}
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Mode</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(["buyer", "seller"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setAppMode(mode)}
                    className={cn(
                      "rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors",
                      appMode === mode
                        ? "border-blue-600 bg-blue-50 text-blue-900"
                        : "border-border bg-background text-foreground hover:bg-muted/60",
                    )}
                  >
                    {mode === "buyer" ? "Buyer" : "Seller"}
                  </button>
                ))}
              </div>
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
                {locationData ? displayUserLocation : settingsUi.noLocationYet}
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
              <div className="mt-2 max-h-52 space-y-1 overflow-y-auto rounded-xl border border-border p-2">
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
                {MOCK_SHOPS.map((shop) => (
                  <label
                    key={shop.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50"
                  >
                    <input
                      type="checkbox"
                      checked={preferredShopIds.includes(shop.id)}
                      onChange={() => togglePreferredShop(shop.id)}
                      className="h-4 w-4 shrink-0 accent-blue-600"
                    />
                    <img src={shop.logoSrc} alt="" className="h-8 w-8 shrink-0 rounded-md border border-border bg-white object-contain" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{shop.name}</span>
                  </label>
                ))}
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
        </SheetContent>
      </Sheet>

      <LocationCaptureDialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen} />
    </div>
  )
}

