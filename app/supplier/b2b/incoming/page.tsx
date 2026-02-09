"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  ArrowDownLeft,
  Eye,
  Filter,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { listIncoming, B2BOrder, B2BApiError } from "@/lib/b2bApi";

const STATUS_COLORS = {
  'B2B_SUBMITTED': 'bg-blue-100 text-blue-800',
  'B2B_NEEDS_CHANGES': 'bg-yellow-100 text-yellow-800',
  'B2B_CHANGES_ACCEPTED': 'bg-purple-100 text-purple-800',
  'B2B_ACCEPTED': 'bg-green-100 text-green-800',
  'B2B_REJECTED': 'bg-red-100 text-red-800',
  'B2B_CONFIRMED': 'bg-green-100 text-green-800',
  'B2B_COMPLETED': 'bg-green-100 text-green-800',
};

const STATUS_ICONS = {
  'B2B_SUBMITTED': Clock,
  'B2B_NEEDS_CHANGES': AlertCircle,
  'B2B_CHANGES_ACCEPTED': Eye,
  'B2B_ACCEPTED': CheckCircle,
  'B2B_REJECTED': XCircle,
  'B2B_CONFIRMED': CheckCircle,
  'B2B_COMPLETED': CheckCircle,
};

export default function B2BIncomingPage() {
  const router = useRouter();
  const { user, isAuthenticated, hasHydrated } = useAuthStore();

  const [orders, setOrders] = useState<B2BOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [total, setTotal] = useState(0);

  const limit = 20;

  useEffect(() => {
    // CRITICAL: Wait for auth store to rehydrate from localStorage
    if (!hasHydrated) {
      return; // Don't check auth yet - store is still loading
    }

    console.log("Incoming page auth check:", { isAuthenticated, user, userRole: user?.role });
    if (!isAuthenticated || (user?.role as string) !== "supplier") {
      console.log("Redirecting to login - auth failed");
      router.push("/login");
      return;
    }

    loadOrders();
  }, [hasHydrated, isAuthenticated, user?.role, router, currentPage, statusFilter]);

  const loadOrders = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await listIncoming({
        page: currentPage,
        limit,
        status: statusFilter || undefined,
      });

      setOrders(data.orders);
      setTotal(data.total);
      setTotalPages(Math.ceil(data.total / limit));
    } catch (err: any) {
      console.error("Load orders error:", err);
      if (err instanceof B2BApiError) {
        if (err.status === 401) {
          router.push("/login");
          return;
        }
        setError(err.message);
      } else {
        setError("Failed to load orders");
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    const IconComponent = STATUS_ICONS[status as keyof typeof STATUS_ICONS] || Clock;
    return <IconComponent className="h-4 w-4" />;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-RW', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const getStatusText = (status: string) => {
    return status.replace('B2B_', '').replace(/_/g, ' ');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading incoming orders...</p>
        </div>
      </div>
    );
  }

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
          <h1 className="text-3xl font-bold text-slate-900">
            Incoming Orders / Byinshi bivuye
          </h1>
          <p className="text-slate-600 mt-2">
            Orders received from other sellers
          </p>
        </div>
      </div>

      <div className="container mx-auto px-6 pb-8">
        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700">Status:</span>
              </div>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="B2B_SUBMITTED">Submitted</option>
                <option value="B2B_NEEDS_CHANGES">Needs Changes</option>
                <option value="B2B_CHANGES_ACCEPTED">Changes Accepted</option>
                <option value="B2B_ACCEPTED">Accepted</option>
                <option value="B2B_REJECTED">Rejected</option>
                <option value="B2B_CONFIRMED">Confirmed</option>
                <option value="B2B_COMPLETED">Completed</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="py-4">
              <div className="flex items-center gap-2 text-red-800">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">Error</span>
              </div>
              <p className="text-red-700 text-sm mt-1">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Orders Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Orders to Process ({total} total)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <div className="text-center py-12">
                <ArrowDownLeft className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600 text-lg">No incoming orders found</p>
                <p className="text-slate-500 text-sm mt-2">
                  {statusFilter ? "Try a different status filter" : "No orders have been assigned to you yet"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="text-left p-3 font-semibold text-slate-900">Order ID</th>
                      <th className="text-left p-3 font-semibold text-slate-900">Buyer</th>
                      <th className="text-left p-3 font-semibold text-slate-900">Status</th>
                      <th className="text-left p-3 font-semibold text-slate-900">Amount</th>
                      <th className="text-left p-3 font-semibold text-slate-900">Created</th>
                      <th className="text-center p-3 font-semibold text-slate-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id} className="border-b hover:bg-slate-50">
                        <td className="p-3">
                          <span className="font-medium text-slate-900">#{order.id}</span>
                        </td>
                        <td className="p-3">
                          {order.buyerName ? (
                            <div>
                              <div className="font-medium text-slate-900">
                                {order.buyerName}
                              </div>
                              <div className="text-sm text-slate-500">
                                {order.buyerAccount}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className={`inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[order.status as keyof typeof STATUS_COLORS] || 'bg-gray-100 text-gray-800'}`}>
                            {getStatusIcon(order.status)}
                            {getStatusText(order.status)}
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="font-medium">
                            {order.amount.toLocaleString()} {order.currency}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="text-sm text-slate-600">
                            {formatDate(order.createdAt)}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-center">
                            <Link href={`/supplier/b2b/order/${order.id}`}>
                              <Button size="sm" variant="outline" className="gap-1">
                                <Eye className="h-3 w-3" />
                                View & Respond
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <span className="text-sm text-slate-600">
              Page {currentPage} of {totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
