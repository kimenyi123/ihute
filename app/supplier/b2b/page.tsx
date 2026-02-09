"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  ShoppingCart,
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownLeft,
  Package,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { useRouter } from "next/navigation";

interface B2BStats {
  outgoingOrders: number;
  incomingOrders: number;
  draftOrders: number;
  totalSpent: number;
  totalReceived: number;
}

export default function B2BOverviewPage() {
  const router = useRouter();
  const { user, isAuthenticated, hasHydrated } = useAuthStore();
  const [stats, setStats] = useState<B2BStats>({
    outgoingOrders: 0,
    incomingOrders: 0,
    draftOrders: 0,
    totalSpent: 0,
    totalReceived: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // CRITICAL: Wait for auth store to rehydrate from localStorage
    if (!hasHydrated) {
      return; // Don't check auth yet - store is still loading
    }

    console.log("Main B2B page auth check:", { isAuthenticated, user, userRole: user?.role });
    if (!isAuthenticated || (user?.role as string) !== "supplier") {
      console.log("Redirecting to login - auth failed");
      router.push("/login");
      return;
    }

    // Load B2B stats
    loadStats();
  }, [hasHydrated, isAuthenticated, user?.role, router]);

  const loadStats = async () => {
    try {
      setLoading(true);

      // Fetch outgoing orders count
      const outgoingRes = await fetch("/supplier/b2b/api?action=listOutgoing&limit=1");
      const outgoingData = await outgoingRes.json();

      // Fetch incoming orders count
      const incomingRes = await fetch("/supplier/b2b/api?action=listIncoming&limit=1");
      const incomingData = await incomingRes.json();

      // Fetch draft orders count
      const draftsRes = await fetch("/supplier/b2b/api?action=listDrafts");
      const draftsData = await draftsRes.json();

      if (outgoingData.ok && incomingData.ok) {
        // Calculate total spent from outgoing orders
        const totalSpent = outgoingData.orders?.reduce(
          (sum: number, order: any) => sum + (order.amount || 0),
          0
        ) || 0;

        setStats({
          outgoingOrders: outgoingData.total || 0,
          incomingOrders: incomingData.total || 0,
          draftOrders: draftsData.drafts?.length || 0,
          totalSpent: totalSpent,
          totalReceived: 0,
        });
      }
    } catch (error) {
      console.error("Error loading B2B stats:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b shadow-sm mb-8">
        <div className="container mx-auto px-6 py-6">
          <h1 className="text-3xl font-bold text-slate-900">
            B2B Procurement / Kurangura byinshi
          </h1>
          <p className="text-slate-600 mt-2">
            Buy from other sellers in bulk using quick search or Excel upload
          </p>
        </div>
      </div>

      <div className="container mx-auto px-6 pb-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Link href="/supplier/b2b/outgoing">
            <Card className="bg-white shadow-md hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">
                  Outgoing Requests
                </CardTitle>
                <ArrowUpRight className="h-5 w-5 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">
                  {loading ? "..." : stats.outgoingOrders}
                </div>
                <p className="text-xs text-slate-500 mt-1">Orders you placed</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/supplier/b2b/incoming">
            <Card className="bg-white shadow-md hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">
                  Incoming Requests
                </CardTitle>
                <ArrowDownLeft className="h-5 w-5 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">
                  {loading ? "..." : stats.incomingOrders}
                </div>
                <p className="text-xs text-slate-500 mt-1">Orders received</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/supplier/b2b/drafts">
            <Card className="bg-white shadow-md hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">
                  Draft Orders
                </CardTitle>
                <Package className="h-5 w-5 text-yellow-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">
                  {loading ? "..." : stats.draftOrders}
                </div>
                <p className="text-xs text-slate-500 mt-1">Not submitted yet</p>
              </CardContent>
            </Card>
          </Link>

          <Card className="bg-white shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                Total Spent
              </CardTitle>
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">
                {loading ? "..." : stats.totalSpent.toLocaleString()} RWF
              </div>
              <p className="text-xs text-slate-500 mt-1">B2B purchases</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Action Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Quick Buy Card */}
          <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200 shadow-lg hover:shadow-xl transition-all">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <ShoppingCart className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-xl">Quick Buy</CardTitle>
                  <CardDescription className="mt-1">
                    Kurangura vuba / Search and buy instantly
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 mb-4">
                Search for products from other live sellers and add them to your B2B cart.
                Filter by price, distance, or stock availability.
              </p>
              <ul className="space-y-2 mb-4 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>Search across all active seller inventories</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>See real-time prices and stock levels</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>Single or multi-supplier orders</span>
                </li>
              </ul>
              <Link href="/supplier/b2b/buy">
                <Button className="w-full bg-blue-600 hover:bg-blue-700">
                  Start Quick Buy
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Bulk Excel Card */}
          <Card className="bg-gradient-to-br from-green-50 to-white border-green-200 shadow-lg hover:shadow-xl transition-all">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                  <FileSpreadsheet className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <CardTitle className="text-xl">Bulk Upload (Excel)</CardTitle>
                  <CardDescription className="mt-1">
                    Kurangura byinshi / Upload shopping list
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 mb-4">
                Upload an Excel file with your needed items. The system will automatically
                match suppliers and suggest best options.
              </p>
              <ul className="space-y-2 mb-4 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">•</span>
                  <span>Upload up to 500 items at once</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">•</span>
                  <span>Automatic supplier matching by item code/name</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">•</span>
                  <span>Edit suppliers before submitting</span>
                </li>
              </ul>
              <Link href="/supplier/b2b/bulk">
                <Button className="w-full bg-green-600 hover:bg-green-700">
                  Upload Excel
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Order Management Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Draft Orders Card */}
          <Card className="bg-white shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
                  <Package className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <CardTitle>Draft Orders</CardTitle>
                  <CardDescription className="mt-1">
                    Review before submitting
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 mb-4">
                View and edit draft B2B orders created from Excel imports.
                Select suppliers and submit when ready.
              </p>
              <Link href="/supplier/b2b/drafts">
                <Button variant="outline" className="w-full">
                  View Draft Orders
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Outgoing Orders Card */}
          <Card className="bg-white shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                  <ArrowUpRight className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <CardTitle>Outgoing Requests</CardTitle>
                  <CardDescription className="mt-1">
                    Orders you placed as buyer
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 mb-4">
                View and manage B2B orders you've submitted to other sellers.
                Track status and follow up on pending requests.
              </p>
              <Link href="/supplier/b2b/outgoing">
                <Button variant="outline" className="w-full">
                  View Outgoing Orders
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Incoming Orders Card */}
          <Card className="bg-white shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <ArrowDownLeft className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <CardTitle>Incoming Requests</CardTitle>
                  <CardDescription className="mt-1">
                    Orders received from other sellers
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 mb-4">
                Review and respond to B2B orders from other sellers.
                Accept, reject, or request changes to order details.
              </p>
              <Link href="/supplier/b2b/incoming">
                <Button variant="outline" className="w-full">
                  View Incoming Orders
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Help Section */}
        <Card className="mt-8 bg-slate-50 border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg">How B2B Procurement Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
              <div>
                <div className="font-semibold text-slate-900 mb-2">1. Create Request</div>
                <p className="text-slate-600">
                  Use Quick Buy to search for items or upload an Excel file with your shopping list.
                </p>
              </div>
              <div>
                <div className="font-semibold text-slate-900 mb-2">2. Select Suppliers</div>
                <p className="text-slate-600">
                  Review suggested suppliers and adjust selections based on price, stock, and location.
                </p>
              </div>
              <div>
                <div className="font-semibold text-slate-900 mb-2">3. Submit & Track</div>
                <p className="text-slate-600">
                  Submit your order. Suppliers will review and respond. Track progress in Outgoing Orders.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
