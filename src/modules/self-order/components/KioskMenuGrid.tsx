"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ShoppingCart, Search, ChevronLeft, X, Trash2, ChevronRight, Moon, Sun } from "lucide-react"
import type {
  KioskCategory,
  KioskMenuItem,
  KioskModifierGroup,
  KioskModifierOption,
} from "@/src/modules/self-order/types"
import { useCartStore } from "@/lib/cart-store"
import { generalSellingPrice, normalizeItemEmballageForCart } from "@/lib/package-price"
import { Input } from "@/components/ui/input"

interface Props {
  items: KioskMenuItem[]
  category: KioskCategory
  venueName?: string
  venueLogoUrl?: string
  shopNickname?: string
}

/** Stable reference — category row for shop share links (nickname + BAR/RESTRO) */
const UNIFIED_SHOP_MENU_TAB_LIST: string[] = ["All", "Other", "Drinks", "Food"]

type MenuLang = "en" | "fr" | "rw"

const MENU_I18N: Record<
  MenuLang,
  {
    search: string
    cart: string
    yourOrder: string
    cartEmpty: string
    placeOrder: string
    addToCart: string
    total: string
    previous: string
    next: string
    of: string
    noItems: string
  }
> = {
  en: {
    search: "Search menu…",
    cart: "Cart",
    yourOrder: "Your Order",
    cartEmpty: "Your cart is empty. Tap an item to add it.",
    placeOrder: "Place Order",
    addToCart: "Add to Cart",
    total: "Total",
    previous: "Previous",
    next: "Next",
    of: "of",
    noItems: "No items found.",
  },
  fr: {
    search: "Rechercher menu…",
    cart: "Panier",
    yourOrder: "Votre commande",
    cartEmpty: "Votre panier est vide. Touchez un article pour l'ajouter.",
    placeOrder: "Passer la commande",
    addToCart: "Ajouter au panier",
    total: "Total",
    previous: "Précédent",
    next: "Suivant",
    of: "sur",
    noItems: "Aucun article trouvé.",
  },
  rw: {
    search: "Shakisha menu…",
    cart: "Igitebo",
    yourOrder: "Ibyo watumije",
    cartEmpty: "Igitebo kirimo ubusa. Kanda ku kintu ukongeremo.",
    placeOrder: "Komeza gutumiza",
    addToCart: "Shyira mu gitebo",
    total: "Igiteranyo",
    previous: "Ibibanza",
    next: "Ibikurikira",
    of: "kuri",
    noItems: "Nta bintu byabonetse.",
  },
}

// ─── Family emoji map ─────────────────────────────────────────────────────────
const FAMILY_EMOJI: Record<string, string> = {
  // Food families
  "breakfast": "🍳",
  "petit déjeuner": "🍳",
  "starters": "🥗",
  "entrées": "🥗",
  "entrees": "🥗",
  "appetizers": "🥗",
  "main course": "🍽",
  "main courses": "🍽",
  "plat principal": "🍽",
  "plats": "🍽",
  "pasta & rice": "🍝",
  "pasta": "🍝",
  "rice": "🍚",
  "riz": "🍚",
  "pizza": "🍕",
  "pizzas": "🍕",
  "sizzling & bbq": "🔥",
  "bbq": "🔥",
  "grills": "🔥",
  "grill": "🔥",
  "braisé": "🔥",
  "burgers & snacks": "🍔",
  "burgers": "🍔",
  "snacks": "🍟",
  "sides": "🍟",
  "side dishes": "🍟",
  "accompagnement": "🍟",
  "sandwiches": "🥪",
  "desserts": "🍰",
  "dessert": "🍰",
  "cakes": "🎂",
  "salads": "🥗",
  "salade": "🥗",
  "soups": "🍲",
  "soup": "🍲",
  "seafood": "🦞",
  "fish": "🐟",
  "poisson": "🐟",
  "fruits de mer": "🦞",
  "chicken": "🍗",
  "poulet": "🍗",
  "viande": "🥩",
  "meat": "🥩",
  "beef": "🥩",
  "pork": "🥩",
  "vegetarian": "🌱",
  "vegan": "🌱",
  "food": "🍽",
  "omelette": "🍳",
  "omelettes": "🍳",
  "eggs": "🥚",
  // Drink families
  "beer & cider": "🍺",
  "beers": "🍺",
  "beer": "🍺",
  "bière": "🍺",
  "draft beer": "🍺",
  "wine": "🍷",
  "vins": "🍷",
  "red wine": "🍷",
  "white wine": "🥂",
  "rosé": "🥂",
  "rose": "🥂",
  "spirits": "🥃",
  "whisky": "🥃",
  "whiskey": "🥃",
  "vodka": "🥃",
  "gin": "🥃",
  "rum": "🥃",
  "brandy": "🥃",
  "cognac": "🥃",
  "cocktails & drinks": "🍹",
  "cocktails": "🍹",
  "drinks": "🥤",
  "alcoholic drinks": "🍹",
  "juices & smoothies": "🧃",
  "juices": "🧃",
  "smoothies": "🥤",
  "jus": "🧃",
  "soft drinks": "🥤",
  "sodas": "🥤",
  "water": "💧",
  "eau": "💧",
  "coffee & tea": "☕",
  "coffee": "☕",
  "tea": "🍵",
  "hot drinks": "☕",
  "boissons chaudes": "☕",
  "energy drinks": "⚡",
  "energy": "⚡",
}

