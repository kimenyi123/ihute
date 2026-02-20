"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, TrendingUp, Users, Calendar, ArrowLeft } from "lucide-react";

interface RatingStats {
  totalRatings: number;
  averageRating: number;
  distribution: {
    "5": number;
    "4": number;
    "3": number;
    "2": number;
    "1": number;
  };
  percentages: {
    "5": number;
    "4": number;
    "3": number;
    "2": number;
    "1": number;
  };
  recentRatings: Array<{
    orderId: number;
    rating: number;
    feedback: string;
    ratedAt: string;
    buyerEmail: string;
  }>;
}

const emojiMap: { [key: number]: string } = {
  1: "😢",
  2: "😕",
  3: "😐",
  4: "🙂",
  5: "😊",
};

export default function SupplierRatingsPage() {
  const router = useRouter();
  const { user, isAuthenticated, hasHydrated } = useAuthStore();
  const [stats, setStats] = useState<RatingStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasHydrated) return;

    if (!isAuthenticated || user?.role !== "supplier") {
      router.push("/login");
      return;
    }

    if (!user?.ishyigaAccount) {
      setError("No supplier account found");
      setIsLoading(false);
      return;
    }

    fetchRatingStats();
  }, [hasHydrated, isAuthenticated, user, router]);

  const fetchRatingStats = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`/api/ratings/stats?sellerAccount=${encodeURIComponent(user!.ishyigaAccount!)}`);
      const data = await res.json();

      if (data.ok) {
        // Handle case where stats might be empty or null
        setStats(data.stats || {
          totalRatings: 0,
          averageRating: 0,
          distribution: { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 },
          percentages: { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 },
          recentRatings: []
        });
      } else {
        // Don't show error for "no ratings" case
        if (data.error && data.error.toLowerCase().includes('not found')) {
          setStats({
            totalRatings: 0,
            averageRating: 0,
            distribution: { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 },
            percentages: { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 },
            recentRatings: []
          });
        } else {
          setError(data.error || "Failed to load rating statistics");
        }
      }
    } catch (err) {
      console.error("Failed to fetch rating stats:", err);
      // Set empty stats instead of error for better UX
      setStats({
        totalRatings: 0,
        averageRating: 0,
        distribution: { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 },
        percentages: { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 },
        recentRatings: []
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-5 h-5 ${
              star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
            }`}
          />
        ))}
      </div>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { 
      year: "numeric", 
      month: "short", 
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading ratings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-700 mb-4">{error}</p>
            <Button onClick={() => router.back()}>Go Back</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Your Ratings</h1>
              <p className="text-sm text-slate-600">
                View your customer feedback and ratings
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-white shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                Average Rating
              </CardTitle>
              <Star className="h-5 w-5 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">
                {stats?.averageRating?.toFixed(1) || "0.0"}
              </div>
              <div className="flex items-center gap-2 mt-2">
                {renderStars(Math.round(stats?.averageRating || 0))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                Total Ratings
              </CardTitle>
              <Users className="h-5 w-5 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">
                {stats?.totalRatings || 0}
              </div>
              <p className="text-xs text-slate-500 mt-1">Customer reviews</p>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                5-Star Ratings
              </CardTitle>
              <TrendingUp className="h-5 w-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">
                {stats?.distribution?.["5"] || 0}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {stats?.percentages?.["5"]?.toFixed(1) || 0}% of total
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Rating Distribution */}
        <Card className="bg-white shadow-md mb-8">
          <CardHeader>
            <CardTitle>Rating Distribution</CardTitle>
            <CardDescription>
              Breakdown of your ratings by star level
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[5, 4, 3, 2, 1].map((star) => (
                <div key={star} className="flex items-center gap-4">
                  <div className="flex items-center gap-2 w-24">
                    <span className="text-2xl">{emojiMap[star]}</span>
                    <span className="text-sm font-medium text-slate-700">
                      {star} Star
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          star === 5
                            ? "bg-green-500"
                            : star === 4
                            ? "bg-blue-500"
                            : star === 3
                            ? "bg-yellow-500"
                            : star === 2
                            ? "bg-orange-500"
                            : "bg-red-500"
                        }`}
                        style={{
                          width: `${stats?.percentages?.[star.toString() as keyof typeof stats.percentages] || 0}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="w-20 text-right">
                    <span className="text-sm font-semibold text-slate-900">
                      {stats?.distribution?.[star.toString() as keyof typeof stats.distribution] || 0}
                    </span>
                    <span className="text-xs text-slate-500 ml-1">
                      ({stats?.percentages?.[star.toString() as keyof typeof stats.percentages]?.toFixed(1) || 0}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Ratings */}
        <Card className="bg-white shadow-md">
          <CardHeader>
            <CardTitle>Recent Ratings</CardTitle>
            <CardDescription>
              Latest customer feedback and reviews
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.recentRatings && stats.recentRatings.length > 0 ? (
              <div className="space-y-4">
                {stats.recentRatings.map((rating, index) => (
                  <div
                    key={index}
                    className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{emojiMap[rating.rating]}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            {renderStars(rating.rating)}
                            <span className="text-sm font-semibold text-slate-900">
                              {rating.rating}.0
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            Order #{rating.orderId}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <Calendar className="h-3 w-3" />
                          {formatDate(rating.ratedAt)}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          {rating.buyerEmail}
                        </p>
                      </div>
                    </div>
                    {rating.feedback && (
                      <div className="mt-3 p-3 bg-slate-50 rounded-md">
                        <p className="text-sm text-slate-700 italic">
                          "{rating.feedback}"
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Star className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 text-lg">No ratings yet</p>
                <p className="text-slate-400 text-sm mt-2">
                  Ratings will appear here once customers rate your service
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
