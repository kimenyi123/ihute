"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuthStore } from "@/lib/auth-store"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { HalfStarRating } from "@/components/half-star-rating"
import { Package, Image as ImageIcon, MessageSquare } from "lucide-react"

type ProductRating = {
  productId?: string
  productName?: string
  supplierId?: string
  supplierName?: string
  orderId?: string
}

export default function RateProductPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, user } = useAuthStore()
  
  const [product, setProduct] = useState<ProductRating>({})
  const [rating, setRating] = useState<number>(0)
  const [feedback, setFeedback] = useState<string>("")
  const [images, setImages] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Allow anonymous users if they have orderId (from track order page)
  useEffect(() => {
    const orderId = searchParams.get("orderId")
    if (!isAuthenticated && !orderId) {
      router.push("/login")
    }
  }, [isAuthenticated, searchParams, router])

  useEffect(() => {
    // Load product details from search params
    const productId = searchParams.get("productId")
    const productName = searchParams.get("productName")
    const supplierId = searchParams.get("supplierId")
    const supplierName = searchParams.get("supplierName")
    const orderId = searchParams.get("orderId")

    if (productId) {
      setProduct({
        productId,
        productName: productName || undefined,
        supplierId: supplierId || undefined,
        supplierName: supplierName || undefined,
        orderId: orderId || undefined,
      })
    }
  }, [searchParams])

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        setImages((prev) => [...prev, reader.result as string])
      }
      reader.readAsDataURL(file)
    })
  }

  const handleSubmit = async () => {
    if (rating === 0) {
      alert("Please select a rating")
      return
    }

    setSubmitting(true)
    try {
      // TODO: Create API endpoint for product rating
      const res = await fetch("/api/products/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.productId,
          supplierId: product.supplierId,
          orderId: product.orderId,
          rating,
          feedback,
          images,
          email: user?.email || searchParams.get("email") || "anonymous",
        }),
      })

      const json = await res.json()
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to submit rating")

      alert("Thank you for your rating!")
      // Redirect back to track order if anonymous, otherwise to orders
      if (product.orderId && !isAuthenticated) {
        router.push(`/track-order/${product.orderId}`)
      } else {
        router.push("/orders")
      }
    } catch (e: any) {
      alert(e?.message || "Failed to submit rating")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Rate Product</h1>
          <p className="text-slate-600 mt-1">Share your experience with this product</p>
        </div>

        <Card className="mt-6 hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="h-16 w-16 rounded-lg bg-slate-200 flex items-center justify-center">
                <Package className="h-8 w-8 text-slate-400" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg">{product.productName || "Product"}</CardTitle>
                {product.supplierName && (
                  <p className="text-sm text-slate-600 mt-1">from {product.supplierName}</p>
                )}
                {product.orderId && (
                  <p className="text-xs text-slate-500 mt-1">Order #{product.orderId}</p>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Rating Stars */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Your Rating</h3>
              <HalfStarRating
                value={rating}
                onChange={setRating}
                maxStars={5}
                size="lg"
                showValue={true}
              />
            </div>

            {/* Feedback */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Your Review
              </h3>
              <textarea
                className="w-full rounded-lg border border-slate-300 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Share your thoughts about this product. What did you like or dislike?"
                rows={5}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
            </div>

            {/* Image Upload */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Add Photos (Optional)
              </h3>
              <div className="space-y-3">
                {images.length > 0 && (
                  <div className="grid grid-cols-3 gap-3">
                    {images.map((img, idx) => (
                      <div key={idx} className="relative group">
                        <img
                          src={img}
                          alt={`Upload ${idx + 1}`}
                          className="w-full h-24 object-cover rounded-lg border border-slate-300"
                        />
                        <button
                          onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <label className="block">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition-colors">
                    <ImageIcon className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                    <p className="text-sm text-slate-600">
                      Click to upload photos or drag and drop
                    </p>
                    <p className="text-xs text-slate-500 mt-1">PNG, JPG up to 10MB</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => router.back()}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || rating === 0}
                className="flex-1"
              >
                {submitting ? "Submitting…" : "Submit Rating"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  )
}

