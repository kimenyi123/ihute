/**
 * Single source of truth for Grandma categories.
 *
 * IDs are Kaos `PREFEREDCATEGORIES` / `preferedcategories` slugs (strings), not numeric rows.
 * There is no separate category table — sellers store the slug on account_signup / account_seller.
 *
 * Display mapping (do not infer Pharmacy from a shop name when the DB says boutique):
 * 1. PREFEREDCATEGORIES — authoritative
 * 2. DEPARTMENT — only if preferred is empty
 * 3. Shop name — only if both category fields are empty
 *
 * Electronics, Home Supplies, Building Materials, and Auto Parts are nested under
 * Others (Ibindi) on the Grandma home UI. Slugs stay independent for search/registration.
 */

export type GrandmaLang = "en" | "fr" | "rw"

export type GrandmaCategoryDef = {
  /** Stable application id = Kaos sector slug stored on the seller row. */
  id: string
  slug: string
  /** Grandma home-grid / search label (English canonical). */
  label: string
  icon: string
  /** Values accepted from registration UI / DB variants. */
  aliases: string[]
  labels: Record<GrandmaLang, string>
  /** Shown on Grandma home category cards. Nested children use parentId instead. */
  nav: boolean
  /** When set, this card lives on the Others (Ibindi) hub, not the home grid. */
  parentId?: "others"
  active: boolean
}

/**
 * Catalog order is stable. Home grid = nav && !parentId (Boutique…Veterinary, Others).
 * The four nested cards live on the Others / Ibindi hub (parentId: "others").
 */
export const GRANDMA_CATEGORY_CATALOG: readonly GrandmaCategoryDef[] = [
  {
    id: "boutique",
    slug: "boutique",
    label: "Boutique",
    icon: "🏪",
    aliases: ["boutique", "butike", "shop"],
    labels: { en: "Boutique", rw: "Butike", fr: "Boutique" },
    nav: true,
    active: true,
  },
  {
    id: "supermarket",
    slug: "supermarket",
    label: "Supermarket",
    icon: "🛒",
    aliases: ["supermarket", "alimantasiyo", "grocery"],
    labels: { en: "Supermarket", rw: "Alimantasiyo", fr: "Supermarché" },
    nav: true,
    active: true,
  },
  {
    id: "pharmacy",
    slug: "pharmacy",
    label: "Pharmacy",
    icon: "💊",
    aliases: ["pharmacy", "pharmacie", "farumasi", "pharma", "drugstore"],
    labels: { en: "Pharmacy", rw: "Farumasi", fr: "Pharmacie" },
    nav: true,
    active: true,
  },
  {
    id: "restaurant",
    slug: "restaurant",
    label: "Restaurant",
    icon: "🍽️",
    aliases: [
      "restaurant",
      "bar-resto",
      "bar/resto",
      "bar/restaurant",
      "resto",
      "resitora",
      "pizzeria",
    ],
    labels: { en: "Restaurant", rw: "Resitora", fr: "Restaurant" },
    nav: true,
    active: true,
  },
  {
    id: "liquor-store",
    slug: "liquor-store",
    label: "Liquor Store",
    icon: "🍺",
    aliases: ["liquor-store", "liquor store", "liquor", "inzoga"],
    labels: { en: "Liquor Store", rw: "Inzoga", fr: "Boissons" },
    nav: true,
    active: true,
  },
  {
    id: "coffee-shop",
    slug: "coffee-shop",
    label: "Bakery",
    icon: "🥖",
    aliases: ["bakery", "coffee-shop", "coffee shop", "imikati"],
    labels: { en: "Bakery", rw: "Imikati", fr: "Boulangerie" },
    nav: true,
    active: true,
  },
  {
    id: "veterinary",
    slug: "veterinary",
    label: "Veterinary",
    icon: "🐾",
    aliases: ["veterinary", "vet", "amatungo"],
    labels: { en: "Veterinary", rw: "Amatungo", fr: "Vétérinaire" },
    nav: true,
    active: true,
  },
  {
    id: "electronics",
    slug: "electronics",
    label: "Electronics",
    icon: "🔌",
    aliases: ["electronics", "electronic", "ibikoresho bya elektroni"],
    labels: { en: "Electronics", rw: "Ibikoresho by'amashanyarazi", fr: "Électronique" },
    nav: false,
    parentId: "others",
    active: true,
  },
  {
    id: "home-supplies",
    slug: "home-supplies",
    label: "Home Supplies",
    icon: "🏠",
    aliases: [
      "home-supplies",
      "home supplies",
      "household",
      "household-store",
      "household store",
    ],
    labels: { en: "Home Supplies", rw: "Ibikoresho byo mu rugo", fr: "Articles ménagers" },
    nav: false,
    parentId: "others",
    active: true,
  },
  {
    id: "building-materials",
    slug: "building-materials",
    label: "Building Materials",
    icon: "🧱",
    aliases: [
      "building-materials",
      "building materials",
      "hardware",
      "construction",
      "cimenterie",
    ],
    labels: { en: "Building Materials", rw: "Ibikoresho byo kubaka", fr: "Matériaux de construction" },
    nav: false,
    parentId: "others",
    active: true,
  },
  {
    id: "auto-parts",
    slug: "auto-parts",
    label: "Auto Parts",
    icon: "🚗",
    aliases: [
      "auto-parts",
      "auto parts",
      "spare-parts",
      "spare parts",
      "vehicle-parts",
      "vehicle spare parts",
    ],
    labels: { en: "Auto Parts", rw: "Ibice by'imodoka", fr: "Pièces auto" },
    nav: false,
    parentId: "others",
    active: true,
  },
  {
    id: "others",
    slug: "others",
    label: "Others",
    icon: "◻️",
    aliases: ["others", "other", "ibindi", "general", "general-store", "general store"],
    labels: { en: "Others", rw: "Ibindi", fr: "Autres" },
    nav: true,
    active: true,
  },
] as const

