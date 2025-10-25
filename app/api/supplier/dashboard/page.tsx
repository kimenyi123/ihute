"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, Package, DollarSign, TrendingUp, LogOut } from "lucide-react";
import Link from "next/link";

export default function SupplierDashboard() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [supplierProducts, setSupplierProducts] = useState<any[]>([]);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "supplier") {
      router.push("/login");
      return;
    }

    if (!user?.ishyigaAccount) return;

    fetch(`/api/supplier/stock?account=${user?.ishyigaAccount}`)
      .then((res) => res.json())
      .then((data) => {
        const mappedProducts = (data.products || []).map((p: any) => ({
          ...p,
          price: p.UNITY_PRICE || 0,
          stock: p.stock || p.STOCK || 0,
        }));
        setSupplierProducts(mappedProducts);
      })
      .catch((err) => console.error("Error fetching stock:", err));
  }, [isAuthenticated, user, router]);

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const totalProducts = supplierProducts.length;
  const totalValue = supplierProducts.reduce((sum, p) => sum + p.price * p.stock, 0);
  const lowStock = supplierProducts.filter((p) => p.stock < 10).length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{user?.businessName}</h1>
            <p className="text-sm text-slate-600">{user?.businessCategory}</p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Products</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalProducts}</div>
              <p className="text-xs text-muted-foreground">Active products in store</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalValue.toLocaleString()} RWF</div>
              <p className="text-xs text-muted-foreground">Total stock value</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{lowStock}</div>
              <p className="text-xs text-muted-foreground">Products below 10 units</p>
            </CardContent>
          </Card>
        </div>

        {/* Products Section */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle>My Products</CardTitle>
              <CardDescription>Manage your product inventory</CardDescription>
            </div>
            <div className="flex gap-2">
              <Link href="/supplier/products/bulk-upload">
                <Button variant="outline">
                  <Package className="h-4 w-4 mr-2" />
                  Bulk Upload
                </Button>
              </Link>
              <Link href="/supplier/products/add">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </Button>
              </Link>
            </div>
          </CardHeader>

          <CardContent>
            {supplierProducts.length === 0 ? (
              <div>No products found</div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr>
                    <th className="border-b p-2">Name</th>
                    <th className="border-b p-2">Code</th>
                    <th className="border-b p-2">Price (RWF)</th>
                    <th className="border-b p-2">Stock</th>
                    <th className="border-b p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {supplierProducts.map((p) => (
                    <tr key={p.ITEM_CODE}>
                      <td className="p-2">{p.ITEM_NAME}</td>
                      <td className="p-2">{p.ITEM_CODE}</td>
                      <td className="p-2">{p.price.toLocaleString()}</td>
                      <td className="p-2">{p.stock}</td>
                      <td className="p-2 flex gap-2">
                        {/* Edit button */}
                        <Link href={`/supplier/products/edit/${p.ITEM_CODE}`}>
                          <Button size="sm" variant="outline">
                            Edit
                          </Button>
                        </Link>

                        {/* Delete button */}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={async () => {
                            if (!confirm(`Are you sure you want to delete ${p.ITEM_NAME}?`)) return;
                            try {
                              const res = await fetch(`/api/supplier/stock/${p.ITEM_CODE}`, {
                                method: "DELETE",
                              });
                              if (res.ok) {
                                setSupplierProducts(
                                  supplierProducts.filter(
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ✅ Optional export for dashboard main entry */
export function SupplierDashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Supplier Dashboard</h1>
      <p>Welcome to your supplier dashboard.</p>
    </div>
  );
}
