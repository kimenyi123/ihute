"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Store,
  Loader2,
  MapPin,
  Mail,
  Heart,
  ShoppingCart,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  User,
  LayoutGrid,
  SlidersHorizontal,
  Star,
  Carrot,
  Flame,
  Egg,
  Wine,
  Beer,
  Coffee,
  GlassWater,
  Sparkles,
  Pill,
  Baby,
  Leaf,
  HeartPulse,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { type ErxPrescription, serializeErxForNotes } from "@/lib/erx-prescription";
import { ErxPrescriptionDialog } from "@/components/erx-prescription-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { useCartStore } from "@/lib/cart-store";
import { useFavoritesStore } from "@/lib/favorites-store";
import { useTableCommandStore, getOrCreateGuestEmail } from "@/lib/table-command-store";
import { useAuthStore } from "@/lib/auth-store";
import { trackProductView, trackClick } from "@/lib/interaction-tracker";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { getProductImageUrl, getProductImageSrc, normalizeImageUrl } from "@/lib/image-utils";
import { LocationBadge } from "@/components/location-badge";

/** Optional fields for production: plug in from DB when available. */
type ShopWithMeProductMeta = {
  category?: string;
  isAlcohol?: boolean;
  salesLast6Hours?: number;
  salesToday?: number;
  totalSold?: number;
  discountPercent?: number;
  originalPrice?: number;
  favoriteScore?: number;
  stockQty?: number;
};

type ShopWithMeProduct = {
  item_name?: string;
  item_commercial_name?: string;
  /** item_packet = quantity (available stock), not unit */
  item_packet?: string | number;
  item_emballage?: string;
  selling_price?: number | string;
  cost_price?: number | string;
  /** Currency from account_signup for this supplier. */
  item_key_words?: string;
  item_state?: string;
  price?: string;
  stock?: number;
  in_stock?: boolean;
  expiry_days?: number;
  /** Product image URL (from Redis image_url / item_image_url). */
  image?: string;
  image_url?: string;
  item_image_url?: string;
  source?: string;
  OWNER?: string;
  momo?: string;
  currency?: string;
  /** Category/family from API (e.g. BREAKFAST, COLD STARTERS). Preserved when flattening. */
  famille?: string;
  item_key_words_french?: string;
  item_key_words_kinyarwanda?: string;
} & Partial<ShopWithMeProductMeta>;

type ShopWithMeSeller = {
  ISHYIGA_ACCOUNT?: string;
  NICKNAME?: string;
  SELLER_NAMES?: string;
  EMAIL?: string;
  PHONE_NUMBER?: string;
  LOCATION?: string;
  PREFERRED_CATEGORIES?: string;
  DEPARTMENT?: string;
  OWNER?: string;
  /** Currency from account_signup (e.g. RWF). */
  currency?: string;
  products?: ShopWithMeProduct[];
  product_count?: number;
  total_stock?: number;
  in_stock_products?: number;
  out_of_stock_products?: number;
  source?: string;
};

type ShopWithMeResponse = {
  ok: boolean;
  sellers: ShopWithMeSeller[];
  count: number;
  query: string;
  timestamp: number;
  searchTime: number;
};

type CategorySection = {
  name: string;
  products: ShopWithMeProduct[];
  expanded: boolean;
};

/** Alcohol category regex for filter. */
const ALCOHOL_REGEX = /wine|beer|spirits|cocktail|whiskey|whisky|vodka|rum|gin|cognac|lager|ale|sparkling/i;
/** Non-alcohol drinks (soda, juice, water, malt, zero-alcohol, energy drinks). */
const NON_ALCOHOL_REGEX = /soft drink|juice|smoothie|virgin|tea|coffee|water|beverage|malt|energy|zero|non-alcohol|hot coffee|iced coffee|hot tea/i;

/** Single source of truth for mood merchandising: section title, filter, sort, card meta. */
const MOOD_CONFIG: Record<
  string,
  {
    sectionLabel: string;
    filter: (p: ShopWithMeProduct) => boolean;
    sort?: (a: ShopWithMeProduct, b: ShopWithMeProduct) => number;
    /** When set, used instead of sort() to build ordered list (e.g. surprise mix). */
    sortProducts?: (products: ShopWithMeProduct[]) => ShopWithMeProduct[];
    metaType: MoodMetaType;
  }
> = {
  "white-wine": {
    sectionLabel: "Alcohol",
    filter: (p) => getProductMeta(p).isAlcohol,
    metaType: "alcohol",
  },
  whisky: {
    sectionLabel: "Non-Alcohol",
    filter: (p) => {
      const meta = getProductMeta(p);
      const cat = meta.category + String((p as Record<string, unknown>).item_commercial_name ?? "");
      return !meta.isAlcohol && NON_ALCOHOL_REGEX.test(cat);
    },
    metaType: "nonAlcohol",
  },
  beer: {
    sectionLabel: "Trending Now",
    filter: (p) => ALCOHOL_REGEX.test(getProductMeta(p).category) || /beer|lager|ale/i.test(String((p as Record<string, unknown>).item_commercial_name ?? "")),
    sort: (a, b) => getProductMeta(b).trendScore - getProductMeta(a).trendScore,
    metaType: "trending",
  },
  cocktails: {
    sectionLabel: "Discounted",
    filter: (p) => {
      const meta = getProductMeta(p);
      if (meta.discountPercent > 0) return true;
      return /cocktail|shot cocktail|coffee cocktail/i.test(meta.category) || /cocktail/i.test(String((p as Record<string, unknown>).item_commercial_name ?? ""));
    },
    sort: (a, b) => getProductMeta(b).discountPercent - getProductMeta(a).discountPercent,
    metaType: "discounted",
  },
  coffee: {
    sectionLabel: "Favorites",
    filter: (p) => /coffee|hot coffee|iced coffee|tea/i.test(getProductMeta(p).category) || /coffee|tea/i.test(String((p as Record<string, unknown>).item_commercial_name ?? "")),
    sort: (a, b) => (getProductMeta(b).favoriteScore ?? 0) - (getProductMeta(a).favoriteScore ?? 0),
    metaType: "favorites",
  },
  "no-alcohol": {
    sectionLabel: "Surprise me :)",
    filter: (p) => NON_ALCOHOL_REGEX.test(getProductMeta(p).category) || getProductMeta(p).inStock,
    sortProducts: (products) => buildSurpriseMix(products),
    metaType: "surprise",
  },
};

/** User choices from Surprise me :) popup. Used to filter/surface products. */
export type SurprisePreferences = {
  males: number;
  females: number;
  kids: number;
  hungry: boolean;
  onDiet: boolean;
  cold: boolean;
  thirsty: boolean;
  wantAlcohol: boolean;
};

/** Filter products for Surprise section based on table + mood. */
function filterSurpriseByPreferences(
  products: ShopWithMeProduct[],
  prefs: SurprisePreferences
): ShopWithMeProduct[] {
  const { males, females, kids, hungry, onDiet, cold, thirsty, wantAlcohol } = prefs;
  const match = (p: ShopWithMeProduct, regex: RegExp) => {
    const meta = getProductMeta(p);
    const name = String((p as Record<string, unknown>).item_commercial_name ?? "").toLowerCase();
    return regex.test(meta.category) || regex.test(name);
  };

  if (kids > 0) {
    const milkRegex = /milk|milkshake|yogurt|biscuit|biscuits/i;
    const filtered = products.filter((p) => match(p, milkRegex));
    if (filtered.length > 0) return filtered;
  }
  if (males > 0 && females === 0 && kids === 0) {
    const maleRegex = /beer|bbq|barbecue|meat|lager|ale/i;
    const filtered = products.filter((p) => match(p, maleRegex));
    if (filtered.length > 0) return filtered;
  }
  if (females > 0 && males === 0 && kids === 0) {
    const femaleRegex = /wine|banana|ice cream|icecream/i;
    const filtered = products.filter((p) => match(p, femaleRegex));
    if (filtered.length > 0) return filtered;
  }
  if (wantAlcohol) {
    const filtered = products.filter((p) => match(p, ALCOHOL_REGEX));
    if (filtered.length > 0) return filtered;
  }
  const moodRegexes: RegExp[] = [];
  if (hungry) moodRegexes.push(/main course|burger|bbq|meat|rice|pasta|pizza|platter|food/i);
  if (onDiet) moodRegexes.push(/salad|vegetable|light|diet/i);
  if (cold) moodRegexes.push(/hot coffee|hot tea|tea|coffee|soup/i);
  if (thirsty) moodRegexes.push(/juice|drink|soda|water|beverage|soft drink|beer|wine|cocktail/i);
  if (moodRegexes.length > 0) {
    const filtered = products.filter((p) => moodRegexes.some((re) => match(p, re)));
    if (filtered.length > 0) return filtered;
  }
  return products;
}

/** Surprise mix: 40% best sellers, 20% discounted, 20% recent movers, 20% random. Fallback: shuffled in-stock. */
function buildSurpriseMix(products: ShopWithMeProduct[]): ShopWithMeProduct[] {
  const meta = products.map((p) => ({ p, meta: getProductMeta(p) }));
  const byFavorite = [...meta].sort((a, b) => (b.meta.favoriteScore ?? 0) - (a.meta.favoriteScore ?? 0));
  const discounted = meta.filter((m) => m.meta.discountPercent > 0);
  const byTrend = [...meta].sort((a, b) => b.meta.trendScore - a.meta.trendScore);
  const inStock = meta.filter((m) => m.meta.inStock);

  const take = (arr: { p: ShopWithMeProduct }[], n: number) => arr.slice(0, Math.max(0, n)).map((x) => x.p);
  const n = products.length;
  const n40 = Math.ceil(n * 0.4);
  const n20 = Math.ceil(n * 0.2);
  const used = new Set<ShopWithMeProduct>();
  const add = (list: ShopWithMeProduct[], source: ShopWithMeProduct[], count: number) => {
    let added = 0;
    for (const p of source) {
      if (added >= count || used.has(p)) continue;
      used.add(p);
      list.push(p);
      added++;
    }
  };
  const result: ShopWithMeProduct[] = [];
  add(result, byFavorite.map((x) => x.p), n40);
  add(result, discounted.map((x) => x.p), n20);
  add(result, byTrend.map((x) => x.p), n20);
  const rest = inStock.filter((m) => !used.has(m.p));
  const shuffled = [...rest].sort(() => Math.random() - 0.5);
  add(result, shuffled.map((x) => x.p), n20);
  const remaining = products.filter((p) => !used.has(p));
  return [...result, ...remaining];
}

