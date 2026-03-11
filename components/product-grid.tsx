"use client";

import { useEffect, useMemo, useState } from "react";
import { ProductCard } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search, Store, Loader2 } from "lucide-react";
import { filterProductsByRelevance, filterSuppliersByRelevance } from "@/lib/search-utils";

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
  image?: string;
  // ✅ we’ll keep category info if backend provides it (type/sector/category)
  type?: string;
  sector?: string;
  category?: string;
  momo?: string;
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
  return {
    item_commercial_name: p.item_commercial_name ?? p.ITEM_NAME ?? p.name ?? "Product",
    item_packet: p.item_packet ?? p.UNIT ?? p.pack ?? "",
    item_emballage: p.item_emballage ?? "",
    selling_price: p.selling_price,
    cost_price: p.cost_price,
    currency: p.currency,
    item_key_words: p.item_key_words ?? p.DESCRIPTION_KEYWORD ?? "",
    item_seller_account:
      p.item_seller_account ??
      p.seller_account ??
      p.SELLER_ISHYIGA_ACCOUNT ??
      fallbacks?.account ??
      "",
    supplier_name: p.supplier_name ?? p.SELLER_NAMES ?? fallbacks?.sellerName ?? "",
    supplier_location: p.supplier_location ?? p.LOCATION ?? fallbacks?.sellerLoc ?? "",
    image: p.image ?? p.image_url ?? p.item_image_url ?? p.IMAGE_URL ?? undefined,
    momo: p.momo,
    // keep any server-provided category hint
    type: p.type ?? p.TYPE ?? undefined,
    sector: p.sector ?? p.SECTOR ?? undefined,
    category: p.category ?? p.CATEGORY ?? undefined,
  };
}

