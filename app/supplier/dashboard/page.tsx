"use client";

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
} from "lucide-react";
import Link from "next/link";

function SupplierDashboard() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [supplierProducts, setSupplierProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "supplier") {
      router.push("/login");
      return;
    }

    if (!user?.ishyigaAccount) return;

    fetch(`/api/supplier/stock?account=${user?.ishyigaAccount}`)
      .then((res) => res.json())
      .then((data) => {
        const mappedProducts = (data.products || [])
          .map((p: any) => ({
            ...p,
            price: p.UNITY_PRICE || 0,
            costPrice: p.UNIT_COST || p.COST || 0,
            stock: p.stock || p.STOCK || 0,
            category: p.category || "uncategorized",
            sales: 0, // You can calculate actual sales
          }))
          .filter((p) => p.stock > 0);

        setSupplierProducts(mappedProducts);
      })
      .catch((err) => console.error("Error fetching stock:", err));
  }, [isAuthenticated, user, router]);

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  // Filter products
  const filteredProducts = supplierProducts.filter((p) => {
    const matchesSearch =
      p.ITEM_NAME?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" || p.category === categoryFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "low" && p.stock <= 10) ||
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
  const lowStock = supplierProducts.filter((p) => p.stock <= 10).length;
  const totalValue = supplierProducts.reduce(
    (sum, p) => sum + p.price * p.stock,
    0
  );

  const handleDelete = async (product: any) => {
    if (!confirm(`Are you sure you want to delete ${product.ITEM_NAME}?`))
      return;
    try {
      const res = await fetch(`/api/supplier/stock/${product.ITEM_CODE}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSupplierProducts((prev) =>
          prev.filter((prod) => prod.ITEM_CODE !== product.ITEM_CODE)
        );
      } else {
        const data = await res.json();
        alert(data.message || "Failed to delete product");
      }
    } catch {
      alert("Error deleting product");
    }
  };

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
              {user?.businessCategory || "Supplier Panel"}
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
              <p className="text-xs text-slate-500 mt-1">
                Active products with stock
              </p>
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
              <p className="text-xs text-slate-500 mt-1">
                Items below 10 units
              </p>
            </CardContent>
          </Card>
        </div>

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

              <div className="flex gap-2">
                <Link href="/supplier/products/bulk-upload">
                  <Button variant="outline" className="gap-2">
                    <Package className="h-4 w-4" />
                    Bulk Upload
                  </Button>
                </Link>
                <Link href="/supplier/products/add">
                  <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4" />
                    Add Product
                  </Button>
                </Link>
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
                <option value="active">Active Stock</option>
                <option value="low">Low Stock</option>
              </select>
            </div>

            {/* Table */}
            {paginatedProducts.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 text-lg">
                  {searchTerm || categoryFilter !== "all" || statusFilter !== "all"
                    ? "No products found matching your filters"
                    : "No products with available stock"}
                </p>
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
                          Revenue
                        </th>
                        <th className="text-center px-4 py-3 text-sm font-semibold text-slate-700">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-200">
                      {paginatedProducts.map((p) => {
                        const revenue = p.price * p.stock;

                        return (
                          <tr
                            key={p.ITEM_CODE}
                            className="hover:bg-slate-50 transition-colors"
                          >
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg bg-slate-200 flex items-center justify-center">
                                  <Package className="h-5 w-5 text-slate-500" />
                                </div>
                                <div>
                                  <p className="font-medium text-slate-900">
                                    {p.ITEM_NAME}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <span className="font-medium text-slate-900">
                                {p.price.toLocaleString()} RWF
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span
                                className={`font-semibold ${
                                  p.stock <= 10
                                    ? "text-red-600"
                                    : "text-slate-900"
                                }`}
                              >
                                {p.stock}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span
                                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                  p.stock <= 10
                                    ? "bg-red-100 text-red-700"
                                    : "bg-blue-100 text-blue-700"
                                }`}
                              >
                                {p.stock <= 10 ? "Low Stock" : "active"}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <span className="font-medium text-slate-900">
                                {revenue.toLocaleString()} RWF
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center justify-center gap-2">
                                <Link
                                  href={`/supplier/products/edit/${p.ITEM_CODE}`}
                                >
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </Link>
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
      </div>
    </div>
  );
}

export default function SupplierDashboardPage() {
  return <SupplierDashboard />;
}