import type { LucideIcon } from "lucide-react"
import {
  Beer,
  Carrot,
  Coffee,
  Egg,
  Flame,
  GlassWater,
  HeartPulse,
  Leaf,
  Pill,
  Sparkles,
  Wine,
  Baby,
  Smartphone,
  Shirt,
  ShoppingBag,
  Stethoscope,
  Zap,
} from "lucide-react"
import { shopCategoryToSectorSlug } from "@/lib/seller-category-sector"
import { isRestoBarPreferredCategories } from "@/lib/supplier-sector"
import { SURPRISE_MOOD_ID } from "@/lib/seller-surprise-config"

const ALCOHOL_REGEX =
  /wine|beer|spirits|cocktail|whiskey|whisky|vodka|rum|gin|cognac|lager|ale|sparkling|bitters|cream|shot cocktail|coffee cocktail/i
const NON_ALCOHOL_REGEX =
  /juice|smoothie|soft drink|virgin|tea|coffee|water|milkshake|iced|hot tea|hot coffee|fresh juice|dessert|accompaniment|vegetable/i
const KIDS_EXCLUDE =
  /child|kids|pediatric|baby|infant|syrup|enfant|pediatri|junior|nourrisson/i

export type MoodOption = {
  id: string
  label: string
  Icon: LucideIcon
  colorClass: string
  categoryRegex: RegExp
  /** When set, products matching this are excluded (e.g. adult vs kids in pharmacy). */
  excludeRegex?: RegExp
}

export type SellerMoodSector = "food" | "pharmacy" | "liquor" | "retail"

const MOOD_TRENDING: MoodOption = {
  id: "beer",
  label: "Trending Now",
  Icon: Beer,
  colorClass: "text-amber-500",
  categoryRegex: /./i,
}
const MOOD_DISCOUNTED: MoodOption = {
  id: "cocktails",
  label: "Discounted",
  Icon: Sparkles,
  colorClass: "text-pink-500",
  categoryRegex: /./i,
}
const MOOD_FAVORITES: MoodOption = {
  id: "coffee",
  label: "Favorites",
  Icon: Coffee,
  colorClass: "text-amber-800",
  categoryRegex: /./i,
}
const MOOD_SURPRISE: MoodOption = {
  id: SURPRISE_MOOD_ID,
  label: "Surprise me :)",
  Icon: GlassWater,
  colorClass: "text-sky-500",
  categoryRegex: /./i,
}

const MOOD_OPTIONS_FOOD: MoodOption[] = [
  {
    id: "meat",
    label: "I'm a meat lover",
    Icon: Flame,
    colorClass: "text-orange-600",
    categoryRegex:
      /main course|burger|barbecue|bbq|meat|platter|sizzling|rice|pasta|pizza|beef|goat|pork/i,
  },
  {
    id: "vg",
    label: "I'm a VG",
    Icon: Carrot,
    colorClass: "text-emerald-600",
    categoryRegex:
      /vegetable|salad|cold starter|dessert|beverage|juice|smoothie|soft drink|virgin|tea|coffee|vegan|vg/i,
  },
  {
    id: "white-meat",
    label: "I eat white meat",
    Icon: Egg,
    colorClass: "text-amber-600",
    categoryRegex: /chicken|fish|seafood|salad|cold starter|hot starter|main course|rice|pasta|turkey/i,
  },
  {
    id: "white-wine",
    label: "Alcohol",
    Icon: Wine,
    colorClass: "text-lime-400",
    categoryRegex: ALCOHOL_REGEX,
  },
  {
    id: "whisky",
    label: "Non-Alcohol",
    Icon: Sparkles,
    colorClass: "text-amber-700",
    categoryRegex: NON_ALCOHOL_REGEX,
  },
  MOOD_TRENDING,
  MOOD_DISCOUNTED,
  MOOD_FAVORITES,
  MOOD_SURPRISE,
]

