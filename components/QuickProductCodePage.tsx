"use client"

import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { useCartStore } from "@/lib/cart-store";
import { useFavoritesStore } from "@/lib/favorites-store";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import Image from "next/image";

type QuickProductItem = {
  item_emballage?: string;
  selling_price?: number | string;
  cost_price?: number | string;
  /** Currency from account_signup for this supplier (e.g. RWF, USD). */
  currency?: string;
  item_commercial_name?: string;
  item_code?: string;
  item_packet?: string;
  supplier_account?: string;
  supplier_name?: string;
  supplier_location?: string;
  image?: string;
  momo?: string;
};

type QuickProductResult = {
  products?: QuickProductItem[];
  totalProducts?: number;
  totalSuppliers?: number;
};

export default function QuickProductCodePage() {
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<QuickProductResult | null>(null);
  const [error, setError] = useState('');
  const [searchCode, setSearchCode] = useState('');
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  const addItem = useCartStore((s) => s.addItem);
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);
  const isFavorite = useFavoritesStore((s) => s.isFavorite);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let codeFromUrl = params.get('quick_product_code') ?? '';
    let accountFromUrl = params.get('account') ?? '';

    // If someone used ? instead of & (e.g. ?quick_product_code=CODE?account=ACC), the code param gets the whole string
    if (codeFromUrl.includes('?')) {
      const [codePart, rest] = codeFromUrl.split('?', 2);
      codeFromUrl = (codePart ?? '').trim();
      if (rest && rest.startsWith('account=')) {
        accountFromUrl = rest.replace(/^account=/, '').trim();
      }
    }

    if (!codeFromUrl) {
      setError('No product code provided in URL');
      setLoading(false);
      return;
    }

    setSearchCode(codeFromUrl);
    performSearch(codeFromUrl, accountFromUrl);
  }, []);

  useEffect(() => {
    setBrokenImages({});
  }, [results, searchCode]);

  const performSearch = async (code: string, account?: string) => {
    setLoading(true);
    setError('');
    setResults(null);

    try {
      let url = `/api/fetchSuggestions?quick_product_code=${encodeURIComponent(code)}&Currency=RWF`;
      if (account && account.trim() !== '') {
        url += `&account=${encodeURIComponent(account.trim())}`;
      }
      const response = await fetch(url);
      const data = await response.json();

      if (data.ok && data.products && data.products.length > 0) {
        setResults(data as QuickProductResult);
      } else {
        const msg = account?.trim()
          ? `No products found for code "${code}" at pharmacy ${account}`
          : `No products found for code "${code}"`;
        setError(msg);
      }
    } catch (err: unknown) {
      setError(`Failed to search: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  /** Price from selling_price only (no fallback to item_emballage). */
  const getPrice = (product: QuickProductItem): number => {
    if (typeof product.selling_price === 'number' && Number.isFinite(product.selling_price)) return product.selling_price;
    if (product.selling_price != null) {
      const n = parseFloat(String(product.selling_price).replace(/[^0-9.]/g, ''));
      if (!isNaN(n)) return n;
    }
    return 0;
  };

  /** Currency from account_signup (product.currency). */
  const getCurrency = (product: QuickProductItem) => product.currency || 'RWF';

  /** Display: selling_price with currency concatenated (from account_signup). */
  const formatPrice = (product: QuickProductItem) => {
    const price = getPrice(product);
    const curr = getCurrency(product);
    return price > 0 ? `${Number(price).toLocaleString()} ${curr}` : '—';
  };

  const handleAddToCart = (product: QuickProductItem) => {
    const price = getPrice(product);
    const unit = product.item_packet || 'Unit';
    const productId = `${product.supplier_account ?? ""}_${product.item_code ?? ""}`;

    addItem(
      {
        id: productId,
        name: product.item_commercial_name ?? "Product",
        price: price,
        unit: unit,
        image: product.image || "/placeholder.svg?height=300&width=300",
        supplierId: product.supplier_account || "unknown",
        supplierName: product.supplier_name || "Supplier",
        supplierLocation: product.supplier_location,
        momo: product.momo,
        selectedUnit: unit,
        itemCode: product.item_code,
        item_key_words: product.item_code,
      },
      1
    );

    toast({
      title: "Added to cart!",
      description: product.item_commercial_name ?? "Product",
      duration: 2000,
    });

    setTimeout(() => {
      router.push("/cart");
    }, 500);
  };

  const handleToggleFavorite = (e: React.MouseEvent, product: QuickProductItem) => {
    e.preventDefault();
    e.stopPropagation();

    const price = getPrice(product);
    const productId = `${product.supplier_account ?? ""}_${product.item_code ?? ""}`;
    const wasFav = isFavorite(productId);

    toggleFavorite({
      id: productId,
      name: product.item_commercial_name ?? "Product",
      price: price,
      unit: product.item_packet,
      image: product.image || "/placeholder.svg?height=300&width=300",
      description: undefined,
      supplierId: product.supplier_account,
      supplierName: product.supplier_name,
      supplierLocation: product.supplier_location,
      momo: product.momo,
    });

    toast({
      title: wasFav ? "Removed from favorites" : "Added to favorites!",
      description: product.item_commercial_name ?? "Product",
      duration: 1500,
    });
  };

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading products...</p>
        </div>
      </div>
    );
  }

  // Error State
  if (error && !results) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-lg text-muted-foreground mb-4">{error}</p>
          <button
            onClick={() => window.location.href = '/'}
            className="px-6 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  // Results View
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold mb-2">
            All Suppliers — {results?.totalProducts || 0} products
          </h1>
          <p className="text-sm text-muted-foreground">
            {results?.totalSuppliers || 0} suppliers with products
          </p>
        </div>

        {/* Products Grid */}
        {results?.products && results.products.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
            {results.products.map((product: QuickProductItem, idx: number) => {
              const productId = `${product.supplier_account ?? ""}_${product.item_code ?? ""}`;
              const fav = isFavorite(productId);
              const imgSrc = brokenImages[productId]
                ? "/placeholder.svg?height=300&width=300"
                : (product.image || "/placeholder.svg?height=300&width=300");

              return (
                <div
                  key={idx}
                  className="group bg-card border rounded-lg overflow-hidden hover:shadow-lg transition-all"
                >
                  {/* Product Image with Heart */}
                  <div className="relative w-full aspect-square bg-muted">
                    <Image
                      fill
                      src={imgSrc}
                      alt={product.item_commercial_name ?? "Product"}
                      className="object-contain"
                      onError={() => {
                        setBrokenImages((prev) => ({ ...prev, [productId]: true }));
                      }}
                    />

                    {/* Heart Button */}
                    <button
                      onClick={(e) => handleToggleFavorite(e, product)}
                      className={cn(
                        "absolute right-2 top-2 h-8 w-8 flex items-center justify-center rounded-full border bg-white/90 backdrop-blur transition",
                        "hover:bg-white",
                        fav ? "text-red-600" : "text-muted-foreground"
                      )}
                      aria-label={fav ? "Remove from favorites" : "Add to favorites"}
                    >
                      <Heart className={cn("h-4 w-4", fav && "fill-current")} />
                    </button>
                  </div>

                  {/* Product Info */}
                  <div className="p-3 space-y-2">
                    {/* Product Name */}
                    <h3 className="font-semibold text-sm leading-tight line-clamp-2 min-h-[2.5rem]">
                      {product.item_commercial_name}
                    </h3>

                    {/* Quality product tag */}
                    <p className="text-xs text-muted-foreground">
                      Quality product
                    </p>

                    {/* Price: selling_price + currency from account_signup */}
                    <div className="text-lg font-bold">
                      {formatPrice(product)}
                    </div>

                    {/* Supplier / Seller name — visible like main ihute display */}
                    <div className="text-sm border-t border-border/50 pt-2 mt-2">
                      <span className="text-muted-foreground">Supplier: </span>
                      <span className="font-medium text-foreground">
                        {product.supplier_name || product.supplier_account || "—"}
                      </span>
                      {product.supplier_location && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {product.supplier_location}
                        </div>
                      )}
                    </div>

                    {/* Buy Button */}
                    <button
                      onClick={() => handleAddToCart(product)}
                      className="w-full mt-2 py-2 bg-[#1a3a52] text-white rounded hover:bg-[#1a3a52]/90 transition-colors font-medium text-sm"
                    >
                      Buy
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}