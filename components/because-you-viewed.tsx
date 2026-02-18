"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Eye } from "lucide-react"
import { getRecentInteractions } from "@/lib/interaction-tracker"
import { getCollaborativeRecommendations } from "@/lib/recommendation-service"

/**
 * "Because You Viewed X" Recommendation Section
 * Shows personalized recommendations based on recently viewed products
 */

type Product = {
    id: string
    name: string
    price?: number
    image?: string
    supplierName?: string
}

interface BecauseYouViewedProps {
    className?: string
    limit?: number
}

export function BecauseYouViewed({ className, limit = 6 }: BecauseYouViewedProps) {
    const [recommendations, setRecommendations] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [viewedProduct, setViewedProduct] = useState<string | null>(null)

    useEffect(() => {
        loadRecommendations()
    }, [])

    async function loadRecommendations() {
        try {
            setLoading(true)

            // Get most recently viewed product
            const recentViews = getRecentInteractions("product", 1)
            if (recentViews.length === 0) {
                setLoading(false)
                return
            }

            const lastViewed = recentViews[0]
            setViewedProduct(lastViewed.entityName || lastViewed.entityId)

            // Get collaborative recommendations
            const productIds = await getCollaborativeRecommendations(lastViewed.entityId, limit)

            if (productIds.length === 0) {
                setLoading(false)
                return
            }

            // Enrich with product details
            const enriched = await enrichProducts(productIds)
            setRecommendations(enriched)
        } catch (error) {
            console.error("[BecauseYouViewed] Error:", error)
        } finally {
            setLoading(false)
        }
    }

    async function enrichProducts(productIds: string[]): Promise<Product[]> {
        const products: Product[] = []

        for (const id of productIds.slice(0, limit)) {
            try {
                const resp = await fetch(
                    `/api/fetchSuggestions?globalSearch=${encodeURIComponent(id)}&limit=1&Currency=RWF`,
                    { cache: "no-store" }
                )

                if (!resp.ok) continue

                const payload = await resp.json()
                const item = payload.products?.[0]

                if (item) {
                    products.push({
                        id: item.ITEM_CODE || id,
                        name: item.ITEM_NAME || id,
                        price: parseFloat(item.SALE_PRICE_INCLUSIVE || "0") || undefined,
                        image: item.IMAGE_URL,
                        supplierName: item.SELLER_NAMES,
                    })
                }
            } catch (error) {
                console.warn(`[BecauseYouViewed] Failed to enrich ${id}:`, error)
            }
        }

        return products
    }

    if (loading) {
        return (
            <Card className={className}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Eye className="h-5 w-5" />
                        <Skeleton className="h-6 w-48" />
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="space-y-2">
                                <Skeleton className="h-32 w-full rounded-lg" />
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-3 w-2/3" />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (recommendations.length === 0) {
        return null
    }

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Eye className="h-5 w-5 text-blue-600" />
                    <span>Because you viewed &quot;{viewedProduct}&quot;</span>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {recommendations.map((product) => (
                        <Link
                            key={product.id}
                            href={`/search?q=${encodeURIComponent(product.name)}`}
                            className="group"
                        >
                            <div className="space-y-2">
                                <div className="aspect-square bg-muted rounded-lg overflow-hidden group-hover:shadow-md transition-shadow">
                                    {product.image ? (
                                        <img
                                            src={product.image}
                                            alt={product.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                            No image
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-medium line-clamp-2 group-hover:text-blue-600 transition-colors">
                                        {product.name}
                                    </p>
                                    {product.supplierName && (
                                        <p className="text-xs text-muted-foreground line-clamp-1">
                                            {product.supplierName}
                                        </p>
                                    )}
                                    {product.price && (
                                        <p className="text-sm font-semibold text-primary">
                                            {Math.round(product.price).toLocaleString()} RWF
                                        </p>
                                    )}
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