const MOOD_OPTIONS_PHARMACY: MoodOption[] = [
  {
    id: "pain",
    label: "Pain relief",
    Icon: Pill,
    colorClass: "text-red-500",
    categoryRegex: /pain|paracetamol|analgesic|ibuprofen|headache|fever|dolor|douleur|aspirin|migraine/i,
  },
  {
    id: "cold-flu",
    label: "Cold & flu",
    Icon: Stethoscope,
    colorClass: "text-blue-500",
    categoryRegex: /cold|flu|cough|syrup|decongest|rhume|toux|expector|antituss/i,
  },
  {
    id: "allergy",
    label: "Allergy",
    Icon: Leaf,
    colorClass: "text-lime-600",
    categoryRegex: /allergy|antihist|hay fever|allerg|loratadine|cetirizine|pollen/i,
  },
  {
    id: "vitamins",
    label: "Vitamins & supplements",
    Icon: Leaf,
    colorClass: "text-emerald-600",
    categoryRegex: /vitamin|supplement|mineral|iron|calcium|multivitamin|omega|probiotic|zinc/i,
  },
  {
    id: "stomach",
    label: "Stomach & digestion",
    Icon: HeartPulse,
    colorClass: "text-orange-500",
    categoryRegex: /stomach|digest|antacid|diarr|constip|gastro|rehydration|ors|laxative/i,
  },
  {
    id: "skincare",
    label: "Skincare",
    Icon: Sparkles,
    colorClass: "text-pink-500",
    categoryRegex: /skin|cream|lotion|cosmetic|beauty|sunscreen|moisturizer|soin|visage|derma/i,
  },
  {
    id: "first-aid",
    label: "First aid",
    Icon: Zap,
    colorClass: "text-amber-600",
    categoryRegex: /first aid|bandage|plaster|antiseptic|gauze|wound|disinfect/i,
  },
  {
    id: "kids",
    label: "For kids",
    Icon: Baby,
    colorClass: "text-sky-500",
    categoryRegex: /child|kids|pediatric|baby|infant|syrup|enfant|pediatri|junior/i,
  },
  {
    id: "adults",
    label: "For adults",
    Icon: HeartPulse,
    colorClass: "text-amber-600",
    categoryRegex: /adult|tablet|capsule|medicine|medicament|general|pain|fever|headache|comprime/i,
    excludeRegex: KIDS_EXCLUDE,
  },
  MOOD_TRENDING,
  MOOD_DISCOUNTED,
  MOOD_FAVORITES,
  MOOD_SURPRISE,
]

const MOOD_OPTIONS_LIQUOR: MoodOption[] = [
  {
    id: "white-wine",
    label: "Alcohol",
    Icon: Wine,
    colorClass: "text-lime-400",
    categoryRegex: ALCOHOL_REGEX,
  },
  {
    id: "whisky",
    label: "Non-Alcohol",
    Icon: Sparkles,
    colorClass: "text-amber-700",
    categoryRegex: NON_ALCOHOL_REGEX,
  },
  MOOD_TRENDING,
  MOOD_DISCOUNTED,
  MOOD_FAVORITES,
  MOOD_SURPRISE,
]

const MOOD_OPTIONS_BOUTIQUE: MoodOption[] = [
  {
    id: "new-arrivals",
    label: "New arrivals",
    Icon: Sparkles,
    colorClass: "text-pink-500",
    categoryRegex: /new|latest|arrival|collection|trend/i,
  },
  {
    id: "for-her",
    label: "For her",
    Icon: Shirt,
    colorClass: "text-rose-500",
    categoryRegex: /women|woman|lady|dress|skirt|bag|perfume|jewelry|scarf|her/i,
  },
  {
    id: "for-him",
    label: "For him",
    Icon: Shirt,
    colorClass: "text-slate-600",
    categoryRegex: /men|man|shirt|tie|belt|watch|shoe|suit|him|male/i,
  },
  {
    id: "kids-wear",
    label: "Kids wear",
    Icon: Baby,
    colorClass: "text-sky-500",
    categoryRegex: /kid|child|boy|girl|school|uniform|baby|junior/i,
  },
  MOOD_TRENDING,
  MOOD_DISCOUNTED,
  MOOD_FAVORITES,
  MOOD_SURPRISE,
]

const MOOD_OPTIONS_ELECTRONICS: MoodOption[] = [
  {
    id: "phones",
    label: "Phones & tablets",
    Icon: Smartphone,
    colorClass: "text-blue-600",
    categoryRegex: /phone|mobile|tablet|smartphone|iphone|samsung|ipad|android/i,
  },
  {
    id: "computers",
    label: "Computers",
    Icon: Zap,
    colorClass: "text-indigo-600",
    categoryRegex: /laptop|notebook|pc|computer|desktop|macbook|monitor/i,
  },
  {
    id: "accessories",
    label: "Accessories",
    Icon: ShoppingBag,
    colorClass: "text-amber-600",
    categoryRegex: /cable|adapter|case|cover|usb|mouse|keyboard|accessory|charger|headphone/i,
  },
  {
    id: "home-tech",
    label: "TV & home",
    Icon: Zap,
    colorClass: "text-violet-600",
    categoryRegex: /tv|television|audio|speaker|soundbar|router|wifi|printer|home/i,
  },
  MOOD_TRENDING,
  MOOD_DISCOUNTED,
  MOOD_FAVORITES,
  MOOD_SURPRISE,
]

