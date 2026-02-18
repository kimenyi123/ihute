"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Star, Flag, Check, X, Search, TrendingUp, TrendingDown } from "lucide-react"
import { toast } from "sonner"

interface Rating {
    id: number
    orderId: number
    buyerAccount: string | null
    buyerEmail: string | null
    buyerPhone: string
    sellerAccount: string
    sellerName: string | null
    supplierRating: number
    supplierFeedback: string | null
    ratedAt: string
    isFlagged: boolean
    flagCount: number
    sellerResponse: string | null
}

interface Analytics {
    totalRatings: number
    averageRating: number
    distribution: Record<string, number>
    flaggedCount: number
    sellerResponseRate: number
    topRatedSuppliers: Array<{
        account: string
        name: string
        rating: number
        totalRatings: number
    }>
}

export default function AdminRatingsPage() {
    const [ratings, setRatings] = useState<Rating[]>([])
    const [analytics, setAnalytics] = useState<Analytics | null>(null)
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [statusFilter, setStatusFilter] = useState("all")
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedRating, setSelectedRating] = useState<Rating | null>(null)
    const [flagReason, setFlagReason] = useState("")
    const [adminNotes, setAdminNotes] = useState("")
    const [showFlagDialog, setShowFlagDialog] = useState(false)

    // Fetch ratings
    useEffect(() => {
        fetchRatings()
    }, [page, statusFilter, searchTerm])

    // Fetch analytics
    useEffect(() => {
        fetchAnalytics()
    }, [])

    async function fetchRatings() {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: "20",
                status: statusFilter,
            })
            if (searchTerm) params.append("search", searchTerm)

            const res = await fetch(`/api/admin/ratings?${params}`)
            const data = await res.json()

            if (data.ok) {
                setRatings(data.ratings)
                setTotalPages(data.pagination.totalPages)
            } else {
                toast.error("Failed to load ratings")
            }
        } catch (error) {
            console.error("Error fetching ratings:", error)
            toast.error("Error loading ratings")
        } finally {
            setLoading(false)
        }
    }

    async function fetchAnalytics() {
        try {
            const res = await fetch("/api/admin/ratings?action=getRatingAnalytics&period=30days")
            const data = await res.json()

            if (data.ok) {
                setAnalytics(data.analytics)
            }
        } catch (error) {
            console.error("Error fetching analytics:", error)
        }
    }

    async function handleFlagRating(ratingId: number) {
        try {
            const res = await fetch("/api/admin/ratings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "flagRating",
                    ratingId,
                    reason: flagReason || "inappropriate",
                    adminNotes,
                }),
            })

            const data = await res.json()

            if (data.ok) {
                toast.success("Rating flagged successfully")
                setShowFlagDialog(false)
                fetchRatings()
                fetchAnalytics()
            } else {
                toast.error("Failed to flag rating")
            }
        } catch (error) {
            console.error("Error flagging rating:", error)
            toast.error("Error flagging rating")
        }
    }

    async function handleApproveRating(ratingId: number) {
        try {
            const res = await fetch("/api/admin/ratings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "approveRating",
                    ratingId,
                }),
            })

            const data = await res.json()

            if (data.ok) {
                toast.success("Rating approved")
                fetchRatings()
                fetchAnalytics()
            } else {
                toast.error("Failed to approve rating")
            }
        } catch (error) {
            toast.error("Error approving rating")
        }
    }

    async function handleRemoveRating(ratingId: number) {
        if (!confirm("Are you sure you want to remove this rating? This cannot be undone.")) {
            return
        }

        try {
            const res = await fetch("/api/admin/ratings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "removeRating",
                    ratingId,
                }),
            })

            const data = await res.json()

            if (data.ok) {
                toast.success("Rating removed successfully")
                fetchRatings()
                fetchAnalytics()
            } else {
                toast.error("Failed to remove rating")
            }
        } catch (error) {
            toast.error("Error removing rating")
        }
    }

    const renderStars = (rating: number) => {
        const stars = []
        for (let i = 1; i <= 5; i++) {
            stars.push(
                <Star
                    key={i}
                    className={`h-4 w-4 ${i <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
                />
            )
        }
        return <div className="flex gap-0.5">{stars}</div>
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Rating Management</h1>
                <p className="text-muted-foreground">Manage and moderate customer ratings</p>
            </div>

            {/* Analytics Cards */}
            {analytics && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Ratings</CardTitle>
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{analytics.totalRatings}</div>
                            <p className="text-xs text-muted-foreground">Last 30 days</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
                            <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{analytics.averageRating.toFixed(1)}/5.0</div>
                            <p className="text-xs text-muted-foreground">Platform average</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Flagged Ratings</CardTitle>
                            <Flag className="h-4 w-4 text-destructive" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{analytics.flaggedCount}</div>
                            <p className="text-xs text-muted-foreground">Require review</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Response Rate</CardTitle>
                            <TrendingDown className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{analytics.sellerResponseRate.toFixed(1)}%</div>
                            <p className="text-xs text-muted-foreground">Sellers responding</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle>Filters</CardTitle>
                </CardHeader>
                <CardContent className="flex gap-4">
                    <div className="flex-1">
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by order ID, seller..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8"
                            />
                        </div>
                    </div>

                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Ratings</SelectItem>
                            <SelectItem value="rated">Completed</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="flagged">Flagged</SelectItem>
                        </SelectContent>
                    </Select>

                    <Button variant="outline" onClick={() => fetchRatings()}>
                        Refresh
                    </Button>
                </CardContent>
            </Card>

            {/* Ratings Table */}
            <Card>
                <CardHeader>
                    <CardTitle>All Ratings</CardTitle>
                    <CardDescription>
                        Page {page} of {totalPages}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8">Loading...</div>
                    ) : ratings.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">No ratings found</div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Order ID</TableHead>
                                    <TableHead>Seller</TableHead>
                                    <TableHead>Rating</TableHead>
                                    <TableHead>Feedback</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {ratings.map((rating) => (
                                    <TableRow key={rating.id}>
                                        <TableCell className="font-medium">#{rating.orderId}</TableCell>
                                        <TableCell>
                                            <div>
                                                <div className="font-medium">{rating.sellerName || "Unknown"}</div>
                                                <div className="text-sm text-muted-foreground">{rating.sellerAccount}</div>
                                            </div>
                                        </TableCell>
                                        <TableCell>{renderStars(Math.round(rating.supplierRating))}</TableCell>
                                        <TableCell className="max-w-xs truncate">
                                            {rating.supplierFeedback || <span className="text-muted-foreground">No feedback</span>}
                                        </TableCell>
                                        <TableCell>{new Date(rating.ratedAt).toLocaleDateString()}</TableCell>
                                        <TableCell>
                                            {rating.isFlagged ? (
                                                <Badge variant="destructive">
                                                    <Flag className="h-3 w-3 mr-1" />
                                                    Flagged
                                                </Badge>
                                            ) : rating.sellerResponse ? (
                                                <Badge variant="secondary">Has Response</Badge>
                                            ) : (
                                                <Badge>Active</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-2">
                                                {rating.isFlagged ? (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleApproveRating(rating.id)}
                                                        >
                                                            <Check className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="destructive"
                                                            onClick={() => handleRemoveRating(rating.id)}
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => {
                                                            setSelectedRating(rating)
                                                            setShowFlagDialog(true)
                                                        }}
                                                    >
                                                        <Flag className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex justify-center gap-2 mt-4">
                            <Button
                                variant="outline"
                                onClick={() => setPage(page - 1)}
                                disabled={page === 1}
                            >
                                Previous
                            </Button>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">
                                    Page {page} of {totalPages}
                                </span>
                            </div>
                            <Button
                                variant="outline"
                                onClick={() => setPage(page + 1)}
                                disabled={page === totalPages}
                            >
                                Next
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Flag Dialog */}
            <Dialog open={showFlagDialog} onOpenChange={setShowFlagDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Flag Rating</DialogTitle>
                        <DialogDescription>
                            Flag this rating for review. Provide a reason and any additional notes.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium">Reason</label>
                            <Select value={flagReason} onValueChange={setFlagReason}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a reason" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="inappropriate">Inappropriate Content</SelectItem>
                                    <SelectItem value="spam">Spam</SelectItem>
                                    <SelectItem value="fake">Fake Rating</SelectItem>
                                    <SelectItem value="offensive">Offensive Language</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <label className="text-sm font-medium">Admin Notes</label>
                            <Textarea
                                placeholder="Add any additional context..."
                                value={adminNotes}
                                onChange={(e) => setAdminNotes(e.target.value)}
                                rows={3}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowFlagDialog(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() => selectedRating && handleFlagRating(selectedRating.id)}
                            disabled={!flagReason}
                        >
                            Flag Rating
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