function getFamilyEmoji(family: string): string {
  const key = family.trim().toLowerCase()

  // 1. Exact match from hardcoded map
  if (FAMILY_EMOJI[key]) return FAMILY_EMOJI[key]

  // 2. Partial keyword scan — works for any shop's unknown famille names
  if (key.includes("beer") || key.includes("bière") || key.includes("draft") || key.includes("bier")) return "🍺"
  if (key.includes("wine") || key.includes("vin") || key.includes("rosé")) return "🍷"
  if (key.includes("whisky") || key.includes("whiskey") || key.includes("spirit") || key.includes("vodka") || key.includes("gin") || key.includes("rum") || key.includes("tequila") || key.includes("cognac") || key.includes("brandy")) return "🥃"
  if (key.includes("cocktail") || key.includes("mojito") || key.includes("margarita") || key.includes("mix")) return "🍹"
  if (key.includes("juice") || key.includes("jus") || key.includes("smoothie")) return "🧃"
  if (key.includes("soda") || key.includes("soft") || key.includes("fizzy") || key.includes("cola") || key.includes("energy") || key.includes("drink")) return "🥤"
  if (key.includes("water") || key.includes("eau")) return "💧"
  if (key.includes("coffee") || key.includes("café") || key.includes("hot drink") || key.includes("boisson chaude")) return "☕"
  if (key.includes("tea") || key.includes("thé")) return "🍵"
  if (key.includes("breakfast") || key.includes("déjeuner") || key.includes("brunch")) return "🍳"
  if (key.includes("starter") || key.includes("appetiz") || key.includes("entrée")) return "🥗"
  if (key.includes("pizza")) return "🍕"
  if (key.includes("pasta") || key.includes("noodle") || key.includes("spaghetti")) return "🍝"
  if (key.includes("rice") || key.includes("riz")) return "🍚"
  if (key.includes("burger")) return "🍔"
  if (key.includes("sandwich") || key.includes("wrap") || key.includes("sub")) return "🥪"
  if (key.includes("bbq") || key.includes("grill") || key.includes("brais")) return "🔥"
  if (key.includes("pizza")) return "🍕"
  if (key.includes("snack") || key.includes("side") || key.includes("chips") || key.includes("fries") || key.includes("accomp")) return "🍟"
  if (key.includes("soup") || key.includes("soupe") || key.includes("stew") || key.includes("ragout")) return "🍲"
  if (key.includes("fish") || key.includes("poisson") || key.includes("seafood") || key.includes("tilapia") || key.includes("mer")) return "🐟"
  if (key.includes("chicken") || key.includes("poulet")) return "🍗"
  if (key.includes("beef") || key.includes("steak") || key.includes("viande") || key.includes("meat") || key.includes("lamb") || key.includes("pork") || key.includes("goat")) return "🥩"
  if (key.includes("veg") || key.includes("vegan") || key.includes("salad") || key.includes("salade")) return "🥗"
  if (key.includes("dessert") || key.includes("cake") || key.includes("ice cream") || key.includes("glace") || key.includes("sweet")) return "🍰"

  // 3. Generic fallbacks
  if (DRINK_NAME_KEYWORDS.some((kw) => key.includes(kw))) return "🍹"
  if (FOOD_NAME_KEYWORDS.some((kw) => key.includes(kw))) return "🍽"

  return "🍴"  // totally unknown — generic cutlery, not 🍽 (which looks like food)
}


// ─── BAR vs KITCHEN family classification ────────────────────────────────────
const BAR_FAMILIES = new Set([
  "beer & cider", "beers", "beer", "draft beer", "bière",
  "wine", "vins", "red wine", "white wine", "rosé", "rose",
  "spirits", "whisky", "whiskey", "vodka", "gin", "rum", "brandy", "cognac",
  "cocktails & drinks", "cocktails", "drinks", "alcoholic drinks",
  "juices & smoothies", "juices", "smoothies", "jus",
  "soft drinks", "sodas", "soft", "water", "eau", "fizzy drinks",
  "coffee & tea", "coffee", "tea", "hot drinks", "boissons chaudes",
  "energy drinks", "energy",
])

const KITCHEN_FAMILIES = new Set([
  "starters", "entrées", "entrees", "appetizers",
  "main course", "main courses", "plat principal", "plats",
  "pasta & rice", "pasta", "rice", "riz",
  "pizza", "pizzas",
  "sizzling & bbq", "bbq", "grills", "grill", "braisé",
  "burgers & snacks", "burgers", "snacks", "sandwiches",
  "sides", "side dishes", "accompagnement",
  "desserts", "dessert", "cakes", "ice cream", "glaces",
  "breakfast", "petit déjeuner", "brunch",
  "salads", "salade", "salades",
  "soups", "soup", "soupes",
  "seafood", "fish", "poisson", "fruits de mer",
  "chicken", "poulet", "viande", "meat", "beef", "pork",
  "vegetarian", "végétarien", "vegan",
  "omelette", "eggs", "omelettes",
])

// ─── Drink keyword patterns for name-based fallback ─────────────────────────
// Matches common drink words that appear in item names when famille is blank.
const DRINK_NAME_KEYWORDS = [
  // beers
  "beer", "bière", "primus", "heineken", "skol", "amstel", "guinness", "tusker",
  "savana", "smirnoff", "bavaria", "desperados", "leffe", "virunga",
  // wines & champagne
  "wine", "vin ", "rose", "rosé", "champagne", "prosecco",
  // spirits
  "whisky", "whiskey", "vodka", "tequila", "gin", "rum", "cognac", "brandy",
  "jagermeister", "jägermeister", "jager",
  // cocktails & mixed
  "cocktail", "mojito", "margarita", "daiquiri", "b52", "jagerbomb",
  "panache", "panaché",
  // soft drinks
  "soda", "cola", "sprite", "fanta", "redbull", "red bull", "energy",
  "lemonade", "limonade",
  // juices
  "juice", "jus", "smoothie", "umutobe",
  // water / hot
  "water", "eau", "coffee", "café", "tea", "thé",
]

