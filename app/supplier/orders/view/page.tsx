"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  Check,
  X,
  AlertCircle,
  FileText,
  Package,
  Calendar,
  User,
  DollarSign,
  Printer,
} from "lucide-react";
import Link from "next/link";

interface OrderLine {
  id: number;
  itemCode: string;
  itemName: string;
  quantity: number;
  confirmedReceivedQty: number;
  requestPrice: number;
  receivePrice: number;
  unityPrice: number;
  availableStock: number;
  suggestedPrice: number;
  vatRate: number;
}

interface OrderDetails {
  id: number;
  orderType: string;
  status: string;
  amount: number;
  currency: string;
  buyerAccount: string;
  buyerName: string;
  sellerAccount: string;
  sellerName: string;
  createdAt: string;
  importFileName: string | null;
  isChildOrder: boolean;
  parentOrderId: number | null;
}

export default function SupplierOrderDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated } = useAuthStore();
  
  const orderId = searchParams.get("id");
  
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [editedLines, setEditedLines] = useState<Record<number, { qty: number; price: number }>>({});
  const [reason, setReason] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "supplier") {
      router.push("/login");
      return;
    }

    if (!orderId) {
      router.push("/supplier/orders");
      return;
    }

    loadOrderDetails();
  }, [isAuthenticated, user, router, orderId]);

  const loadOrderDetails = async () => {
    if (!orderId) return;

    setLoading(true);

    try {
      const response = await fetch(`/supplier/b2b/api?action=getOrderDetails&orderId=${orderId}`);
      const data = await response.json();

      if (data.ok) {
        setOrder(data.order);
        setLines(data.lines || []);
        
        // Initialize edited lines with default values
        const initialEdited: Record<number, { qty: number; price: number }> = {};
        data.lines.forEach((line: OrderLine) => {
          initialEdited[line.id] = {
            qty: line.confirmedReceivedQty || line.quantity,
            price: line.unityPrice || line.suggestedPrice || line.requestPrice || 0,
          };
        });
        setEditedLines(initialEdited);
      } else {
        alert(data.error || "Failed to load order details");
        router.push("/supplier/orders");
      }
    } catch (error) {
      console.error("Load order error:", error);
      alert("Failed to load order details");
      router.push("/supplier/orders");
    } finally {
      setLoading(false);
    }
  };

  const updateLineValue = (lineId: number, field: "qty" | "price", value: number) => {
    setEditedLines((prev) => ({
      ...prev,
      [lineId]: {
        ...prev[lineId],
        [field]: value,
      },
    }));
  };

  const calculateTotal = () => {
    return lines.reduce((sum, line) => {
      const edited = editedLines[line.id];
      if (!edited) return sum;
      return sum + (edited.qty * edited.price);
    }, 0);
  };

  const handleRemoveLine = async (lineId: number) => {
    if (!confirm("Remove this line from the order?")) {
      return;
    }

    setProcessing(true);

    try {
      const response = await fetch(`/supplier/b2b/api?action=removeLine&lineId=${lineId}`, {
        method: "POST",
      });

      const data = await response.json();

      if (data.ok) {
        alert("Line removed successfully");
        loadOrderDetails();
      } else {
        alert(data.error || "Failed to remove line");
      }
    } catch (error) {
      console.error("Remove line error:", error);
      alert("Failed to remove line");
    } finally {
      setProcessing(false);
    }
  };

  const handleDecision = async (decision: "accept" | "propose_changes" | "reject" | "finalize") => {
    if (!order) return;

    // Validate all lines have qty > 0
    const zeroQtyLines = lines.filter((line) => {
      const edited = editedLines[line.id];
      return edited && edited.qty <= 0;
    });

    if (zeroQtyLines.length > 0 && decision !== "reject") {
      alert(
        "All order lines must have quantity > 0. Please remove lines with 0 quantity or enter a valid quantity.\n" +
        "Lines with 0 qty: " + zeroQtyLines.map((l) => l.itemName).join(", ")
      );
      return;
    }

    // Validation for accept/finalize
    if (decision === "accept" || decision === "finalize") {
      const insufficientLines = lines.filter((line) => {
        const edited = editedLines[line.id];
        return edited && edited.qty > line.availableStock;
      });

      if (insufficientLines.length > 0) {
        alert(
          "Insufficient stock for the following items:\n" +
          insufficientLines.map((l) => `- ${l.itemName} (need: ${editedLines[l.id].qty}, available: ${l.availableStock})`).join("\n")
        );
        return;
      }
    }

    const confirmMessages = {
      accept: "Accept this order directly? This will reserve your stock immediately.",
      finalize: "Finalize this order? This will reserve your stock and complete the order.",
      propose_changes: "Propose changes to the buyer? They will need to accept your changes.",
      reject: "Reject this order? This action cannot be undone.",
    };

    if (!confirm(confirmMessages[decision])) {
      return;
    }

    setProcessing(true);

    try {
      // Prepare line updates
      const lineUpdates = lines.map((line) => ({
        lineId: line.id,
        confirmedQty: editedLines[line.id].qty,
        unitPrice: editedLines[line.id].price,
      }));

      const response = await fetch(`/supplier/b2b/api?action=updateSupplierDecision`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId: order.id,
          decision,
          reason: reason || undefined,
          lineUpdates,
        }),
      });

      const data = await response.json();

      if (data.ok) {
        alert(data.message || "Decision recorded successfully");
        router.push("/supplier/b2b/incoming");
      } else {
        alert(data.error || "Failed to record decision");
      }
    } catch (error) {
      console.error("Decision error:", error);
      alert("Network error. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const handlePrintInvoice = () => {
    if (!order) return;

    // Open invoice in new window
    const url = `/supplier/b2b/api?action=invoiceHtml&orderId=${order.id}`;
    window.open(url, "_blank");
  };

  const isB2B = order?.orderType === "B2B";
  const isLocked = order?.status === "B2B_ACCEPTED" || order?.status === "B2B_CONFIRMED" || order?.status === "B2B_COMPLETED";
  
  // Pattern A: Different actions for different statuses
  const canAcceptDirectly = isB2B && order?.status === "B2B_SUBMITTED";
  const canProposeChanges = isB2B && (order?.status === "B2B_SUBMITTED" || order?.status === "B2B_NEEDS_CHANGES");
  const canFinalize = isB2B && order?.status === "B2B_CHANGES_ACCEPTED";
  const canReject = isB2B && (order?.status === "B2B_SUBMITTED" || order?.status === "B2B_NEEDS_CHANGES");
  
  const canViewInvoice = isB2B && (order?.status === "B2B_ACCEPTED" || order?.status === "B2B_CONFIRMED" || order?.status === "B2B_COMPLETED");

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      B2B_DRAFT: { label: "Draft", className: "bg-slate-100 text-slate-700" },
      B2B_SUBMITTED: { label: "Pending Review", className: "bg-blue-100 text-blue-700" },
      B2B_NEEDS_CHANGES: { label: "Needs Changes", className: "bg-yellow-100 text-yellow-700" },
      B2B_CHANGES_ACCEPTED: { label: "Changes Accepted", className: "bg-indigo-100 text-indigo-700" },
      B2B_ACCEPTED: { label: "Accepted", className: "bg-green-100 text-green-700" },
      B2B_REJECTED: { label: "Rejected", className: "bg-red-100 text-red-700" },
      B2B_CONFIRMED: { label: "Confirmed", className: "bg-purple-100 text-purple-700" },
      B2B_COMPLETED: { label: "Completed", className: "bg-emerald-100 text-emerald-700" },
    };

    const config = statusMap[status] || { label: status, className: "bg-slate-100 text-slate-700" };

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b shadow-sm mb-6">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/supplier/orders">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Orders
              </Button>
            </Link>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                Order #{order.id}
              </h1>
              <p className="text-slate-600 mt-2">
                {isB2B ? "B2B Procurement Order" : "Regular Order"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {getStatusBadge(order.status)}
              {isB2B && (
                <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
                  B2B
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 pb-8">
        {/* Order Info */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4" />
                Buyer Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold text-slate-900">{order.buyerName}</p>
              <p className="text-sm text-slate-600 mt-1">Account: {order.buyerAccount}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Order Date
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold text-slate-900">
                {order.createdAt ? new Date(order.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }) : "N/A"}
              </p>
              {order.importFileName && (
                <p className="text-xs text-slate-500 mt-2">
                  From file: {order.importFileName}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Order Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-900">
                {canMakeDecision ? calculateTotal().toLocaleString() : order.amount.toLocaleString()} {order.currency}
              </p>
              {canMakeDecision && (
                <p className="text-xs text-slate-500 mt-1">Adjust prices below to change total</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Items Table */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Order Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-100 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">
                      Item
                    </th>
                    <th className="text-right px-4 py-3 text-sm font-semibold text-slate-700">
                      Requested Qty
                    </th>
                    {canMakeDecision && (
                      <>
                        <th className="text-right px-4 py-3 text-sm font-semibold text-slate-700">
                          Confirmed Qty
                        </th>
                        <th className="text-right px-4 py-3 text-sm font-semibold text-slate-700">
                          Available Stock
                        </th>
                        <th className="text-right px-4 py-3 text-sm font-semibold text-slate-700">
                          Buyer Price
                        </th>
                        <th className="text-right px-4 py-3 text-sm font-semibold text-slate-700">
                          Your Price
                        </th>
                      </>
                    )}
                    {!canMakeDecision && (
                      <>
                        <th className="text-right px-4 py-3 text-sm font-semibold text-slate-700">
                          Unit Price
                        </th>
                      </>
                    )}
                    <th className="text-right px-4 py-3 text-sm font-semibold text-slate-700">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {lines.map((line) => {
                    const edited = editedLines[line.id];
                    const lineTotal = edited ? edited.qty * edited.price : line.quantity * (line.unityPrice || 0);
                    const insufficientStock = edited && edited.qty > line.availableStock;

                    return (
                      <tr key={line.id} className={insufficientStock ? "bg-red-50" : ""}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{line.itemName}</p>
                          <p className="text-xs text-slate-500">Code: {line.itemCode || "N/A"}</p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-medium">{line.quantity}</span>
                        </td>
                        {canMakeDecision && (
                          <>
                            <td className="px-4 py-3 text-right">
                              <input
                                type="number"
                                value={edited?.qty || 0}
                                onChange={(e) => updateLineValue(line.id, "qty", Number(e.target.value))}
                                className={`w-24 px-2 py-1 border rounded text-right ${
                                  insufficientStock ? "border-red-500 bg-red-50" : ""
                                }`}
                                min="0"
                                step="1"
                              />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className={`font-medium ${insufficientStock ? "text-red-600" : "text-slate-900"}`}>
                                {line.availableStock}
                              </span>
                              {insufficientStock && (
                                <p className="text-xs text-red-600 mt-1">Insufficient!</p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-slate-600">{line.requestPrice.toLocaleString()} RWF</span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <input
                                type="number"
                                value={edited?.price || 0}
                                onChange={(e) => updateLineValue(line.id, "price", Number(e.target.value))}
                                className="w-32 px-2 py-1 border rounded text-right"
                                min="0"
                                step="100"
                              />
                            </td>
                          </>
                        )}
                        {!canMakeDecision && (
                          <td className="px-4 py-3 text-right">
                            <span className="font-medium">{(line.unityPrice || 0).toLocaleString()} RWF</span>
                          </td>
                        )}
                        <td className="px-4 py-3 text-right">
                          <span className="font-semibold text-slate-900">{lineTotal.toLocaleString()} RWF</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50 border-t-2">
                  <tr>
                    <td colSpan={canMakeDecision ? 6 : 2} className="px-4 py-3 text-right font-semibold text-slate-900">
                      TOTAL:
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xl font-bold text-slate-900">
                        {canMakeDecision ? calculateTotal().toLocaleString() : order.amount.toLocaleString()} {order.currency}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Decision Buttons - Pattern A */}
        {(canAcceptDirectly || canProposeChanges || canFinalize || canReject) && !isLocked && (
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-lg">Supplier Decision</CardTitle>
              <p className="text-sm text-slate-600 mt-2">
                {canFinalize 
                  ? "Buyer has accepted your proposed changes. Click Finalize to complete the order and reserve stock."
                  : "Review the order details above. You can adjust quantities and prices before making your decision."
                }
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {!canFinalize && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Reason / Notes (optional)
                    </label>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none"
                      rows={3}
                      placeholder="Add any notes or reasons for your decision..."
                    />
                  </div>
                )}

                <div className="flex gap-3">
                  {canAcceptDirectly && (
                    <Button
                      onClick={() => handleDecision("accept")}
                      disabled={processing}
                      className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                    >
                      <Check className="h-4 w-4" />
                      Accept Order
                    </Button>
                  )}
                  
                  {canFinalize && (
                    <Button
                      onClick={() => handleDecision("finalize")}
                      disabled={processing}
                      className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                    >
                      <Check className="h-4 w-4" />
                      Finalize Order
                    </Button>
                  )}
                  
                  {canProposeChanges && (
                    <Button
                      onClick={() => handleDecision("propose_changes")}
                      disabled={processing}
                      variant="outline"
                      className="flex-1 gap-2 border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                    >
                      <AlertCircle className="h-4 w-4" />
                      Propose Changes
                    </Button>
                  )}
                  
                  {canReject && (
                    <Button
                      onClick={() => handleDecision("reject")}
                      disabled={processing}
                      variant="outline"
                      className="flex-1 gap-2 border-red-300 text-red-600 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                      Reject Order
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Invoice Button (only for accepted orders) */}
        {canViewInvoice && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Invoice</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Button
                  onClick={handlePrintInvoice}
                  variant="outline"
                  className="gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Preview Invoice
                </Button>
                <Button
                  onClick={handlePrintInvoice}
                  className="gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Print Invoice
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
