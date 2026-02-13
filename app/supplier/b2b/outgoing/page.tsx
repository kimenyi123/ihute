/**
 * Outgoing Orders Page
 * Task 15 - Requirements 18.1, 18.2, 18.3, 18.4, 18.5
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { listOutgoing, B2BOrder } from "@/lib/b2bApi";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorMessage from "@/components/ErrorMessage";
import EmptyState from "@/components/EmptyState";
import { formatCurrency, formatDateShort, formatStatus, getStatusColor } from "@/lib/utils";

export default function OutgoingOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<B2BOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("All");

  const statusOptions = [
    "All",
    "B2B_SUBMITTED",
    "B2B_NEEDS_CHANGES",
    "B2B_CHANGES_ACCEPTED",
    "B2B_ACCEPTED",
    "B2B_REJECTED",
  ];

  useEffect(() => {
    loadOrders();
  }, [statusFilter]);

  async function loadOrders() {
    try {
      setLoading(true);
      setError(null);
      const response = await listOutgoing({
        status: statusFilter === "All" ? undefined : statusFilter,
      });
      setOrders(response.orders || []);
    } catch (err: any) {
      setError(err.message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" message="Loading orders..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <ErrorMessage message={error} onRetry={loadOrders} />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Outgoing Orders</h1>
        <p className="mt-2 text-gray-600">Orders you've sent to suppliers</p>
      </div>

      <div className="mb-6 flex items-center gap-4">
        <label htmlFor="status-filter" className="text-sm font-medium text-gray-700">
          Filter by status:
        </label>
        <select
          id="status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status === "All" ? "All Statuses" : formatStatus(status)}
            </option>
          ))}
        </select>
      </div>

      {orders.length === 0 ? (
        <EmptyState message="No outgoing orders found" icon="document" />
      ) : (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Supplier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Amount
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orders.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => router.push(`/supplier/b2b/order/${order.id}`)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    #{order.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {order.sellerName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDateShort(order.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(order.status)}`}>
                      {formatStatus(order.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatCurrency(order.amount, order.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
