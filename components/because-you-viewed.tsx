"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Eye } from "lucide-react"
import { getRecentInteractions } from "@/lib/interaction-tracker"
import { getCollaborativeRecommendations } from "@/lib/recommendation-service"
import { getProductImageSrc } from "@/lib/image-utils"
import { ProductImageFallback } from "@/components/product-image-fallback"

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
    item_code?: string
    item_key_words?: string
    famille?: string
    niki_code?: string
    NIKI_CODE?: string
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
                        image: getProductImageSrc(item as Record<string, unknown>),
                        supplierName: item.SELLER_NAMES,
                        item_code: item.ITEM_CODE,
                        item_key_words: item.ITEM_KEY_WORDS,
                        famille: item.FAMILLE,
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
                <CardHeader className="pb-3">
                    <Skeleton className="h-6 w-48" />
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        {Array.from({ length: limit }).map((_, i) => (
                            <div key={i} className="space-y-2">
                                <Skeleton className="aspect-square rounded-lg" />
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
            <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                    <Eye className="h-5 w-5 text-blue-500" />
                    <CardTitle className="text-lg">
                        Because you viewed <span className="text-blue-600 font-semibold">&quot;{viewedProduct}&quot;</span>
                    </CardTitle>
                </div>
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
                                    <ProductImageFallback
                                        source={product as any}
                                        alt={product.name}
                                        className="w-full h-full object-cover"
                                    />
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
