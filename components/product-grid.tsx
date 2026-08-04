"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ProductCard } from "@/components/product-card";
import { ProductQuickView, type QuickViewProduct } from "@/components/product-quick-view";
import { useCartStore } from "@/lib/cart-store";
import { getProductImageSrc } from "@/lib/image-utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search, Store, Loader2 } from "lucide-react";
import { filterProductsByRelevance, filterSuppliersByRelevance } from "@/lib/search-utils";
import { useTranslation } from "@/hooks/use-translation";
import type { TranslationKey } from "@/lib/translations";
import { cn } from "@/lib/utils";

const LIST_SECTOR_SUPPLIERS_LIMIT = 500;
import {
  generalSellingPrice,
  normalizeItemEmballageForCart,
  resolveItemEmballageRaw,
} from "@/lib/package-price";
import { useToast } from "@/components/ui/use-toast";

type ServerProduct = {
  item_commercial_name?: string;
  item_packet?: string;
  item_emballage?: string;
  selling_price?: number | string;
  cost_price?: number | string;
  /** Currency from account_signup for this supplier. */
  currency?: string;
  item_key_words?: string;
  item_seller_account?: string;
  supplier_name?: string;
  supplier_location?: string;
  // Preserve all image fields for KAOS URL construction
  image?: string;
  image_url?: string;
  item_image_url?: string;
  IMAGE_URL?: string;
  IMAGE_URL_2?: string;
  IMAGE_URL_3?: string;
  // Also preserve famille for KAOS paths
  famille?: string;
  FAMILLE?: string;
  // ✅ we’ll keep category info if backend provides it (type/sector/category)
  type?: string;
  sector?: string;
  category?: string;
  /** Brand from niki_items: item_fabricant or id_fabricant */
  brand?: string;
  momo?: string;
  /** Catalogue / NIKI code for KAOS images and deduping */
  item_code?: string;
  ITEM_CODE?: string;
  requires_prescription?: boolean;
  requiresPrescription?: boolean;
};

function extractNumericPrice(value: any): number {
  if (typeof value === "number") return value;
  const n = String(value ?? "").replace(/[^\d.,]/g, "").replace(",", ".");
  const parsed = parseFloat(n);
  return Number.isFinite(parsed) ? parsed : 0;
}