const FOOD_NAME_KEYWORDS = [
  "steak", "chicken", "poulet", "beef", "viande", "pork", "porc", "fish",
  "poisson", "tilapia", "goat", "chèvre", "lamb", "mutton",
  "rice", "riz", "ugali", "igisafuriya", "isombe", "ibirayi", "ibijumba",
  "curry", "stew", "ragout", "ragoût", "soup", "soupe",
  "burger", "sandwich", "wrap", "pizza", "pasta", "noodle",
  "salad", "salade", "brochette", "bbq", "grill",
  "cake", "dessert", "ice cream", "glace", "fruit", "tropical",
  "breakfast", "omelette", "egg", "pancake",
  "samosa", "spring roll", "meatball", "meatballs", "wings", "fingers",
  "cordon bleu", "stroganoff", "coleslaw", "chips",
]

/**
 * Classify an item into BAR or KITCHEN.
 * Priority: 1. famille field (exact match)  2. name keyword scan  3. default to KITCHEN
 */
function matchesKioskCategory(
  itemFamily: string,
  kiosk: KioskCategory,
  itemName = "",
): boolean {
  const fam = itemFamily.trim().toLowerCase()
  const isBlank = !fam || fam === "other" || fam === "na" || fam === "null"

  // ── 1. Exact famille set match ──────────────────────────────────────────
  if (!isBlank) {
    if (kiosk === "BAR") {
      if (BAR_FAMILIES.has(fam)) return true
      if (KITCHEN_FAMILIES.has(fam)) return false
    }
    if (kiosk === "RESTRO") {
      if (KITCHEN_FAMILIES.has(fam)) return true
      if (BAR_FAMILIES.has(fam)) return false
    }
  }

  // ── 2. Name-keyword fallback ────────────────────────────────────────────
  const nameLower = itemName.trim().toLowerCase()
  const isDrinkName = DRINK_NAME_KEYWORDS.some((kw) => nameLower.includes(kw))
  const isFoodName = FOOD_NAME_KEYWORDS.some((kw) => nameLower.includes(kw))

  if (kiosk === "BAR") {
    // If name strongly suggests food and NOT a drink → exclude from bar
    if (isFoodName && !isDrinkName) return false
    // If name suggests drink OR we have no signal → include (bar is default for unclassifiable)
    return isDrinkName || (!isFoodName)
  }
  if (kiosk === "RESTRO") {
    // If name strongly suggests drink and NOT food → exclude from kitchen
    if (isDrinkName && !isFoodName) return false
    // If name suggests food OR no signal → include in kitchen
    return isFoodName || (!isDrinkName)
  }

  return true
}

/**
 * For unified shop menus (nickname + BAR/RESTRO): split items into Drinks / Food / Other.
 * Uses famille sets first, then name keywords; ambiguous or unclassified → "other".
 */
function classifyItemKind(item: KioskMenuItem): "drink" | "food" | "other" {
  const fam = (item.item_department || item.category || "").toLowerCase().trim()
  const name = (item.item_commercial_name || item.item_name || "").toLowerCase()
  const isBlank = !fam || fam === "other" || fam === "na" || fam === "null"

  const isDrinkName = DRINK_NAME_KEYWORDS.some((kw) => name.includes(kw))
  const isFoodName = FOOD_NAME_KEYWORDS.some((kw) => name.includes(kw))

  if (!isBlank) {
    const barFam = BAR_FAMILIES.has(fam)
    const kitFam = KITCHEN_FAMILIES.has(fam)
    if (barFam && !kitFam) return "drink"
    if (kitFam && !barFam) return "food"
    if (barFam && kitFam) {
      if (isFoodName && !isDrinkName) return "food"
      if (isDrinkName && !isFoodName) return "drink"
      return "other"
    }
    // Non-empty famille but not in our sets
    if (isDrinkName && !isFoodName) return "drink"
    if (isFoodName && !isDrinkName) return "food"
    if (isDrinkName && isFoodName) return "other"
    return "other"
  }

  if (isDrinkName && !isFoodName) return "drink"
  if (isFoodName && !isDrinkName) return "food"
  if (isDrinkName && isFoodName) return "other"
  return "other"
}

