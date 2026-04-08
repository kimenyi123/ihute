"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    FileText,
    ArrowLeft,
    Eye,
    Trash2,
    Loader2,
    AlertCircle,
    Package,
} from "lucide-react";
import Link from "next/link";

interface DraftOrder {
    orderId: number;
    createdAt: string;
    itemCount: number;
    totalAmount: number;
}

export default function DraftOrdersPage() {
    const router = useRouter();
    const { user, isAuthenticated, hasHydrated } = useAuthStore();
    const [drafts, setDrafts] = useState<DraftOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hasMounted, setHasMounted] = useState(false);

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
            router.push("/login");
            return;
        }

        // Skip data fetching if not authenticated
        if (!hasMounted || !isAuthenticated) {
            return;
        }

        loadDrafts();
    }, [hasHydrated, hasMounted, isAuthenticated, user, router]);

    const loadDrafts = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch("/supplier/b2b/api?action=listDrafts");
            const data = await response.json();

            if (data.ok) {
                setDrafts(data.drafts || []);
            } else {
                setError(data.message || "Failed to load draft orders");
            }
        } catch (err: any) {
            console.error("Error loading drafts:", err);
            setError("Failed to load draft orders");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (orderId: number) => {
        if (!confirm("Are you sure you want to delete this draft?")) return;

        try {
            const response = await fetch("/supplier/b2b/api?action=deleteDraft", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderId }),
            });

            const data = await response.json();

            if (data.ok) {
                // Reload drafts
                loadDrafts();
            } else {
                alert(data.message || "Failed to delete draft");
            }
        } catch (err) {
            console.error("Error deleting draft:", err);
            alert("Failed to delete draft");
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-RW", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className="text-slate-600">Loading draft orders...</p>
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
                                Back to B2B Overview
                            </Button>
                        </Link>
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900">Draft Orders</h1>
                    <p className="text-slate-600 mt-2">
                        Review and edit draft B2B orders before submitting
                    </p>
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

                {/* Empty State */}
                {!loading && drafts.length === 0 && (
                    <Card className="text-center py-12">
                        <CardContent>
                            <Package className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-slate-900 mb-2">
                                No Draft Orders
                            </h3>
                            <p className="text-slate-600 mb-6">
                                Upload an Excel file to create a new B2B order draft
                            </p>
                            <Link href="/supplier/b2b/bulk">
                                <Button>Upload Excel File</Button>
                            </Link>
                        </CardContent>
                    </Card>
                )}

                {/* Draft Orders List */}
                {drafts.length > 0 && (
                    <div className="grid grid-cols-1 gap-4">
                        {drafts.map((draft) => (
                            <Card
                                key={draft.orderId}
                                className="hover:shadow-lg transition-shadow"
                            >
                                <CardContent className="py-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
                                                <FileText className="h-6 w-6 text-yellow-600" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-slate-900">
                                                    Draft Order #{draft.orderId}
                                                </h3>
                                                <p className="text-sm text-slate-600">
                                                    Created {formatDate(draft.createdAt)} • {draft.itemCount} items •{" "}
                                                    {draft.totalAmount.toLocaleString()} RWF
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            <Link href={`/supplier/b2b/draft/${draft.orderId}`}>
                                                <Button variant="outline" size="sm" className="gap-2">
                                                    <Eye className="h-4 w-4" />
                                                    Review & Submit
                                                </Button>
                                            </Link>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                onClick={() => handleDelete(draft.orderId)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
