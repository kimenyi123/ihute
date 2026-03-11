"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/auth-store"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Package,
  Edit,
  Trash2,
  Plus,
  Search,
  Filter,
  Download,
  RefreshCw,
  Eye,
  EyeOff,
  AlertCircle,
} from "lucide-react"
import Link from "next/link"

type ProductStatus = "active" | "inactive" | "out-of-stock"

type Product = {
  id: string
  name: string
  category: string
  price: number
  stock: number
  status: ProductStatus
  sales: number
  revenue: number
  lastRestocked?: string
}

export default function MyProductsPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState("")
  // const [categoryFilter, setCategoryFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState<ProductStatus | "all">("all")
  const [fromCache, setFromCache] = useState(false)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalProducts, setTotalProducts] = useState(0)
  const itemsPerPage = 20

  // Fetch products from Redis/DB (using existing /api/supplier/stock endpoint)
  const fetchProducts = async () => {
    if (!user?.ishyigaAccount) return

    setLoading(true)
    setError(null)

    try {
      // Use the existing stock API that has Redis support
      const res = await fetch(`/api/supplier/stock?account=${user.ishyigaAccount}`)
      const json = await res.json()

      if (json.products) {
        // Map the response to our Product type
        const mappedProducts = (json.products || []).map((p: any) => {
  // ✅ Handle both Redis format and DB format
  const name = p.item_commercial_name || p.ITEM_NAME || p.name || ""
  const id   = p.item_key_words || p.ITEM_CODE || p.id || ""

  // Price: selling_price (Redis) or SALE_PRICE_INCLUSIVE/price (DB). item_emballage is not price.
  let price = 0
  if (p.selling_price != null) {
    price = typeof p.selling_price === "number" ? p.selling_price : parseFloat(String(p.selling_price).replace(/[^0-9.-]/g, "")) || 0
  }
  if (price <= 0) {
    price = parseFloat(p.price || p.SALE_PRICE_INCLUSIVE || 0)
  }

  // ✅ Handle Redis stock format (item_packet) or DB format
  let stock = 0
  if (p.item_packet) {
    stock = parseInt(p.item_packet) || 0
  } else {
    stock = parseInt(p.stock || p.QUANTITY || 0)
  }

  let status: ProductStatus = "active"
  if (stock === 0) status = "out-of-stock"

  return {
    id,
    name,
    category: p.category || "uncategorized",
    price,
    stock,
    status,
    sales: p.sales || 0,
    revenue: p.revenue || price * stock,
    lastRestocked: p.lastRestocked,
  } as Product
})
        // Apply client-side filters
        let filtered = mappedProducts

        // if (categoryFilter !== "all") {
        //   filtered = filtered.filter((p: { category?: string }) => p.category === categoryFilter)
        // }

        if (statusFilter !== "all") {
          filtered = filtered.filter((p: { status?: string }) => p.status === statusFilter)
        }

        setProducts(filtered)
        setTotalProducts(filtered.length)
        setFromCache(json.fromCache || false)
      } else {
        setError("Failed to fetch products")
      }
    } catch (e: any) {
      setError(e?.message || "Failed to fetch products")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "supplier") {
      router.push("/login")
      return
    }

    fetchProducts()
  // }, [isAuthenticated, user, router, currentPage, categoryFilter, statusFilter])
  }, [isAuthenticated, user, router, currentPage, statusFilter])


  // Filter products by search query (client-side)
  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Export to CSV
  const exportToCSV = () => {
    if (!filteredProducts.length) {
      alert("No products to export")
      return
    }

    const headers = "ID,Name,Category,Price,Stock,Status,Sales,Revenue"
    const rows = filteredProducts.map(
      (p) =>
        `${p.id},${p.name},${p.category},${p.price},${p.stock},${p.status},${p.sales || 0},${p.revenue || 0}`
    )
    const csv = [headers, ...rows].join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `products_${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // Toggle product status
  const toggleProductStatus = async (productId: string, newStatus: ProductStatus) => {
    // TODO: API call to update product status
    alert(`Toggle product ${productId} to ${newStatus} - Backend API needed`)
  }

  const totalPages = Math.ceil(totalProducts / itemsPerPage)

  if (loading && products.length === 0) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-lg font-semibold text-foreground">Loading products...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
              <Package className="w-8 h-8" />
              My Products
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your product inventory
              {fromCache && (
                <span className="ml-2 text-green-600 font-semibold">(Cached from Redis)</span>
              )}
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={fetchProducts}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button asChild>
              <Link href="/supplier/products/add">
                <Plus className="w-4 h-4 mr-2" />
                Add Product
              </Link>
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Search */}
              <div className="flex flex-col">
                <label className="text-sm font-medium mb-2">Search Products</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name..."
                    className="w-full pl-10 pr-3 py-2 border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Category Filter */}
              {/* <div className="flex flex-col">
                <label className="text-sm font-medium mb-2">Category</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-2 border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="all">All Categories</option>
                  <option value="electronics">Electronics</option>
                  <option value="clothing">Clothing</option>
                  <option value="books">Books</option>
                  <option value="home">Home & Garden</option>
                  <option value="food">Food & Beverage</option>
                </select>
              </div> */}

              {/* Status Filter */}
              <div className="flex flex-col">
                <label className="text-sm font-medium mb-2">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as ProductStatus | "all")}
                  className="px-3 py-2 border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="out-of-stock">Out of Stock</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error State */}
        {error && (
          <Card className="mb-6 border-destructive">
            <CardContent className="pt-6 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-destructive" />
              <p className="text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchProducts} className="ml-auto">
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Products Table */}
        {filteredProducts.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>
                Products ({filteredProducts.length} of {totalProducts})
              </CardTitle>
              <CardDescription>
                Click on a product to edit or manage stock levels
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 text-sm font-semibold">Product</th>
                      {/* <th className="text-left p-3 text-sm font-semibold">Category</th> */}
                      <th className="text-right p-3 text-sm font-semibold">Price</th>
                      <th className="text-right p-3 text-sm font-semibold">Stock</th>
                      <th className="text-center p-3 text-sm font-semibold">Status</th>
                      <th className="text-right p-3 text-sm font-semibold">Sales</th>
                      <th className="text-right p-3 text-sm font-semibold">Revenue</th>
                      <th className="text-center p-3 text-sm font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((product) => (
                      <tr key={product.id} className="border-b hover:bg-muted/50 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium text-sm">{product.name}</p>
                              {product.lastRestocked && (
                                <p className="text-xs text-muted-foreground">
                                  Restocked: {new Date(product.lastRestocked).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        {/* <td className="p-3 text-sm">{product.category}</td> */}
                        <td className="p-3 text-right font-semibold text-sm">
                          {product.price.toLocaleString()} {product.currency || "RWF"}
                        </td>
                        <td className="p-3 text-right">
                          <span
                            className={`font-semibold text-sm ${product.stock < 10 ? "text-red-600" : "text-green-600"}`}
                          >
                            {product.stock}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <Badge
                            variant={
                              product.status === "active"
                                ? "default"
                                : product.status === "out-of-stock"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {product.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-right text-sm">{product.sales || 0}</td>
                        <td className="p-3 text-right font-semibold text-sm">
                          {(product.revenue || 0).toLocaleString()} RWF
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-2">
                            <Button size="sm" variant="ghost" asChild>
                              <Link href={`/supplier/products/edit/${product.id}`}>
                                <Edit className="w-4 h-4" />
                              </Link>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                toggleProductStatus(
                                  product.id,
                                  product.status === "active" ? "inactive" : "active"
                                )
                              }
                              title={
                                product.status === "active"
                                  ? "Mark as inactive"
                                  : "Mark as active"
                              }
                            >
                              {product.status === "active" ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-6 border-t">
                  <p className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-12 pb-12 text-center">
              <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No products found</h3>
              <p className="text-muted-foreground mb-6">
                {searchQuery || categoryFilter !== "all" || statusFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Get started by adding your first product"}
              </p>
              <Button asChild>
                <Link href="/supplier/products/add">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Product
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