export function ProductGrid({
  categoryId,
  categoryName,
  selectedSupplier = "all",
  selectedSupplierName = "All Suppliers",
}: {
  categoryId: string;
  categoryName: string;
  selectedSupplier?: string;
  selectedSupplierName?: string;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("featured");
  const [displayCount, setDisplayCount] = useState(12);
  const [serverProducts, setServerProducts] = useState<ServerProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [globalSearchResults, setGlobalSearchResults] = useState<ServerProduct[]>([]);

  function getApiBase() {
    // Always use empty string to make relative calls to Next.js API routes
    return "";
  }

  // reset search & pagination when the supplier changes
  useEffect(() => {
    setSearchQuery("");
    setDisplayCount(12);
    setGlobalSearchResults([]);
  }, [selectedSupplier]);

  // Global search with debounce - searches both PRODUCTS and SUPPLIERS in this category
  useEffect(() => {
    if (!searchQuery.trim()) {
      setGlobalSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timeoutId = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          globalSearch: searchQuery.trim(),
          sector: categoryId, // Filter to current category only
          limit: "100",
          Currency: "RWF",
        });

        const res = await fetch(`/api/fetchSuggestions?${params}`, {
          cache: "no-store"
        });

        if (!res.ok) throw new Error("Search failed");

        const json = await res.json();

        // Get products from the search
        const products = json.products || [];

        console.log(`[ProductGrid Search] Query: "${searchQuery}" in ${categoryId}`);
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
          searchQuery.trim(),
          8 // Lower threshold for more results
        );

        console.log(`[ProductGrid Search] ${filteredSuppliers.length} suppliers after relevance filtering`);

        // For each supplier, fetch their products in this category
        const allProducts: any[] = [];

        // Add direct product matches (already category-filtered)
        const filteredProducts = filterProductsByRelevance(categoryFilteredProducts, searchQuery.trim(), 10);
        allProducts.push(...filteredProducts);

        // Fetch products from matching suppliers
        for (const supplier of filteredSuppliers) {
          const supplierAccount = supplier.supplier_account || supplier.SELLER_ISHYIGA_ACCOUNT;
          if (!supplierAccount) continue;

          try {
            const supplierRes = await fetch(
              `/api/fetchSuggestions?supplierProducts=${encodeURIComponent(supplierAccount)}&limit=20&Currency=RWF`,
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
  }, [searchQuery, categoryId]);

  useEffect(() => {
    let isMounted = true;

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const base = getApiBase();

        if (selectedSupplier === "all") {
          // show random products from sellers in this category
          const res = await fetch(
            `${base}/api/fetchSuggestions?listSuppliersWithProducts=${encodeURIComponent(categoryId)}&Currency=RWF`,
            { cache: "no-store" }
          );
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const sellers = (await res.json()) as Array<any>;

          const products: ServerProduct[] = [];
          for (const s of sellers || []) {
            const sellerAccount =
              s.seller_account ?? s.SELLER_ISHYIGA_ACCOUNT ?? s.seller_ishyiga_account ?? "";
            const sellerName = s.seller_name ?? s.SELLER_NAMES ?? "";
            const sellerLoc = s.seller_location ?? s.LOCATION ?? "";

            for (const p of s.products || []) {
              products.push(normalizeProduct(p, { account: sellerAccount, sellerName, sellerLoc }));
            }
          }
          products.sort(() => Math.random() - 0.5);
          if (!isMounted) return;
          setServerProducts(products);
        } else {
          // ONLY the selected supplier's items
          const res = await fetch(
            `${base}/api/fetchSuggestions?supplierProducts=${encodeURIComponent(selectedSupplier)}&limit=50&Currency=RWF`,
            { cache: "no-store" }
          );
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const raw = (await res.json()) as Array<any>;
          const items = (Array.isArray(raw) ? raw : []).map((p) =>
            normalizeProduct(p, { account: selectedSupplier, sellerName: selectedSupplierName })
          );
          if (!isMounted) return;
          setServerProducts(items);
        }

        setDisplayCount(12);
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
  }, [categoryId, selectedSupplier, selectedSupplierName]);

  const allProducts = useMemo(() => {
    // Use global search results if searching, otherwise use server products
    const sourceProducts = searchQuery.trim() ? globalSearchResults : serverProducts;

    return (sourceProducts || []).map((p, idx) => {
      const firstCategoryHint =
        toRouteCategoryId(p.type) ||
        toRouteCategoryId(p.sector) ||
        toRouteCategoryId(p.category);

      return {
        id: `${categoryId}-${idx}`,
        name: p.item_commercial_name || "Product",
        description: undefined,
        price: extractNumericPrice(p.selling_price),
        currency: p.currency || "RWF",
        unit: p.item_packet,
        inStock: true,
        rating: 4,
        supplierId: p.item_seller_account,
        supplierName: p.supplier_name || p.item_seller_account || "Supplier",
        supplierLocation: p.supplier_location,
        image: p.image || "/placeholder.svg?height=300&width=300",
        momo: p.momo,
        _routeCategory: firstCategoryHint,
      };
    });
  }, [serverProducts, globalSearchResults, searchQuery, categoryId]);

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

  const filteredProducts = useMemo(() => {
    let items = allProducts;

    // filter by supplier if chosen
    if (selectedSupplier !== "all") {
      items = items.filter((p) => p.supplierId === selectedSupplier);

      // If supplierProducts includes category hints, keep only items in the current category
      if (items.some((p) => !!p._routeCategory)) {
        items = items.filter((p) => p._routeCategory === categoryId);
      }
    }

    // No need for local text filtering - global search handles it with multilingual support

    // sort
    switch (sortBy) {
      case "price-low":
        items = [...items].sort((a, b) => a.price - b.price);
        break;
      case "price-high":
        items = [...items].sort((a, b) => b.price - a.price);
        break;
      case "rating":
        items = [...items].sort((a, b) => b.rating - a.rating);
        break;
      // "newest" not available (no timestamp in payload) -> fall through to "featured"
      // "featured" keeps original order from server/randomization
    }

    return items;
  }, [allProducts, selectedSupplier, sortBy, categoryId]);

  const displayedProducts = filteredProducts.slice(0, displayCount);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{categoryName}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {selectedSupplier === "all" ? "All Suppliers" : selectedSupplierName} — {filteredProducts.length} product
            {filteredProducts.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder={`Search ${categoryName} products or suppliers…`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10"
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-blue-600" />
            )}
          </div>
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

        {suppliers.length > 0 && (
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

      {!loading && !error && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {displayedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {searchQuery ? `No products found matching "${searchQuery}"` : "No products available"}
              </p>
            </div>
          )}

          {displayCount < filteredProducts.length && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setDisplayCount((prev) => Math.min(prev + 12, filteredProducts.length))}
              >
                Load More Products ({filteredProducts.length - displayCount} remaining)
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
