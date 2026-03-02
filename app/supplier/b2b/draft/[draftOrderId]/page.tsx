"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Package,
  AlertTriangle,
  CheckCircle,
  Search,
  X,
  Save,
  Loader2,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import {
  getDraft,
  getSupplierOptions,
  updateLineSupplier,
  updateLine,
  removeLine,
  submitDraft,
  B2BDraftOrder,
  B2BDraftLine,
  SupplierOption,
  B2BApiError,
} from "@/lib/b2bApi";

export default function B2BDraftPage() {
  const router = useRouter();
  const params = useParams();
  const { user, isAuthenticated, hasHydrated } = useAuthStore();
  const draftOrderId = parseInt(params.draftOrderId as string);

  const [draft, setDraft] = useState<B2BDraftOrder | null>(null);
  const [lines, setLines] = useState<B2BDraftLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Modal state for supplier options
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [selectedLine, setSelectedLine] = useState<B2BDraftLine | null>(null);
  const [supplierOptions, setSupplierOptions] = useState<SupplierOption[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [supplierSource, setSupplierSource] = useState<string>("");

  // Editing state
  const [editingQuantities, setEditingQuantities] = useState<Record<number, string>>({});

  useEffect(() => {
    // CRITICAL: Wait for auth store to rehydrate from localStorage
    if (!hasHydrated) {
      return; // Don't check auth yet - store is still loading
    }

    console.log("Draft page auth check:", { isAuthenticated, user, userRole: user?.role });
    if (!isAuthenticated || (user?.role as string) !== "supplier") {
      console.log("Redirecting to login - auth failed");
      router.push("/login");
      return;
    }

    // Periodic session check every 30 seconds
    const interval = setInterval(() => {
      const { isAuthenticated: currentAuth, user: currentUser } = useAuthStore.getState();
      if (!currentAuth || (currentUser?.role as string) !== "supplier") {
        console.log("Session expired - redirecting to login");
        router.push("/login");
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [hasHydrated, isAuthenticated, user?.role, router]);

  useEffect(() => {
    // Only proceed if authenticated and hydrated
    if (!hasHydrated || !isAuthenticated || (user?.role as string) !== "supplier") {
      return;
    }

    if (!draftOrderId || isNaN(draftOrderId)) {
      setError("Invalid draft order ID");
      setLoading(false);
      return;
    }

    loadDraft();
  }, [isAuthenticated, user, router, draftOrderId]);

  const loadDraft = async () => {
    try {
      const data = await getDraft(draftOrderId);
      setDraft(data.order);
      setLines(data.lines);

      // Initialize editing quantities
      const quantities: Record<number, string> = {};
      data.lines.forEach(line => {
        quantities[line.id] = line.quantity.toString();
      });
      setEditingQuantities(quantities);

    } catch (err) {
      console.error("Load draft error:", err);
      if (err instanceof B2BApiError) {
        if (err.status === 401) {
          router.push("/login");
          return;
        }
        setError(err.message);
      } else {
        setError("Failed to load draft order");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFindSuppliers = async (line: B2BDraftLine) => {
    setSelectedLine(line);
    setShowSupplierModal(true);
    setLoadingSuppliers(true);
    setError(null);

    try {
      const data = await getSupplierOptions(line.id);
      setSupplierOptions(data.options);
      setSupplierSource(data.source);
    } catch (err) {
      console.error("Load supplier options error:", err);
      if (err instanceof B2BApiError) {
        setError(err.message);
      } else {
        setError("Failed to load supplier options");
      }
    } finally {
      setLoadingSuppliers(false);
    }
  };

  const handleSelectSupplier = async (supplier: SupplierOption) => {
    if (!selectedLine) return;

    try {
      await updateLineSupplier({
        lineId: selectedLine.id,
        stockId: supplier.stockId,
      });

      // Update local state
      setLines(prev => prev.map(line =>
        line.id === selectedLine.id
          ? {
            ...line,
            supplierStockId: supplier.stockId,
            sellerAccount: supplier.supplierId,
            sellerName: supplier.supplierName,
            supplierPrice: supplier.unitPrice,
            supplierStock: supplier.availableQty,
            matchStatus: "MATCHED" as const,
            matchNotes: `Changed to ${supplier.supplierName}`,
          }
          : line
      ));

      setShowSupplierModal(false);
      setSelectedLine(null);
      setSupplierOptions([]);
      setSupplierSource("");
    } catch (err) {
      console.error("Update supplier error:", err);
      if (err instanceof B2BApiError) {
        setError(err.message);
      } else {
        setError("Failed to update supplier");
      }
    }
  };

  const handleQuantityUpdate = async (lineId: number, newQuantity: string) => {
    const qty = parseFloat(newQuantity);
    if (isNaN(qty) || qty <= 0) return;

    setEditingQuantities(prev => ({ ...prev, [lineId]: newQuantity }));

    try {
      await updateLine({
        lineId,
        lineAction: "updateQty",
        newQuantity: qty,
      });

      // Update local state
      setLines(prev => prev.map(line =>
        line.id === lineId ? { ...line, quantity: qty } : line
      ));
    } catch (err) {
      console.error("Update quantity error:", err);
      if (err instanceof B2BApiError) {
        setError(err.message);
      } else {
        setError("Failed to update quantity");
      }
    }
  };

  const handleRemoveLine = async (lineId: number) => {
    if (!confirm("Are you sure you want to remove this item?")) return;

    try {
      await removeLine(lineId);

      // Update local state
      setLines(prev => prev.filter(line => line.id !== lineId));
      setEditingQuantities(prev => {
        const newQuantities = { ...prev };
        delete newQuantities[lineId];
        return newQuantities;
      });
    } catch (err) {
      console.error("Remove line error:", err);
      if (err instanceof B2BApiError) {
        setError(err.message);
      } else {
        setError("Failed to remove line");
      }
    }
  };

  const handleSubmitDraft = async () => {
    const unmatchedLines = lines.filter(line => line.matchStatus === "UNMATCHED");
    if (unmatchedLines.length > 0) {
      setError(`Cannot submit: ${unmatchedLines.length} unmatched items. Please assign suppliers first.`);
      return;
    }

    if (!confirm("Submit this draft order to suppliers?")) return;

    setSubmitting(true);
    setError(null);

    try {
      await submitDraft(draftOrderId);

      // Redirect to outgoing orders
      router.push("/supplier/b2b/outgoing");
    } catch (err) {
      console.error("Submit draft error:", err);
      if (err instanceof B2BApiError) {
        setError(err.message);
      } else {
        setError("Failed to submit draft");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const getMatchStatusColor = (status: string) => {
    switch (status) {
      case "MATCHED": return "text-green-700 bg-green-50 border-green-200";
      case "AMBIGUOUS": return "text-yellow-700 bg-yellow-50 border-yellow-200";
      case "UNMATCHED": return "text-red-700 bg-red-50 border-red-200";
      default: return "text-slate-700 bg-slate-50 border-slate-200";
    }
  };

  const getMatchStatusIcon = (status: string) => {
    switch (status) {
      case "MATCHED": return <CheckCircle className="h-4 w-4" />;
      case "AMBIGUOUS": return <AlertTriangle className="h-4 w-4" />;
      case "UNMATCHED": return <AlertCircle className="h-4 w-4" />;
      default: return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading draft order...</p>
        </div>
      </div>
    );
  }

  if (error && !draft) {
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
            <Link href="/supplier/b2b">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to B2B
              </Button>
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">
            Draft Order Review
          </h1>
          {draft && (
            <p className="text-slate-600 mt-2">
              Imported from {draft.importFileName} • {lines.length} items
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

        {/* Lines Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Order Items</span>
              <Button
                onClick={handleSubmitDraft}
                disabled={submitting || lines.some(line => line.matchStatus === "UNMATCHED")}
                className="gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Submit Draft
                  </>
                )}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lines.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600">No items in this draft order</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="text-left p-3 font-semibold text-slate-900">Item</th>
                      <th className="text-left p-3 font-semibold text-slate-900">Quantity</th>
                      <th className="text-left p-3 font-semibold text-slate-900">Match Status</th>
                      <th className="text-left p-3 font-semibold text-slate-900">Supplier</th>
                      <th className="text-left p-3 font-semibold text-slate-900">Price</th>
                      <th className="text-left p-3 font-semibold text-slate-900">Stock</th>
                      <th className="text-center p-3 font-semibold text-slate-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr key={line.id} className="border-b hover:bg-slate-50">
                        <td className="p-3">
                          <div>
                            <div className="font-medium text-slate-900">
                              {line.itemName}
                            </div>
                            {line.itemCode && (
                              <div className="text-sm text-slate-500">
                                Code: {line.itemCode}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            value={editingQuantities[line.id] || line.quantity.toString()}
                            onChange={(e) => handleQuantityUpdate(line.id, e.target.value)}
                            className="w-24 h-8"
                            step="0.01"
                            min="0.01"
                          />
                        </td>
                        <td className="p-3">
                          <div className={`inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium border ${getMatchStatusColor(line.matchStatus)}`}>
                            {getMatchStatusIcon(line.matchStatus)}
                            {line.matchStatus}
                          </div>
                          {line.matchNotes && (
                            <div className="text-xs text-slate-500 mt-1">
                              {line.matchNotes}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          {line.sellerName ? (
                            <div>
                              <div className="font-medium text-slate-900">
                                {line.sellerName}
                              </div>
                              <div className="text-sm text-slate-500">
                                {line.sellerAccount}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">No supplier</span>
                          )}
                        </td>
                        <td className="p-3">
                          {line.supplierPrice ? (
                            <span className="font-medium">
                              {line.supplierPrice.toLocaleString()} RWF
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="p-3">
                          {line.supplierStock !== null ? (
                            <span className={line.supplierStock < 10 ? "text-red-600 font-medium" : ""}>
                              {line.supplierStock}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleFindSuppliers(line)}
                              className="gap-1"
                            >
                              <Search className="h-3 w-3" />
                              {line.matchStatus === "MATCHED" ? "Change" : "Find"} Supplier
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRemoveLine(line.id)}
                              className="gap-1 text-red-600 hover:text-red-700"
                            >
                              <X className="h-3 w-3" />
                              Remove
                            </Button>
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

        {/* Supplier Options Modal */}
        {showSupplierModal && selectedLine && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-4xl max-h-[80vh] overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>Supplier Options for {selectedLine.itemName}</span>
                    {supplierSource && (
                      <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-normal">
                        {supplierSource}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSupplierModal(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-y-auto max-h-[60vh]">
                {loadingSuppliers ? (
                  <div className="text-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
                    <p className="text-slate-600">Loading supplier options...</p>
                  </div>
                ) : supplierOptions.length === 0 ? (
                  <div className="text-center py-12">
                    <Search className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-600">No suppliers found for this item</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {supplierOptions.map((supplier) => (
                      <div
                        key={supplier.stockId}
                        className="border border-slate-200 rounded-lg p-4 hover:border-blue-300 cursor-pointer transition-colors"
                        onClick={() => handleSelectSupplier(supplier)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="font-medium text-slate-900">
                                {supplier.supplierName}
                              </div>
                              {supplier.matchScore !== undefined && (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${supplier.matchScore >= 100 ? 'bg-green-100 text-green-700' :
                                  supplier.matchScore >= 90 ? 'bg-green-100 text-green-600' :
                                    supplier.matchScore >= 50 ? 'bg-yellow-100 text-yellow-700' :
                                      'bg-gray-100 text-gray-600'
                                  }`}>
                                  {supplier.matchScore}% match
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-slate-600 mb-2">
                              {supplier.location}
                            </div>
                            <div className="text-sm text-slate-500">
                              {supplier.itemName}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-lg text-blue-600">
                              {supplier.unitPrice.toLocaleString()} RWF
                            </div>
                            <div className="text-sm text-slate-600">
                              Stock: {supplier.availableQty}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