export type GrandmaCategoryLabel = (typeof GRANDMA_CATEGORY_CATALOG)[number]["label"]

export const GRANDMA_CATEGORY_TO_SECTOR_SLUG: Record<GrandmaCategoryLabel, string> =
  Object.fromEntries(GRANDMA_CATEGORY_CATALOG.map((c) => [c.label, c.slug])) as Record<
    GrandmaCategoryLabel,
    string
  >

const ALIAS_TO_LABEL: Record<string, GrandmaCategoryLabel> = (() => {
  const out: Record<string, GrandmaCategoryLabel> = {}
  for (const c of GRANDMA_CATEGORY_CATALOG) {
    out[c.label.toLowerCase()] = c.label
    out[c.slug] = c.label
    out[c.id] = c.label
    for (const a of c.aliases) {
      out[a.toLowerCase()] = c.label
    }
  }
  return out
})()

export function grandmaCategoryLabel(cat: GrandmaCategoryLabel, lang: GrandmaLang): string {
  const row = GRANDMA_CATEGORY_CATALOG.find((c) => c.label === cat)
  return row?.labels[lang] ?? cat
}

export function grandmaNavCategories(): GrandmaCategoryDef[] {
  return GRANDMA_CATEGORY_CATALOG.filter((c) => c.nav && c.active && !c.parentId)
}

/** Categories shown after tapping Others / Ibindi (same card UI). */
export function grandmaOthersChildCategories(): GrandmaCategoryDef[] {
  return GRANDMA_CATEGORY_CATALOG.filter((c) => c.active && c.parentId === "others")
}

export function isOthersHubCategory(label: string): boolean {
  return resolveGrandmaCategory(label) === "Others"
}

export function isOthersChildCategory(label: string): boolean {
  const resolved = resolveGrandmaCategory(label)
  return grandmaOthersChildCategories().some((c) => c.label === resolved)
}

/**
 * True when `raw` is a known Grandma label, slug, or alias.
 * Unknown strings must NOT silently become Others in search filters.
 */
