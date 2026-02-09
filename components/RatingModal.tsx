"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Star } from "lucide-react"

interface RatingModalProps {
    orderId: string
    sellerId: string
    sellerName: string
    items: Array<{ code: string; name: string }>
    open: boolean
    onClose: () => void
    onSuccess: () => void
}

const EMOJIS = [
    { value: 1, emoji: "😢", label: "Very Poor" },
    { value: 2, emoji: "😕", label: "Poor" },
    { value: 3, emoji: "😐", label: "Average" },
    { value: 4, emoji: "🙂", label: "Good" },
    { value: 5, emoji: "😊", label: "Excellent" },
]

export function RatingModal({ orderId, sellerId, sellerName, items, open, onClose, onSuccess }: RatingModalProps) {
    const [step, setStep] = useState<"rating" | "success">("rating")
    const [submitting, setSubmitting] = useState(false)

    // Supplier rating
    const [supplierRating, setSupplierRating] = useState<number>(0)
    const [supplierFeedback, setSupplierFeedback] = useState("")

    // Item ratings
    const [itemRatings, setItemRatings] = useState<Record<string, { rating: number; feedback: string }>>({})

    const handleItemRating = (itemCode: string, rating: number) => {
        setItemRatings(prev => ({
            ...prev,
            [itemCode]: { ...prev[itemCode], rating }
        }))
    }

    const handleItemFeedback = (itemCode: string, feedback: string) => {
        setItemRatings(prev => ({
            ...prev,
            [itemCode]: { ...prev[itemCode], feedback }
        }))
    }

    const handleSubmit = async () => {
        if (supplierRating === 0) {
            alert("Please rate the supplier")
            return
        }

        setSubmitting(true)

        try {
            // Format item ratings
            const formattedItemRatings = items
                .filter(item => itemRatings[item.code]?.rating > 0)
                .map(item => ({
                    itemCode: item.code,
                    itemName: item.name,
                    rating: itemRatings[item.code].rating,
                    feedback: itemRatings[item.code].feedback || ""
                }))

            const payload = {
                action: "submitRating",
                orderId: parseInt(orderId),
                sellerAccount: sellerId,
                supplierRating,
                supplierFeedback,
                itemRatings: formattedItemRatings
            }

            console.log("[RatingModal] Submitting rating:", payload)

            const res = await fetch("/api/ratings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })

            const data = await res.json()

            if (res.ok && data.ok) {
                setStep("success")
                setTimeout(() => {
                    onSuccess()
                    onClose()
                }, 2000)
            } else {
                alert("Failed to submit rating: " + (data.error || "Unknown error"))
            }
        } catch (error) {
            console.error("[RatingModal] Error:", error)
            alert("Failed to submit rating. Please try again.")
        } finally {
            setSubmitting(false)
        }
    }

    if (step === "success") {
        return (
            <Dialog open={open} onOpenChange={onClose}>
                <DialogContent className="max-w-md">
                    <div className="text-center py-6">
                        <div className="text-6xl mb-4">🎉</div>
                        <h3 className="text-2xl font-bold mb-2">Thank You!</h3>
                        <p className="text-muted-foreground">
                            Your feedback helps other buyers make better decisions.
                        </p>
                    </div>
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Rate Your Order</DialogTitle>
                    <DialogDescription>
                        Share your experience with {sellerName}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 my-4">
                    {/* Supplier Rating */}
                    <div className="space-y-3">
                        <Label className="text-base font-semibold">How was the overall service?</Label>
                        <div className="flex gap-4 justify-center">
                            {EMOJIS.map(({ value, emoji, label }) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setSupplierRating(value)}
                                    className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${supplierRating === value
                                            ? "border-blue-500 bg-blue-50 scale-110"
                                            : "border-gray-200 hover:border-gray-300"
                                        }`}
                                >
                                    <span className="text-4xl">{emoji}</span>
                                    <span className="text-xs text-muted-foreground">{label}</span>
                                </button>
                            ))}
                        </div>

                        {supplierRating > 0 && (
                            <div className="space-y-2 mt-4">
                                <Label htmlFor="supplier-feedback" className="text-sm">
                                    Additional Comments (Optional)
                                </Label>
                                <Textarea
                                    id="supplier-feedback"
                                    placeholder="Tell us about delivery speed, packaging, communication..."
                                    value={supplierFeedback}
                                    onChange={(e) => setSupplierFeedback(e.target.value)}
                                    rows={3}
                                    maxLength={500}
                                />
                            </div>
                        )}
                    </div>

                    {/* Item Ratings */}
                    {items.length > 0 && (
                        <div className="space-y-4 pt-4 border-t">
                            <Label className="text-base font-semibold">Rate Individual Items (Optional)</Label>

                            {items.map((item) => (
                                <div key={item.code} className="space-y-2 p-4 bg-slate-50 rounded-lg">
                                    <div className="font-medium text-sm">{item.name}</div>

                                    <div className="flex gap-2">
                                        {EMOJIS.map(({ value, emoji }) => (
                                            <button
                                                key={value}
                                                type="button"
                                                onClick={() => handleItemRating(item.code, value)}
                                                className={`text-2xl p-2 rounded transition-all ${itemRatings[item.code]?.rating === value
                                                        ? "bg-white scale-110 shadow-sm"
                                                        : "hover:bg-white/50"
                                                    }`}
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                    </div>

                                    {itemRatings[item.code]?.rating > 0 && (
                                        <Textarea
                                            placeholder="Feedback for this item..."
                                            value={itemRatings[item.code]?.feedback || ""}
                                            onChange={(e) => handleItemFeedback(item.code, e.target.value)}
                                            rows={2}
                                            maxLength={200}
                                            className="text-sm"
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onClose} disabled={submitting}>
                        Maybe Later
                    </Button>
                    <Button onClick={handleSubmit} disabled={submitting || supplierRating === 0}>
                        {submitting ? "Submitting..." : "Submit Rating"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