// Map a variety of backend category labels to our route-friendly categoryId
function toRouteCategoryId(raw?: string): string | undefined {
  if (!raw) return undefined;
  const s = raw.trim().toLowerCase();

  // Heuristics for common names
  if (s.includes("bar") && s.includes("rest")) return "bar-resto";
  if (s.includes("liquor")) return "liquor-store";
  if (s.includes("coffee")) return "coffee-shop";
  if (s.includes("beauty")) return "beauty";
  if (s.includes("pharma")) return "pharmacy";
  if (s.includes("super")) return "supermarket";
  if (s.includes("boutique")) return "boutique";
  if (s.includes("general")) return "general";

  // Generic slug
  return s
    .replace(/\s*&\s*/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

// Normalize any product shape from API (Redis format: supplier_<account> / data[]; item_emballage as-is, price from selling_price)
function normalizeProduct(
  p: any,
  fallbacks?: { account?: string; sellerName?: string; sellerLoc?: string }
): ServerProduct {
  const codeCandidates = [
    p.ITEM_CODE,
    p.item_code,
    p.itemCode,
    p.NIKI_CODE,
    p.niki_code,
    p.CODE,
    p.code,
    p.product_code,
    p.PRODUCT_CODE,
  ]
  const code =
    codeCandidates
      .map((x) => (typeof x === "string" ? x.trim() : x != null ? String(x).trim() : ""))
      .find((s) => s.length > 0) || ""
  const img =
    p.image ?? p.image_url ?? p.item_image_url ?? p.IMAGE_URL ?? undefined
  const imgStr = typeof img === "string" ? img.trim() : img != null ? String(img).trim() : ""

  const sellCandidates = [
    p.selling_price,
    p.PRICE,
    p.P_VENTE,
    p.PRIX_VENTE,
    p.UNITY_PRICE,
    p.SALE_PRICE_INCLUSIVE,
    p.final_selling_price,
    p.price,
  ]
  let sellingPrice: number | string | undefined =
    p.selling_price ?? p.SALE_PRICE_INCLUSIVE ?? p.final_selling_price ?? p.price
  if (
    sellingPrice != null &&
    typeof sellingPrice !== "number" &&
    typeof sellingPrice !== "string"
  ) {
    sellingPrice = String(sellingPrice)
  }
  let bestSell = 0
  for (const c of sellCandidates) {
    if (c == null || (typeof c === "string" && String(c).trim() === "")) continue
    const n = typeof c === "number" ? c : parseFloat(String(c).replace(/[^\d.-]/g, ""))
    if (!Number.isFinite(n) || n <= 0) continue
    if (bestSell <= 1 && n > bestSell) {
      bestSell = n
      sellingPrice = typeof c === "number" || typeof c === "string" ? c : String(c)
    } else if (bestSell <= 0 && n > 0) {
      bestSell = n
      sellingPrice = typeof c === "number" || typeof c === "string" ? c : String(c)
    }
  }

  return {
    item_commercial_name: p.item_commercial_name ?? p.ITEM_NAME ?? p.name ?? "Product",
    item_packet: p.item_packet ?? p.UNIT ?? p.pack ?? "",
    item_emballage: p.item_emballage ?? p.ITEM_EMBALLAGE ?? "",
    selling_price: sellingPrice,
    cost_price: p.cost_price,
    currency: p.currency,
    item_code: code || (p.item_key_words ?? p.NIKI_CODE ?? p.niki_code ?? "").toString().trim() || undefined,
    item_key_words: p.item_key_words ?? p.DESCRIPTION_KEYWORD ?? code ?? "",
    item_seller_account:
      p.item_seller_account ??
      p.supplier_account ??
      p.seller_account ??
      p.SELLER_ISHYIGA_ACCOUNT ??
      fallbacks?.account ??
      "",
    supplier_name: p.supplier_name ?? p.SELLER_NAMES ?? fallbacks?.sellerName ?? "",
    supplier_location: p.supplier_location ?? p.LOCATION ?? fallbacks?.sellerLoc ?? "",
    // Preserve all original image fields for KAOS URL construction
    image: p.image,
    image_url: p.image_url,
    item_image_url: p.item_image_url,
    IMAGE_URL: p.IMAGE_URL,
    // Preserve raw FAMILLE for KAOS paths; `famille` below is normalized
    FAMILLE: p.FAMILLE,
    momo: p.momo,
    // keep any server-provided category hint
    type: p.type ?? p.TYPE ?? undefined,
    sector: p.sector ?? p.SECTOR ?? undefined,
    category: p.category ?? p.CATEGORY ?? undefined,
    brand: p.item_fabricant ?? p.id_fabricant ?? p.brand,
    famille: (p.famille ?? p.FAMILLE ?? p.category ?? p.CATEGORY ?? "")
      .toString()
      .trim() || undefined,
    requires_prescription: Boolean(
      p.requires_prescription === true
        || p.requires_prescription === 1
        || p.requires_prescription === "1"
        || p.requiresPrescription === true
        || p.requiresPrescription === 1
        || p.requiresPrescription === "1",
    ),
    requiresPrescription: Boolean(
      p.requires_prescription === true
        || p.requires_prescription === 1
        || p.requires_prescription === "1"
        || p.requiresPrescription === true
        || p.requiresPrescription === 1
        || p.requiresPrescription === "1",
    ),
  };
}

/** Same merge as loadAllSectorProducts — one listSuppliers JSON payload → flat grid rows. */
function flattenListSuppliersPayloadToProducts(sellers: unknown[]): ServerProduct[] {
  const products: ServerProduct[] = [];
  for (const s of sellers) {
    if (s == null || typeof s !== "object") continue;
    const row = s as Record<string, unknown>;
    const sellerAccount =
      (row.seller_account as string) ??
      (row.SELLER_ISHYIGA_ACCOUNT as string) ??
      (row.seller_ishyiga_account as string) ??
      "";
    const sellerName = (row.seller_name as string) ?? (row.SELLER_NAMES as string) ?? "";
    const sellerLoc = (row.seller_location as string) ?? (row.LOCATION as string) ?? "";
    const plist = row.products;
    if (!Array.isArray(plist)) continue;
    for (const p of plist) {
      products.push(normalizeProduct(p, { account: sellerAccount, sellerName, sellerLoc }));
    }
  }
  return products;
}

function extractSuppliersWithProducts(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    if (Array.isArray(payload.sellers)) return payload.sellers;
    if (Array.isArray(payload.suppliers)) return payload.suppliers;
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.results)) return payload.results;
  }
  return [];
}

