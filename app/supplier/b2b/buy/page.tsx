"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  MapPin,
  Package,
  DollarSign,
  Filter,
  ArrowLeft,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { searchB2B, B2BProduct, B2BApiError, submitQuickBuy } from "@/lib/b2bApi";

interface CartItem {
  product: B2BProduct;
  requestedQty: number;
}

export default function B2BQuickBuyPage() {
  const router = useRouter();
  const { user, isAuthenticated, hasHydrated } = useAuthStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [products, setProducts] = useState<B2BProduct[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"relevance" | "cheapest" | "stock">("relevance");
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [limit] = useState(20);

  useEffect(() => {
    // CRITICAL: Wait for auth store to rehydrate from localStorage
    if (!hasHydrated) {
      return; // Don't check auth yet - store is still loading
    }

    console.log("Buy page auth check:", { isAuthenticated, user, userRole: user?.role });
    if (!isAuthenticated || (user?.role as string) !== "supplier") {
      console.log("Redirecting to login - auth failed");
      router.push("/login");
      return; // CRITICAL: Exit immediately after redirect
    }

    // Periodic session check every 30 seconds
    const interval = setInterval(() => {
      const { isAuthenticated: currentAuth, user: currentUser } = useAuthStore.getState();
      if (!currentAuth || (currentUser?.role as string) !== "supplier") {
        console.log("Session expired - redirecting to login");
        router.push("/login");
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [hasHydrated, isAuthenticated, user?.role, router]); // Use user?.role instead of user object

  // Search-as-you-type: Auto-search after 500ms of no typing
  useEffect(() => {
    if (!searchQuery.trim()) {
      // Clear results when search is empty
      setProducts([]);
      setSearchPerformed(false);
      setTotalCount(0);
      return;
    }

    // Debounce: wait 500ms before searching
    const timer = setTimeout(() => {
      handleSearch(1);
    }, 500);

    // Cleanup: cancel previous timer if user keeps typing
    return () => clearTimeout(timer);
  }, [searchQuery, sortBy]); // Re-search when query or sort changes

  const handleSearch = async (page: number = 1) => {
    if (!searchQuery.trim()) {
      return;
    }

    setLoading(true);
    setError(null);
    setSearchPerformed(true);
    setCurrentPage(page);

    try {
      const data = await searchB2B({
        q: searchQuery,
        sort: sortBy,
        page: page,
        limit: limit,
      });

      setProducts(data.products || []);
      setTotalCount(data.total || 0);
    } catch (err: any) {
      console.error("Search error:", err);
      if (err instanceof B2BApiError) {
        if (err.status === 401) {
          router.push("/login");
          return;
        }
        setError(err.message);
      } else {
        setError("Search failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product: B2BProduct, qty: number = 1) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);

      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, requestedQty: item.requestedQty + qty }
            : item
        );
      } else {
        return [...prev, { product, requestedQty: qty }];
      }
    });
  };

  const updateCartQty = (productId: number, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(productId);
    } else {
      setCart((prev) =>
        prev.map((item) =>
          item.product.id === productId
            ? { ...item, requestedQty: newQty }
            : item
        )
      );
    }
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const calculateTotal = () => {
    return cart.reduce(
      (sum, item) => sum + item.product.price * item.requestedQty,
      0
    );
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      alert("Cart is empty");
      return;
    }

    const total = calculateTotal();
    const itemCount = cart.reduce((sum, item) => sum + item.requestedQty, 0);

    // Confirm with user
    const confirmed = confirm(
      `Quick Buy Order Summary:\n` +
      `• ${itemCount} items from ${cart.length} product(s)\n` +
      `• Total: ${total.toLocaleString()} RWF\n\n` +
      `Order will be split by supplier automatically.\n\n` +
      `Submit this order?`
    );

    if (!confirmed) return;

    setLoading(true);
    setError(null);

    try {
      // Convert cart to API format
      const items = cart.map(item => ({
        productId: item.product.id,
        quantity: item.requestedQty,
      }));

      const result = await submitQuickBuy(items);

      // Success! Clear cart and redirect
      setCart([]);
      alert(
        `✅ Order Sent Successfully!\n\n` +
        `Parent Order ID: ${result.parentOrderId}\n` +
        `Child Orders: ${result.childOrders.length}\n\n` +
        `${result.message}`
      );

      // Redirect to outgoing orders
      router.push("/supplier/b2b/outgoing");
    } catch (err: any) {
      console.error("Checkout error:", err);
      if (err instanceof B2BApiError) {
        if (err.status === 401) {
          router.push("/login");
          return;
        }
        setError(err.message);
      } else {
        setError("Order submission failed. Please try again.");
      }
      alert(`❌ Order submission failed:\n${err.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const cartItemCount = cart.reduce((sum, item) => sum + item.requestedQty, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b shadow-sm mb-6">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/supplier/b2b">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to B2B
              </Button>
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Quick Buy / Kurangura vuba</h1>
          <p className="text-slate-600 mt-2">
            Search for products from other live sellers and add to cart
          </p>
        </div>
      </div>

      <div className="container mx-auto px-6 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Search Section */}
          <div className="lg:col-span-2 space-y-6">
            {/* Search Bar */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                      type="text"
                      placeholder="Search by item name, code, or keywords..."
                      className="pl-10"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    />
                  </div>
                  <Button onClick={handleSearch} disabled={loading} className="gap-2">
                    <Search className="h-4 w-4" />
                    Search
                  </Button>
                </div>

                {/* Filters */}
                <div className="mt-4 flex items-center gap-4">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Filter className="h-4 w-4" />
                    <span>Sort by:</span>
                  </div>
                  <div className="flex gap-2">
                    {["relevance", "cheapest", "stock"].map((sort) => (
                      <Button
                        key={sort}
                        variant={sortBy === sort ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setSortBy(sort as any);
                          if (searchPerformed) handleSearch();
                        }}
                      >
                        {sort.charAt(0).toUpperCase() + sort.slice(1)}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Error Display */}
            {error && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="py-4">
                  <div className="flex items-center gap-2 text-red-800">
                    <AlertCircle className="h-5 w-5" />
                    <span className="font-medium">Search Error</span>
                  </div>
                  <p className="text-red-700 text-sm mt-1">{error}</p>
                </CardContent>
              </Card>
            )}

            {/* Search Results */}
            {loading && (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-slate-600 mt-4">Searching across all sellers...</p>
              </div>
            )}

            {!loading && searchPerformed && products.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Package className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600 text-lg">No products found</p>
                  <p className="text-slate-500 text-sm mt-2">
                    Try different keywords or check your spelling
                  </p>
                </CardContent>
              </Card>
            )}

            {!loading && products.length > 0 && (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  Showing {((currentPage - 1) * limit) + 1}-{Math.min(currentPage * limit, totalCount)} of {totalCount} product(s)
                </p>

                {products.map((product) => {
                  const inCart = cart.find((item) => item.product.id === product.id);

                  return (
                    <Card key={`${product.id}-${product.itemCode}`} className="hover:shadow-lg transition-shadow">
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg text-slate-900">
                              {product.itemName}
                            </h3>
                            <p className="text-sm text-slate-500 mt-1">
                              Code: {product.itemCode}
                            </p>

                            <div className="flex items-center gap-4 mt-3 text-sm">
                              <div className="flex items-center gap-1 text-slate-600">
                                <DollarSign className="h-4 w-4" />
                                <span className="font-semibold">
                                  {product.price.toLocaleString()} RWF
                                </span>
                                <span className="text-slate-500">/ {product.unit}</span>
                              </div>

                              <div className="flex items-center gap-1 text-slate-600">
                                <Package className="h-4 w-4" />
                                <span>Stock: {product.quantity}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 mt-3 text-sm">
                              <MapPin className="h-4 w-4 text-slate-400" />
                              <span className="text-slate-600">
                                {product.sellerName} • {product.location || "Location not set"}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-2">
                            {inCart ? (
                              <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  onClick={() =>
                                    updateCartQty(product.id, inCart.requestedQty - 1)
                                  }
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                                <span className="font-semibold min-w-[30px] text-center">
                                  {inCart.requestedQty}
                                </span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  onClick={() =>
                                    updateCartQty(product.id, inCart.requestedQty + 1)
                                  }
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => addToCart(product)}
                                className="gap-2"
                              >
                                <Plus className="h-4 w-4" />
                                Add to Cart
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {/* Pagination Controls */}
                {totalCount > limit && (
                  <div className="flex items-center justify-between pt-4">
                    <Button
                      variant="outline"
                      onClick={() => handleSearch(currentPage - 1)}
                      disabled={currentPage === 1 || loading}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-slate-600">
                      Page {currentPage} of {Math.ceil(totalCount / limit)}
                    </span>
                    <Button
                      variant="outline"
                      onClick={() => handleSearch(currentPage + 1)}
                      disabled={currentPage >= Math.ceil(totalCount / limit) || loading}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cart Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  B2B Cart ({cartItemCount})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {cart.length === 0 ? (
                  <div className="text-center py-8">
                    <ShoppingCart className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-500 text-sm">Cart is empty</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="max-h-[400px] overflow-y-auto space-y-3">
                      {cart.map((item) => (
                        <div
                          key={item.product.id}
                          className="border border-slate-200 rounded-lg p-3"
                        >
                          <div className="flex justify-between items-start gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-slate-900 truncate">
                                {item.product.itemName}
                              </p>
                              <p className="text-xs text-slate-500 truncate">
                                {item.product.sellerName}
                              </p>
                            </div>
                            <button
                              onClick={() => removeFromCart(item.product.id)}
                              className="text-red-500 hover:text-red-700 text-xs"
                            >
                              Remove
                            </button>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 w-7 p-0"
                                onClick={() =>
                                  updateCartQty(item.product.id, item.requestedQty - 1)
                                }
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="text-sm font-medium min-w-[30px] text-center">
                                {item.requestedQty}
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 w-7 p-0"
                                onClick={() =>
                                  updateCartQty(item.product.id, item.requestedQty + 1)
                                }
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="text-sm font-semibold text-slate-900">
                              {(item.product.price * item.requestedQty).toLocaleString()} RWF
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center mb-4">
                        <span className="font-semibold text-slate-900">Total:</span>
                        <span className="text-xl font-bold text-slate-900">
                          {calculateTotal().toLocaleString()} RWF
                        </span>
                      </div>

                      <Button
                        className="w-full"
                        onClick={handleCheckout}
                        disabled={cart.length === 0}
                      >
                        Create B2B Order
                      </Button>

                      <p className="text-xs text-slate-500 text-center mt-2">
                        Order will be split by supplier automatically
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