// ─── Modifier group icon & label ─────────────────────────────────────────────
function getGroupIcon(name: string): string {
  const lower = name.toLowerCase()
  if (lower.includes("spice") || lower.includes("hot") || lower.includes("piment")) return "🌶"
  if (lower.includes("topping") || lower.includes("extra") || lower.includes("bonus")) return "➕"
  if (lower.includes("side") || lower.includes("accomp")) return "🍟"
  if (lower.includes("remove") || lower.includes("without") || lower.includes("sans")) return "❌"
  if (lower.includes("size") || lower.includes("taille") || lower.includes("portion")) return "📏"
  if (lower.includes("ice") || lower.includes("glace")) return "🧊"
  if (lower.includes("sauce")) return "🥫"
  return "✨"
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatPrice(n: number) {
  return n.toLocaleString("en") + " RWF"
}

function getItemTab(item: KioskMenuItem): string {
  const raw = item.item_department || item.category || ""
  const isBlank = !raw || raw.toLowerCase() === "null" || raw.toLowerCase() === "na"
  if (!isBlank) return raw.trim().replace(/\b\w/g, (c) => c.toUpperCase())

  // Infer a display tab from item name when famille is blank
  const n = (item.item_commercial_name || item.item_name || "").toLowerCase()
  if (DRINK_NAME_KEYWORDS.some((kw) => n.includes(kw))) return "Drinks"
  if (FOOD_NAME_KEYWORDS.some((kw) => n.includes(kw))) return "Food"
  return "Other"
}

function getOptionGroupsForItem(item: KioskMenuItem): KioskModifierGroup[] {
  const groups: KioskModifierGroup[] = []
  if (Array.isArray(item.sizes) && item.sizes.length) groups.push(...item.sizes)
  if (Array.isArray(item.modifiers) && item.modifiers.length) groups.push(...item.modifiers)
  if (Array.isArray(item.toppings) && item.toppings.length) groups.push(...item.toppings)
  return groups
}

// ─── Inline expand panel ─────────────────────────────────────────────────────
function ItemExpandPanel({
  item,
  onClose,
  onAdd,
  t,
}: {
  item: KioskMenuItem
  onClose: () => void
  onAdd: (item: KioskMenuItem, qty: number, selected: Record<string, KioskModifierOption>) => void
  t: (key: keyof (typeof MENU_I18N)["en"]) => string
}) {
  const [qty, setQty] = useState(1)
  const [selectedOptions, setSelectedOptions] = useState<Record<string, KioskModifierOption>>({})

  const baseUnit = Number(item.selling_price || 0)
  const basePrice = generalSellingPrice(baseUnit, item.item_emballage)
  const groups = getOptionGroupsForItem(item)
  const extra = Object.values(selectedOptions).reduce((sum, opt) => sum + (opt.priceDelta || 0), 0)
  const unitPrice = basePrice + extra

  const description = item.item_name && item.item_name !== item.item_commercial_name
    ? item.item_name
    : null

  function handleSelect(group: KioskModifierGroup, opt: KioskModifierOption) {
    setSelectedOptions((prev) => {
      if (group.type === "single") return { ...prev, [group.id]: opt }
      const existing = prev[group.id]
      if (existing && existing.id === opt.id) {
        const copy = { ...prev }; delete copy[group.id]; return copy
      }
      return { ...prev, [group.id]: opt }
    })
  }

  return (
    <div className="col-span-full rounded-2xl border-2 border-slate-200 bg-white shadow-xl overflow-hidden mb-3">
      {/* Header row */}
      <div className="flex items-start gap-4 p-4 pb-3">
        {item.image_url ? (
           
          <img
            src={item.image_url}
            alt={item.item_commercial_name}
            className="h-20 w-20 rounded-xl object-cover flex-shrink-0"
          />
        ) : (
          <div className="h-20 w-20 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 text-3xl">
            {getFamilyEmoji(item.item_department || item.category || "")}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-base leading-snug">
            {item.item_commercial_name || item.item_name}
          </p>
          {description && (
            <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{description}</p>
          )}
          <p className="text-emerald-600 font-extrabold text-lg mt-1 tracking-tight">⭐ ⭐ ⭐ {formatPrice(unitPrice)}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-full text-slate-600 bg-slate-100 hover:bg-slate-200 transition ml-1 flex-shrink-0"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Modifier groups */}
      {groups.length > 0 && (
        <div className="px-4 pb-3 space-y-4 border-t border-gray-100 pt-3">
          {groups.map((group) => (
            <div key={group.id} className="space-y-2">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <span>{getGroupIcon(group.name)}</span>
                {group.name}
              </div>
              <div className="flex flex-wrap gap-2">
                {group.options.map((opt) => {
                  const active = selectedOptions[group.id]?.id === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelect(group, opt)}
                      className={`px-4 py-1.5 rounded-full text-sm font-semibold border-2 transition ${
                        active
                          ? "border-slate-900 bg-slate-900 text-white shadow"
                          : "border-gray-200 bg-white text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      {opt.label}
                      {opt.priceDelta ? (
                        <span className={`ml-1 text-xs ${active ? "text-white/80" : "text-slate-400"}`}>
                          +{formatPrice(opt.priceDelta)}
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Qty + Add to Cart */}
      <div className="flex items-center gap-3 px-4 pb-4 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600">Qty</span>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={qty}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10)
              if (Number.isFinite(n)) setQty(Math.max(1, n))
            }}
            onBlur={() => setQty((q) => Math.max(1, Math.floor(q || 1)))}
            className="h-10 w-24 rounded-xl"
            aria-label="Quantity"
          />
        </div>
        <button
          type="button"
          className="flex-1 flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl py-3 text-base transition shadow-lg"
          onClick={() => { onAdd(item, qty, selectedOptions); onClose() }}
        >
          <ShoppingCart className="w-5 h-5" />
          {t("addToCart")} · {formatPrice(unitPrice * qty)}
        </button>
      </div>
    </div>
  )
}

// ─── Item card (horizontal row) ───────────────────────────────────────────────
function ItemCard({
  item,
  isExpanded,
  onToggle,
  itemQty,
  onQuickSetQty,
}: {
  item: KioskMenuItem
  isExpanded: boolean
  onToggle: () => void
  itemQty: number
  onQuickSetQty: (qty: number) => void
}) {
  const price = generalSellingPrice(Number(item.selling_price || 0), item.item_emballage)
  // Show multilingual description if different from name
  const description = item.item_name && item.item_name !== item.item_commercial_name
    ? item.item_name
    : null

  return (
    <div
      className={`w-full text-left bg-white rounded-2xl border-2 transition overflow-hidden flex flex-row items-center gap-3 p-3 pr-4 shadow-sm hover:shadow-md ${
        isExpanded
          ? "border-slate-700 shadow-md"
          : "border-transparent hover:border-slate-200"
      }`}
    >
      {/* Image */}
      <div className="relative h-20 w-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
        {item.image_url ? (
           
          <img
            src={item.image_url}
            alt={item.item_commercial_name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-3xl text-gray-300">
            {getFamilyEmoji(item.item_department || item.category || "")}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm line-clamp-2 leading-snug">
          {item.item_commercial_name || item.item_name}
        </p>
        {description && (
          <p className="text-[11px] text-gray-400 line-clamp-1 mt-0.5">{description}</p>
        )}
        <p className="text-emerald-600 font-extrabold text-sm mt-1 tracking-tight">⭐ ⭐ ⭐ {formatPrice(price)}</p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] font-semibold text-slate-500">Qty</span>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={itemQty}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10)
              if (!Number.isFinite(n)) return
              onQuickSetQty(Math.max(0, n))
            }}
            className="h-9 w-20"
            aria-label="Quantity"
          />
        </div>

        <button
          type="button"
          onClick={onToggle}
          className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition ${
            isExpanded
              ? "bg-slate-900 border-slate-900 text-white"
              : "border-gray-300 text-gray-500 hover:border-slate-400 hover:text-slate-600"
          }`}
          aria-label="Customize"
        >
          <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
        </button>
      </div>
    </div>
  )
}

// ─── Cart Sidebar ─────────────────────────────────────────────────────────────
function CartSidebar({
  open,
  onClose,
  cartHref,
  t,
}: {
  open: boolean
  onClose: () => void
  cartHref: string
  t: (key: keyof (typeof MENU_I18N)["en"]) => string
}) {
  const router = useRouter()
  const { items, remove, setQty } = useCartStore()
  const total = items.reduce((s, i) => s + i.price * (i.qty ?? 0), 0)

  return (
    <div className={`fixed inset-0 z-50 flex ${open ? "" : "pointer-events-none"}`}>
      <div
        className={`flex-1 bg-black/40 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <div
        className={`w-full max-w-sm bg-white shadow-2xl flex flex-col transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2 font-bold text-lg text-gray-900">
            <ShoppingCart className="w-5 h-5 text-slate-700" />
            {t("yourOrder")}
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-full hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
          {items.length === 0 && (
            <p className="text-center text-gray-400 mt-8 text-sm">
              {t("cartEmpty")}
            </p>
          )}
          {items.map((ci) => (
            <div key={`${ci.id}-${ci.selectedUnit}`} className="flex items-start gap-3">
              {ci.image ? (
                 
                <img src={ci.image} alt={ci.name} className="h-14 w-14 rounded-xl object-cover flex-shrink-0" />
              ) : (
                <div className="h-14 w-14 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 text-xl">🍽️</div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-900 line-clamp-2">{ci.name}</p>
                <p className="text-emerald-600 font-extrabold text-sm mt-0.5 tracking-tight">⭐ ⭐ ⭐ {formatPrice(ci.price)}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    value={ci.qty}
                    onChange={(e) => {
                      const n = Number.parseInt(e.target.value, 10)
                      if (Number.isFinite(n)) setQty(ci.id, ci.selectedUnit, Math.max(1, n))
                    }}
                    className="h-8 w-20"
                    aria-label="Quantity"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => remove(ci.id, ci.selectedUnit)}
                className="p-1 text-gray-400 hover:text-slate-600 transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {items.length > 0 && (
          <div className="px-5 py-4 border-t space-y-3">
            <div className="flex items-center justify-between font-bold text-gray-900">
              <span>Total</span>
              <span className="text-emerald-600 font-extrabold tracking-tight">⭐ ⭐ ⭐ {formatPrice(total)}</span>
            </div>
            <button
              type="button"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl py-3 transition shadow"
              onClick={() => { onClose(); router.push(cartHref) }}
            >
              {t("placeOrder")}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Items grid with row-level inline expand ──────────────────────────────────
const COLS = 3

function ItemsGrid({
  items,
  onAdd,
  getItemQty,
  onQuickSetQty,
  t,
}: {
  items: KioskMenuItem[]
  onAdd: (item: KioskMenuItem, qty: number, selected: Record<string, KioskModifierOption>) => void
  getItemQty: (item: KioskMenuItem) => number
  onQuickSetQty: (item: KioskMenuItem, qty: number) => void
  t: (key: keyof (typeof MENU_I18N)["en"]) => string
}) {
  const [expandedCode, setExpandedCode] = useState<string | null>(null)

  const rows: KioskMenuItem[][] = []
  for (let i = 0; i < items.length; i += COLS) rows.push(items.slice(i, i + COLS))

  const expandedRowIndex = expandedCode
    ? Math.floor(items.findIndex((i) => i.item_code === expandedCode) / COLS)
    : -1

  const expandedItem = expandedCode
    ? items.find((i) => i.item_code === expandedCode) ?? null
    : null

  if (items.length === 0) {
    return <p className="text-center text-gray-400 mt-20 text-sm">{t("noItems")}</p>
  }

  return (
    <div className="space-y-0">
      {rows.map((row, rowIdx) => (
        <div key={rowIdx}>
          <div
            className="grid gap-3 py-1.5"
            style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0,1fr))` }}
          >
            {row.map((item) => (
              <ItemCard
                key={item.item_code}
                item={item}
                isExpanded={expandedCode === item.item_code}
                onToggle={() => setExpandedCode((prev) => prev === item.item_code ? null : item.item_code)}
                itemQty={getItemQty(item)}
                onQuickSetQty={(qty) => onQuickSetQty(item, qty)}
              />
            ))}
            {Array.from({ length: COLS - row.length }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
          </div>

          {/* Full-width expand panel below this row */}
          {expandedRowIndex === rowIdx && expandedItem && (
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0,1fr))` }}
            >
              <ItemExpandPanel
                item={expandedItem}
                onClose={() => setExpandedCode(null)}
                onAdd={onAdd}
                t={t}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Scrollable tab bar with arrows ──────────────────────────────────────────
function TabBar({
  tabs,
  activeTab,
  onSelect,
}: {
  tabs: string[]
  activeTab: string
  onSelect: (tab: string) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  function scroll(dir: "left" | "right") {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" })
    }
  }

  return (
    <div className="flex items-center bg-white border-b border-gray-100">
      {/* Left arrow */}
      <button
        type="button"
        onClick={() => scroll("left")}
        className="flex-shrink-0 px-1 py-2 text-gray-400 hover:text-gray-700 transition"
        aria-label="Scroll left"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Scrollable tab list */}
      <div
        ref={scrollRef}
        className="flex overflow-x-auto scrollbar-hide flex-1 px-1"
        style={{ scrollBehavior: "smooth" }}
      >
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onSelect(tab)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition border-b-2 whitespace-nowrap ${
              activeTab === tab
                ? "border-slate-700 text-slate-700"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {tab !== "All" && (
              <span className="text-base leading-none">
                {getFamilyEmoji(tab)}
              </span>
            )}
            {tab}
          </button>
        ))}
      </div>

    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export function KioskMenuGrid({
  items: initialItems,
  category,
  venueName,
  venueLogoUrl,
  shopNickname,
}: Props) {
  const router = useRouter()
  const { addItem, items: cartItems, remove, setQty } = useCartStore()

  const [items, setItems] = useState<KioskMenuItem[]>(initialItems)
  const [activeTab, setActiveTab] = useState("All")
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [lang, setLang] = useState<MenuLang>("en")
  const [darkMode, setDarkMode] = useState(false)
  const PAGE_SIZE = 30

  const cartCount = cartItems.reduce((s, i) => s + (i.qty ?? 0), 0)
  const t = (key: keyof (typeof MENU_I18N)["en"]) => MENU_I18N[lang][key]

  /** Shop share links (?nickname=…&kioskCategory=BAR|RESTRO): show full catalog + All / Other / Drinks / Food */
  const useUnifiedShopTabs =
    Boolean(shopNickname) && (category === "BAR" || category === "RESTRO")

  // "RESTRO" is kept in the type but displayed as "Kitchen"
  const categoryLabel = useUnifiedShopTabs
    ? "Full menu — drinks & food"
    : category === "BAR"
      ? "🍺 Drinks menu"
      : category === "RESTRO"
        ? "🍽 Kitchen menu"
        : "Tap an item to customise"

  const venue =
    venueName ||
    (category === "BAR" ? "Bar" : category === "RESTRO" ? "Restaurant" : "Menu")

  const cartHref = useMemo(() => {
    const sp = new URLSearchParams()
    sp.set("kioskCategory", category)
    if (shopNickname) sp.set("nickname", shopNickname)
    return `/self-order/cart?${sp.toString()}`
  }, [category, shopNickname])

  useEffect(() => {
    setItems(initialItems)
    setPage(1)
  }, [initialItems])

  // Apply BAR / Kitchen filter for category-only kiosk API; shop nickname links show full stock
  const categoryFilteredItems = useMemo(() => {
    if (category !== "BAR" && category !== "RESTRO") return items
    if (useUnifiedShopTabs) return items
    return items.filter((item) => {
      const fam = (item.item_department || item.category || "").toLowerCase().trim()
      const itemName = item.item_commercial_name || item.item_name || ""
      return matchesKioskCategory(fam, category, itemName)
    })
  }, [items, category, useUnifiedShopTabs])

  const itemKindByCode = useMemo(() => {
    const m = new Map<string, "drink" | "food" | "other">()
    if (!useUnifiedShopTabs) return m
    for (const i of categoryFilteredItems) {
      m.set(i.item_code, classifyItemKind(i))
    }
    return m
  }, [categoryFilteredItems, useUnifiedShopTabs])

  // Build tabs: fixed All / Other / Drinks / Food for shop links; else dynamic famille tabs
  const tabs = useMemo(() => {
    if (useUnifiedShopTabs) return UNIFIED_SHOP_MENU_TAB_LIST
    const seen = new Set<string>()
    const list: string[] = ["All"]
    for (const item of categoryFilteredItems) {
      const t = getItemTab(item)
      if (!seen.has(t)) {
        seen.add(t)
        list.push(t)
      }
    }
    return list
  }, [categoryFilteredItems, useUnifiedShopTabs])

  useEffect(() => {
    if (!tabs.includes(activeTab)) setActiveTab("All")
  }, [tabs, activeTab])

  // Tab + query filter:
  // In shopNickname mode the backend already filtered by keyword — applying local
  // .includes() would eliminate results returned in other languages (e.g. 'byeri' → 'Primus 500ml').
  // So in shopNickname mode we ONLY apply the tab filter, NOT local text matching.
  const visible = useMemo(() => {
    let base: KioskMenuItem[]
    if (useUnifiedShopTabs) {
      if (activeTab === "All") base = categoryFilteredItems
      else if (activeTab === "Drinks") {
        base = categoryFilteredItems.filter((i) => itemKindByCode.get(i.item_code) === "drink")
      } else if (activeTab === "Food") {
        base = categoryFilteredItems.filter((i) => itemKindByCode.get(i.item_code) === "food")
      } else if (activeTab === "Other") {
        base = categoryFilteredItems.filter((i) => itemKindByCode.get(i.item_code) === "other")
      } else {
        base = categoryFilteredItems
      }
    } else {
      base =
        activeTab === "All"
          ? categoryFilteredItems
          : categoryFilteredItems.filter((i) => getItemTab(i) === activeTab)
    }
    // Server already did the keyword filter in shopNickname mode — don't re-filter locally
    if (shopNickname) return base
    if (!query.trim()) return base
    const q = query.trim().toLowerCase()
    return base.filter(
      (i) =>
        (i.item_commercial_name || "").toLowerCase().includes(q) ||
        (i.item_name || "").toLowerCase().includes(q) ||
        (i.keywords || "").toLowerCase().includes(q),
    )
  }, [categoryFilteredItems, activeTab, query, shopNickname, useUnifiedShopTabs, itemKindByCode])

  const totalItems = visible.length
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE))
  const currentPage = Math.min(Math.max(1, page), totalPages)
  const startIndex = (currentPage - 1) * PAGE_SIZE
  const pageItems = visible.slice(startIndex, startIndex + PAGE_SIZE)

  // Debounced backend search
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (shopNickname) {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(async () => {
        try {
          setLoading(true)
          const params = new URLSearchParams({ nickname: shopNickname })
          const trimmed = query.trim()
          if (trimmed) params.set("productSearch", trimmed)
          const res = await fetch(`/api/shop-with-me?${params.toString()}`, { cache: "no-store" })
          const data = await res.json().catch(() => ({}))
          if (!res.ok || !data.ok || !Array.isArray(data.sellers) || !data.sellers.length) {
            setItems([]); return
          }
          const seller = data.sellers[0]
          const products: any[] = Array.isArray(seller.products) ? seller.products : []
          setItems(products.map((p) => ({
            item_code: String(p.ITEM_CODE ?? p.item_code ?? p.item_key_words ?? ""),
            item_commercial_name: String(p.item_commercial_name ?? p.ITEM_NAME ?? p.item_name ?? "Product"),
            item_name: p.item_name ?? p.ITEM_NAME,
            selling_price: Number(p.selling_price ?? p.price ?? p.SALE_PRICE_INCLUSIVE ?? 0),
            item_emballage: p.item_emballage ?? p.ITEM_EMBALLAGE,
            unit: String(p.unit ?? p.UNIT ?? "pcs"),
            image_url: p.image_url ?? p.item_image_url ?? p.image,
            supplier_account: String(seller.ISHYIGA_ACCOUNT ?? seller.seller_account ?? ""),
            supplier_name: String(seller.OWNER ?? seller.SELLER_NAMES ?? seller.NICKNAME ?? ""),
            supplier_location: seller.LOCATION,
            search_priority: undefined,
            contains_ingredient: undefined,
            category: String(p.famille ?? p.FAMILLE ?? ""),
            sector: undefined,
            item_department: String(p.famille ?? p.FAMILLE ?? ""),
            keywords: p.item_key_words,
          })))
        } finally { setLoading(false) }
      }, 250)
      return () => { if (timerRef.current) clearTimeout(timerRef.current) }
    }

    // For the regular kiosk menu, search against the menu that is already loaded.
    // This is more reliable than replacing the menu with backend search results.
    if (timerRef.current) clearTimeout(timerRef.current)
    setItems(initialItems)
    setLoading(false)
    return
  }, [query, category, shopNickname, initialItems])

  function handleAdd(item: KioskMenuItem, qty: number, _selected: Record<string, KioskModifierOption> = {}) {
    const base = Number(item.selling_price || 0)
    const linePrice = generalSellingPrice(base, item.item_emballage)
    const itemEmballage = normalizeItemEmballageForCart(item.item_emballage)
    addItem(
      {
        id: item.item_code,
        itemCode: item.item_code,
        name: item.item_commercial_name || item.item_name || item.item_code,
        price: linePrice,
        unit: item.unit || "",
        image: item.image_url,
        supplierId: item.supplier_account,
        supplierName: item.supplier_name,
        supplierLocation: item.supplier_location,
        momo: item.momo,
        sellerPhone: item.sellerPhone,
        isBarResto: true,
        ...(itemEmballage ? { itemEmballage } : {}),
      },
      qty,
    )
  }

  function matchesQuickTarget(ci: { itemCode?: string; id: string; supplierId: string; name: string; price: number }, item: KioskMenuItem): boolean {
    const targetCode = String(item.item_code || "").trim()
    const cartCode = String(ci.itemCode ?? ci.id).trim()
    const sameSupplier = String(ci.supplierId || "").trim() === String(item.supplier_account || "").trim()
    if (!sameSupplier) return false

    // Use strict code match when a real item code exists.
    if (targetCode) return cartCode === targetCode

    // Fallback for items with missing code: match by name + price + supplier.
    const targetName = String(item.item_commercial_name || item.item_name || "").trim().toLowerCase()
    const cartName = String(ci.name || "").trim().toLowerCase()
    const targetPrice = generalSellingPrice(Number(item.selling_price || 0), item.item_emballage)
    return cartName === targetName && Number(ci.price || 0) === Number(targetPrice || 0)
  }

  function getItemQty(item: KioskMenuItem): number {
    return cartItems
      .filter((ci) => matchesQuickTarget(ci, item))
      .reduce((sum, ci) => sum + (ci.qty ?? 0), 0)
  }

  function quickInc(item: KioskMenuItem) {
    const target = cartItems.find((ci) => matchesQuickTarget(ci, item))
    if (!target) return
    setQty(target.id, target.selectedUnit, (target.qty ?? 0) + 1)
  }

  function quickDec(item: KioskMenuItem) {
    const target = cartItems.find((ci) => matchesQuickTarget(ci, item))
    if (!target) return
    if ((target.qty ?? 0) <= 1) {
      remove(target.id, target.selectedUnit)
      return
    }
    setQty(target.id, target.selectedUnit, (target.qty ?? 0) - 1)
  }

  function quickSetQty(item: KioskMenuItem, qty: number) {
    const target = cartItems.find((ci) => matchesQuickTarget(ci, item))
    if (!target) {
      if (qty <= 0) return
      handleAdd(item, qty, {})
      return
    }
    if (qty <= 0) {
      remove(target.id, target.selectedUnit)
      return
    }
    setQty(target.id, target.selectedUnit, qty)
  }

  return (
    <div className={`min-h-screen flex flex-col ${darkMode ? "bg-slate-900 text-slate-100" : "bg-gray-50"}`}>
      {/* HEADER */}
      <header className="sticky top-0 z-30 bg-slate-900 shadow-md">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="p-1 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 text-lg">
              {venueLogoUrl ? (
                 
                <img src={venueLogoUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : useUnifiedShopTabs ? (
                <span className="text-sm leading-none">🍽🍺</span>
              ) : category === "BAR" ? (
                "🍺"
              ) : (
                "🍽"
              )}
            </div>
            <div className="min-w-0">
              <p className="text-white font-bold text-sm truncate">{venue}</p>
              <p className="text-white/70 text-xs">{categoryLabel}</p>
            </div>
          </div>

          {/* Search desktop */}
          <div className="flex-1 max-w-xs relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1) }}
              placeholder={t("search")}
              className="w-full pl-9 pr-3 py-2 rounded-full bg-white text-sm text-gray-900 placeholder-gray-400 outline-none"
            />
          </div>

          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as MenuLang)}
            className="hidden sm:block rounded-full px-2 py-1.5 text-xs font-semibold text-gray-800"
            aria-label="Language selector"
          >
            <option value="en">EN</option>
            <option value="fr">FR</option>
            <option value="rw">RW</option>
          </select>

          <button
            type="button"
            onClick={() => setDarkMode((d) => !d)}
            className="hidden sm:flex items-center justify-center w-9 h-9 rounded-full bg-white text-slate-700 hover:bg-gray-100 transition"
            aria-label="Toggle dark mode"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Cart */}
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="relative flex items-center gap-2 bg-white rounded-full px-3 py-1.5 text-slate-700 font-bold text-sm hover:bg-gray-50 transition shadow"
          >
            <ShoppingCart className="w-4 h-4" />
            <span className="hidden sm:inline">{t("cart")}</span>
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-yellow-400 text-gray-900 text-[11px] font-bold flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        </div>

        {/* Search mobile */}
        <div className="px-4 pb-3 sm:hidden space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1) }}
              placeholder={t("search")}
              className="w-full pl-9 pr-3 py-2 rounded-full bg-white text-sm text-gray-900 placeholder-gray-400 outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as MenuLang)}
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-gray-800"
              aria-label="Language selector"
            >
              <option value="en">EN</option>
              <option value="fr">FR</option>
              <option value="rw">RW</option>
            </select>
            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              className="flex items-center justify-center w-9 h-9 rounded-full bg-white text-slate-700 hover:bg-gray-100 transition"
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Tab bar with arrows */}
        <TabBar
          tabs={tabs}
          activeTab={activeTab}
          onSelect={(tab) => { setActiveTab(tab); setPage(1) }}
        />
      </header>

      {/* ITEMS */}
      <main className="flex-1 px-4 py-4 max-w-5xl mx-auto w-full">
        {/* Kitchen/Bar banner */}
        {shopNickname && (category === "BAR" || category === "RESTRO") && (
          <div
            className={`rounded-xl px-4 py-2 mb-4 text-sm font-semibold flex items-center gap-2 ${
              useUnifiedShopTabs
                ? "bg-slate-50 text-slate-800 border border-slate-200"
                : category === "BAR"
                  ? "bg-amber-50 text-amber-800 border border-amber-200"
                  : "bg-green-50 text-green-800 border border-green-200"
            }`}
          >
            {useUnifiedShopTabs
              ? "🍽🍺 Full menu — use Drinks / Food to filter. Drinks → Bar, meals → Kitchen."
              : category === "BAR"
                ? "🍺 Drinks menu — orders go to Bar"
                : "🍽 Food menu — orders go to Kitchen"}
          </div>
        )}

        {loading && (
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0,1fr))` }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-gray-200 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && (
          <ItemsGrid
            items={pageItems}
            onAdd={handleAdd}
            getItemQty={getItemQty}
            onQuickSetQty={quickSetQty}
            t={t}
          />
        )}

        {!loading && totalItems > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-3 mt-6 border-t border-gray-200 pt-4">
            <span className="text-xs text-gray-500">
              {startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, totalItems)} {t("of")} {totalItems}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="px-4 py-1.5 rounded-full border border-gray-300 text-sm text-gray-700 disabled:opacity-40 bg-white hover:bg-gray-50"
              >
                {t("previous")}
              </button>
              <span className="text-sm text-gray-600">{currentPage} / {totalPages}</span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="px-4 py-1.5 rounded-full border border-gray-300 text-sm text-gray-700 disabled:opacity-40 bg-white hover:bg-gray-50"
              >
                {t("next")}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* CART SIDEBAR */}
      <CartSidebar open={cartOpen} onClose={() => setCartOpen(false)} cartHref={cartHref} t={t} />
    </div>
  )
}
