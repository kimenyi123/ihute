/**
 * Order Details Page with Negotiation UI
 * Task 17 - Requirements 20.1-20.8, 5.1-5.6, 6.1-6.5, 7.1-7.9, 8.1-8.6, 9.1-9.4, 10.1-10.8
 */

"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  getOrderDetails,
  getNegotiation,
  startNegotiation,
  makeOffer,
  acceptOffer,
  rejectNegotiation,
  finalizeNegotiation,
  getInvoiceHtmlUrl,
  B2BOrder,
  B2BOrderLine,
  Negotiation,
  Offer,
  LineUpdateForOffer,
} from "@/lib/b2bApi";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorMessage from "@/components/ErrorMessage";
import {
  formatCurrency,
  formatDate,
  formatDateShort,
  formatStatus,
  getStatusColor,
  formatNegotiationStatus,
  getNegotiationStatusColor,
} from "@/lib/utils";

export default function OrderDetailsPage() {
  const params = useParams();
  const orderId = parseInt(params.orderId as string);

  const [order, setOrder] = useState<B2BOrder | null>(null);
  const [lines, setLines] = useState<B2BOrderLine[]>([]);
  const [negotiation, setNegotiation] = useState<Negotiation | null>(null);
  const [currentOffer, setCurrentOffer] = useState<Offer | null>(null);
  const [history, setHistory] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerNote, setOfferNote] = useState("");
  const [offerLines, setOfferLines] = useState<LineUpdateForOffer[]>([]);

  useEffect(() => {
    loadOrderDetails();
  }, [orderId]);

  async function loadOrderDetails() {
    try {
      setLoading(true);
      setError(null);

      const orderResponse = await getOrderDetails(orderId);
      setOrder(orderResponse.order);
      setLines(orderResponse.lines);

      // Try to load negotiation if order status allows
      if (canHaveNegotiation(orderResponse.order.status)) {
        try {
          const negResponse = await getNegotiation(orderId);
          setNegotiation(negResponse.negotiation);
          setCurrentOffer(negResponse.currentOffer);
          setHistory(negResponse.history);
        } catch (err) {
          // Negotiation doesn't exist yet, that's okay
          console.log("No negotiation found for this order");
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load order details");
    } finally {
      setLoading(false);
    }
  }

  function canHaveNegotiation(status: string): boolean {
    return [
      "B2B_SUBMITTED",
      "B2B_NEEDS_CHANGES",
      "B2B_CHANGES_ACCEPTED",
    ].includes(status);
  }

  async function handleStartNegotiation() {
    try {
      setActionLoading(true);
      await startNegotiation(orderId);
      await loadOrderDetails();
    } catch (err: any) {
      alert(err.message || "Failed to start negotiation");
    } finally {
      setActionLoading(false);
    }
  }

  function openOfferModal() {
    // Initialize offer lines with current order lines
    const initialLines: LineUpdateForOffer[] = lines.map((line) => ({
      lineId: line.id,
      qty: line.quantity,
      unitPrice: line.unityPrice,
      supplierStockId: line.supplierStockId ? parseInt(line.supplierStockId) : undefined,
    }));
    setOfferLines(initialLines);
    setOfferNote("");
    setShowOfferModal(true);
  }

  async function handleMakeOffer() {
    try {
      setActionLoading(true);
      const isCounter = currentOffer !== null;
      await makeOffer({
        negotiationId: negotiation!.id,
        lineUpdates: offerLines,
        note: offerNote,
        isCounter,
      });
      setShowOfferModal(false);
      await loadOrderDetails();
    } catch (err: any) {
      alert(err.message || "Failed to make offer");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAcceptOffer() {
    if (!confirm("Accept the current offer?")) return;
    try {
      setActionLoading(true);
      await acceptOffer(negotiation!.id);
      await loadOrderDetails();
    } catch (err: any) {
      alert(err.message || "Failed to accept offer");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRejectNegotiation() {
    if (!confirm("Reject this negotiation? This cannot be undone.")) return;
    try {
      setActionLoading(true);
      await rejectNegotiation(negotiation!.id);
      await loadOrderDetails();
    } catch (err: any) {
      alert(err.message || "Failed to reject negotiation");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleFinalizeNegotiation() {
    if (!confirm("Finalize this negotiation? This will update the order with agreed terms.")) return;
    try {
      setActionLoading(true);
      await finalizeNegotiation(negotiation!.id);
      await loadOrderDetails();
      alert("Negotiation finalized successfully!");
    } catch (err: any) {
      alert(err.message || "Failed to finalize negotiation");
    } finally {
      setActionLoading(false);
    }
  }

  function updateOfferLine(lineId: number, field: keyof LineUpdateForOffer, value: any) {
    setOfferLines((prev) =>
      prev.map((line) =>
        line.lineId === lineId ? { ...line, [field]: value } : line
      )
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" message="Loading order details..." />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <ErrorMessage message={error || "Order not found"} onRetry={loadOrderDetails} />
      </div>
    );
  }

  const orderTotal = lines.reduce((sum, line) => sum + line.quantity * line.unityPrice, 0);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Order Header */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Order #{order.id}</h1>
            <p className="mt-1 text-gray-600">
              {formatDate(order.createdAt)}
            </p>
          </div>
          <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(order.status)}`}>
            {formatStatus(order.status)}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Buyer</p>
            <p className="font-medium text-gray-900">{order.buyerName}</p>
          </div>
          <div>
            <p className="text-gray-600">Supplier</p>
            <p className="font-medium text-gray-900">{order.sellerName}</p>
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <a
            href={getInvoiceHtmlUrl(orderId)}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Download Invoice
          </a>
        </div>
      </div>

      {/* Line Items */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Line Items</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subtotal</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {lines.map((line) => (
                <tr key={line.id}>
                  <td className="px-4 py-3 text-sm text-gray-900">{line.itemName}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{line.quantity}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {formatCurrency(line.unityPrice, order.currency)}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {formatCurrency(line.quantity * line.unityPrice, order.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td colSpan={3} className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                  Total:
                </td>
                <td className="px-4 py-3 text-sm font-bold text-gray-900">
                  {formatCurrency(orderTotal, order.currency)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Negotiation Panel */}
      {canHaveNegotiation(order.status) && (
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Negotiation</h2>

          {!negotiation ? (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">No negotiation started for this order</p>
              <button
                onClick={handleStartNegotiation}
                disabled={actionLoading}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? "Starting..." : "Start Negotiation"}
              </button>
            </div>
          ) : (
            <div>
              {/* Negotiation Status */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${getNegotiationStatusColor(negotiation.status)}`}>
                    {formatNegotiationStatus(negotiation.status)}
                  </span>
                  <span className="text-sm text-gray-600">
                    Rounds: {negotiation.roundsCount}
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  <p>Started: {formatDateShort(negotiation.startedAt)}</p>
                  <p>Expires: {formatDateShort(negotiation.expiresAt)}</p>
                </div>
              </div>

              {/* Current Offer */}
              {currentOffer && (
                <div className="mb-6 p-4 border border-gray-200 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-2">Current Offer</h3>
                  <p className="text-sm text-gray-600 mb-2">
                    By: {currentOffer.createdByRole} ({currentOffer.createdByAccount})
                  </p>
                  <p className="text-sm text-gray-600 mb-2">
                    Date: {formatDate(currentOffer.createdAt)}
                  </p>
                  {currentOffer.note && (
                    <p className="text-sm text-gray-700 italic">"{currentOffer.note}"</p>
                  )}
                </div>
              )}

              {/* Actions */}
              {negotiation.status === "OPEN" && (
                <div className="flex flex-wrap gap-3 mb-6">
                  <button
                    onClick={openOfferModal}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {currentOffer ? "Make Counter Offer" : "Make Offer"}
                  </button>
                  {currentOffer && (
                    <button
                      onClick={handleAcceptOffer}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      Accept Offer
                    </button>
                  )}
                  <button
                    onClick={handleRejectNegotiation}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    Reject Negotiation
                  </button>
                </div>
              )}

              {negotiation.status === "AGREED" && (
                <div className="mb-6">
                  <button
                    onClick={handleFinalizeNegotiation}
                    disabled={actionLoading}
                    className="px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? "Finalizing..." : "Finalize Negotiation (Seller Only)"}
                  </button>
                </div>
              )}

              {/* History */}
              {history.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Negotiation History</h3>
                  <div className="space-y-3">
                    {history.map((offer, index) => (
                      <div key={offer.id} className="p-3 bg-gray-50 rounded-lg text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-gray-900">
                            Offer #{index + 1} by {offer.createdByRole}
                          </span>
                          <span className="text-gray-600">{formatDateShort(offer.createdAt)}</span>
                        </div>
                        {offer.note && <p className="text-gray-700 italic">"{offer.note}"</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Make Offer Modal */}
      {showOfferModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {currentOffer ? "Make Counter Offer" : "Make Offer"}
            </h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Note (optional)
              </label>
              <textarea
                value={offerNote}
                onChange={(e) => setOfferNote(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Add a note to explain your offer..."
              />
            </div>

            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">Line Items</h3>
              <div className="space-y-3">
                {offerLines.map((offerLine) => {
                  const originalLine = lines.find((l) => l.id === offerLine.lineId);
                  return (
                    <div key={offerLine.lineId} className="p-3 border border-gray-200 rounded-lg">
                      <p className="font-medium text-gray-900 mb-2">{originalLine?.itemName}</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Quantity</label>
                          <input
                            type="number"
                            min="1"
                            value={offerLine.qty}
                            onChange={(e) =>
                              updateOfferLine(offerLine.lineId, "qty", parseInt(e.target.value))
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Unit Price</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={offerLine.unitPrice}
                            onChange={(e) =>
                              updateOfferLine(offerLine.lineId, "unitPrice", parseFloat(e.target.value))
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleMakeOffer}
                disabled={actionLoading}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? "Submitting..." : "Submit Offer"}
              </button>
              <button
                onClick={() => setShowOfferModal(false)}
                disabled={actionLoading}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