/** Bar/restaurant "How I feel today" mood pills: display only. Merchandising logic in MOOD_CONFIG. */
const MOOD_OPTIONS = [
  { id: "meat", label: "I'm a meat lover", Icon: Flame, colorClass: "text-orange-600", categoryRegex: /main course|burger|barbecue|bbq|meat|platter|sizzling|rice|pasta|pizza/i },
  { id: "vg", label: "I'm a VG", Icon: Carrot, colorClass: "text-emerald-600", categoryRegex: /vegetable|salad|cold starter|dessert|beverage|juice|smoothie|soft drink|virgin|tea|coffee/i },
  { id: "white-meat", label: "I eat white meat", Icon: Egg, colorClass: "text-amber-600", categoryRegex: /chicken|fish|seafood|salad|cold starter|hot starter|main course|rice|pasta/i },
  { id: "white-wine", label: "Alcohol", Icon: Wine, colorClass: "text-lime-400", categoryRegex: ALCOHOL_REGEX },
  { id: "whisky", label: "Non-Alcohol", Icon: Sparkles, colorClass: "text-amber-700", categoryRegex: NON_ALCOHOL_REGEX },
  { id: "beer", label: "Trending Now", Icon: Beer, colorClass: "text-amber-500", categoryRegex: /beer|lager|ale/i },
  { id: "cocktails", label: "Discounted", Icon: Sparkles, colorClass: "text-pink-500", categoryRegex: /cocktail|shot cocktail|coffee cocktail/i },
  { id: "coffee", label: "Favorites", Icon: Coffee, colorClass: "text-amber-800", categoryRegex: /coffee|hot coffee|iced coffee|tea/i },
  { id: "no-alcohol", label: "Surprise me :)", Icon: GlassWater, colorClass: "text-sky-500", categoryRegex: NON_ALCOHOL_REGEX },
];

/** Pharmacy "How I feel today" mood pills: first five adapted for health/medical; last four shared (Trending, Discounted, Favorites, Surprise). */
const MOOD_OPTIONS_PHARMACY = [
  { id: "pain", label: "Pain relief", Icon: Pill, colorClass: "text-red-500", categoryRegex: /pain|paracetamol|analgesic|ibuprofen|headache|fever|dolor|douleur|aspirin/i },
  { id: "vitamins", label: "Vitamins & supplements", Icon: Leaf, colorClass: "text-emerald-600", categoryRegex: /vitamin|supplement|mineral|iron|calcium|multivitamin|omega|probiotic/i },
  { id: "skincare", label: "Skincare", Icon: Sparkles, colorClass: "text-pink-500", categoryRegex: /skin|cream|lotion|cosmetic|beauty|sunscreen|moisturizer|soin|visage/i },
  { id: "kids", label: "For kids", Icon: Baby, colorClass: "text-sky-500", categoryRegex: /child|kids|pediatric|baby|infant|syrup|enfant|pediatri/i },
  { id: "adults", label: "For adults", Icon: HeartPulse, colorClass: "text-amber-600", categoryRegex: /adult|medicine|pharma|general|tablet|capsule|medicament|comprime/i },
  { id: "beer", label: "Trending Now", Icon: Beer, colorClass: "text-amber-500", categoryRegex: /beer|lager|ale/i },
  { id: "cocktails", label: "Discounted", Icon: Sparkles, colorClass: "text-pink-500", categoryRegex: /cocktail|shot cocktail|coffee cocktail/i },
  { id: "coffee", label: "Favorites", Icon: Coffee, colorClass: "text-amber-800", categoryRegex: /coffee|hot coffee|iced coffee|tea/i },
  { id: "no-alcohol", label: "Surprise me :)", Icon: GlassWater, colorClass: "text-sky-500", categoryRegex: /./i },
];