export function isKnownGrandmaCategoryInput(raw: unknown): boolean {
  const s = String(raw ?? "").trim()
  if (!s) return true
  const lower = s.toLowerCase().replace(/[_]+/g, " ").replace(/\s+/g, " ").trim()
  const slug = lower.replace(/\s+/g, "-").replace(/[/']/g, "-")
  if (s in GRANDMA_CATEGORY_TO_SECTOR_SLUG) return true
  if (ALIAS_TO_LABEL[lower] || ALIAS_TO_LABEL[slug]) return true
  for (const c of GRANDMA_CATEGORY_CATALOG) {
    if (c.slug === slug || c.slug === lower || c.label.toLowerCase() === lower) return true
  }
  return false
}

/**
 * Source of truth for a LIVE seller's Grandma category card.
 * Explicit `boutique` stays Boutique even if the shop name contains "Pharmacie".
 */
export function resolveSellerDisplayCategory(
  preferredCategories: unknown,
  department: unknown = "",
  shopName: unknown = "",
): GrandmaCategoryLabel {
  const preferred = String(preferredCategories ?? "").trim()
  if (preferred) return resolveGrandmaCategory(preferred)
  const dept = String(department ?? "").trim()
  if (dept) return resolveGrandmaCategory(dept)
  const name = String(shopName ?? "").trim()
  if (name) return resolveGrandmaCategory(name)
  return "Others"
}

/**
 * SQL LIKE patterns for filtering LIVE sellers by Grandma sector.
 * Keep Auto Parts specific (no generic `%auto%`) so mechanics/garages are not pulled in.
 */
export function grandmaSectorLikePatterns(sectorOrCategory: string): string[] {
  const s = sectorOrCategory.trim().toLowerCase()
  if (!s) return []
  const fromSlug = Object.entries(GRANDMA_CATEGORY_TO_SECTOR_SLUG).find(([, v]) => v === s)
  const label = fromSlug?.[0] ?? (s in GRANDMA_CATEGORY_TO_SECTOR_SLUG ? sectorOrCategory : resolveGrandmaCategory(s))
  const slug = GRANDMA_CATEGORY_TO_SECTOR_SLUG[label as GrandmaCategoryLabel] || s
  const patterns = new Set<string>()
  patterns.add(`%${slug}%`)
  patterns.add(`%${label}%`)
  patterns.add(`%${slug.replace(/-/g, " ")}%`)
  if (slug === "liquor-store") patterns.add("%liquor%")
  if (slug === "coffee-shop") patterns.add("%bakery%")
  if (slug === "restaurant") {
    patterns.add("%restaurant%")
    patterns.add("%bar%")
  }
  if (slug === "building-materials") {
    patterns.add("%hardware%")
    patterns.add("%construction%")
  }
  if (slug === "auto-parts") {
    patterns.add("%auto-parts%")
    patterns.add("%auto parts%")
    patterns.add("%spare-parts%")
    patterns.add("%spare parts%")
    patterns.add("%vehicle-parts%")
    patterns.add("%vehicle parts%")
  }
  if (slug === "home-supplies") patterns.add("%household%")
  if (slug === "others") {
    patterns.add("%other%")
    patterns.add("%general%")
  }
  return [...patterns]
}

/** True when a shop name is the literal placeholder "null"/"undefined"/empty — not a real name. */
export function isPlaceholderGrandmaShopName(value: unknown): boolean {
  const n = String(value ?? "").trim()
  return !n || /^null$/i.test(n) || /^undefined$/i.test(n)
}

/** Prefer a real shop name; never surface the literal string "null" from bad historical rows. */
export function displayGrandmaShopName(
  nickname: string,
  ownerName: string,
  sellerAccount: string,
): string {
  if (!isPlaceholderGrandmaShopName(nickname)) return nickname.trim()
  if (!isPlaceholderGrandmaShopName(ownerName)) return ownerName.trim()
  return sellerAccount.trim() || "Shop"
}

/** Registration dropdown values (human-readable, converted to slugs on submit). */
export const GRANDMA_REGISTRATION_CATEGORY_VALUES: string[] = GRANDMA_CATEGORY_CATALOG.filter(
  (c) => c.active,
).map((c) => {
  if (c.slug === "liquor-store") return "liquor store"
  if (c.slug === "coffee-shop") return "coffee shop"
  if (c.slug === "restaurant") return "bar/restaurant"
  if (c.slug === "home-supplies") return "home supplies"
  if (c.slug === "building-materials") return "building materials"
  if (c.slug === "auto-parts") return "auto parts"
  if (c.slug === "others") return "other"
  return c.slug
})

export function resolveGrandmaCategory(raw: unknown): GrandmaCategoryLabel {
  const s = String(raw ?? "").trim()
  if (!s) return "Others"
  if (s in GRANDMA_CATEGORY_TO_SECTOR_SLUG) {
    return s as GrandmaCategoryLabel
  }
  const lower = s.toLowerCase().replace(/[_]+/g, " ").replace(/\s+/g, " ").trim()
  if (ALIAS_TO_LABEL[lower]) return ALIAS_TO_LABEL[lower]
  const slug = lower.replace(/\s+/g, "-").replace(/[/']/g, "-")
  if (ALIAS_TO_LABEL[slug]) return ALIAS_TO_LABEL[slug]
  for (const c of GRANDMA_CATEGORY_CATALOG) {
    if (c.slug === slug || c.slug === lower) return c.label
    if (c.label.toLowerCase() === lower) return c.label
  }
  return "Others"
}
