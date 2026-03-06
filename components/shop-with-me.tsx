"use client";

import { useEffect, useState } from "react";
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
  User,
} from "lucide-react";
import Image from "next/image";
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
import { useCartStore } from "@/lib/cart-store";
import { useFavoritesStore } from "@/lib/favorites-store";
import { trackProductView, trackClick } from "@/lib/interaction-tracker";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

type ShopWithMeProduct = {
  item_name?: string;
  item_commercial_name?: string;
  /** item_packet = quantity (available stock), not unit */
  item_packet?: string | number;
  item_emballage?: string;
  selling_price?: number | string;
  cost_price?: number | string;
  /** Currency from account_signup for this supplier. */
  currency?: string;
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
};

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

function extractNumericPrice(value: any): number {
  if (typeof value === "number") return value;
  const n = String(value ?? "").replace(/[^\d.,]/g, "").replace(",", ".");
  const parsed = parseFloat(n);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Single item code from API. Prefer ITEM_CODE (backend catalog) so order creation finds the item; fallback to item_code then item_key_words. */
function getItemCode(product: ShopWithMeProduct): string {
  const p = product as Record<string, unknown>;
  return String(p.ITEM_CODE ?? p.item_code ?? p.item_key_words ?? "").trim() || "";
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
          const img = (item as Record<string, unknown>).image_url ?? (item as Record<string, unknown>).item_image_url ?? (item as Record<string, unknown>).image;
        flatProducts.push({
            ...item,
            OWNER: item.OWNER ?? (p as ShopWithMeProduct).OWNER ?? seller.OWNER,
            stock,
            in_stock: stock > 0,
            currency: currency || undefined,
            famille: fam != null ? String(fam) : undefined,
            image: typeof img === "string" ? img : undefined,
          });
        }
      } else {
        const flatP = p as ShopWithMeProduct;
        const currency = flatP.currency || (seller as ShopWithMeSeller).currency;
        const fam = (p as Record<string, unknown>).famille ?? (p as Record<string, unknown>).FAMILLE ?? flatP.famille;
        const img = (p as Record<string, unknown>).image_url ?? (p as Record<string, unknown>).item_image_url ?? flatP.image;
        flatProducts.push({
          ...flatP,
          currency: currency || flatP.currency,
          famille: fam != null ? String(fam) : flatP.famille,
          image: typeof img === "string" ? img : flatP.image,
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

export default function ShopWithMePage() {
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
  const [debouncedProductSearch, setDebouncedProductSearch] = useState("");
  const [sortBy, setSortBy] = useState("featured");
  const [categories, setCategories] = useState<CategorySection[]>([]);

  const cartItems = useCartStore((s) => s.items);
  const cartItemCount = cartItems.reduce((sum, item) => sum + item.qty, 0);
  const setTableInfo = useCartStore((s) => s.setTableInfo);
  const clearTableInfo = useCartStore((s) => s.clearTableInfo);

  // Debounce product search so we hit the backend with the query
  useEffect(() => {
    const t = setTimeout(() => setDebouncedProductSearch(productSearchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [productSearchQuery]);

  // Fetch shop from backend when nickname or product search changes (search hits backend, not just client filter)
  useEffect(() => {
    if (!nicknameFromUrl?.trim()) return;
    let cancelled = false;
    const normalizedNickname = nicknameFromUrl.trim().toLowerCase();
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ nickname: normalizedNickname });
    if (debouncedProductSearch) params.set("productSearch", debouncedProductSearch);
    fetch(`/api/shop-with-me?${params.toString()}`, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch shop data`);
        return res.json();
      })
      .then((data: ShopWithMeResponse) => {
        if (cancelled) return;
        if (!data.ok) throw new Error("Shop not found");
        if (data.sellers && data.sellers.length > 0) {
          setSellers(normalizeSellersProducts(data.sellers));
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

  // Pre-fill customer/table from URL (table=table%204, customer=..., address=...)
  useEffect(() => {
    if (customerFromQuery?.trim()) setCustomerName(customerFromQuery.trim());
    if (addressFromQuery?.trim()) setCustomerAddress(addressFromQuery.trim());
    if (tableFromQuery?.trim()) {
      if (!customerFromQuery?.trim()) setCustomerName(tableFromQuery.trim());
      if (!addressFromQuery?.trim()) setCustomerAddress(tableFromQuery.trim());
    }
  }, [customerFromQuery, addressFromQuery, tableFromQuery]);

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
        setSellers(normalizeSellersProducts(data.sellers));
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

  const currentSeller = selectedSeller ? sellers.find((s) => s.ISHYIGA_ACCOUNT === selectedSeller) : null;

  const preferred = currentSeller?.PREFERRED_CATEGORIES?.toLowerCase() || "";
  const department = currentSeller?.DEPARTMENT?.toLowerCase() || "";
  const isBarOrRestaurant =
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
    const categoryOrder = ["Food", "Wine", "Beer", "Spirits", "Beverages", "Bakery", "Snacks", "Other"];

    const orderedNames = Array.from(categoryMap.keys()).sort((a, b) => {
      const ai = categoryOrder.indexOf(a);
      const bi = categoryOrder.indexOf(b);
      if (ai >= 0 && bi >= 0) return ai - bi;
      if (ai >= 0) return -1;
      if (bi >= 0) return 1;
      return a.localeCompare(b);
    });

    orderedNames.forEach((categoryName) => {
      categorySections.push({
        name: categoryName,
        products: categoryMap.get(categoryName)!,
        expanded: true,
      });
    });

    setCategories(categorySections);
  }, [currentSeller]);

  const toggleCategory = (categoryName: string) => {
    setCategories((prev) => prev.map((cat) => (cat.name === categoryName ? { ...cat, expanded: !cat.expanded } : cat)));
  };

  const getFilteredProducts = (products: ShopWithMeProduct[]) => {
    if (!productSearchQuery.trim()) return products;

    const query = productSearchQuery.toLowerCase().trim();
    const terms = query.split(/\s+/).filter(Boolean);

    const matches = products.filter((product) => {
      const name = (product.item_commercial_name || product.item_name || "").toLowerCase();
      const keywords = (product.item_key_words || "").toLowerCase();
      const famille = String((product as Record<string, unknown>).famille ?? (product as Record<string, unknown>).FAMILLE ?? "").toLowerCase();
      const french = ((product as Record<string, unknown>).item_key_words_french as string || "").toLowerCase();
      const kinyarwanda = ((product as Record<string, unknown>).item_key_words_kinyarwanda as string || "").toLowerCase();
      const description = ((product as Record<string, unknown>).item_description as string || (product as Record<string, unknown>).description as string || "").toLowerCase();
      const combined = `${name} ${keywords} ${famille} ${french} ${kinyarwanda} ${description}`;
      return terms.every((term) => combined.includes(term));
    });

    // If nothing matches the text, fall back to showing all products
    return matches.length > 0 ? matches : products;
  };

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
  /** Filtered count (after search) */
  const totalProductCount = categories.reduce((sum, cat) => {
    const filtered = getFilteredProducts(cat.products);
    return sum + filtered.length;
  }, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-shrink-0">
              <Image
                src="/images/ishyiga-logo.png"
                alt="Ishyiga Software"
                width={100}
                height={35}
                className="h-8 w-auto sm:h-9"
              />
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              <Button variant="ghost" size="sm" className="hidden lg:flex">
                <MapPin className="h-4 w-4 mr-1" />
                <span className="hidden xl:inline">Set Location</span>
              </Button>
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

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6 max-w-5xl">
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
                <p className="text-sm text-muted-foreground mt-1">
                  {productSearchQuery.trim()
                    ? `Showing ${totalProductCount} of ${totalItemsFromBackend} item${totalItemsFromBackend !== 1 ? "s" : ""} matching "${productSearchQuery.trim()}"`
                    : `${totalItemsFromBackend} item${totalItemsFromBackend !== 1 ? "s" : ""}`}
                </p>
              </div>

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

            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
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
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  {productSearchQuery.trim()
                    ? `${totalProductCount} of ${totalItemsFromBackend} item${totalItemsFromBackend !== 1 ? "s" : ""}`
                    : `${totalItemsFromBackend} item${totalItemsFromBackend !== 1 ? "s" : ""}`}
                </span>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="featured">Featured</SelectItem>
                    <SelectItem value="price-low">Price: Low to High</SelectItem>
                    <SelectItem value="price-high">Price: High to Low</SelectItem>
                    <SelectItem value="name">Name: A to Z</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                <p className="text-muted-foreground">Loading products...</p>
              </div>
            ) : (
              <div className="space-y-8">
                {categories.map((category) => {
                  const filteredProducts = getFilteredProducts(category.products);
                  const sortedProducts = getSortedProducts(filteredProducts);

                  if (sortedProducts.length === 0) return null;

                  return (
                    <div key={category.name} className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <h2 className="text-xl font-bold">{category.name}</h2>
                          <Badge variant="secondary">{sortedProducts.length}</Badge>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => toggleCategory(category.name)} className="gap-1">
                          {category.expanded ? (
                            <>
                              Show Less <ChevronUp className="h-4 w-4" />
                            </>
                          ) : (
                            <>
                              Show More <ChevronDown className="h-4 w-4" />
                            </>
                          )}
                        </Button>
                      </div>

                      {category.expanded && (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                          {sortedProducts.map((product, idx) => (
                            <ProductCard
                              key={`${category.name}-${idx}`}
                              product={product}
                              ownerName={currentSeller.OWNER || currentSeller.SELLER_NAMES || currentSeller.NICKNAME}
                              supplierId={currentSeller.ISHYIGA_ACCOUNT || ""}
                              isDeliveryShop={isDeliveryShop}
                              isBarOrRestaurant={isBarOrRestaurant}
                              hasTableContext={hasTableContext}
                              customerName={customerName}
                              customerAddress={customerAddress}
                              onCustomerInfoRequired={() => setShowCustomerDialog(true)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {categories.every((cat) => getFilteredProducts(cat.products).length === 0) && (
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
            <DialogTitle>{isBarOrRestaurant ? "Table Information" : "Customer Information"}</DialogTitle>
            <DialogDescription>
              {isBarOrRestaurant
                ? "Provide your table or group name so the bar/restaurant can find you"
                : "Please provide your name and delivery address"}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label htmlFor="customer-name">{isBarOrRestaurant ? "Table / Guest Name *" : "Full Name *"}</Label>
              <Input
                id="customer-name"
                placeholder={isBarOrRestaurant ? "e.g., Table 5 - Friends" : "e.g., John Doe"}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="customer-address">{isBarOrRestaurant ? "Location / Note (optional)" : "Delivery Address *"}</Label>
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
    </div>
  );
}

// Product Card Component
function ProductCard({
  product,
  ownerName,
  supplierId,
  isDeliveryShop,
  isBarOrRestaurant,
  hasTableContext,
  customerName,
  customerAddress,
  onCustomerInfoRequired,
}: {
  product: ShopWithMeProduct;
  ownerName?: string;
  supplierId: string;
  isDeliveryShop: boolean;
  isBarOrRestaurant?: boolean;
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
  // API returns normalized format: item_commercial_name, item_emballage, item_key_words, item_state, famille, item_packet, image_url
  const productName = String(p.item_commercial_name ?? p.item_name ?? p.ITEM_NAME ?? p.ITEM_COMMERCIAL_NAME ?? "").trim() || "Product";
  const priceRaw = p.selling_price ?? p.price ?? p.UNITY_PRICE ?? p.SALE_PRICE_INCLUSIVE;
  const price = extractNumericPrice(priceRaw);
  const rawImageUrl = product.image ?? (p.image_url as string) ?? (p.item_image_url as string) ?? "";
  const imageUrl = typeof rawImageUrl === "string" && rawImageUrl.trim() !== "" ? rawImageUrl.trim() : "";
  const validImage =
    imageUrl &&
    (imageUrl.startsWith("http://") || imageUrl.startsWith("https://") || imageUrl.startsWith("/"));
  const [imgError, setImgError] = useState(false);
  const fav = isFavorite(itemCode);

  useEffect(() => {
    setImgError(false);
  }, [imageUrl]);

  useEffect(() => {
    trackProductView(itemCode, productName, {
      supplierId,
      categoryId: undefined,
    });
  }, [itemCode, productName, supplierId]);

  const handleAddToCart = () => {
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
        image: imageUrl || product.image,
        itemCode,
        supplierId: supplierId,
        supplierName: ownerName || "Supplier",
        supplierLocation: undefined,
        momo: product.momo,
        selectedUnit: "pcs",
        isBarResto: isBarOrRestaurant,
      },
      1
    );

    toast({
      title: "Added to cart",
      description: productName,
      duration: 2000,
    });
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
      image: imageUrl || product.image,
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
      <div className="relative w-full aspect-square bg-muted">
        {validImage && !imgError && /^https?:\/\//i.test(imageUrl) ? (
          <img
            src={imageUrl}
            alt={productName}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
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
          <h3 className="text-sm font-semibold leading-tight line-clamp-2">{productName}</h3>
        </div>

        <p className="text-xs text-muted-foreground">Quality product</p>

        <div className="space-y-0.5">
          <div className="font-bold text-base">
            {price.toLocaleString()} {product.currency || "RWF"}
          </div>
        </div>

        <Button
          size="sm"
          className="mt-1 w-full bg-[#1e3a5f] hover:bg-[#2c4f7c]"
          onClick={handleAddToCart}
        >
          {hasTableContext && (isDeliveryShop || isBarOrRestaurant) && (!customerName || !customerAddress)
            ? isBarOrRestaurant
              ? "Set Table Info"
              : "Add Info to Order"
            : "Buy"}
        </Button>
      </CardContent>
    </Card>
  );
}