/** Card row for ProductCard / quick view (shape of `allProducts` items). */
export type GridCardProduct = {
  id: string;
  name: string;
  description?: string;
  price: number;
  itemEmballage?: string | number;
  currency?: string;
  unit?: string | number;
  supplierId?: string;
  supplierName?: string;
  supplierLocation?: string;
  /** Stable catalog / NIKI code — never the composite grid id. */
  itemCode?: string;
  item_code?: string;
  ITEM_CODE?: string;
  item_key_words?: string;
  image?: string;
  image_url?: string;
  item_image_url?: string;
  IMAGE_URL?: string;
  famille?: string;
  FAMILLE?: string;
  momo?: string;
  item_state?: string;
  expiryLabel?: string;
  _routeCategory?: string;
  requiresPrescription?: boolean;
  requires_prescription?: boolean;
};

function catalogCodeOf(p: {
  item_code?: string;
  ITEM_CODE?: string;
  item_key_words?: string;
  itemCode?: string;
}): string {
  return (
    [p.itemCode, p.item_code, p.ITEM_CODE, p.item_key_words]
      .map((x) => (x == null ? "" : String(x).trim()))
      .find((s) => s.length > 0 && !s.toLowerCase().startsWith("pharmacy-") && !/^[\w-]+-\w+-\d+$/.test(s)) ||
    [p.itemCode, p.item_code, p.ITEM_CODE, p.item_key_words]
      .map((x) => (x == null ? "" : String(x).trim()))
      .find((s) => s.length > 0) ||
    ""
  );
}

/** Display/cart hint when API has not stamped requires_prescription yet (gate still re-checks DB). */
function looksLikeRxRequiredName(name: string | undefined | null): boolean {
  const n = (name || "").toUpperCase();
  if (!n) return false;
  return (
    n.includes("AUGMENTIN") ||
    n.includes("AMOXICLAV") ||
    n.includes("AMOXICIL") ||
    n.includes("AZITHROMYC") ||
    n.includes("FLAGYL") ||
    n.includes("METRONIDAZ") ||
    n.includes("AMLODIPINE") ||
    n.includes("AMLO-DENK") ||
    n.includes("AMITRYPT") ||
    n.includes("LEVETIRACETAM") ||
    n.includes("ARTEMETHER") ||
    n.includes("HYDROCORTISONE")
  );
}

function gridProductToQuickView(p: GridCardProduct): QuickViewProduct {
  const line = generalSellingPrice(p.price, p.itemEmballage);
  const code = catalogCodeOf(p);
  return {
    id: (code || p.id).toString(),
    name: p.name,
    price: line,
    currency: p.currency || "RWF",
    unit: p.unit?.toString(),
    itemCode: code || undefined,
    supplierId: p.supplierId,
    supplierName: p.supplierName,
    itemEmballage: normalizeItemEmballageForCart(p.itemEmballage),
    image: p.image,
    image_url: p.image_url,
    item_image_url: p.item_image_url,
    IMAGE_URL: p.IMAGE_URL,
    famille: p.famille ?? p.FAMILLE,
    FAMILLE: p.FAMILLE,
    item_key_words: p.item_key_words || code,
    item_code: code || p.item_code,
    requiresPrescription: Boolean(p.requiresPrescription ?? p.requires_prescription),
    requires_prescription: Boolean(p.requiresPrescription ?? p.requires_prescription),
  };
}

