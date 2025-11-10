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
  DollarSign,
  TrendingUp,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

function SupplierDashboard() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [supplierProducts, setSupplierProducts] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "supplier") {
      router.push("/login");
      return;
    }

    if (!user?.ishyigaAccount) return;

    fetch(`/api/supplier/stock?account=${user?.ishyigaAccount}`)
      .then((res) => res.json())
      .then((data) => {
        // Normalize price & stock
        const mappedProducts = (data.products || []).map((p: any) => {
          // Extract price from item_emballage (format: "1000RWF" or "1000")
          let price = 0;
          if (p.item_emballage) {
            const priceStr = String(p.item_emballage).replace(/[^\d.]/g, '');
            price = parseFloat(priceStr) || 0;
          }

          return {
            ...p,
            ITEM_NAME: p.item_commercial_name || p.ITEM_NAME || '',
            ITEM_CODE: p.item_code || p.ITEM_CODE || '',
            price: price || p.UNITY_PRICE || p.SALE_PRICE_INCLUSIVE || 0,
            stock: p.QUANTITY || p.stock || p.STOCK || 0,
          };
        });
        setSupplierProducts(mappedProducts);
      })
      .catch((err) => console.error("Error fetching stock:", err));
  }, [isAuthenticated, user, router]);

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const totalProducts = supplierProducts.length;
  const totalValue = supplierProducts.reduce(
    (sum, p) => sum + p.price * p.stock,
    0
  );
  const lowStock = supplierProducts.filter((p) => p.stock < 10).length;

  // Pagination calculations
  const totalPages = Math.ceil(totalProducts / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProducts = supplierProducts.slice(startIndex, endIndex);

  // Pagination handlers
  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              {user?.businessName || "Supplier Dashboard"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600">
              {user?.businessCategory || "Supplier Panel"}
            </p>
          </div>
          <Button variant="outline" onClick={handleLogout} className="w-full sm:w-auto">
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Total Products
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalProducts}</div>
              <p className="text-xs text-muted-foreground">
                Active products in store
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Inventory Value
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totalValue.toLocaleString()} RWF
              </div>
              <p className="text-xs text-muted-foreground">
                Total stock value
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Low Stock Items
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{lowStock}</div>
              <p className="text-xs text-muted-foreground">
                Products below 10 units
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Products */}
        <Card>
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle>My Products</CardTitle>
              <CardDescription>Manage your product inventory</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Link href="/supplier/products/bulk-upload" className="w-full sm:w-auto">
                <Button variant="outline" className="w-full sm:w-auto">
                  <Package className="h-4 w-4 mr-2" />
                  Bulk Upload
                </Button>
              </Link>
              <Link href="/supplier/products/add" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </Button>
              </Link>
            </div>
          </CardHeader>

          <CardContent>
            {supplierProducts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No products found</div>
            ) : (
              <>
                {/* Items per page selector */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                  <div className="text-sm text-slate-600">
                    Showing {startIndex + 1}-{Math.min(endIndex, totalProducts)} of {totalProducts} products
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600">Rows per page:</span>
                    <select
                      className="border rounded-md px-2 py-1 text-sm"
                      value={itemsPerPage}
                      onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                    >
                      {[5, 10, 20, 50].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto -mx-6 sm:mx-0">
                  <div className="inline-block min-w-full align-middle">
                    <table className="min-w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="border-b p-3 text-xs sm:text-sm font-medium">Name</th>
                          <th className="border-b p-3 text-xs sm:text-sm font-medium">Code</th>
                          <th className="border-b p-3 text-xs sm:text-sm font-medium">Price (RWF)</th>
                          <th className="border-b p-3 text-xs sm:text-sm font-medium">Stock</th>
                          <th className="border-b p-3 text-xs sm:text-sm font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentProducts.map((p) => (
                        <tr key={p.ITEM_CODE} className="hover:bg-slate-50">
                          <td className="p-3 text-xs sm:text-sm">{p.ITEM_NAME}</td>
                          <td className="p-3 text-xs sm:text-sm">{p.ITEM_CODE}</td>
                          <td className="p-3 text-xs sm:text-sm">{p.price.toLocaleString()}</td>
                          <td className="p-3 text-xs sm:text-sm">{p.stock}</td>
                          <td className="p-3">
                            <div className="flex gap-2">
                              <Link href={`/supplier/products/edit/${p.ITEM_CODE}`}>
                                <Button size="sm" variant="outline" className="text-xs">
                                  Edit
                                </Button>
                              </Link>

                              <Button
                                size="sm"
                                variant="destructive"
                                className="text-xs"
                                onClick={async () => {
                                  if (
                                    !confirm(
                                      `Are you sure you want to delete ${p.ITEM_NAME}?`
                                    )
                                  )
                                    return;
                                  try {
                                    const res = await fetch(
                                      `/api/supplier/stock/${p.ITEM_CODE}`,
                                      { method: "DELETE" }
                                    );
                                    if (res.ok) {
                                      setSupplierProducts((prev) =>
                                        prev.filter(
                                          (prod) => prod.ITEM_CODE !== p.ITEM_CODE
                                        )
                                      );
                                    } else {
                                      const data = await res.json();
                                      alert(data.message || "Failed to delete product");
                                    }
                                  } catch (err) {
                                    console.error(err);
                                    alert("Error deleting product");
                                  }
                                }}
                              >
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t">
                    <div className="text-xs sm:text-sm text-slate-600 order-2 sm:order-1">
                      Page {currentPage} of {totalPages}
                    </div>
                    <div className="flex items-center gap-1 order-1 sm:order-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="gap-1 flex-shrink-0"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        <span className="hidden sm:inline">Prev</span>
                      </Button>

                      {/* Page numbers */}
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const pageNum = currentPage <= 3
                          ? i + 1
                          : currentPage >= totalPages - 2
                            ? totalPages - 4 + i
                            : currentPage - 2 + i;

                        if (pageNum < 1 || pageNum > totalPages) return null;

                        return (
                          <Button
                            key={pageNum}
                            variant={pageNum === currentPage ? "default" : "outline"}
                            size="sm"
                            onClick={() => goToPage(pageNum)}
                            className="flex-shrink-0"
                          >
                            {pageNum}
                          </Button>
                        );
                      })}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="gap-1 flex-shrink-0"
                      >
                        <span className="hidden sm:inline">Next</span>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ✅ Main page export (for Next.js)
export default function SupplierDashboardPage() {
  return <SupplierDashboard />;
}
