"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, Sparkles } from "lucide-react"
import { getSmartRecommendations } from "@/lib/recommendation-service"
import { trackABTestEvent } from "@/lib/recommendation-config"

/**
 * Personalized "Recommended for You" Section
 * Main recommendation showcase for homepage
 */

type Product = {
    id: string
    name: string
    price?: number
    image?: string
    supplierName?: string
    category?: string
}

interface RecommendedForYouProps {
    className?: string
    limit?: number
}

export function RecommendedForYou({ className, limit = 12 }: RecommendedForYouProps) {
    const [recommendations, setRecommendations] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [source, setSource] = useState<"cache" | "backend">("backend")

    useEffect(() => {
        loadRecommendations()
    }, [])

    async function loadRecommendations() {
        try {
            setLoading(true)

            const { products: productIds, source: dataSource } = await getSmartRecommendations(limit)
            setSource(dataSource)

            // Track A/B test impression
            trackABTestEvent("recommended_for_you_view", {
                source: dataSource,
                productCount: productIds.length,
            })

            if (productIds.length === 0) {
                setLoading(false)
                return
            }

            // Enrich with product details
            const enriched = await enrichProducts(productIds)
            setRecommendations(enriched)
        } catch (error) {
            console.error("[RecommendedForYou] Error:", error)
        } finally {
            setLoading(false)
        }
    }

    async function enrichProducts(productIds: string[]): Promise<Product[]> {
        const products: Product[] = []
        const seen = new Set<string>()

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
                    const productId = item.ITEM_CODE || id
                    if (seen.has(productId)) continue
                    seen.add(productId)

                    products.push({
                        id: productId,
                        name: item.ITEM_NAME || id,
                        price: parseFloat(item.SALE_PRICE_INCLUSIVE || "0") || undefined,
                        image: item.image_url ?? item.item_image_url ?? item.image ?? item.IMAGE_URL,
                        supplierName: item.SELLER_NAMES,
                        category: item.FAMILLE || item.CATEGORY,
                    })
                }
            } catch (error) {
                console.warn(`[RecommendedForYou] Failed to enrich ${id}:`, error)
            }
        }

        return products
    }

    function handleProductClick(productId: string) {
        trackABTestEvent("recommended_product_click", {
            productId,
            source,
        })
    }

    if (loading) {
        return (
            <section className={className}>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Sparkles className="h-6 w-6 text-yellow-500" />
                        Recommended for You
                    </h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="space-y-2">
                            <Skeleton className="aspect-square w-full rounded-lg" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-3 w-2/3" />
                        </div>
                    ))}
                </div>
            </section>
        )
    }

    if (recommendations.length === 0) {
        return (
            <section className={className}>
                <div className="text-center py-12">
                    <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Start Browsing to Get Recommendations</h3>
                    <p className="text-sm text-muted-foreground">
                        Check out some products to see personalized suggestions here
                    </p>
                </div>
            </section>
        )
    }

    return (
        <section className={className}>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Sparkles className="h-6 w-6 text-yellow-500" />
                    Recommended for You
                </h2>
                {source === "cache" && (
                    <Badge variant="outline" className="text-xs">
                        <TrendingUp className="h-3 w-3 mr-1" />
                        Personalized
                    </Badge>
                )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                {recommendations.map((product) => (
                    <Link
                        key={product.id}
                        href={`/search?q=${encodeURIComponent(product.name)}`}
                        onClick={() => handleProductClick(product.id)}
                        className="group"
                    >
                        <Card className="h-full hover:shadow-lg transition-shadow">
                            <CardContent className="p-3 space-y-2">
                                <div className="aspect-square bg-muted rounded-lg overflow-hidden">
                                    {product.image ? (
                                        <img
                                            src={product.image}
                                            alt={product.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
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
                                    {product.category && (
                                        <Badge variant="secondary" className="text-xs">
                                            {product.category}
                                        </Badge>
                                    )}
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
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>
        </section>
    )
}