export function ProductGrid({
  categoryId,
  categoryName,
  selectedSupplier = "all",
  selectedSupplierName = "All Suppliers",
  /** category_ai item mode: all sector products + family filter */
  browseMode,
  /** When true, hide the in-page search box (use header search). Sort + family filters stay. */
  hideInlineSearch = false,
  /** Parent’s single listSuppliersWithProducts response — avoids duplicate fetch + mismatched RAND() sample. */
  preloadedSectorListSuppliers,
}: {
  categoryId: string;
  categoryName: string;
  selectedSupplier?: string;
  selectedSupplierName?: string;
  browseMode?: "item";
  hideInlineSearch?: boolean;
  preloadedSectorListSuppliers?: unknown[] | null;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const urlSq = (searchParams.get("sq") ?? "").trim();
  const [searchQuery, setSearchQuery] = useState("");
  /** category_ai item mode: header search writes `?sq=` — grid filters from URL. */
  const effectiveSearchQuery = hideInlineSearch ? urlSq : searchQuery;
  /** Non–category-item pages: sort is local state. Category "Choose an item" uses `?sort=` (filter sheet / URL). */
  const [sortByPage, setSortByPage] = useState("featured");
  const sortBy =
    browseMode === "item" ? (searchParams.get("sort") || "price-low") : sortByPage;
  const setSortBy = (value: string) => {
    if (browseMode === "item") {
      const p = new URLSearchParams(searchParams.toString());
      p.set("sort", value);
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
      return;
    }
    setSortByPage(value);
  };
  const [displayCount, setDisplayCount] = useState(12);
  const [familleFilter, setFamilleFilter] = useState<string | null>(null);
  const [serverProducts, setServerProducts] = useState<ServerProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [globalSearchResults, setGlobalSearchResults] = useState<ServerProduct[]>([]);
  const [quickViewProduct, setQuickViewProduct] = useState<GridCardProduct | null>(null);
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const addOrInc = useCartStore((s) => s.addOrInc ?? s.addItem);
  const { toast } = useToast();

  function getApiBase() {
    // Always use empty string to make relative calls to Next.js API routes
    return "";
  }

  // reset search & pagination when the supplier changes
  useEffect(() => {
    setSearchQuery("");
    setDisplayCount(browseMode === "item" ? 20 : 12);
    setGlobalSearchResults([]);
  }, [selectedSupplier, browseMode]);

  // Global / sector search with debounce — category_ai item mode uses sector-scoped-search
  useEffect(() => {
    if (!effectiveSearchQuery.trim()) {
      setGlobalSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timeoutId = setTimeout(async () => {
      try {
        // category_ai "Choose an item": dedicated sector catalog search (same as header GlobalSearch when sector is set)
        if (browseMode === "item" && selectedSupplier === "all") {
          const params = new URLSearchParams({
            sector: categoryId,
            mode: "items",
            q: effectiveSearchQuery.trim(),
            Currency: "RWF",
          });
          const res = await fetch(`/api/sector-scoped-search?${params}`, {
            cache: "no-store",
            headers: { Accept: "application/json" },
          });
          if (!res.ok) throw new Error(`Search failed: ${res.status}`);
          const json = (await res.json()) as { results?: unknown[]; ok?: boolean; error?: string };
          const rawResults = Array.isArray(json.results) ? json.results : [];
          console.log(
            `[ProductGrid Search] sector-scoped items: query="${effectiveSearchQuery}" sector=${categoryId} count=${rawResults.length}`,
          );
          const normalized = rawResults.map((p: any) =>
            normalizeProduct({
              ...p,
              item_commercial_name:
                p.item_commercial_name ?? p.ITEM_NAME ?? p.item_name ?? p.name,
              item_key_words: p.item_key_words ?? p.ITEM_CODE ?? p.item_code ?? p.niki_code,
              supplier_account: p.supplier_account ?? p.item_seller_account ?? p.SELLER_ISHYIGA_ACCOUNT,
              supplier_name: p.supplier_name ?? p.SELLER_NAMES ?? p.nickname,
              selling_price: p.selling_price ?? p.SALE_PRICE_INCLUSIVE ?? p.price,
            }),
          );
          const filtered = filterProductsByRelevance(
            normalized,
            effectiveSearchQuery.trim(),
            10,
          );
          setGlobalSearchResults(filtered);
          return;
        }

        const params = new URLSearchParams({
          globalSearch: effectiveSearchQuery.trim(),
          sector: categoryId, // Filter to current category only
          limit: "10000",
          Currency: "RWF",
        });
        // When a supplier is selected, force Redis-first supplier cache search in backend.
        if (selectedSupplier && selectedSupplier !== "all") {
          params.set("supplier", selectedSupplier);
        }

        const res = await fetch(`/api/fetchSuggestions?${params}`, {
          cache: "no-store"
        });

        if (!res.ok) throw new Error("Search failed");

        const json = await res.json();

        // Get products from the search
        const products = json.products || [];

        console.log(`[ProductGrid Search] Query: "${effectiveSearchQuery}" in ${categoryId}`);
        console.log(`[ProductGrid Search] Received ${products.length} products from backend`);
        if (products.length > 0) {
          console.log(`[ProductGrid Search] Sample product:`, {
            name: products[0].item_commercial_name || products[0].ITEM_NAME,
            type: products[0].type || products[0].TYPE,
            sector: products[0].sector || products[0].SECTOR,
            category: products[0].category || products[0].CATEGORY
          });
        }

        // Since backend should filter by sector param, we trust it
        // But we'll do light filtering if category info exists
        const categoryFilteredProducts = products;

        console.log(`[ProductGrid Search] Using ${categoryFilteredProducts.length} products`);

        // Get suppliers from the search (both by name and by product)
        const suppliersByName = json.suppliersByName || [];
        const suppliersByProduct = json.suppliersByProduct || [];

        console.log(`[ProductGrid Search] Received ${suppliersByName.length} suppliers by name, ${suppliersByProduct.length} by product`);

        // Combine and deduplicate suppliers
        const allSuppliers = [...suppliersByName, ...suppliersByProduct];
        const uniqueSuppliers = allSuppliers.filter((supplier, index, self) =>
          index === self.findIndex((s) =>
            (s.supplier_account || s.SELLER_ISHYIGA_ACCOUNT) === (supplier.supplier_account || supplier.SELLER_ISHYIGA_ACCOUNT)
          )
        );

        console.log(`[ProductGrid Search] ${uniqueSuppliers.length} unique suppliers found`);

        // Filter suppliers by relevance (backend should have already filtered by sector)
        const filteredSuppliers = filterSuppliersByRelevance(
          uniqueSuppliers.filter(s => s.supplier_name),
          effectiveSearchQuery.trim(),
          8 // Lower threshold for more results
        );

        console.log(`[ProductGrid Search] ${filteredSuppliers.length} suppliers after relevance filtering`);

        // For each supplier, fetch their products in this category
        const allProducts: any[] = [];

        // Add direct product matches (already category-filtered)
        const filteredProducts = filterProductsByRelevance(categoryFilteredProducts, effectiveSearchQuery.trim(), 10);
        allProducts.push(...filteredProducts);

        // Fetch products from matching suppliers
        for (const supplier of filteredSuppliers) {
          const supplierAccount = supplier.supplier_account || supplier.SELLER_ISHYIGA_ACCOUNT;
          if (!supplierAccount) continue;

          try {
            const supplierRes = await fetch(
              `/api/fetchSuggestions?supplierProducts=${encodeURIComponent(supplierAccount)}&limit=10000&Currency=RWF`,
              { cache: "no-store" }
            );

            if (supplierRes.ok) {
              const supplierProducts = await supplierRes.json();
              // Add supplier products
              if (Array.isArray(supplierProducts)) {
                allProducts.push(...supplierProducts.map((p: any) => ({
                  ...p,
                  supplier_name: supplier.supplier_name,
                  supplier_location: supplier.supplier_location,
                  supplier_account: supplierAccount
                })));
              }
            }
          } catch (err) {
            console.error(`Failed to fetch products for supplier ${supplierAccount}:`, err);
          }
        }

        // Remove duplicate products
        const uniqueProducts = allProducts.filter((product, index, self) =>
          index === self.findIndex((p) =>
            (p.item_code || p.item_commercial_name) === (product.item_code || product.item_commercial_name) &&
            (p.item_seller_account || p.supplier_account) === (product.item_seller_account || product.supplier_account)
          )
        );

        console.log(`[ProductGrid Search] Final result: ${uniqueProducts.length} unique products`);

        // Normalize all products
        const normalized = uniqueProducts.map((p: any) => normalizeProduct(p));

        setGlobalSearchResults(normalized);
      } catch (error) {
        console.error("Global search error:", error);
        setGlobalSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [effectiveSearchQuery, categoryId, browseMode, selectedSupplier]);

  /** category_ai: sector list + badges come from parent — do not re-fetch listSuppliersWithProducts. */
  useEffect(() => {
    if (browseMode !== "item" || selectedSupplier !== "all") return;
    if (preloadedSectorListSuppliers === undefined) return;
    let cancelled = false;
    if (preloadedSectorListSuppliers === null) {
      setLoading(true);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const products = flattenListSuppliersPayloadToProducts(preloadedSectorListSuppliers);
      if (!cancelled) setServerProducts(products);
    } catch (e: any) {
      if (!cancelled) setError(e?.message || "Failed to load products");
    } finally {
      if (!cancelled) setLoading(false);
    }
    return () => {
      cancelled = true;
    };
  }, [browseMode, selectedSupplier, preloadedSectorListSuppliers, categoryId]);

  useEffect(() => {
    let isMounted = true;

    async function run() {
      if (
        browseMode === "item" &&
        selectedSupplier === "all" &&
        preloadedSectorListSuppliers !== undefined
      ) {
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const base = getApiBase();
        const sectorListUrl = `${base}/api/sector-list-suppliers?sector=${encodeURIComponent(categoryId)}&Currency=RWF&limit=${LIST_SECTOR_SUPPLIERS_LIMIT}`;

        const loadAllSectorProducts = async (shuffle: boolean) => {
          const res = await fetch(sectorListUrl, { cache: "no-store" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const raw = await res.json();
          const sellers = extractSuppliersWithProducts(raw);

          const products: ServerProduct[] = [];
          for (const s of sellers) {
            const sellerAccount =
              s.seller_account ?? s.SELLER_ISHYIGA_ACCOUNT ?? s.seller_ishyiga_account ?? "";
            const sellerName = s.seller_name ?? s.SELLER_NAMES ?? "";
            const sellerLoc = s.seller_location ?? s.LOCATION ?? "";
            for (const p of s.products || []) {
              products.push(normalizeProduct(p, { account: sellerAccount, sellerName, sellerLoc }));
            }
          }
          if (shuffle) {
            products.sort(() => Math.random() - 0.5);
          }
          return products;
        };

        if (selectedSupplier !== "all") {
          const res = await fetch(
            `${base}/api/fetchSuggestions?supplierProducts=${encodeURIComponent(selectedSupplier)}&limit=10000&Currency=RWF`,
            { cache: "no-store" }
          );
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const raw = (await res.json()) as Array<any>;
          const items = (Array.isArray(raw) ? raw : []).map((p) =>
            normalizeProduct(p, { account: selectedSupplier, sellerName: selectedSupplierName })
          );
          if (!isMounted) return;
          setServerProducts(items);
        } else {
          const shuffle = browseMode !== "item";
          const products = await loadAllSectorProducts(shuffle);
          if (!isMounted) return;
          setServerProducts(products);
        }
      } catch (e: any) {
        if (isMounted) setError(e?.message || "Failed to load products");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (categoryId) run();
    return () => {
      isMounted = false;
    };
  }, [categoryId, selectedSupplier, selectedSupplierName, browseMode, preloadedSectorListSuppliers]);

  const allProducts = useMemo(() => {
    // Use global search results if searching, otherwise use server products
    const sourceProducts = effectiveSearchQuery.trim() ? globalSearchResults : serverProducts;

    console.log("[ProductGrid] allProducts update:", {
      searchQuery: effectiveSearchQuery,
      usingGlobalResults: !!effectiveSearchQuery.trim(),
      sourceProductsCount: sourceProducts.length,
      globalResultsCount: globalSearchResults.length,
      serverProductsCount: serverProducts.length
    });

    return (sourceProducts || []).map((p, idx) => {
      // Backend often sets type: "product" (entity kind), not a sector — do not treat as route category.
      const typeRaw = p.type != null ? String(p.type).trim() : "";
      const fromType =
        typeRaw && typeRaw.toLowerCase() !== "product"
          ? toRouteCategoryId(p.type)
          : undefined;
      const firstCategoryHint =
        fromType ||
        toRouteCategoryId(p.sector) ||
        toRouteCategoryId(p.category);
      const kw = (p.item_key_words ?? p.item_code ?? "").toString();
      const acct = (p.item_seller_account ?? "").toString();
      const catalogCode = catalogCodeOf(p);
      const needsRx =
        Boolean(p.requiresPrescription ?? p.requires_prescription) ||
        (categoryId === "pharmacy" && looksLikeRxRequiredName(p.item_commercial_name));

      // Do not set `image` to a local placeholder: getProductImageSrc treats `/placeholder...` as a valid URL and skips KAOS / backend fallbacks.
      const embRaw = resolveItemEmballageRaw(p as Record<string, unknown>);
      const embStr =
        embRaw != null && String(embRaw).trim() !== "" ? String(embRaw).trim() : undefined;
      // `selling_price` from Redis/API is the base catalog unit (same as supplier dashboard `product.price`).
      // Customer line = base × item_emballage — applied once in ProductCard via `generalSellingPrice`.
      // Do not pre-multiply here or prices become base × emballage² (e.g. 510×50 vs 10.2×50).
      return {
        id: `${categoryId}-${acct}-${kw || catalogCode}-${idx}`,
        name: p.item_commercial_name || "Product",
        description: undefined,
        price: extractNumericPrice(p.selling_price),
        itemEmballage: embStr,
        currency: p.currency || "RWF",
        unit: p.item_packet,
        inStock: true,
        rating: 4,
        itemCode: catalogCode || undefined,
        item_code: catalogCode || p.item_code,
        ITEM_CODE: catalogCode || p.ITEM_CODE,
        supplierId:
          p.item_seller_account ||
          (selectedSupplier !== "all" ? selectedSupplier : "") ||
          "",
        supplierName: p.supplier_name || p.item_seller_account || "Supplier",
        supplierLocation: p.supplier_location,
        image: p.image,
        image_url: p.image_url,
        item_image_url: p.item_image_url,
        IMAGE_URL: p.IMAGE_URL,
        item_key_words: p.item_key_words || catalogCode,
        famille: (p as { famille?: string }).famille ?? (p as { FAMILLE?: string }).FAMILLE ?? "",
        FAMILLE: (p as { FAMILLE?: string }).FAMILLE,
        momo: p.momo,
        requiresPrescription: needsRx,
        requires_prescription: needsRx,
        _routeCategory: firstCategoryHint,
      };
    });
  }, [serverProducts, globalSearchResults, effectiveSearchQuery, categoryId, selectedSupplier]);

  const suppliers = useMemo(() => {
    const uniq = new Map<string, { id: string; name: string; location?: string }>();
    for (const p of allProducts) {
      if (p.supplierId && !uniq.has(p.supplierId)) {
        uniq.set(p.supplierId, {
          id: p.supplierId,
          name: p.supplierName || p.supplierId,
          location: p.supplierLocation,
        });
      }
    }
    return Array.from(uniq.values());
  }, [allProducts]);

  const familleOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of allProducts) {
      const f = (p as { famille?: string }).famille?.toString().trim();
      if (f) set.add(f);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allProducts]);

  const filteredProducts = useMemo(() => {
    let items = allProducts;

    // Supplier chip: only match account id. Category/sector is enforced by the API
    // (sector on globalSearch, listSuppliersWithProducts by categoryId, etc.) — never
    // re-filter here using client-side _routeCategory heuristics (breaks with type: "product", mixed fields, Redis shapes).
    if (selectedSupplier !== "all") {
      items = items.filter((p) => p.supplierId === selectedSupplier);
      if (items.some((p) => !!p._routeCategory)) {
        items = items.filter((p) => p._routeCategory === categoryId);
      }
    }

    if (browseMode === "item" && familleFilter) {
      items = items.filter(
        (p) =>
          ((p as { famille?: string }).famille || "").toString().trim().toLowerCase() ===
          familleFilter.toLowerCase()
      );
    }

    switch (sortBy) {
      case "price-low":
        items = [...items].sort(
          (a, b) =>
            generalSellingPrice(a.price, a.itemEmballage) -
            generalSellingPrice(b.price, b.itemEmballage)
        );
        break;
      case "price-high":
        items = [...items].sort(
          (a, b) =>
            generalSellingPrice(b.price, b.itemEmballage) -
            generalSellingPrice(a.price, a.itemEmballage)
        );
        break;
      case "rating":
        items = [...items].sort((a, b) => b.rating - a.rating);
        break;
      case "trending":
        // Placeholder: keep API merge order until real trend scores exist
        break;
      default:
        break;
    }

    return items;
  }, [allProducts, selectedSupplier, sortBy, categoryId, browseMode, familleFilter]);

  const displayedProducts = filteredProducts.slice(0, displayCount);
  const loadMoreStep = browseMode === "item" ? 20 : 12;

  const slimCategoryItemHeader = browseMode === "item" && hideInlineSearch;

  function addGridProductToCart(p: GridCardProduct) {
    const displayPrice = generalSellingPrice(p.price, p.itemEmballage);
    const itemEmballageForCart = normalizeItemEmballageForCart(p.itemEmballage);
    const imageUrlForCart = getProductImageSrc(
      p as Record<string, unknown>,
      "/placeholder.svg?height=300&width=300",
    );
    const catalogCode = catalogCodeOf(p);
    const needsRx =
      Boolean(p.requiresPrescription ?? p.requires_prescription) ||
      (categoryId === "pharmacy" && looksLikeRxRequiredName(p.name));
    addOrInc(
      {
        id: p.id,
        itemCode: catalogCode || p.id,
        name: p.name,
        price: displayPrice,
        unit: p.unit?.toString(),
        image: imageUrlForCart,
        image_url: p.image_url,
        item_image_url: p.item_image_url,
        IMAGE_URL: p.IMAGE_URL,
        item_key_words: p.item_key_words || catalogCode,
        famille: p.famille,
        supplierId: (p.supplierId || "unknown").toString().trim(),
        supplierName: p.supplierName || "Supplier",
        supplierLocation: p.supplierLocation,
        momo: p.momo,
        selectedUnit: p.unit?.toString(),
        ...(itemEmballageForCart ? { itemEmballage: itemEmballageForCart } : {}),
        ...(needsRx ? { requiresPrescription: true } : {}),
      },
      1,
    );
  }

  return (
    <>
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        {!slimCategoryItemHeader && (
          <div>
            <h1 className="text-2xl font-bold text-foreground">{categoryName}</h1>
            {browseMode === "item" ? (
              <div className="mt-1 space-y-1">
                <p className="text-sm text-muted-foreground">
                  {t("categoryBrowseAllItemsInSector" as TranslationKey)} —{" "}
                  <span className="font-semibold text-foreground">{filteredProducts.length}</span>{" "}
                  product{filteredProducts.length !== 1 ? "s" : ""}
                  {searching && effectiveSearchQuery.trim() ? " (searching…)" : ""}
                </p>
                {hideInlineSearch && (
                  <p className="text-xs text-muted-foreground pt-1 border-t border-border/60 mt-2">
                    {t("categoryBrowseUseHeaderSearchProducts" as TranslationKey)}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">
                {selectedSupplier === "all" ? "All Suppliers" : selectedSupplierName} — {filteredProducts.length}{" "}
                product{filteredProducts.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        )}

        {!slimCategoryItemHeader && (
          <div className="flex flex-col sm:flex-row gap-3">
            {!hideInlineSearch && (
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder={`Search ${categoryName} products or suppliers…`}
                  value={searchQuery}
                  onChange={(e) => {
                    console.log("[ProductGrid] Search input changed:", e.target.value);
                    setSearchQuery(e.target.value);
                  }}
                  className="pl-10 pr-10"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-blue-600" />
                )}
              </div>
            )}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className={cn("w-full", "sm:w-[200px]")}>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="featured">Featured</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="rating">Highest Rated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {slimCategoryItemHeader && (
          <div className="flex justify-end">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="featured">Featured</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="rating">Highest Rated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

            {browseMode === "item" && !effectiveSearchQuery.trim() && familleOptions.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground shrink-0">
                  {t("categoryBrowseFamily" as TranslationKey)}:
                </span>
                <button
                  type="button"
                  onClick={() => setFamilleFilter(null)}
                  className={cn(
                    "px-3 py-1 rounded-full border text-xs font-medium transition-colors",
                    familleFilter == null
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted border-border"
                  )}
                >
                  {t("categoryBrowseFamilyAny" as TranslationKey)}
                </button>
                {familleOptions.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFamilleFilter(f)}
                    className={cn(
                      "px-3 py-1 rounded-full border text-xs font-medium transition-colors max-w-[200px] truncate",
                      familleFilter === f
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-muted border-border"
                    )}
                    title={f}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}

            {suppliers.length > 0 && !slimCategoryItemHeader && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Store className="h-4 w-4 flex-shrink-0" />
                <span>
                  {suppliers.length} supplier{suppliers.length !== 1 ? "s" : ""} with products
                </span>
              </div>
            )}
      </div>

      {loading && <div className="text-center py-12 text-muted-foreground">Loading products…</div>}
      {error && <div className="text-center py-12 text-destructive">Failed to load products: {error}</div>}

      {!loading && !error && searching && effectiveSearchQuery.trim() && filteredProducts.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          <p>Searching for &quot;{effectiveSearchQuery}&quot;…</p>
        </div>
      )}

      {!loading && !error && !(searching && filteredProducts.length === 0) && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {displayedProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                pharmacyErx={categoryId === "pharmacy"}
              />
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {effectiveSearchQuery
                  ? `No products found matching "${effectiveSearchQuery}"`
                  : "No products available"}
              </p>
            </div>
          )}

          {displayCount < filteredProducts.length && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                size="lg"
                onClick={() =>
                  setDisplayCount((prev) => Math.min(prev + loadMoreStep, filteredProducts.length))
                }
              >
                Load More Products ({filteredProducts.length - displayCount} remaining)
              </Button>
            </div>
          )}
        </>
      )}
    </div>
    <ProductQuickView
      product={quickViewProduct ? gridProductToQuickView(quickViewProduct) : null}
      open={quickViewOpen}
      onOpenChange={setQuickViewOpen}
      onAddToCart={() => {
        if (!quickViewProduct) return;
        addGridProductToCart(quickViewProduct);
        toast({ title: "Added to cart", description: quickViewProduct.name, duration: 2000 });
        setQuickViewOpen(false);
      }}
    />
    </>
  );
}