const MOOD_OPTIONS_RETAIL: MoodOption[] = [
  {
    id: "essentials",
    label: "Daily essentials",
    Icon: ShoppingBag,
    colorClass: "text-emerald-600",
    categoryRegex: /rice|sugar|salt|oil|flour|soap|toothpaste|bread|milk|essential|basic/i,
  },
  {
    id: "snacks",
    label: "Snacks",
    Icon: Coffee,
    colorClass: "text-amber-600",
    categoryRegex: /snack|biscuit|chips|cookie|chocolate|candy|crisp/i,
  },
  MOOD_TRENDING,
  MOOD_DISCOUNTED,
  MOOD_FAVORITES,
  MOOD_SURPRISE,
]

const FOOD_SECTOR_SLUGS = new Set(["bar-resto", "restaurant", "coffee-shop", "pizzeria"])
const PHARMACY_SECTOR_SLUGS = new Set(["pharmacy"])
const LIQUOR_SECTOR_SLUGS = new Set(["liquor-store", "liquor"])
const RETAIL_SECTOR_SLUGS = new Set([
  "boutique",
  "supermarket",
  "general",
  "general-store",
  "electronics",
  "others",
  "veterinary",
  "beauty",
  "beauty-&-cosmetics",
])

function isBlankCategory(value?: string | null): boolean {
  const s = String(value ?? "").trim().toLowerCase()
  return s === "" || s === "na" || s === "n/a" || s === "null"
}

export function parseSellerCategorySlugs(
  preferredCategories?: string | null,
  department?: string | null
): string[] {
  const rawPref = String(preferredCategories ?? "").trim()
  const rawDept = String(department ?? "").trim()

  const parts: string[] = []
  if (!isBlankCategory(rawPref)) {
    parts.push(rawPref)
    if (/[,;|]/.test(rawPref)) {
      parts.push(...rawPref.split(/[,;|]+/).map((s) => s.trim()).filter(Boolean))
    }
  } else if (!isBlankCategory(rawDept)) {
    parts.push(rawDept)
    if (/[,;|]/.test(rawDept)) {
      parts.push(...rawDept.split(/[,;|]+/).map((s) => s.trim()).filter(Boolean))
    }
  }

  const slugs = parts.filter(Boolean).map((p) => shopCategoryToSectorSlug(p))
  return [...new Set(slugs.filter(Boolean))]
}

export function resolveSellerMoodSectorFromSlugs(slugs: string[]): SellerMoodSector | null {
  if (slugs.length === 0) return null

  for (const slug of slugs) {
    if (PHARMACY_SECTOR_SLUGS.has(slug) || slug.includes("pharm")) return "pharmacy"
  }
  for (const slug of slugs) {
    if (LIQUOR_SECTOR_SLUGS.has(slug) || slug.includes("liquor")) return "liquor"
  }
  for (const slug of slugs) {
    if (FOOD_SECTOR_SLUGS.has(slug) || isRestoBarPreferredCategories(slug)) return "food"
  }
  for (const slug of slugs) {
    if (RETAIL_SECTOR_SLUGS.has(slug)) return "retail"
  }

  const hay = slugs.join(" ")
  if (hay.includes("pharm")) return "pharmacy"
  if (hay.includes("liquor")) return "liquor"
  if (hay.includes("resto") || hay.includes("restaurant") || hay.includes("bar-resto") || hay.includes("coffee")) {
    return "food"
  }

  return "retail"
}

export function resolveSellerMoodSector(
  preferredCategories?: string | null,
  department?: string | null
): SellerMoodSector | null {
  return resolveSellerMoodSectorFromSlugs(parseSellerCategorySlugs(preferredCategories, department))
}

export function sellerIsPharmacyCategory(
  preferredCategories?: string | null,
  department?: string | null
): boolean {
  return resolveSellerMoodSector(preferredCategories, department) === "pharmacy"
}

export function getMoodOptionsForSector(
  sector: SellerMoodSector,
  slugs: string[] = []
): MoodOption[] {
  if (sector === "pharmacy") return MOOD_OPTIONS_PHARMACY
  if (sector === "food") return MOOD_OPTIONS_FOOD
  if (sector === "liquor") return MOOD_OPTIONS_LIQUOR
  if (slugs.includes("electronics")) return MOOD_OPTIONS_ELECTRONICS
  if (slugs.includes("boutique")) return MOOD_OPTIONS_BOUTIQUE
  return MOOD_OPTIONS_RETAIL
}

export function getMoodOptionsForSeller(
  preferredCategories?: string | null,
  department?: string | null
): MoodOption[] {
  const slugs = parseSellerCategorySlugs(preferredCategories, department)
  const sector = resolveSellerMoodSectorFromSlugs(slugs)
  if (!sector) return []
  return getMoodOptionsForSector(sector, slugs)
}

export function isSurpriseMoodId(id: string): boolean {
  return id === SURPRISE_MOOD_ID
}
