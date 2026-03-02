"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Package,
  TrendingUp,
  LogOut,
  AlertTriangle,
  Edit,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
  Share2,
  Copy,
} from "lucide-react";
import Link from "next/link";
import AddProductModal, { ProductFormData } from "@/components/supplier/AddProductModal";

const QRCode = dynamic(() => import("react-qr-code"), { ssr: false });

function SupplierDashboard() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [supplierProducts, setSupplierProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add Product Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductFormData | null>(null);

  // Shop With Me QR (collapsible so it doesn't interrupt the main dashboard)
  const [shopWithMeQROpen, setShopWithMeQROpen] = useState(false);
  const [shopNickname, setShopNickname] = useState("");
  const [isBarOrRestaurant, setIsBarOrRestaurant] = useState(false);
  /** When true, Bar or Restaurant was set from account PREFEREDCATEGORIES and must not be edited */
  const [isBarOrRestaurantFromAccount, setIsBarOrRestaurantFromAccount] = useState(false);
  /** Only show Bar or Restaurant checkbox when PREFEREDCATEGORIES is resto-bar/restaurant/bar */
  const [showBarOrRestaurantOption, setShowBarOrRestaurantOption] = useState(false);
  const [tableNameOrNumber, setTableNameOrNumber] = useState("");
  const [baseUrl, setBaseUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") setBaseUrl(window.location.origin);
  }, []);

  // Only show Bar or Restaurant when PREFEREDCATEGORIES is resto-bar/restaurant/bar
  useEffect(() => {
    if (!user?.ishyigaAccount || user?.role !== "supplier") return;
    fetch(`/api/supplier/profile?account=${encodeURIComponent(user.ishyigaAccount)}`)
      .then((res) => res.json())
      .then((data) => {
        const raw = (data?.preferredCategories ?? "").trim().toLowerCase();
        const isRestoBar =
          raw === "resto-bar" ||
          raw.includes("restaurant") ||
          raw.includes("resto") ||
          raw.includes("bar");
        if (isRestoBar) {
          setShowBarOrRestaurantOption(true);
          setIsBarOrRestaurant(true);
          setIsBarOrRestaurantFromAccount(true);
        }
      })
      .catch(() => {});
  }, [user?.ishyigaAccount, user?.role]);

  const shopWithMeLink = shopNickname.trim()
    ? `${baseUrl}/shop-with-me?nickname=${encodeURIComponent(shopNickname.trim().toLowerCase())}${isBarOrRestaurant && tableNameOrNumber.trim() ? `&table=${encodeURIComponent(tableNameOrNumber.trim())}` : ""}`
    : "";

  const copyShopWithMeLink = () => {
    if (!shopWithMeLink) return;
    navigator.clipboard.writeText(shopWithMeLink).then(() => alert("Link copied to clipboard"));
  };

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "supplier") {
      router.push("/login");
      return;
    }

    if (!user?.ishyigaAccount) {
      setError("No ishyigaAccount found for user");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    fetch(`/api/supplier/stock?account=${user.ishyigaAccount}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        console.log("=== API Response ===");
        console.log("Full data:", data);
        console.log("Products array:", data.products);
        console.log("Count:", data.count);
        console.log("Source:", data.source);

        if (!data.ok) {
          throw new Error(data.error || "API returned ok: false");
        }

        const products = data.products || [];
        console.log(`Received ${products.length} products from ${data.source}`);

        // Helper function to parse integers safely
        const parseIntSafe = (value: any): number => {
          if (typeof value === 'number') return Math.floor(value);
          if (typeof value === 'string') {
            const parsed = parseInt(value.trim());
            return isNaN(parsed) ? 0 : parsed;
          }
          return 0;
        };

        // Helper function to parse Redis price format (e.g., "3000RWF")
        const parsePriceFromRedis = (value: any): number => {
          if (typeof value === 'number') return value;
          if (typeof value === 'string') {
            const cleaned = value.replace(/RWF/gi, '').trim();
            const parsed = parseFloat(cleaned);
            return isNaN(parsed) ? 0 : parsed;
          }
          return 0;
        };

        // Helper function to parse Redis price strings like "1880.0RWF"
        const parsePrice = (value: any): number => {
          if (typeof value === 'number') return value;
          if (typeof value === 'string') {
            // Remove "RWF" and parse
            const cleaned = value.replace(/RWF/gi, '').trim();
            const parsed = parseFloat(cleaned);
            return isNaN(parsed) ? 0 : parsed;
          }
          return 0;
        };

        // Map products - handle Redis format (your format)
        const mappedProducts = products.map((p: any, index: number) => {
          console.log(`Product ${index}:`, p);

          // Parse price from various sources
          const price = parsePrice(
            p.selling_price ??
            p.price ??
            p.UNITY_PRICE ??
            p.SALE_PRICE_INCLUSIVE ??
            0
          );

          const mapped = {
            ...p, // Keep all original fields
            // Normalize field names - handle database, Redis, and API variations
            stock: Number(
              p.stock ||
              p.STOCK ||
              p.item_packet ||  // Redis stock field
              p.QUANTITY ||
              0
            ),
            price: price,
            costPrice: Number(
              p.cost_price ??
              p.cost ??
              p.COST_PRICE_INCLUSIVE ??
              0
            ),
            itemName:
              p.ITEM_NAME ||
              p.itemName ||
              p.item_commercial_name ||  // Redis name field
              "Unknown",
            itemCode:
              p.ITEM_CODE ||
              p.itemCode ||
              p.item_key_words ||  // Redis code field
              "",
            batchInfo: p.item_state || "",  // Redis batch/expiry info
            category: p.category || "uncategorized",
            sales: 0,
            currency: p.currency ?? "RWF",
          };
            mapped = {
              ...p, // Keep all original fields
              // Normalize field names
              stock: Number(
                p.stock ||
                p.STOCK ||
                p.QUANTITY ||
                0
              ),
              price: price,
              costPrice: Number(
                p.cost ||
                p.COST_PRICE_INCLUSIVE ||
                0
              ),
              itemName:
                p.ITEM_NAME ||
                p.itemName ||
                "Unknown",
              itemCode:
                p.ITEM_CODE ||
                p.itemCode ||
                "",
              batchInfo: p.DESCRIPTION || "",
              category: p.category || "uncategorized",
              sales: 0,
            };
          }

          console.log(`Mapped product ${index}:`, mapped);
          return mapped;
        });

        console.log("=== All Mapped Products ===");
        console.log(mappedProducts);
        console.log(`Total: ${mappedProducts.length}`);

        // Don't filter by stock > 0, show ALL products
        setSupplierProducts(mappedProducts);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching stock:", err);
        setError(err.message);
        setLoading(false);
      });
  }, [isAuthenticated, user?.ishyigaAccount, user?.role, router]);

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  // Filter products
  const filteredProducts = supplierProducts.filter((p) => {
    const matchesSearch =
      p.itemName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.ITEM_NAME?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" || p.category === categoryFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "low" && p.stock <= 10) ||
      (statusFilter === "out" && p.stock === 0) ||
      (statusFilter === "active" && p.stock > 10);

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

  // Get unique categories
  const categories = Array.from(
    new Set(supplierProducts.map((p) => p.category))
  );

  const totalProducts = supplierProducts.length;
  const lowStock = supplierProducts.filter((p) => p.stock <= 10 && p.stock > 0).length;
  const outOfStock = supplierProducts.filter((p) => p.stock === 0).length;
  const totalValue = supplierProducts.reduce(
    (sum, p) => sum + p.price * p.stock,
    0
  );

  const handleDelete = async (product: any) => {
    const itemName = product.ITEM_NAME || product.itemName || "this product";
    if (!confirm(`Are you sure you want to delete ${itemName}?`)) return;

    try {
      const itemCode = product.ITEM_CODE || product.itemCode;
      const res = await fetch(`/api/supplier/stock/${itemCode}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setSupplierProducts((prev) =>
          prev.filter((prod) =>
            (prod.ITEM_CODE || prod.itemCode) !== itemCode
          )
        );
      } else {
        const data = await res.json();
        alert(data.message || "Failed to delete product");
      }
    } catch {
      alert("Error deleting product");
    }
  };

  const handleSaveProduct = async (productData: ProductFormData) => {
    if (!user?.ishyigaAccount) {
      alert("No account found");
      return;
    }

    try {
      const action = editingProduct ? "updateProduct" : "addProduct";

      const res = await fetch("/api/supplier/stock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          account: user.ishyigaAccount,
          ...productData,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        // Refresh the products list
        window.location.reload();
      } else {
        alert(data.error || "Failed to save product");
      }
    } catch (error) {
      console.error("Error saving product:", error);
      alert("Error saving product");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading products...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-700">{error}</p>
            <Button onClick={() => window.location.reload()} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {user?.businessName || "Supplier Dashboard"}
            </h1>
            <p className="text-sm text-slate-600">
              {user?.businessCategory || "Supplier Panel"} • Account: {user?.ishyigaAccount}
            </p>
          </div>
          <Button variant="outline" onClick={handleLogout} className="gap-2">
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">


        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                Total Products
              </CardTitle>
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">
                {totalProducts}
              </div>
              <p className="text-xs text-slate-500 mt-1">All products</p>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                Inventory Value
              </CardTitle>
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">
                {totalValue.toLocaleString()} RWF
              </div>
              <p className="text-xs text-slate-500 mt-1">Total stock value</p>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                Low Stock Items
              </CardTitle>
              <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-700">
                {lowStock}
              </div>
              <p className="text-xs text-slate-500 mt-1">Items below 10 units</p>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                Out of Stock
              </CardTitle>
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-700">
                {outOfStock}
              </div>
              <p className="text-xs text-slate-500 mt-1">Items with 0 stock</p>
            </CardContent>
          </Card>
        </div>

        {/* Shop With Me QR Code — collapsible so original dashboard stays primary */}
        <Card className="bg-white shadow-md mb-8">
          <CardHeader
            className="border-b bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors select-none"
            onClick={() => setShopWithMeQROpen((o) => !o)}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Share2 className="h-6 w-6 text-blue-600 shrink-0" />
                <div>
                  <CardTitle className="text-xl">QR Code</CardTitle>
                  <CardDescription className="mt-1">
                    {shopWithMeQROpen
                      ? "Customers scan this to browse your products. Collapse when not needed."
                      : "Generate a link and QR so customers can browse your shop. Click to expand."}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {shopNickname.trim() && shopWithMeLink && (
                  <span className="text-xs text-slate-500 font-mono truncate max-w-[140px]" title={shopWithMeLink}>
                    {shopNickname}
                  </span>
                )}
                <ChevronRight
                  className={`h-5 w-5 text-slate-500 transition-transform ${shopWithMeQROpen ? "rotate-90" : ""}`}
                />
              </div>
            </div>
          </CardHeader>
          {shopWithMeQROpen && (
            <CardContent className="p-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="shop-nickname">Your shop nickname *</Label>
                  <Input
                    id="shop-nickname"
                    placeholder="known as"
                    value={shopNickname}
                    onChange={(e) => setShopNickname(e.target.value)}
                    className="max-w-xs"
                  />
                </div>
                {showBarOrRestaurantOption && (
                  <div className="flex items-center space-x-2 pt-6">
                    <Checkbox
                      id="bar-restaurant"
                      checked={isBarOrRestaurant}
                      disabled={isBarOrRestaurantFromAccount}
                      onCheckedChange={(checked) => setIsBarOrRestaurant(!!checked)}
                    />
                    <Label
                      htmlFor="bar-restaurant"
                      className={isBarOrRestaurantFromAccount ? "cursor-not-allowed text-muted-foreground" : "cursor-pointer"}
                    >
                      Bar or Restaurant
                      {isBarOrRestaurantFromAccount && " (set from your account)"}
                    </Label>
                  </div>
                )}
              </div>
              {showBarOrRestaurantOption && isBarOrRestaurant && (
                <div className="space-y-2 max-w-xs">
                  <Label htmlFor="table-name">Default table name or number (optional)</Label>
                  <Input
                    id="table-name"
                    placeholder="e.g. Table 5"
                    value={tableNameOrNumber}
                    onChange={(e) => setTableNameOrNumber(e.target.value)}
                  />
                </div>
              )}
              {shopWithMeLink && (
                <div className="flex flex-col sm:flex-row gap-4 items-start pt-4 border-t">
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <QRCode value={shopWithMeLink} size={180} />
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <Label className="text-slate-600">Link</Label>
                    <p className="text-sm text-slate-700 break-all font-mono">{shopWithMeLink}</p>
                    <Button variant="outline" size="sm" onClick={copyShopWithMeLink} className="gap-2">
                      <Copy className="h-4 w-4" />
                      Copy link
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* Product Management Card */}
        <Card className="bg-white shadow-md">
          <CardHeader className="border-b bg-slate-50">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle className="text-xl">My Products</CardTitle>
                <CardDescription className="mt-1">
                  Products ({filteredProducts.length} of {totalProducts})
                </CardDescription>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" className="gap-2">
                  <Link href="/supplier/products/add">
                    <Package className="h-4 w-4" />
                    Bulk Upload
                  </Link>
                </Button>
                <Button
                  onClick={() => {
                    setEditingProduct(null);
                    setShowAddModal(true);
                  }}
                  className="gap-2 bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" />
                  Add Product
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name..."
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>

              <select
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="all">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <select
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="all">All Status</option>
                <option value="active">Active Stock (&gt;10)</option>
                <option value="low">Low Stock (1-10)</option>
                <option value="out">Out of Stock (0)</option>
              </select>
            </div>

            {/* Table */}
            {paginatedProducts.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 text-lg">
                  {searchTerm || categoryFilter !== "all" || statusFilter !== "all"
                    ? "No products found matching your filters"
                    : "No products found"}
                </p>
                {supplierProducts.length === 0 && (
                  <Button asChild className="mt-4">
                    <Link href="/supplier/products/add">Add Your First Product</Link>
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full">
                    <thead className="bg-slate-100 border-b border-slate-200">
                      <tr>
                        <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">
                          Product
                        </th>
                        <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">
                          Price
                        </th>
                        <th className="text-center px-4 py-3 text-sm font-semibold text-slate-700">
                          Stock
                        </th>
                        <th className="text-center px-4 py-3 text-sm font-semibold text-slate-700">
                          Status
                        </th>
                        <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">
                          Value
                        </th>
                        <th className="text-center px-4 py-3 text-sm font-semibold text-slate-700">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-200">
                      {paginatedProducts.map((p) => {
                        const revenue = p.price * p.stock;
                        const displayName = p.ITEM_NAME || p.itemName || "Unknown";
                        const displayCode = p.ITEM_CODE || p.itemCode || "";

                        return (
                          <tr
                            key={displayCode}
                            className="hover:bg-slate-50 transition-colors"
                          >
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg bg-slate-200 flex items-center justify-center">
                                  <Package className="h-5 w-5 text-slate-500" />
                                </div>
                                <div>
                                  <p className="font-medium text-slate-900">
                                    {displayName}
                                  </p>
                                  <p className="text-xs text-slate-500">{displayCode}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              {p.price > 0 ? (
                                <span className="font-medium text-slate-900">
                                  {p.price.toLocaleString()} {p.currency ?? "RWF"}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-sm italic">
                                  No price
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span
                                className={`font-semibold ${
                                  p.stock === 0
                                    ? "text-red-600"
                                    : p.stock <= 10
                                    ? "text-yellow-600"
                                    : "text-slate-900"
                                }`}
                              >
                                {p.stock}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span
                                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                  p.stock === 0
                                    ? "bg-red-100 text-red-700"
                                    : p.stock <= 10
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-blue-100 text-blue-700"
                                }`}
                              >
                                {p.stock === 0 ? "Out of Stock" : p.stock <= 10 ? "Low Stock" : "Active"}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              {revenue > 0 ? (
                                <span className="font-medium text-slate-900">
                                  {revenue.toLocaleString()} RWF
                                </span>
                              ) : (
                                <span className="text-slate-400 text-sm italic">
                                  -
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center justify-center gap-2">
                                <Button
                                  asChild
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
                                >
                                  <Link href={`/supplier/products/edit/${displayCode}`}>
                                    <Edit className="h-4 w-4" />
                                  </Link>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                                  onClick={() => handleDelete(p)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600">Show</span>
                    <select
                      className="px-3 py-1 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                    <span className="text-sm text-slate-600">entries</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600">
                      Showing {startIndex + 1} to{" "}
                      {Math.min(endIndex, filteredProducts.length)} of{" "}
                      {filteredProducts.length} entries
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="gap-1"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>

                    <div className="flex gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(
                          (page) =>
                            page === 1 ||
                            page === totalPages ||
                            Math.abs(page - currentPage) <= 1
                        )
                        .map((page, idx, arr) => (
                          <div key={page} className="flex items-center">
                            {idx > 0 && arr[idx - 1] !== page - 1 && (
                              <span className="px-2 text-slate-400">...</span>
                            )}
                            <Button
                              variant={
                                currentPage === page ? "default" : "outline"
                              }
                              size="sm"
                              onClick={() => setCurrentPage(page)}
                              className={`h-8 w-8 p-0 ${
                                currentPage === page
                                  ? "bg-blue-600 hover:bg-blue-700"
                                  : ""
                              }`}
                            >
                              {page}
                            </Button>
                          </div>
                        ))}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages}
                      className="gap-1"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Add Product Modal */}
        <AddProductModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSave={handleSaveProduct}
          editingProduct={editingProduct}
        />
      </div>
    </div>
  );
}
export default function SupplierDashboardPage() {
  return <SupplierDashboard />;
}