function extractNumericPrice(value: unknown): number {
  if (typeof value === "number") return value;
  const n = String(value ?? "").replace(/[^\d.,]/g, "").replace(",", ".");
  const parsed = parseFloat(n);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Product metadata for mood filter/sort/meta. DB-ready: plug in real fields when available. */
function getProductMeta(p: ShopWithMeProduct) {
  const raw = p as Record<string, unknown>;
  const category = String(raw.category ?? raw.famille ?? raw.FAMILLE ?? "").trim();
  const sellingPrice = extractNumericPrice(raw.selling_price ?? raw.price ?? raw.UNITY_PRICE);
  const costPrice = extractNumericPrice(raw.cost_price);
  const originalPrice = typeof p.originalPrice === "number" ? p.originalPrice : costPrice > 0 ? costPrice : sellingPrice;
  const discountPercent =
    typeof p.discountPercent === "number"
      ? p.discountPercent
      : originalPrice > 0 && sellingPrice < originalPrice
        ? Math.round((1 - sellingPrice / originalPrice) * 100)
        : 0;
  const isAlcohol =
    typeof p.isAlcohol === "boolean"
      ? p.isAlcohol
      : /wine|beer|spirits|cocktail|whiskey|whisky|vodka|rum|gin|cognac|lager|ale|sparkling/i.test(category) ||
        /wine|beer|spirits|cocktail|whiskey|whisky|vodka|rum|gin|lager|ale/i.test(String(raw.item_commercial_name ?? ""));

  const salesLast6Hours = typeof p.salesLast6Hours === "number" ? p.salesLast6Hours : undefined;
  const salesToday = typeof p.salesToday === "number" ? p.salesToday : undefined;
  const totalSold = typeof p.totalSold === "number" ? p.totalSold : undefined;
  const favoriteScore = typeof p.favoriteScore === "number" ? p.favoriteScore : totalSold;

  /** MOCK: when DB has no sales data, use stable pseudo-score from item code for ordering. Replace with real salesLast6Hours/salesToday in production. */
  const getTrendScoreMock = (product: ShopWithMeProduct) => {
    const code = String((product as Record<string, unknown>).ITEM_CODE ?? (product as Record<string, unknown>).item_code ?? "").trim();
    let h = 0;
    for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0;
    return (h % 20) + 1;
  };
  const trendScore =
    salesLast6Hours !== undefined && salesToday !== undefined
      ? salesLast6Hours * 3 + salesToday
      : getTrendScoreMock(p);

  const stockQty = typeof p.stockQty === "number" ? p.stockQty : (p.stock ?? 0);

  return {
    category,
    isAlcohol,
    sellingPrice,
    originalPrice,
    discountPercent,
    salesLast6Hours,
    salesToday,
    totalSold,
    favoriteScore,
    trendScore,
    stockQty,
    inStock: stockQty > 0 || p.in_stock !== false,
  };
}

/** Mood meta types for card subtitle. */
type MoodMetaType = "alcohol" | "nonAlcohol" | "trending" | "discounted" | "favorites" | "surprise";

/** Placeholder for trending when no real sales data: stable per-product x and y (y < 12 hours). Replace with real sales in production. */
function getTrendingPlaceholder(p: ShopWithMeProduct): { x: number; y: number } {
  const seed = String(getItemCode(p) || (p as Record<string, unknown>).item_commercial_name || "").trim();
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const x = (h % 18) + 3;
  const y = (Math.floor(h / 31) % 11) + 1;
  return { x, y };
}

/** Returns text and optional discount info for card under product name. */
function getMoodMetaText(
  p: ShopWithMeProduct,
  metaType: MoodMetaType
): { text: string | null; wasPrice?: number; discountPercent?: number } {
  const meta = getProductMeta(p);
  switch (metaType) {
    case "alcohol":
    case "nonAlcohol":
      return { text: meta.category || null };
    case "trending": {
      const six = meta.salesLast6Hours;
      const today = meta.salesToday;
      if (six != null && six > 0) return { text: `${six} sold in last 6 hours` };
      if (today != null && today > 0) return { text: `${today} sold today` };
      const { x, y } = getTrendingPlaceholder(p);
      return { text: `${x} sold in the last ${y} hours` };
    }
    case "discounted":
      if (meta.discountPercent > 0) {
        const wasPrice =
          meta.originalPrice > meta.sellingPrice
            ? meta.originalPrice
            : Math.round(meta.sellingPrice / (1 - meta.discountPercent / 100));
        return {
          text: null,
          wasPrice: wasPrice > meta.sellingPrice ? wasPrice : undefined,
          discountPercent: meta.discountPercent,
        };
      }
      return { text: "Discounted" };
    case "favorites":
      return { text: meta.favoriteScore != null && meta.favoriteScore > 0 ? "Most popular" : "Top favorite" };
    case "surprise":
      return { text: "Surprise me :)" };
    default:
      return { text: null };
  }
}

/** Single item code from API. Prefer ITEM_CODE (backend catalog) so order creation finds the item; fallback to item_code then item_key_words. */
function getItemCode(product: ShopWithMeProduct): string {
  const p = product as Record<string, unknown>;
  return String(p.ITEM_CODE ?? p.item_code ?? p.item_key_words ?? "").trim() || "";
}

type SharedCartItem = {
  name: string;
  qty: number;
  price: number;
  code?: string;
};

/** Parse item1/item2... from URL. Accepts: name,qty,price or name;qty;price;code */
function parseSharedCartItems(searchParams: ReturnType<typeof useSearchParams>): SharedCartItem[] {
  const out: SharedCartItem[] = [];
  if (!searchParams) return out;
  const entries = Array.from(searchParams.entries())
    .filter(([k]) => /^item\d+$/i.test(k))
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  for (const [, raw] of entries) {
    const decoded = decodeURIComponent(String(raw || "").trim());
    if (!decoded) continue;
    const parts = decoded.split(/[;,]/).map((x) => x.trim()).filter(Boolean);
    if (parts.length < 3) continue;
    const [name, qtyRaw, priceRaw, codeRaw] = parts;
    const qty = Math.max(1, parseInt(qtyRaw, 10) || 1);
    const price = Math.max(0, parseFloat(String(priceRaw).replace(/[^\d.]/g, "")) || 0);
    if (!name) continue;
    out.push({
      name,
      qty,
      price,
      code: codeRaw && codeRaw.length ? codeRaw : undefined,
    });
  }
  return out;
}

/** API can return products as categories with nested items[]. Flatten to one product per item. item_packet = quantity (available stock). */
function normalizeSellersProducts(sellers: ShopWithMeSeller[]): ShopWithMeSeller[] {
  return sellers.map((seller) => {
    const rawProducts = seller.products ?? [];
    const flatProducts: ShopWithMeProduct[] = [];
    for (const p of rawProducts) {
      const items = (p as ShopWithMeProduct & { items?: ShopWithMeProduct[] }).items;
      if (Array.isArray(items) && items.length > 0) {
        for (const item of items) {
          const packet = item.item_packet;
          const stockNum = typeof packet === "number" ? packet : parseInt(String(packet ?? ""), 10);
          const stock = Number.isFinite(stockNum) ? stockNum : 0;
          const currency = (item as ShopWithMeProduct).currency || (seller as ShopWithMeSeller).currency;
          const fam = (p as Record<string, unknown>).famille ?? (p as Record<string, unknown>).FAMILLE ?? (item as Record<string, unknown>).famille ?? (item as Record<string, unknown>).FAMILLE;
          const rawImg =
            getProductImageUrl(item as Record<string, unknown>) ||
            getProductImageUrl(p as Record<string, unknown>);
          const img = rawImg ? (normalizeImageUrl(rawImg) ?? rawImg) : undefined;
        flatProducts.push({
            ...item,
            OWNER: item.OWNER ?? (p as ShopWithMeProduct).OWNER ?? seller.OWNER,
            stock,
            in_stock: stock > 0,
            currency: currency || undefined,
            famille: fam != null ? String(fam) : undefined,
            image: img ?? undefined,
          });
        }
      } else {
        const flatP = p as ShopWithMeProduct;
        const currency = flatP.currency || (seller as ShopWithMeSeller).currency;
        const fam = (p as Record<string, unknown>).famille ?? (p as Record<string, unknown>).FAMILLE ?? flatP.famille;
        const rawImg = getProductImageUrl(p as Record<string, unknown>);
        const img = rawImg ? (normalizeImageUrl(rawImg) ?? rawImg) : undefined;
        flatProducts.push({
          ...flatP,
          currency: currency || flatP.currency,
          famille: fam != null ? String(fam) : flatP.famille,
          image: img ?? flatP.image,
        });
      }
    }
    const in_stock_products = flatProducts.filter((pr) => pr.in_stock !== false && (pr.stock ?? 0) > 0).length;
    const total_stock = flatProducts.reduce((sum, pr) => sum + (Number(pr.stock) || 0), 0);
    return {
      ...seller,
      products: flatProducts,
      product_count: flatProducts.length,
      in_stock_products,
      out_of_stock_products: flatProducts.length - in_stock_products,
      total_stock,
    };
  });
}

function sellerIsRestaurantOrBar(seller: ShopWithMeSeller): boolean {
  const preferred = (seller.PREFERRED_CATEGORIES || "").toLowerCase();
  const department = (seller.DEPARTMENT || "").toLowerCase();
  const name = (seller.OWNER || seller.SELLER_NAMES || seller.NICKNAME || "").toLowerCase();
  const nick = String(seller.NICKNAME || "").toLowerCase();
  return (
    nick.includes("burrows") ||
    preferred.includes("bar") ||
    preferred.includes("restaurant") ||
    preferred.includes("resto") ||
    preferred.includes("pub") ||
    preferred.includes("cafe") ||
    department.includes("bar") ||
    department.includes("restaurant") ||
    department.includes("resto") ||
    department.includes("pub") ||
    department.includes("cafe") ||
    name.includes("restaurant") ||
    name.includes("resto") ||
    name.includes("pub") ||
    name.includes("cafe")
  );
}

function sellerIsPharmacy(seller: ShopWithMeSeller): boolean {
  const preferred = (seller.PREFERRED_CATEGORIES || "").toLowerCase();
  const department = (seller.DEPARTMENT || "").toLowerCase();
  const name = (seller.OWNER || seller.SELLER_NAMES || seller.NICKNAME || "").toLowerCase();
  return preferred.includes("pharmacy") || department.includes("pharmacy") || name.includes("phar");
}

// Function to categorize products based on keywords and item_state
function categorizeProduct(product: ShopWithMeProduct): string {
  const keywords = (product.item_key_words || "").toLowerCase();
  const itemState = (product.item_state || "").toLowerCase();
  const name = (product.item_commercial_name || product.item_name || "").toLowerCase();

  if (keywords.includes("wine") || itemState.includes("wine") || name.includes("wine")) {
    return "Wine";
  }

  if (
    keywords.includes("beer") ||
    itemState.includes("beer") ||
    name.includes("beer") ||
    keywords.includes("lager") ||
    name.includes("lager")
  ) {
    return "Beer";
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
    return "Spirits";
  }

  if (keywords.includes("bread") || keywords.includes("cake") || keywords.includes("bakery") || itemState.includes("bakery")) {
    return "Bakery";
  }

  if (keywords.includes("snack") || keywords.includes("chips") || keywords.includes("crisp")) {
    return "Snacks";
  }

  if (
    keywords.includes("juice") ||
    keywords.includes("soda") ||
    keywords.includes("water") ||
    keywords.includes("drink") ||
    itemState.includes("beverage")
  ) {
    return "Beverages";
  }

  if (keywords.includes("food") || keywords.includes("meal") || itemState.includes("food")) {
    return "Food";
  }

  return "Other";
}

export default function ShopWithMePage({ embedInMainLayout = false }: { embedInMainLayout?: boolean }) {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const nicknameFromPath = params?.nickname as string | undefined;
  const nicknameFromQuery = searchParams?.get("nickname") || "";
  const customerFromQuery = searchParams?.get("customer") || "";
  const addressFromQuery = searchParams?.get("address") || "";
  const tableFromQuery = searchParams?.get("table") || "";

  // When only nickname is set (no table/customer/address), treat as normal shop: add to cart and checkout as usual.
  const hasTableContext = !!(tableFromQuery.trim() || customerFromQuery.trim() || addressFromQuery.trim());

  const nicknameFromUrl = nicknameFromPath || nicknameFromQuery;

  const [nickname, setNickname] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [sellers, setSellers] = useState<ShopWithMeSeller[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSeller, setSelectedSeller] = useState<string | null>(null);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("featured");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [priceMin, setPriceMin] = useState<string>("");
  const [priceMax, setPriceMax] = useState<string>("");
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [moodPreference, setMoodPreference] = useState<string | null>(null);
  const [surpriseDialogOpen, setSurpriseDialogOpen] = useState(false);
  const [surprisePreferences, setSurprisePreferences] = useState<SurprisePreferences | null>(null);
  const [surpriseForm, setSurpriseForm] = useState<SurprisePreferences>({
    males: 0, females: 0, kids: 0, hungry: false, onDiet: false, cold: false, thirsty: false, wantAlcohol: false,
  });
  const [categories, setCategories] = useState<CategorySection[]>([]);
  const [itemsPerPage, setItemsPerPage] = useState(12);
  const [categoryPages, setCategoryPages] = useState<Record<string, number>>({});

  const cartItems = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const cartItemCount = cartItems.reduce((sum, item) => sum + item.qty, 0);
  const setTableInfo = useCartStore((s) => s.setTableInfo);
  const clearTableInfo = useCartStore((s) => s.clearTableInfo);
  const joinTableCommand = useTableCommandStore((s) => s.joinTableCommand);
  const { user, isAuthenticated } = useAuthStore();

  const [debouncedProductSearch, setDebouncedProductSearch] = useState("");
  const sharedItems = useMemo(() => parseSharedCartItems(searchParams), [searchParams]);
  const sharedAppliedRef = useRef<string>("");
  const currentSeller = selectedSeller ? sellers.find((s) => s.ISHYIGA_ACCOUNT === selectedSeller) : null;
  useEffect(() => {
    const t = setTimeout(() => setDebouncedProductSearch(productSearchQuery.trim()), 200);
    return () => clearTimeout(t);
  }, [productSearchQuery]);

  // Fetch from backend when nickname or product search changes — always send productSearch when user typed (backend keyword search)
  const prevNicknameRef = useRef<string>("");
  useEffect(() => {
    if (!nicknameFromUrl?.trim()) return;
    let cancelled = false;
    const normalizedNickname = nicknameFromUrl.trim().toLowerCase();
    const nicknameChanged = prevNicknameRef.current !== normalizedNickname;
    if (nicknameChanged) prevNicknameRef.current = normalizedNickname;
    if (nicknameChanged) setLoading(true);
    setError(null);
    const params = new URLSearchParams({ nickname: normalizedNickname });
    if (debouncedProductSearch) params.set("productSearch", debouncedProductSearch);
    const url = `/api/shop-with-me?${params.toString()}`;
    fetch(url, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch shop data`);
        return res.json();
      })
      .then((data: ShopWithMeResponse) => {
        if (cancelled) return;
        if (!data.ok) throw new Error("Shop not found");
        if (data.sellers && data.sellers.length > 0) {
          let next = normalizeSellersProducts(data.sellers);
          // Burrows: only Restaurant + Pharmacy use live data; pin Restaurant first for testing.
          if (normalizedNickname === "burrows") {
            next = next.filter((s) => sellerIsRestaurantOrBar(s) || sellerIsPharmacy(s));
            next = [...next].sort((a, b) => Number(sellerIsRestaurantOrBar(b)) - Number(sellerIsRestaurantOrBar(a)));
          }
          setSellers(next);
          setNickname(normalizedNickname);
          if (data.sellers.length === 1) setSelectedSeller(data.sellers[0].ISHYIGA_ACCOUNT || null);
        } else {
          setSellers([]);
          setError("No shops found with this nickname");
        }
      })
      .catch((err: any) => {
        if (!cancelled) {
          setError(err.message || "Failed to fetch shop");
          setSellers([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [nicknameFromUrl, debouncedProductSearch]);

  // Shared-cart deep link: /shop-with-me/{shop}?item1=name;qty;price;code...
  // Reuses existing NIKI code channel via getItemCode (ITEM_CODE -> item_code -> item_key_words).
  useEffect(() => {
    if (!currentSeller || sharedItems.length === 0) return;
    const signature = `${nicknameFromUrl || ""}|${searchParams?.toString() || ""}`;
    if (sharedAppliedRef.current === signature) return;
    sharedAppliedRef.current = signature;

    const preferredLocal = currentSeller?.PREFERRED_CATEGORIES?.toLowerCase() || "";
    const departmentLocal = currentSeller?.DEPARTMENT?.toLowerCase() || "";
    const nicknameLowerLocal = (nicknameFromUrl || selectedSeller || "").toString().toLowerCase().trim();
    const isBurrowsBarLocal = nicknameLowerLocal === "burrows";
    const isBarOrRestaurantLocal =
      isBurrowsBarLocal ||
      preferredLocal.includes("bar") ||
      preferredLocal.includes("restaurant") ||
      preferredLocal.includes("resto") ||
      preferredLocal.includes("pub") ||
      preferredLocal.includes("cafe") ||
      departmentLocal.includes("bar") ||
      departmentLocal.includes("restaurant") ||
      departmentLocal.includes("resto") ||
      departmentLocal.includes("pub") ||
      departmentLocal.includes("cafe");

    const list = currentSeller.products || [];
    for (const it of sharedItems) {
      const byCode = it.code
        ? list.find((p) => getItemCode(p).toLowerCase() === String(it.code).toLowerCase())
        : null;
      const byName = byCode
        ? byCode
        : list.find((p) => {
            const n = String((p as any).item_commercial_name ?? (p as any).item_name ?? "").trim().toLowerCase();
            const target = it.name.trim().toLowerCase();
            return n === target || n.includes(target) || target.includes(n);
          });
      const matched = byName || byCode || null;
      const itemCode = matched ? getItemCode(matched) : (it.code || it.name);
      const itemName = matched
        ? String((matched as any).item_commercial_name ?? (matched as any).item_name ?? it.name)
        : it.name;
      const img = matched ? (matched.image_url ?? matched.item_image_url ?? matched.image) : undefined;
      const unit = matched ? String((matched as any).item_packet ?? "pcs") : "pcs";
      const price = matched
        ? (extractNumericPrice((matched as any).selling_price ?? (matched as any).price) || it.price)
        : it.price;
      addItem(
        {
          id: itemCode,
          itemCode,
          name: itemName,
          price,
          unit,
          selectedUnit: unit,
          image: typeof img === "string" ? img : undefined,
          supplierId: currentSeller.ISHYIGA_ACCOUNT || "",
          supplierName: currentSeller.OWNER || currentSeller.SELLER_NAMES || currentSeller.NICKNAME || "Supplier",
          supplierLocation: currentSeller.LOCATION,
          momo: (currentSeller as any).momo,
          isBarResto: isBarOrRestaurantLocal,
        },
        it.qty
      );
    }
  }, [currentSeller, sharedItems, addItem, nicknameFromUrl, searchParams, selectedSeller]);

  // Pre-fill customer/address only from URL params (never use table name as buyer name)
  useEffect(() => {
    if (customerFromQuery?.trim()) setCustomerName(customerFromQuery.trim());
    if (addressFromQuery?.trim()) setCustomerAddress(addressFromQuery.trim());
    // Do NOT set customerName/customerAddress from tableFromQuery — table name is not the buyer
  }, [customerFromQuery, addressFromQuery]);

  async function searchShop(searchNickname: string) {
    if (!searchNickname.trim()) {
      setError("Please enter a shop nickname");
      return;
    }

    setLoading(true);
    setError(null);
    setSellers([]);
    setSelectedSeller(null);

    try {
      const normalizedNickname = searchNickname.trim().toLowerCase();
      // Go through Next.js API route to avoid CORS issues
      const response = await fetch(
        `/api/shop-with-me?nickname=${encodeURIComponent(normalizedNickname)}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch shop data`);
      }

      const data: ShopWithMeResponse = await response.json();

      if (!data.ok) {
        throw new Error("Shop not found");
      }

      if (data.sellers && data.sellers.length > 0) {
        let next = normalizeSellersProducts(data.sellers);
        if (normalizedNickname === "burrows") {
          next = next.filter((s) => sellerIsRestaurantOrBar(s) || sellerIsPharmacy(s));
          next = [...next].sort((a, b) => Number(sellerIsRestaurantOrBar(b)) - Number(sellerIsRestaurantOrBar(a)));
        }
        setSellers(next);
        setNickname(normalizedNickname);
        if (data.sellers.length === 1) {
          setSelectedSeller(data.sellers[0].ISHYIGA_ACCOUNT || null);
        }
      } else {
        setError("No shops found with this nickname");
      }
    } catch (err: any) {
      console.error("Shop search error:", err);
      setError(err.message || "Failed to search shop");
    } finally {
      setLoading(false);
    }
  }

  const handleCustomerSubmit = () => {
    if (!currentSeller) return;

    const name = customerName.trim();
    const address = customerAddress.trim();
    if (!name) return;

    // Encode "tableNumber" as "Name | Address" (works for delivery or table orders)
    const tableNumber = address ? `${name} | ${address}` : name;

    setTableInfo({
      tableNumber,
      customerName: name,
      customerAddress: address,
      shopName: currentSeller.OWNER || currentSeller.SELLER_NAMES || currentSeller.NICKNAME || "",
      shopId: currentSeller.ISHYIGA_ACCOUNT || "",
    });

    setShowCustomerDialog(false);

    // Update URL with nickname and customer info for deep links
    const base = nickname || nicknameFromUrl || currentSeller.NICKNAME || "";
    const safeNickname = encodeURIComponent(base.toString().toLowerCase());
    const params = new URLSearchParams();
    if (name) params.set("customer", name);
    if (address) params.set("address", address);

    router.push(`/shop-with-me/${safeNickname}${params.toString() ? `?${params.toString()}` : ""}`);
  };

  const preferred = currentSeller?.PREFERRED_CATEGORIES?.toLowerCase() || "";
  const department = currentSeller?.DEPARTMENT?.toLowerCase() || "";
  const nicknameLower = (nicknameFromUrl || selectedSeller || "").toString().toLowerCase().trim();
  const isBurrowsBar = nicknameLower === "burrows";
  const isBarOrRestaurant =
    isBurrowsBar ||
    preferred.includes("bar") ||
    preferred.includes("restaurant") ||
    preferred.includes("resto") ||
    preferred.includes("pub") ||
    preferred.includes("cafe") ||
    department.includes("bar") ||
    department.includes("restaurant") ||
    department.includes("resto") ||
    department.includes("pub") ||
    department.includes("cafe");

  const isPharmacy =
    preferred.includes("pharmacy") ||
    department.includes("pharmacy") ||
    (currentSeller?.OWNER || currentSeller?.SELLER_NAMES || "")
      .toLowerCase()
      .includes("phar");

  const moodOptions = isPharmacy ? MOOD_OPTIONS_PHARMACY : MOOD_OPTIONS;

  const isDeliveryShop = preferred
    ? ["shop", "store", "pharmacy", "grocery", "delivery"].some((cat) => preferred.includes(cat))
    : true; // Default to true for generic shops

  useEffect(() => {
    if (!currentSeller) return;

    // No table/customer/address in URL → normal shop; clear table info so cart/checkout behave normally.
    if (!tableFromQuery.trim() && !customerFromQuery.trim() && !addressFromQuery.trim()) {
      clearTableInfo();
      return;
    }

    let name = customerFromQuery.trim();
    let address = addressFromQuery.trim();
    const table = tableFromQuery.trim();

    // If explicit customer fields are missing, fall back to "table" param
    if (!name && table) name = table;
    if (!address && table) address = table;

    if (!name && !address) return;

    setCustomerName(name);
    setCustomerAddress(address);

    const tableNumber = address ? `${name} | ${address}` : name;

    setTableInfo({
      tableNumber,
      customerName: name,
      customerAddress: address || name,
      shopName: currentSeller.OWNER || currentSeller.SELLER_NAMES || currentSeller.NICKNAME || "",
      shopId: currentSeller.ISHYIGA_ACCOUNT || "",
    });
  }, [customerFromQuery, addressFromQuery, tableFromQuery, currentSeller, setTableInfo, clearTableInfo]);

  // Auto-join table when landing from supplier QR (e.g. ...?nickname=burrows&table=TEST ISHYIGA2)
  const joinedTableRef = useRef<string | null>(null);
  useEffect(() => {
    const tableName = tableFromQuery?.trim();
    if (!tableName) {
      joinedTableRef.current = null;
      return;
    }
    if (!currentSeller?.ISHYIGA_ACCOUNT) return;
    const key = `${tableName}|${currentSeller.ISHYIGA_ACCOUNT}`;
    if (joinedTableRef.current === key) return;
    joinedTableRef.current = key;
    const locationId = currentSeller.ISHYIGA_ACCOUNT;
    const locationName = currentSeller.OWNER || currentSeller.SELLER_NAMES || currentSeller.NICKNAME || "Shop";
    const userName = customerName?.trim() || tableName || "Guest";
    const userEmail = isAuthenticated && user?.email ? user.email : getOrCreateGuestEmail();
    joinTableCommand(tableName, locationId, locationName, userName, userEmail);
  }, [tableFromQuery, currentSeller, joinTableCommand, customerName, isAuthenticated, user?.email]);

  useEffect(() => {
    if (!currentSeller?.products) {
      setCategories([]);
      return;
    }

    const categoryMap = new Map<string, ShopWithMeProduct[]>();

    currentSeller.products.forEach((product) => {
      const price = extractNumericPrice(product.price || product.item_emballage)
        || extractNumericPrice((product as Record<string, unknown>).selling_price as string);
      if (price <= 0) return; // don't show 0-price items
      const fam = (product as Record<string, unknown>).famille ?? (product as Record<string, unknown>).FAMILLE;
      const category = (fam && String(fam).trim()) ? String(fam).trim() : categorizeProduct(product);
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category)!.push(product);
    });

    const categorySections: CategorySection[] = [];
    // Restaurant order: starters first, then mains/sides/desserts, drinks last
    const categoryOrder = [
      "Cold Starters", "Hot Starters", "Starters", "Breakfast",
      "Main Course", "Main Courses", "Burgers", "Pasta", "Pizzas", "Rice", "Wraps", "Platter", "Sizzling", "Barbecue", "Mother Style",
      "Accompaniments", "Vegetables", "Snacks",
      "Desserts", "Cream",
      "Soft Drinks", "Fresh Juice", "Smoothies", "Virgin Mojitos", "Beverages",
      "Hot Coffee", "Iced Coffee", "Hot Tea", "Coffee Cocktails",
      "Cocktails", "Shot Cocktails", "Beer", "Wine", "Sparkling Wine", "Vodka", "Whiskey", "Rum", "Gin", "Cognac", "Bitters",
      "Food", "Bakery", "Other",
    ];

    const orderedNames = Array.from(categoryMap.keys()).sort((a, b) => {
      const ai = categoryOrder.indexOf(a);
      const bi = categoryOrder.indexOf(b);
      if (ai >= 0 && bi >= 0) return ai - bi;
      if (ai >= 0) return -1;
      if (bi >= 0) return 1;
      return a.localeCompare(b);
    });

    orderedNames.forEach((categoryName, index) => {
      categorySections.push({
        name: categoryName,
        products: categoryMap.get(categoryName)!,
        expanded: index === 0, // Only first category expanded for faster initial load
      });
    });

    setCategories(categorySections);
    setCategoryPages({});
  }, [currentSeller]);

  const filtersActive = !!(
    productSearchQuery.trim() ||
    categoryFilter ||
    priceMin.trim() ||
    priceMax.trim() ||
    moodPreference
  );

  useEffect(() => {
    if (categories.length === 0) return;
    if (filtersActive) {
      setCategories((prev) => prev.map((c) => ({ ...c, expanded: true })));
    }
  }, [filtersActive, debouncedProductSearch]);

  const toggleCategory = (categoryName: string) => {
    setCategories((prev) => prev.map((cat) => (cat.name === categoryName ? { ...cat, expanded: !cat.expanded } : cat)));
  };

  const setCategoryPage = (categoryName: string, page: number) => {
    setCategoryPages((prev) => ({ ...prev, [categoryName]: page }));
  };

  // When we have a backend search (debouncedProductSearch), the API was called with productSearch — trust backend result (no client-side filter).
  // When no backend search, filter on client for instant feedback. Also apply price range when set.
  const getFilteredProducts = (products: ShopWithMeProduct[]) => {
    let list = products;

    if (!debouncedProductSearch.trim() && productSearchQuery.trim()) {
      const query = productSearchQuery.toLowerCase().trim();
      const terms = query.split(/\s+/).filter(Boolean);
      list = list.filter((product) => {
        const name = (product.item_commercial_name || product.item_name || "").toLowerCase();
        const keywords = (product.item_key_words || "").toLowerCase();
        const famille = String((product as Record<string, unknown>).famille ?? (product as Record<string, unknown>).FAMILLE ?? "").toLowerCase();
        const french = ((product as Record<string, unknown>).item_key_words_french as string || "").toLowerCase();
        const kinyarwanda = ((product as Record<string, unknown>).item_key_words_kinyarwanda as string || "").toLowerCase();
        const description = ((product as Record<string, unknown>).item_description as string || (product as Record<string, unknown>).description as string || "").toLowerCase();
        const itemKeywords = ((product as Record<string, unknown>).item_keywords as string || "").toLowerCase();
        const combined = `${name} ${keywords} ${famille} ${french} ${kinyarwanda} ${description} ${itemKeywords}`;
        return terms.every((term) => combined.includes(term));
      });
    }

    const minNum = priceMin.trim() ? parseInt(priceMin.trim(), 10) : NaN;
    const maxNum = priceMax.trim() ? parseInt(priceMax.trim(), 10) : NaN;
    if (!Number.isNaN(minNum) || !Number.isNaN(maxNum)) {
      list = list.filter((product) => {
        const p = extractNumericPrice(product.selling_price ?? product.price ?? (product as Record<string, unknown>).UNITY_PRICE);
        if (Number.isNaN(minNum) === false && p < minNum) return false;
        if (Number.isNaN(maxNum) === false && p > maxNum) return false;
        return true;
      });
    }

    return list;
  };

  const hasActiveFilters = !!(categoryFilter || priceMin.trim() || priceMax.trim() || moodPreference);
  const showFilterButton = !!(currentSeller && categories.length > 0);

  const getSortedProducts = (products: ShopWithMeProduct[]) => {
    const sorted = [...products];
    switch (sortBy) {
      case "price-low":
        sorted.sort((a, b) => {
          const priceA = extractNumericPrice(a.selling_price ?? a.price);
          const priceB = extractNumericPrice(b.selling_price ?? b.price);
          return priceA - priceB;
        });
        break;
      case "price-high":
        sorted.sort((a, b) => {
          const priceA = extractNumericPrice(a.selling_price ?? a.price);
          const priceB = extractNumericPrice(b.selling_price ?? b.price);
          return priceB - priceA;
        });
        break;
      case "name":
        sorted.sort((a, b) => {
          const nameA = (a.item_commercial_name || a.item_name || "").toLowerCase();
          const nameB = (b.item_commercial_name || b.item_name || "").toLowerCase();
          return nameA.localeCompare(nameB);
        });
        break;
    }
    return sorted;
  };

  /** Total items from backend (full Redis/API list) */
  const totalItemsFromBackend = currentSeller?.products?.length ?? currentSeller?.product_count ?? 0;
  /** Categories to display: category filter + optional mood. Mood uses MOOD_CONFIG (filter/sort/section title). Surprise uses popup preferences when set. */
  const categoriesToShow = useMemo(() => {
    let list = categoryFilter ? categories.filter((c) => c.name === categoryFilter) : categories;
    if (!moodPreference) return list;

    const config = MOOD_CONFIG[moodPreference];
    if (config) {
      const sourceList = categoryFilter ? list : categories;
      const allProducts = sourceList.flatMap((c) => c.products);
      let filtered = allProducts.filter(config.filter);
      if (moodPreference === "no-alcohol" && surprisePreferences) {
        filtered = filterSurpriseByPreferences(filtered, surprisePreferences);
      }
      const ordered = config.sortProducts
        ? config.sortProducts(filtered)
        : config.sort
          ? [...filtered].sort(config.sort)
          : filtered;
      if (ordered.length > 0)
        list = [{ name: config.sectionLabel, products: ordered, expanded: true }];
      else
        list = [];
    } else {
      const option = moodOptions.find((o) => o.id === moodPreference);
      if (option) list = list.filter((c) => option.categoryRegex.test(c.name));
    }
    return list;
  }, [categories, categoryFilter, moodPreference, surprisePreferences, moodOptions]);
  /** Filtered count (after search and category filter) */
  const totalProductCount = categoriesToShow.reduce((sum, cat) => {
    const filtered = getFilteredProducts(cat.products);
    return sum + filtered.length;
  }, 0);

  /** Price distribution from all current products (Airbnb-style histogram) */
  const { priceHistogram, priceSliderMax } = useMemo(() => {
    const products = currentSeller?.products ?? [];
    const prices = products
      .map((p) => extractNumericPrice((p as Record<string, unknown>).selling_price ?? p.price ?? (p as Record<string, unknown>).UNITY_PRICE))
      .filter((n) => n > 0);
    if (prices.length === 0) {
      return { priceHistogram: [] as number[], priceSliderMax: 100000 };
    }
    const dataMax = Math.max(...prices);
    const sliderMax = Math.max(10000, Math.ceil(dataMax / 5000) * 5000);
    const numBins = 20;
    const step = sliderMax / numBins;
    const bins = new Array(numBins).fill(0);
    for (const price of prices) {
      const idx = Math.min(Math.floor(price / step), numBins - 1);
      bins[idx]++;
    }
    const maxCount = Math.max(...bins, 1);
    const histogram = bins.map((c) => (c / maxCount) * 100);
    return { priceHistogram: histogram, priceSliderMax: sliderMax };
  }, [currentSeller?.products]);

  const priceSliderMin = 0;
  const priceSliderValue: [number, number] = [
    priceMin.trim() ? Math.min(parseInt(priceMin.trim(), 10) || 0, priceSliderMax) : priceSliderMin,
    priceMax.trim() ? Math.min(Math.max(parseInt(priceMax.trim(), 10) || priceSliderMax, priceSliderMin), priceSliderMax) : priceSliderMax,
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header – same alignment as main site (omit when embedInMainLayout, main site Header is used) */}
      {!embedInMainLayout && (
      <header className="sticky top-0 z-50 w-full border-b bg-white shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between gap-2 md:gap-4">
            {/* Logo – left, link to home */}
            <Link href="/" className="flex items-center shrink-0">
              <Image
                src="/images/ishyiga-logo.png"
                alt="Ishyiga Software"
                width={100}
                height={35}
                className="h-8 w-auto md:h-10"
              />
            </Link>

            {/* Center: product search + location + filters (when seller selected) – same line as main site */}
            {currentSeller && (
              <div className="hidden lg:flex flex-1 max-w-xl items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    type="search"
                    placeholder="Search products..."
                    value={productSearchQuery}
                    onChange={(e) => setProductSearchQuery(e.target.value)}
                    className="h-9 pl-9 min-w-0"
                  />
                </div>
                <LocationBadge compact />
                {showFilterButton && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0 relative"
                    onClick={() => setFilterSheetOpen(true)}
                    title="Sort, price range & category"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                    {hasActiveFilters && (
                      <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-[10px] font-medium text-primary-foreground flex items-center justify-center">
                        {[categoryFilter, priceMin.trim(), priceMax.trim(), moodPreference].filter(Boolean).length}
                      </span>
                    )}
                  </Button>
                )}
              </div>
            )}

            {/* Actions – right side, same as main site */}
            <div className="flex items-center gap-1 md:gap-2">
              <Button variant="ghost" size="sm" className="hidden md:flex">
                English
              </Button>
              <Button variant="ghost" size="sm" className="hidden sm:flex">
                Login
              </Button>
              <Button variant="ghost" size="icon" className="hidden sm:flex">
                <Heart className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="relative" onClick={() => router.push("/cart")}>
                <ShoppingCart className="h-5 w-5" />
                {cartItemCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-green-500 text-white text-xs flex items-center justify-center">
                    {cartItemCount}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>
      )}

      {/* Main Content – same container as main site */}
      <div className="container mx-auto px-4 py-6">
        {error && (
          <Card className="mb-6 border-destructive bg-destructive/10">
            <CardContent className="py-4">
              <p className="text-destructive text-center">{error}</p>
            </CardContent>
          </Card>
        )}

        {sellers.length > 0 && !currentSeller && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">
              Found {sellers.length} shop{sellers.length !== 1 ? "s" : ""}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sellers.map((seller) => (
                <Card
                  key={seller.ISHYIGA_ACCOUNT}
                  className="cursor-pointer transition-all hover:shadow-lg hover:border-primary/50"
                  onClick={() => setSelectedSeller(seller.ISHYIGA_ACCOUNT || null)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Store className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{seller.OWNER || seller.SELLER_NAMES || seller.NICKNAME}</h3>
                        <p className="text-sm text-muted-foreground truncate">@{seller.NICKNAME}</p>
                      </div>
                    </div>

                    {(seller.EMAIL || seller.LOCATION) && (
                      <div className="space-y-2 mb-4">
                        {seller.EMAIL && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{seller.EMAIL}</span>
                          </div>
                        )}
                        {seller.LOCATION && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{seller.LOCATION}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2 pt-4 border-t">
                      <div className="text-center">
                        <div className="text-xl font-bold text-primary">{seller.product_count || 0}</div>
                        <div className="text-xs text-muted-foreground">Products</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-green-600">{seller.in_stock_products || 0}</div>
                        <div className="text-xs text-muted-foreground">In Stock</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-muted-foreground">{seller.total_stock || 0}</div>
                        <div className="text-xs text-muted-foreground">Stock</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

              {currentSeller && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between gap-3 sm:gap-4 sm:items-center">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-foreground break-words">
                  {currentSeller.OWNER || currentSeller.SELLER_NAMES || currentSeller.NICKNAME}
                </h1>
                {/* How I feel today: mood pills with icons */}
                <div className="mt-3 space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">How I feel today:</p>
                  <div
                    className="flex flex-wrap gap-2"
                    data-mood={moodPreference ?? ""}
                    data-cursor-element-id="cursor-el-48"
                  >
                    {moodOptions.map(({ id, label, Icon, colorClass }) => {
                      const isSelected = moodPreference === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            if (id === "no-alcohol") {
                              if (isSelected) {
                                setMoodPreference(null);
                                setSurprisePreferences(null);
                              } else setSurpriseDialogOpen(true);
                            } else {
                              setMoodPreference(isSelected ? null : id);
                            }
                          }}
                          className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all",
                            isSelected
                              ? "bg-[#1e3a5f] text-white border-[#1e3a5f] ring-2 ring-[#1e3a5f] ring-offset-2 shadow-sm"
                              : "bg-background hover:bg-muted border-border"
                          )}
                          aria-pressed={isSelected}
                        >
                          <Icon className={cn("h-4 w-4 shrink-0", isSelected ? "text-white" : colorClass)} />
                          <span>{label}</span>
                        </button>
                      );
                    })}
                    {moodPreference && (
                      <button
                        type="button"
                        onClick={() => { setMoodPreference(null); setSurprisePreferences(null); }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm bg-background hover:bg-muted border-border"
                      >
                        Show all
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {hasTableContext && tableFromQuery?.trim() && (
                <Badge variant="outline" className="text-xs bg-primary/5 border-primary/20">
                  Table: <span className="font-mono font-medium">{tableFromQuery.trim()}</span>
                </Badge>
              )}
              {hasTableContext && tableFromQuery?.trim() && (
                <Badge variant="default" className="bg-[#1e3a5f] text-xs sm:text-sm py-1.5 sm:py-2 px-3 sm:px-4">
                  Table: <span className="font-mono font-medium">{tableFromQuery.trim()}</span>
                </Badge>
              )}
              {hasTableContext && (isDeliveryShop || isBarOrRestaurant) && (
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  {customerName && customerAddress ? (
                    <Badge variant="secondary" className="text-xs sm:text-sm py-1.5 sm:py-2 px-3 sm:px-4 max-w-full truncate">
                      <User className="h-4 w-4 mr-2 hidden xs:inline" />
                      <span className="truncate">{customerName}</span>
                    </Badge>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCustomerDialog(true)}
                      className="gap-2 whitespace-nowrap"
                    >
                      <User className="h-4 w-4" />
                      {isBarOrRestaurant ? "Set Table" : "Add Info"}
                    </Button>
                  )}
                  {customerName && customerAddress && (
                    <Button variant="ghost" size="sm" onClick={() => setShowCustomerDialog(true)} className="px-2 sm:px-3">
                      Change
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Mobile: search + filters (desktop has them in header). When embedInMainLayout always show here. */}
            <div className={cn("flex flex-col sm:flex-row gap-3 sm:items-center", !embedInMainLayout && "lg:hidden")}>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search products..."
                  value={productSearchQuery}
                  onChange={(e) => setProductSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  {productSearchQuery.trim()
                    ? `${totalProductCount} of ${totalItemsFromBackend} item${totalItemsFromBackend !== 1 ? "s" : ""}`
                    : `${totalItemsFromBackend} item${totalItemsFromBackend !== 1 ? "s" : ""}`}
                </span>
                {showFilterButton && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFilterSheetOpen(true)}
                    className="gap-1.5 relative"
                    title="Sort, price range & category"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                    <span className="hidden sm:inline">Filters</span>
                    {hasActiveFilters && (
                      <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] font-medium text-primary-foreground flex items-center justify-center">
                        {[categoryFilter, priceMin.trim(), priceMax.trim(), moodPreference].filter(Boolean).length}
                      </span>
                    )}
                  </Button>
                )}
              </div>
            </div>

            <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
              <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-8 py-6 px-1">
                  {/* Location (moved from header for one UI) */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Location
                    </Label>
                    <p className="text-xs text-muted-foreground">Products and delivery near you</p>
                    <LocationBadge />
                  </div>

                  {/* Sort / Featured */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold block">Sort</Label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: "featured", label: "Featured" },
                        { value: "price-low", label: "Price: Low to High" },
                        { value: "price-high", label: "Price: High to Low" },
                        { value: "name", label: "Name: A to Z" },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setSortBy(opt.value)}
                          className={cn(
                            "px-3 py-1.5 rounded-full border text-sm",
                            sortBy === opt.value
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background hover:bg-muted"
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Price range (RWF) – Airbnb-style distribution + dual-handle slider */}
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold block">Price range (RWF)</Label>
                    {priceHistogram.length > 0 && (
                      <div className="flex items-end gap-0.5 h-10 w-full" aria-hidden="true">
                        {priceHistogram.map((h, i) => (
                          <div
                            key={i}
                            className="flex-1 min-w-[3px] rounded-t bg-primary/25 transition-opacity"
                            style={{ height: `${Math.max(4, h)}%` }}
                          />
                        ))}
                      </div>
                    )}
                    <Slider
                      min={priceSliderMin}
                      max={priceSliderMax}
                      step={Math.max(100, Math.floor(priceSliderMax / 500))}
                      value={priceSliderValue}
                      onValueChange={(v) => {
                        const [a, b] = v;
                        setPriceMin(a <= priceSliderMin ? "" : String(a));
                        setPriceMax(b >= priceSliderMax ? "" : String(b));
                      }}
                      className="w-full py-2"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{priceSliderValue[0].toLocaleString()} RWF</span>
                      <span>{priceSliderValue[1] >= priceSliderMax ? "No max" : `${priceSliderValue[1].toLocaleString()} RWF`}</span>
                    </div>
                  </div>

                  {/* Category (Burrows Famille) */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold block">Category</Label>
                    <div className="flex flex-wrap gap-2 max-h-[280px] overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => setCategoryFilter(null)}
                        className={cn(
                          "px-3 py-1.5 rounded-full border text-sm flex-shrink-0",
                          !categoryFilter
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-muted"
                        )}
                      >
                        Any
                      </button>
                      {categories.map((cat) => (
                        <button
                          key={cat.name}
                          type="button"
                          onClick={() => setCategoryFilter(categoryFilter === cat.name ? null : cat.name)}
                          className={cn(
                            "px-3 py-1.5 rounded-full border text-sm flex-shrink-0",
                            categoryFilter === cat.name
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background hover:bg-muted"
                          )}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <SheetFooter className="flex-row gap-2 border-t pt-4 mt-auto sticky bottom-0 bg-background pb-4">
                  <Button
                    variant="ghost"
                    className="mr-auto"
                    onClick={() => {
                      setCategoryFilter(null);
                      setPriceMin("");
                      setPriceMax("");
                      setSortBy("featured");
                      setMoodPreference(null);
                      setCategories((prev) => prev.map((c, i) => ({ ...c, expanded: i === 0 })));
                    }}
                  >
                    Clear all
                  </Button>
                  <Button onClick={() => setFilterSheetOpen(false)}>
                    Show products
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>

            {loading && categories.length === 0 ? (
              <div className="text-center py-6">
                <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-8">
                {categoriesToShow.map((category) => {
                  const filteredProducts = getFilteredProducts(category.products);
                  const sortedProducts = getSortedProducts(filteredProducts);
                  const currentMoodConfig = moodPreference ? MOOD_CONFIG[moodPreference] : null;

                  if (sortedProducts.length === 0) return null;

                  const totalInCategory = sortedProducts.length;
                  const totalPages = Math.max(1, Math.ceil(totalInCategory / itemsPerPage));
                  const currentPage = Math.min(Math.max(1, categoryPages[category.name] ?? 1), totalPages);
                  const startIndex = (currentPage - 1) * itemsPerPage;
                  const endIndex = Math.min(startIndex + itemsPerPage, totalInCategory);
                  const paginatedProducts = sortedProducts.slice(startIndex, endIndex);

                  return (
                    <Card
                      key={category.name}
                      className="overflow-hidden border-l-4 border-l-primary/60 bg-card shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div
                        className={cn(
                          "flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4",
                          "bg-muted/30 border-b border-border/50"
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10 flex-shrink-0">
                            <LayoutGrid className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <h2 className="text-lg font-semibold tracking-tight text-foreground truncate">
                              {category.name}
                            </h2>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {totalInCategory} product{totalInCategory !== 1 ? "s" : ""}
                            </p>
                          </div>
                          <Badge variant="secondary" className="font-medium tabular-nums flex-shrink-0">
                            {totalInCategory}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-sm text-muted-foreground whitespace-nowrap hidden sm:inline">Show</span>
                            <Select
                              value={String(itemsPerPage)}
                              onValueChange={(v) => {
                                setItemsPerPage(Number(v));
                                setCategoryPages({});
                              }}
                            >
                              <SelectTrigger className="w-[72px] h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="8">8</SelectItem>
                                <SelectItem value="12">12</SelectItem>
                                <SelectItem value="24">24</SelectItem>
                                <SelectItem value="48">48</SelectItem>
                              </SelectContent>
                            </Select>
                            <span className="text-sm text-muted-foreground whitespace-nowrap hidden sm:inline">per section</span>
                          </div>
                          <p className="text-sm text-muted-foreground tabular-nums">
                            Showing{" "}
                            <span className="font-medium text-foreground">
                              {startIndex + 1}–{endIndex}
                            </span>{" "}
                            of <span className="font-medium text-foreground">{totalInCategory}</span> products
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleCategory(category.name)}
                          className="gap-1.5 text-muted-foreground hover:text-foreground flex-shrink-0"
                        >
                          {category.expanded ? (
                            <>
                              Collapse <ChevronUp className="h-4 w-4" />
                            </>
                          ) : (
                            <>
                              Expand <ChevronDown className="h-4 w-4" />
                            </>
                          )}
                        </Button>
                      </div>

                      {category.expanded && (
                        <CardContent className="p-4 sm:p-5 space-y-5">
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5">
                            {paginatedProducts.map((product, idx) => (
                              <ProductCard
                                key={`${category.name}-${startIndex + idx}`}
                                product={product}
                                moodMetaType={currentMoodConfig?.metaType}
                                ownerName={currentSeller.OWNER || currentSeller.SELLER_NAMES || currentSeller.NICKNAME}
                                supplierId={currentSeller.ISHYIGA_ACCOUNT || ""}
                                isDeliveryShop={isDeliveryShop}
                                isBarOrRestaurant={isBarOrRestaurant}
                                isPharmacy={isPharmacy}
                                hasTableContext={hasTableContext}
                                customerName={customerName}
                                customerAddress={customerAddress}
                                onCustomerInfoRequired={() => setShowCustomerDialog(true)}
                              />
                            ))}
                          </div>

                          {totalPages > 1 && (
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-border/50">
                              <p className="text-sm text-muted-foreground order-2 sm:order-1">
                                Page {currentPage} of {totalPages}
                              </p>
                              <div className="flex items-center gap-1.5 order-1 sm:order-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setCategoryPage(category.name, currentPage - 1)}
                                  disabled={currentPage <= 1}
                                  className="gap-1 h-8"
                                >
                                  <ChevronLeft className="h-4 w-4" />
                                  Previous
                                </Button>
                                <div className="flex items-center gap-1">
                                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                                    .filter(
                                      (p) =>
                                        p === 1 ||
                                        p === totalPages ||
                                        Math.abs(p - currentPage) <= 1
                                    )
                                    .map((p, i, arr) => (
                                      <div key={p} className="flex items-center gap-1">
                                        {i > 0 && arr[i - 1] !== p - 1 && (
                                          <span className="text-muted-foreground px-1">…</span>
                                        )}
                                        <Button
                                          variant={currentPage === p ? "default" : "outline"}
                                          size="sm"
                                          onClick={() => setCategoryPage(category.name, p)}
                                          className="h-8 w-8 p-0 min-w-8"
                                        >
                                          {p}
                                        </Button>
                                      </div>
                                    ))}
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setCategoryPage(category.name, currentPage + 1)}
                                  disabled={currentPage >= totalPages}
                                  className="gap-1 h-8"
                                >
                                  Next
                                  <ChevronRight className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      )}
                    </Card>
                  );
                })}

                {categoriesToShow.every((cat) => getFilteredProducts(cat.products).length === 0) && (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">
                      {productSearchQuery ? `No products found matching "${productSearchQuery}"` : "No products available"}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {sellers.length === 0 && !loading && !error && (
          <Card className="mt-12">
            <CardContent className="py-16">
              <div className="text-center text-muted-foreground">
                <Store className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">Find Your Shop</h3>
                <p>Search for a shop by nickname to browse their products</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Customer Info Dialog */}
      <Dialog open={showCustomerDialog} onOpenChange={setShowCustomerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isBarOrRestaurant ? "Your name at this table" : "Customer Information"}
            </DialogTitle>
            <DialogDescription>
              {isBarOrRestaurant
                ? "Tell the bar/restaurant who you are so they can match orders to people at this table. The table name (e.g. Ishyiga Table) comes from the QR link."
                : "Please provide your name and delivery address"}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label htmlFor="customer-name">
                {isBarOrRestaurant ? "Your Name *" : "Full Name *"}
              </Label>
              <Input
                id="customer-name"
                placeholder={isBarOrRestaurant ? "e.g., John, Alice, Nelly" : "e.g., John Doe"}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="customer-address">
                {isBarOrRestaurant ? "Where are you sitting? (optional)" : "Delivery Address *"}
              </Label>
              <Input
                id="customer-address"
                placeholder={
                  isBarOrRestaurant ? "e.g., Terrace, near the DJ" : "e.g., KN 5 Ave, Kigali"
                }
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCustomerDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCustomerSubmit} disabled={!customerName.trim()}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Surprise me :) popup – table + mood to filter results */}
      <Dialog open={surpriseDialogOpen} onOpenChange={setSurpriseDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Surprise me :)</DialogTitle>
            <DialogDescription>
              How many on the table? Pick how you feel and we’ll suggest products for you.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-5">
            <div>
              <p className="text-sm font-medium text-foreground mb-2">How many on table?</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="surprise-males" className="text-xs text-muted-foreground">Males</Label>
                  <Input
                    id="surprise-males"
                    type="number"
                    min={0}
                    value={surpriseForm.males || ""}
                    onChange={(e) => setSurpriseForm((f) => ({ ...f, males: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                    className="mt-1 h-9"
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="surprise-females" className="text-xs text-muted-foreground">Females</Label>
                  <Input
                    id="surprise-females"
                    type="number"
                    min={0}
                    value={surpriseForm.females || ""}
                    onChange={(e) => setSurpriseForm((f) => ({ ...f, females: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                    className="mt-1 h-9"
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="surprise-kids" className="text-xs text-muted-foreground">Kids</Label>
                  <Input
                    id="surprise-kids"
                    type="number"
                    min={0}
                    value={surpriseForm.kids || ""}
                    onChange={(e) => setSurpriseForm((f) => ({ ...f, kids: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                    className="mt-1 h-9"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-2">I feel…</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "hungry", label: "I feel hungry" },
                  { key: "onDiet", label: "I am on diet" },
                  { key: "cold", label: "I'm cold" },
                  { key: "thirsty", label: "I'm thirsty" },
                  { key: "wantAlcohol", label: "I want to get drunk" },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSurpriseForm((f) => ({ ...f, [key]: !(f as Record<string, unknown>)[key] }))}
                    className={cn(
                      "inline-flex items-center px-3 py-1.5 rounded-full border text-sm transition-colors",
                      (surpriseForm as Record<string, unknown>)[key]
                        ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                        : "bg-background hover:bg-muted border-border"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSurpriseDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setSurprisePreferences(surpriseForm);
                setMoodPreference("no-alcohol");
                setSurpriseDialogOpen(false);
              }}
            >
              Surprise me :)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Product Card Component
function ProductCard({
  product,
  moodMetaType,
  ownerName,
  supplierId,
  isDeliveryShop,
  isBarOrRestaurant,
  isPharmacy,
  hasTableContext,
  customerName,
  customerAddress,
  onCustomerInfoRequired,
}: {
  product: ShopWithMeProduct;
  /** When set, show contextual subtitle under product name (from MOOD_CONFIG.metaType). */
  moodMetaType?: MoodMetaType | null;
  ownerName?: string;
  supplierId: string;
  isDeliveryShop: boolean;
  isBarOrRestaurant?: boolean;
  isPharmacy?: boolean;
  /** When false (only nickname in URL), normal shop: add to cart and checkout without table info. */
  hasTableContext?: boolean;
  customerName: string;
  customerAddress: string;
  onCustomerInfoRequired: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const addItem = useCartStore((s) => s.addItem);
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);
  const isFavorite = useFavoritesStore((s) => s.isFavorite);

  const itemCode = getItemCode(product);
  const p = product as Record<string, unknown>;
  // API/Redis format: item_commercial_name, item_emballage (as-is), item_key_words, item_packet, image_url; price from selling_price
  const productName = String(p.item_commercial_name ?? p.item_name ?? p.ITEM_NAME ?? p.ITEM_COMMERCIAL_NAME ?? "").trim() || "Product";
  const categoryVal = p.category ?? p.famille ?? p.FAMILLE ?? p.item_department;
  const categoryLabel = categoryVal && String(categoryVal).trim() ? String(categoryVal).trim() : "n";
  const displayName = `${productName} - ${categoryLabel}`;
  const priceRaw = p.selling_price ?? p.price ?? p.UNITY_PRICE ?? p.SALE_PRICE_INCLUSIVE;
  const price = extractNumericPrice(priceRaw);
  const imageUrl = getProductImageSrc(product as Record<string, unknown>);
  const moodMeta = moodMetaType ? getMoodMetaText(product, moodMetaType) : { text: null };
  const validImage =
    !!imageUrl &&
    imageUrl !== "/placeholder.svg?height=300&width=300" &&
    (imageUrl.startsWith("http://") || imageUrl.startsWith("https://") || imageUrl.startsWith("/"));
  const [imgError, setImgError] = useState(false);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const fav = isFavorite(itemCode);
  const [erxOpen, setErxOpen] = useState(false);

  const pickField = (...keys: string[]) => {
    for (const k of keys) {
      const v = p[k];
      if (v != null && String(v).trim()) return String(v).trim();
    }
    return "";
  };

  const pharmacyViewFields = {
    dosage: pickField("dosage", "DOSAGE"),
    inn: pickField("inn", "INN", "item_name"),
    form: pickField("form", "FORM", "measurement", "MEASUREMENT"),
    pack: pickField("package", "PACKAGE", "item_emballage"),
  };

  useEffect(() => {
    setImgError(false);
  }, [imageUrl]);

  useEffect(() => {
    trackProductView(itemCode, productName, {
      supplierId,
      categoryId: undefined,
    });
  }, [itemCode, productName, supplierId]);

  const pushToCart = (qty = 1, erx?: ErxPrescription) => {
    // Only require table/customer info when we're in table context (table/customer/address in URL).
    const needsInfo = hasTableContext && (isDeliveryShop || isBarOrRestaurant);
    if (needsInfo && (!customerName || !customerAddress)) {
      onCustomerInfoRequired();
      toast({
        title: "Customer info required",
        description: isBarOrRestaurant
          ? "Please provide your table or guest name so staff can find you"
          : "Please provide your name and address for delivery",
        variant: "destructive",
      });
      return;
    }

    trackClick("product", itemCode, productName);

    console.log("[shop-with-me] Add to cart:", {
      itemCode,
      name: productName,
      OWNER: ownerName,
      supplierId,
    });

    addItem(
      {
        id: itemCode,
        name: productName,
        price: price,
        unit: "pcs",
        image: validImage ? imageUrl : undefined,
        itemCode,
        supplierId: supplierId,
        supplierName: ownerName || "Supplier",
        supplierLocation: undefined,
        momo: product.momo,
        selectedUnit: "pcs",
        isBarResto: isBarOrRestaurant,
        erx,
        notes: erx ? serializeErxForNotes(erx) : undefined,
      },
      Math.max(1, qty)
    );

    toast({
      title: "Added to cart",
      description: productName,
      duration: 2000,
    });
  };

  const openErxDialog = () => {
    setErxOpen(true);
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const wasFav = isFavorite(itemCode);
    toggleFavorite({
      id: itemCode,
      name: productName,
      price: price,
      unit: "pcs",
      image: validImage ? imageUrl : undefined,
      description: undefined,
      supplierId,
      supplierName: ownerName,
      supplierLocation: undefined,
      momo: product.momo,
    });

    toast({
      title: wasFav ? "Removed from favorites" : "Added to favorites!",
      description: productName,
      duration: 1500,
    });
  };

  return (
    <Card className="group h-full overflow-hidden transition-all hover:shadow-lg border rounded-lg">
      <div
        className={cn("relative w-full aspect-square bg-muted", validImage && !imgError && "cursor-zoom-in")}
        role={validImage && !imgError ? "button" : undefined}
        tabIndex={validImage && !imgError ? 0 : undefined}
        onClick={() => {
          if (validImage && !imgError) setImagePreviewOpen(true);
        }}
        onKeyDown={(e) => {
          if (!(validImage && !imgError)) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setImagePreviewOpen(true);
          }
        }}
        aria-label={validImage && !imgError ? "View product image" : undefined}
      >
        {validImage && !imgError && /^https?:\/\//i.test(imageUrl) ? (
          <img
            src={imageUrl}
            alt={productName}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
          />
        ) : validImage && !imgError ? (
          <Image
            fill
            src={imageUrl}
            alt={productName}
            className="object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <Store className="h-10 w-10 opacity-50" />
          </div>
        )}
        <button
          aria-label={fav ? "Remove from favorites" : "Add to favorites"}
          onClick={handleToggleFavorite}
          className={cn(
            "absolute right-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/80 backdrop-blur transition border-0 shadow-sm",
            "hover:bg-background",
            fav ? "text-red-600" : "text-muted-foreground"
          )}
          title={fav ? "Remove from favorites" : "Add to favorites"}
        >
          <Heart className={cn("h-4 w-4", fav && "fill-current")} />
        </button>
      </div>

      <CardContent className="p-3 flex flex-col gap-2">
        <div className="min-h-[2.5rem]">
          <h3 className="text-sm font-semibold leading-tight line-clamp-2">{displayName}</h3>
          {isPharmacy && (
            <div className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
              {pharmacyViewFields.dosage && <p>Dosage: {pharmacyViewFields.dosage}</p>}
              {pharmacyViewFields.inn && <p>INN: {pharmacyViewFields.inn}</p>}
              {pharmacyViewFields.form && <p>Form: {pharmacyViewFields.form}</p>}
              {pharmacyViewFields.pack && <p>Package: {pharmacyViewFields.pack}</p>}
            </div>
          )}
          {moodMeta.text && moodMetaType !== "discounted" && (
            <p className="text-xs text-muted-foreground mt-0.5" data-mood-subline>{moodMeta.text}</p>
          )}
          {moodMetaType === "discounted" && (moodMeta.wasPrice != null || (moodMeta.discountPercent != null && moodMeta.discountPercent > 0)) && (
            <p className="text-xs mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              {moodMeta.wasPrice != null && moodMeta.wasPrice > price && (
                <span className="line-through text-red-600 font-medium">{moodMeta.wasPrice.toLocaleString()} RWF</span>
              )}
              {moodMeta.discountPercent != null && moodMeta.discountPercent > 0 && (
                <span className="text-green-600 font-semibold"> -{moodMeta.discountPercent}%</span>
              )}
            </p>
          )}
          {/* IHUTE: ingredient-style search badges — direct match first, then "contains" */}
          {((p.search_priority as string) === "direct" || (p.contains_ingredient as string)) && (
            <div className="mt-1 flex flex-wrap gap-1">
              {(p.search_priority as string) === "direct" && (
                <span className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                  Main Ingredient
                </span>
              )}
              {(p.contains_ingredient as string) && (p.search_priority as string) !== "direct" && (
                <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                  Contains: {String(p.contains_ingredient)}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-0.5 text-amber-500" aria-label="Quality rating">
          {[1, 2, 3, 4, 5].map((i) => (
            <Star key={i} className="h-3.5 w-3.5 fill-current" />
          ))}
        </div>

        <div className="space-y-0.5">
          <div className="font-bold text-base">
            {price.toLocaleString()} {product.currency || "RWF"}
          </div>
        </div>

        <Button
          size="sm"
          className="mt-1 w-full bg-[#1e3a5f] hover:bg-[#2c4f7c]"
          onClick={(e) => {
            e.stopPropagation();
            if (isPharmacy) {
              openErxDialog();
            } else {
              pushToCart();
            }
          }}
        >
          {hasTableContext && (isDeliveryShop || isBarOrRestaurant) && (!customerName || !customerAddress)
            ? isBarOrRestaurant
              ? "Set Table Info"
              : "Add Info to Order"
            : "Buy Now"}
        </Button>
      </CardContent>

      <ErxPrescriptionDialog
        open={erxOpen}
        onOpenChange={setErxOpen}
        productName={productName}
        prefillSource={p as Record<string, unknown>}
        onConfirm={(erx) => pushToCart(1, erx)}
      />

      <Dialog open={imagePreviewOpen} onOpenChange={setImagePreviewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{productName}</DialogTitle>
            <DialogDescription>{ownerName || "Shop"}</DialogDescription>
          </DialogHeader>
          <div className="relative w-full aspect-square bg-muted rounded-md overflow-hidden">
            {validImage && !imgError && /^https?:\/\//i.test(imageUrl) ? (
              <img
                src={imageUrl}
                alt={productName}
                className="absolute inset-0 h-full w-full object-contain bg-white"
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
              />
            ) : validImage && !imgError ? (
              <Image
                fill
                src={imageUrl}
                alt={productName}
                className="object-contain bg-white"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                <Store className="h-10 w-10 opacity-50" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImagePreviewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}