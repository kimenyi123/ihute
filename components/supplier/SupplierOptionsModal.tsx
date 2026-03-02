"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSupplierOptions, updateLineSupplier, type SupplierOption } from "@/lib/b2bApi";
import { MapPin, Package, DollarSign, TrendingUp } from "lucide-react";
import { toast } from "sonner";

interface SupplierOptionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    lineId: number;
    currentSupplierName?: string;
    currentPrice?: number;
    onSupplierChanged?: () => void;
}

export default function SupplierOptionsModal({
    isOpen,
    onClose,
    lineId,
    currentSupplierName,
    currentPrice,
    onSupplierChanged,
}: SupplierOptionsModalProps) {
    const [options, setOptions] = useState<SupplierOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [source, setSource] = useState<string>("");

    // Load supplier options when modal opens
    useState(() => {
        if (isOpen && lineId) {
            loadOptions();
        }
    });

    const loadOptions = async () => {
        setLoading(true);
        try {
            const result = await getSupplierOptions(lineId);
            setOptions(result.options);
            setSource(result.source);
        } catch (error: any) {
            toast.error("Failed to load supplier options: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectSupplier = async (option: SupplierOption) => {
        setUpdating(true);
        try {
            const result = await updateLineSupplier({
                lineId,
                stockId: option.stockId,
            });

            toast.success(
                `Supplier updated to ${result.supplierName} @ ${result.unitPrice.toLocaleString()} RWF`
            );

            onSupplierChanged?.();
            onClose();
        } catch (error: any) {
            toast.error("Failed to update supplier: " + error.message);
        } finally {
            setUpdating(false);
        }
    };

    const getMatchScoreColor = (score?: number) => {
        if (!score) return "bg-gray-500";
        if (score >= 100) return "bg-green-600";
        if (score >= 90) return "bg-green-500";
        if (score >= 50) return "bg-yellow-500";
        if (score >= 30) return "bg-orange-500";
        return "bg-gray-500";
    };

    const getMatchScoreLabel = (score?: number) => {
        if (!score) return "N/A";
        if (score >= 100) return "Exact Match";
        if (score >= 90) return "High Match";
        if (score >= 50) return "Good Match";
        if (score >= 30) return "Partial Match";
        return "Fuzzy Match";
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Supplier Options
                        {source && (
                            <Badge variant="outline" className="ml-2">
                                Source: {source}
                            </Badge>
                        )}
                    </DialogTitle>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    </div>
                ) : options.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No alternative suppliers found</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {currentSupplierName && (
                            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                    Current Supplier: {currentSupplierName}
                                    {currentPrice && (
                                        <span className="ml-2 text-blue-700 dark:text-blue-300">
                                            @ {currentPrice.toLocaleString()} RWF
                                        </span>
                                    )}
                                </p>
                            </div>
                        )}

                        {options.map((option, index) => {
                            const priceDiff = currentPrice
                                ? ((option.unitPrice - currentPrice) / currentPrice) * 100
                                : 0;

                            return (
                                <div
                                    key={index}
                                    className="border rounded-lg p-4 hover:border-primary transition-colors"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-semibold">{option.supplierName}</h4>
                                                {option.matchScore !== undefined && (
                                                    <Badge className={getMatchScoreColor(option.matchScore)}>
                                                        {getMatchScoreLabel(option.matchScore)}
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground">{option.itemName}</p>
                                        </div>

                                        <Button
                                            size="sm"
                                            onClick={() => handleSelectSupplier(option)}
                                            disabled={updating}
                                        >
                                            {updating ? "Updating..." : "Select"}
                                        </Button>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                        <div className="flex items-center gap-1.5">
                                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                                            <div>
                                                <p className="font-medium">{option.unitPrice.toLocaleString()} RWF</p>
                                                {currentPrice && priceDiff !== 0 && (
                                                    <p
                                                        className={`text-xs ${priceDiff < 0 ? "text-green-600" : "text-red-600"
                                                            }`}
                                                    >
                                                        {priceDiff > 0 && "+"}
                                                        {priceDiff.toFixed(1)}%
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                            <Package className="h-4 w-4 text-muted-foreground" />
                                            <div>
                                                <p className="font-medium">{option.availableQty}</p>
                                                <p className="text-xs text-muted-foreground">in stock</p>
                                            </div>
                                        </div>

                                        {option.location && (
                                            <div className="flex items-center gap-1.5 col-span-2">
                                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                                <p className="text-muted-foreground truncate">{option.location}</p>
                                            </div>
                                        )}
                                    </div>

                                    {option.matchScore !== undefined && (
                                        <div className="mt-2 pt-2 border-t">
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                <TrendingUp className="h-3 w-3" />
                                                Match Score: {option.matchScore}/100
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
