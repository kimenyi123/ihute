"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Eye,
  Package,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Edit,
  Save,
  Loader2,
  AlertCircle,
  DollarSign,
  FileText,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import {
  getOrderDetails,
  updateSupplierDecision,
  buyerAcceptChanges,
  getInvoiceHtmlUrl,
  B2BOrder,
  B2BOrderLine,
  LineUpdate,
  B2BApiError,
} from "@/lib/b2bApi";

const STATUS_COLORS = {
  'B2B_DRAFT': 'bg-gray-100 text-gray-800',
  'B2B_SUBMITTED': 'bg-blue-100 text-blue-800',
  'B2B_NEEDS_CHANGES': 'bg-yellow-100 text-yellow-800',
  'B2B_CHANGES_ACCEPTED': 'bg-purple-100 text-purple-800',
  'B2B_ACCEPTED': 'bg-green-100 text-green-800',
  'B2B_REJECTED': 'bg-red-100 text-red-800',
  'B2B_CONFIRMED': 'bg-green-100 text-green-800',
  'B2B_COMPLETED': 'bg-green-100 text-green-800',
};

export default function B2BOrderPage() {
  const router = useRouter();
  const params = useParams();
  const { user, isAuthenticated, hasHydrated } = useAuthStore();
  const orderId = parseInt(params.orderId as string);

  const [order, setOrder] = useState<B2BOrder | null>(null);
  const [lines, setLines] = useState<B2BOrderLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMounted, setHasMounted] = useState(false);

  // Supplier decision state
  const [decisionReason, setDecisionReason] = useState("");
  const [lineUpdates, setLineUpdates] = useState<LineUpdate[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // CRITICAL: Wait for auth store to rehydrate from localStorage
    if (!hasHydrated) {
      return;
    }

    // Mark as mounted only after hydration is complete
    if (!hasMounted) {
      setHasMounted(true);
    }

    // Only check auth on initial mount AFTER hydration
    if (hasMounted && (!isAuthenticated || (user?.role as string) !== "supplier")) {
      console.log("Redirecting to login - auth failed");
      router.push("/login");
      return;
    }

    // Skip data fetching if not authenticated
    if (!hasMounted || !isAuthenticated) {
      return;
    }

    if (!orderId || isNaN(orderId)) {
      setError("Invalid order ID");
      setLoading(false);
      return;
    }

    loadOrder();
  }, [hasHydrated, hasMounted, isAuthenticated, user, router, orderId]);

  const loadOrder = async () => {
    try {
      const data = await getOrderDetails(orderId);
      setOrder(data.order);
      setLines(data.lines);

      // Initialize line updates for supplier decision
      const updates: LineUpdate[] = data.lines.map(line => ({
        lineId: line.id,
        confirmedQty: line.confirmedReceivedQty || line.quantity,
        unitPrice: line.unityPrice || line.receivePrice || 0,
      }));
      setLineUpdates(updates);
    } catch (err: any) {
      console.error("Load order error:", err);
      if (err instanceof B2BApiError && err.status === 401) {
        router.push("/login");
        return;
      }
      setError(err.message || "Failed to load order details");
    } finally {
      setLoading(false);
    }
  };

  const handleLineUpdate = (lineId: number, field: 'confirmedQty' | 'unitPrice', value: number) => {
    setLineUpdates(prev => prev.map(line =>
      line.lineId === lineId
        ? { ...line, [field]: value }
        : line
    ));
  };

  const handleSupplierDecision = async (decision: 'accept' | 'reject' | 'propose_changes' | 'finalize') => {
    if (!confirm(`Are you sure you want to ${decision} this order?`)) return;

    setSubmitting(true);
    setError(null);

    try {
      const result = await updateSupplierDecision({
        orderId,
        decision,
        lineUpdates: decision === 'accept' || decision === 'finalize' ? lineUpdates : undefined,
        reason: decisionReason || undefined,
      });

      // Reload order to get updated status
      await loadOrder();

      // Clear form
      setDecisionReason("");

    } catch (err: any) {
      console.error("Supplier decision error:", err);
      if (err instanceof B2BApiError) {
        if (err.status === 401) {
          router.push("/login");
          return;
        }
        setError(err.message);
      } else {
        setError("Failed to process decision");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleBuyerAcceptChanges = async () => {
    if (!confirm("Accept all proposed changes from the supplier?")) return;

    setSubmitting(true);
    setError(null);

    try {
      const result = await buyerAcceptChanges(orderId);

      // Reload order to get updated status
      await loadOrder();

    } catch (err: any) {
      console.error("Accept changes error:", err);
      if (err instanceof B2BApiError) {
        if (err.status === 401) {
          router.push("/login");
          return;
        }
        setError(err.message);
      } else {
        setError("Failed to accept changes");
      }
    } finally {
      setSubmitting(false);
    }
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

  const canShowInvoice = () => {
    return order && ['B2B_ACCEPTED', 'B2B_CONFIRMED', 'B2B_COMPLETED'].includes(order.status);
  };

  const isSupplier = () => {
    return order && order.sellerAccount === user?.ishyigaAccount;
  };

  const isBuyer = () => {
    return order && order.buyerAccount === user?.ishyigaAccount;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Error</h2>
            <p className="text-slate-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b shadow-sm mb-6">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4 mb-4">
            <Link href={isBuyer() ? "/supplier/b2b/outgoing" : "/supplier/b2b/incoming"}>
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to {isBuyer() ? "Outgoing" : "Incoming"} Orders
              </Button>
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">
            Order Details #{orderId}
          </h1>
          {order && (
            <p className="text-slate-600 mt-2">
              Status: <span className={`inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[order.status as keyof typeof STATUS_COLORS] || 'bg-gray-100 text-gray-800'}`}>
                {order.status.replace('B2B_', '').replace(/_/g, ' ')}
              </span>
            </p>
          )}
        </div>
      </div>

      <div className="container mx-auto px-6 pb-8">
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

        {order && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Order Info */}
            <Card>
              <CardHeader>
                <CardTitle>Order Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm text-slate-500">Order ID:</span>
                    <div className="font-medium">#{order.id}</div>
                  </div>
                  <div>
                    <span className="text-sm text-slate-500">Type:</span>
                    <div className="font-medium">{order.orderType}</div>
                  </div>
                  <div>
                    <span className="text-sm text-slate-500">Created:</span>
                    <div className="font-medium">{formatDate(order.createdAt)}</div>
                  </div>
                  <div>
                    <span className="text-sm text-slate-500">Amount:</span>
                    <div className="font-medium">{order.amount.toLocaleString()} {order.currency}</div>
                  </div>
                  {order.taxes > 0 && (
                    <div>
                      <span className="text-sm text-slate-500">Taxes:</span>
                      <div className="font-medium">{order.taxes.toLocaleString()} {order.currency}</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Parties */}
            <Card>
              <CardHeader>
                <CardTitle>Parties</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-slate-900 mb-2">Buyer</h4>
                    <div className="text-sm">
                      <div><strong>Name:</strong> {order.buyerName}</div>
                      <div><strong>Account:</strong> {order.buyerAccount}</div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium text-slate-900 mb-2">Supplier</h4>
                    <div className="text-sm">
                      <div><strong>Name:</strong> {order.sellerName}</div>
                      <div><strong>Account:</strong> {order.sellerAccount}</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Supplier Actions */}
                {isSupplier() && ['B2B_SUBMITTED', 'B2B_NEEDS_CHANGES'].includes(order.status) && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-slate-900 mb-3">Update Line Details</h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-3">
                        {lines.map((line) => (
                          <div key={line.id} className="grid grid-cols-3 gap-3 items-center py-2 border-b">
                            <div className="text-sm font-medium">{line.itemName}</div>
                            <div>
                              <label className="text-xs text-slate-500">Confirmed Qty</label>
                              <Input
                                type="number"
                                value={lineUpdates.find(u => u.lineId === line.id)?.confirmedQty || line.confirmedReceivedQty || line.quantity}
                                onChange={(e) => handleLineUpdate(line.id, 'confirmedQty', parseFloat(e.target.value) || 0)}
                                className="w-20 h-8"
                                step="0.01"
                                min="0.01"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-500">Unit Price</label>
                              <Input
                                type="number"
                                value={lineUpdates.find(u => u.lineId === line.id)?.unitPrice || line.unityPrice || line.receivePrice || 0}
                                onChange={(e) => handleLineUpdate(line.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                className="w-24 h-8"
                                step="0.01"
                                min="0.01"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {order.status === 'B2B_NEEDS_CHANGES' && (
                      <div>
                        <label className="text-sm text-slate-500">Reason for changes (optional)</label>
                        <Input
                          value={decisionReason}
                          onChange={(e) => setDecisionReason(e.target.value)}
                          placeholder="Explain why changes are needed..."
                          className="w-full"
                        />
                      </div>
                    )}

                    <div className="flex gap-2">
                      {order.status === 'B2B_SUBMITTED' && (
                        <>
                          <Button
                            onClick={() => handleSupplierDecision('accept')}
                            disabled={submitting}
                            className="gap-2"
                          >
                            <CheckCircle className="h-4 w-4" />
                            Accept Order
                          </Button>
                          <Button
                            onClick={() => handleSupplierDecision('propose_changes')}
                            disabled={submitting}
                            variant="outline"
                            className="gap-2"
                          >
                            <Edit className="h-4 w-4" />
                            Propose Changes
                          </Button>
                        </>
                      )}

                      {order.status === 'B2B_NEEDS_CHANGES' && (
                        <Button
                          onClick={() => handleSupplierDecision('reject')}
                          disabled={submitting}
                          variant="outline"
                          className="gap-2 text-red-600 hover:text-red-700"
                        >
                          <XCircle className="h-4 w-4" />
                          Reject
                        </Button>
                      )}

                      {order.status === 'B2B_CHANGES_ACCEPTED' && (
                        <Button
                          onClick={() => handleSupplierDecision('finalize')}
                          disabled={submitting}
                          className="gap-2"
                        >
                          <Save className="h-4 w-4" />
                          Finalize Order
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Buyer Actions */}
                {isBuyer() && order.status === 'B2B_NEEDS_CHANGES' && (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-600 mb-3">
                      The supplier has proposed changes to your order. Review the changes below and accept if you agree.
                    </p>
                    <Button
                      onClick={handleBuyerAcceptChanges}
                      disabled={submitting}
                      className="gap-2 w-full"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Accept All Changes
                    </Button>
                  </div>
                )}

                {/* Invoice Action */}
                {canShowInvoice() && (
                  <div className="space-y-4">
                    <Button
                      onClick={() => window.open(getInvoiceHtmlUrl(orderId), '_blank')}
                      variant="outline"
                      className="gap-2 w-full"
                    >
                      <FileText className="h-4 w-4" />
                      View Invoice
                    </Button>
                  </div>
                )}

                {/* Refresh */}
                <div className="mt-4 pt-4 border-t">
                  <Button
                    onClick={loadOrder}
                    disabled={submitting}
                    variant="ghost"
                    size="sm"
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Order Lines */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Order Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="text-left p-3 font-semibold text-slate-900">Item</th>
                    <th className="text-left p-3 font-semibold text-slate-900">Requested Qty</th>
                    <th className="text-left p-3 font-semibold text-slate-900">Confirmed Qty</th>
                    <th className="text-left p-3 font-semibold text-slate-900">Unit Price</th>
                    <th className="text-left p-3 font-semibold text-slate-900">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => {
                    const confirmedQty = line.confirmedReceivedQty || line.quantity;
                    const unitPrice = line.unityPrice || line.receivePrice || 0;
                    const total = confirmedQty * unitPrice;

                    return (
                      <tr key={line.id} className="border-b hover:bg-slate-50">
                        <td className="p-3">
                          <div>
                            <div className="font-medium text-slate-900">{line.itemName}</div>
                            {line.itemCode && (
                              <div className="text-sm text-slate-500">Code: {line.itemCode}</div>
                            )}
                          </div>
                        </td>
                        <td className="p-3">{line.quantity}</td>
                        <td className="p-3">{confirmedQty}</td>
                        <td className="p-3">
                          <DollarSign className="h-4 w-4 inline text-slate-400" />
                          {unitPrice.toLocaleString()} {order.currency}
                        </td>
                        <td className="p-3 font-medium">
                          {total.toLocaleString()} {order.currency}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
