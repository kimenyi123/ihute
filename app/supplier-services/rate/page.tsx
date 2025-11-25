"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuthStore } from "@/lib/auth-store"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { HalfStarRating } from "@/components/half-star-rating"
import { Star, Store, Truck, MessageSquare, Clock } from "lucide-react"

type ServiceRating = {
  supplierId?: string
  supplierName?: string
  orderId?: string
  serviceType?: "delivery" | "overall"
}

export default function RateSupplierServicePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, user } = useAuthStore()
  
  const [service, setService] = useState<ServiceRating>({
    serviceType: "overall"
  })
  const [deliveryRating, setDeliveryRating] = useState<number>(0)
  const [communicationRating, setCommunicationRating] = useState<number>(0)
  const [feedback, setFeedback] = useState<string>("")
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
    // Load service details from search params
    const supplierId = searchParams.get("supplierId")
    const supplierName = searchParams.get("supplierName")
    const orderId = searchParams.get("orderId")
    const serviceType = searchParams.get("serviceType") as "delivery" | "overall" | null

    if (supplierId) {
      setService({
        supplierId,
        supplierName: supplierName || undefined,
        orderId: orderId || undefined,
        serviceType: serviceType || "overall",
      })
    }
  }, [searchParams])

  const handleSubmit = async () => {
    if (deliveryRating === 0 || communicationRating === 0) {
      alert("Please complete all ratings")
      return
    }

    setSubmitting(true)
    try {
      // TODO: Create API endpoint for supplier service rating
      const res = await fetch("/api/supplier-services/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: service.supplierId,
          orderId: service.orderId,
          deliveryRating,
          communicationRating,
          feedback,
          email: user?.email || searchParams.get("email") || "anonymous",
        }),
      })

      const json = await res.json()
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to submit rating")

      alert("Thank you for your rating!")
      // Redirect back to track order if anonymous, otherwise to orders
      if (service.orderId && !isAuthenticated) {
        router.push(`/track-order/${service.orderId}`)
      } else {
        router.push("/orders")
      }
    } catch (e: any) {
      alert(e?.message || "Failed to submit rating")
    } finally {
      setSubmitting(false)
    }
  }

  const overallRating = deliveryRating && communicationRating 
    ? (deliveryRating + communicationRating) / 2 
    : 0

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Rate Supplier Service</h1>
          <p className="text-slate-600 mt-1">Share your experience with this supplier</p>
        </div>

        <Card className="mt-6 hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="h-16 w-16 rounded-lg bg-blue-100 flex items-center justify-center">
                <Store className="h-8 w-8 text-blue-600" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg">{service.supplierName || "Supplier"}</CardTitle>
                {service.orderId && (
                  <p className="text-sm text-slate-600 mt-1">Order #{service.orderId}</p>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Overall Rating */}
            {overallRating > 0 && (
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-900">Overall Rating</span>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`h-6 w-6 ${
                          overallRating >= s ? "fill-yellow-400 text-yellow-400" : "text-slate-300"
                        }`}
                      />
                    ))}
                    <span className="text-lg font-bold text-blue-900">{overallRating.toFixed(1)}/5</span>
                  </div>
                </div>
              </div>
            )}

            {/* Delivery Service Rating */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-slate-600" />
                <h3 className="text-sm font-semibold">Delivery Service</h3>
              </div>
              <p className="text-xs text-slate-600">
                How satisfied were you with the delivery service?
              </p>
              <HalfStarRating
                value={deliveryRating}
                onChange={setDeliveryRating}
                maxStars={5}
                size="lg"
                showValue={true}
              />
            </div>

            {/* Communication Rating */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-slate-600" />
                <h3 className="text-sm font-semibold">Communication</h3>
              </div>
              <p className="text-xs text-slate-600">
                How satisfied were you with their communication and responsiveness?
              </p>
              <HalfStarRating
                value={communicationRating}
                onChange={setCommunicationRating}
                maxStars={5}
                size="lg"
                showValue={true}
              />
            </div>

            {/* Feedback */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Additional Feedback
              </h3>
              <textarea
                className="w-full rounded-lg border border-slate-300 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Share any additional thoughts about the supplier's service..."
                rows={5}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
            </div>

            {/* Help Text */}
            <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
              <div className="flex items-start gap-2">
                <Clock className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-900">Rating Tips</p>
                  <ul className="text-xs text-amber-800 mt-1 space-y-1 ml-0 pl-0 list-none">
                    <li>• 5 stars: Exceeded expectations</li>
                    <li>• 4 stars: Met expectations</li>
                    <li>• 3 stars: Average service</li>
                    <li>• 2 stars: Below expectations</li>
                    <li>• 1 star: Very dissatisfied</li>
                  </ul>
                </div>
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
                disabled={submitting || deliveryRating === 0 || communicationRating === 0}
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

