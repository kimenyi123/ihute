"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Star } from "lucide-react"
import { Progress } from "@/components/ui/progress"

interface Props {
    account: string
    initialRating?: number
    initialCount?: number
}

interface RatingData {
    rating: number
    totalRatings: number
    breakdown: Record<string, number>
}

export function SupplierRatingCard({ account, initialRating, initialCount }: Props) {
    const [ratingData, setRatingData] = useState<RatingData | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (initialRating !== undefined && initialCount !== undefined) {
            // Use provided data if available
            setRatingData({
                rating: initialRating,
                totalRatings: initialCount,
                breakdown: {},
            })
            setLoading(false)
        } else {
            // Fetch from API
            fetchRatingData()
        }
    }, [account, initialRating, initialCount])

    async function fetchRatingData() {
        try {
            const res = await fetch(`/api/ratings?action=getSupplierRating&account=${encodeURIComponent(account)}`)
            const data = await res.json()

            if (data.ok) {
                setRatingData({
                    rating: data.rating,
                    totalRatings: data.totalRatings,
                    breakdown: data.breakdown || {},
                })
            }
        } catch (error) {
            console.error("Error fetching rating data:", error)
        } finally {
            setLoading(false)
        }
    }

    const renderStars = (rating: number) => {
        const stars = []
        const fullStars = Math.floor(rating)
        const hasHalfStar = rating % 1 >= 0.5

        for (let i = 1; i <= 5; i++) {
            if (i <= fullStars) {
                stars.push(
                    <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                )
            } else if (i === fullStars + 1 && hasHalfStar) {
                stars.push(
                    <div key={i} className="relative h-5 w-5">
                        <Star className="absolute h-5 w-5 text-gray-300" />
                        <div className="absolute overflow-hidden w-1/2">
                            <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                        </div>
                    </div>
                )
            } else {
                stars.push(
                    <Star key={i} className="h-5 w-5 text-gray-300" />
                )
            }
        }
        return stars
    }

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Supplier Rating</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="animate-pulse">
                        <div className="h-8 bg-gray-200 rounded w-32 mb-2"></div>
                        <div className="h-4 bg-gray-200 rounded w-24"></div>
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (!ratingData || ratingData.totalRatings === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Supplier Rating</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">No ratings yet</p>
                </CardContent>
            </Card>
        )
    }

    const { rating, totalRatings, breakdown } = ratingData

    return (
        <Card>
            <CardHeader>
                <CardTitle>Supplier Rating</CardTitle>
                <CardDescription>{totalRatings} {totalRatings === 1 ? 'rating' : 'ratings'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Main Rating Display */}
                <div className="flex items-center gap-4">
                    <div className="text-5xl font-bold">{rating.toFixed(1)}</div>
                    <div>
                        <div className="flex gap-1 mb-1">
                            {renderStars(rating)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Based on {totalRatings} {totalRatings === 1 ? 'review' : 'reviews'}
                        </p>
                    </div>
                </div>

                {/* Rating Breakdown */}
                {Object.keys(breakdown).length > 0 && (
                    <div className="space-y-2">
                        <h4 className="text-sm font-medium">Rating Distribution</h4>
                        {[5, 4, 3, 2, 1].map((star) => {
                            const count = breakdown[star.toString()] || 0
                            const percentage = totalRatings > 0 ? (count / totalRatings) * 100 : 0

                            return (
                                <div key={star} className="flex items-center gap-2">
                                    <div className="flex items-center gap-1 w-16">
                                        <span className="text-sm">{star}</span>
                                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                    </div>
                                    <Progress value={percentage} className="flex-1" />
                                    <span className="text-sm text-muted-foreground w-12 text-right">
                                        {count}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
