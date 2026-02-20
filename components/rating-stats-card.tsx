'use client';

import { useState, useEffect } from 'react';
import { Star, TrendingUp, Users, MessageSquare } from 'lucide-react';

const EMOJIS = ['😢', '😕', '😐', '🙂', '😊'];

interface RatingStats {
  totalRatings: number;
  averageRating: number;
  distribution: {
    '5': number;
    '4': number;
    '3': number;
    '2': number;
    '1': number;
  };
  percentages: {
    '5': number;
    '4': number;
    '3': number;
    '2': number;
    '1': number;
  };
  recentRatings: Array<{
    orderId: number;
    rating: number;
    feedback: string;
    ratedAt: string;
    buyerEmail: string;
  }>;
}

interface RatingStatsCardProps {
  sellerAccount: string;
}

export function RatingStatsCard({ sellerAccount }: RatingStatsCardProps) {
  const [stats, setStats] = useState<RatingStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (sellerAccount) {
      fetchStats();
    }
  }, [sellerAccount]);

  const fetchStats = async () => {
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch(
        `/api/ratings/stats?sellerAccount=${encodeURIComponent(sellerAccount)}`
      );
      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Failed to load rating stats');
      }

      setStats(data.stats);
    } catch (err: any) {
      setError(err?.message || 'Failed to load rating stats');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4" />
          <div className="h-20 bg-gray-200 rounded mb-4" />
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded" />
            <div className="h-4 bg-gray-200 rounded" />
            <div className="h-4 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 border border-red-200">
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    );
  }

  if (!stats || stats.totalRatings === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="text-center py-8">
          <Star className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No Ratings Yet
          </h3>
          <p className="text-gray-600 text-sm">
            Your customer ratings will appear here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Star className="w-5 h-5" />
          Customer Ratings
        </h2>
      </div>

      <div className="p-6 space-y-6">
        {/* Overall Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Star className="w-8 h-8 text-yellow-400 fill-yellow-400" />
              <span className="text-3xl font-bold text-gray-900">
                {stats.averageRating.toFixed(1)}
              </span>
            </div>
            <p className="text-sm text-gray-600">Average Rating</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Users className="w-6 h-6 text-blue-600" />
              <span className="text-3xl font-bold text-gray-900">
                {stats.totalRatings}
              </span>
            </div>
            <p className="text-sm text-gray-600">Total Ratings</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <TrendingUp className="w-6 h-6 text-green-600" />
              <span className="text-3xl font-bold text-gray-900">
                {stats.percentages['5'].toFixed(0)}%
              </span>
            </div>
            <p className="text-sm text-gray-600">5-Star Ratings</p>
          </div>
        </div>

        {/* Rating Distribution */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Rating Distribution
          </h3>
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((stars) => (
              <div key={stars} className="flex items-center gap-3">
                <div className="flex items-center gap-1 w-16">
                  <span className="text-sm font-medium text-gray-700">{stars}</span>
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                </div>
                <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-yellow-400 h-full transition-all duration-500"
                    style={{ width: `${stats.percentages[stars.toString() as keyof typeof stats.percentages]}%` }}
                  />
                </div>
                <span className="text-sm text-gray-600 w-16 text-right">
                  {stats.distribution[stars.toString() as keyof typeof stats.distribution]} ({stats.percentages[stars.toString() as keyof typeof stats.percentages].toFixed(0)}%)
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Ratings */}
        {stats.recentRatings && stats.recentRatings.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Recent Ratings
            </h3>
            <div className="space-y-3">
              {stats.recentRatings.slice(0, 5).map((rating) => (
                <div
                  key={rating.orderId}
                  className="bg-gray-50 rounded-lg p-3 border border-gray-200"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="text-2xl">
                      {EMOJIS[Math.round(rating.rating) - 1] || '😐'}
                    </div>
                    <span className="text-xs text-gray-500">
                      Order #{rating.orderId}
                    </span>
                  </div>
                  {rating.feedback && (
                    <p className="text-sm text-gray-700 mb-2">{rating.feedback}</p>
                  )}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{rating.buyerEmail}</span>
                    <span>{new Date(rating.ratedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
