'use client';

import { useState, useEffect } from 'react';
import { X, Star, Calendar, Package, MessageSquare } from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';

interface Rating {
  orderId: number;
  productName: string;
  supplierName: string;
  rating: number;
  feedback: string;
  images: string[];
  ratedAt: string;
}

const EMOJIS = ['😢', '😕', '😐', '🙂', '😊'];

interface RatingHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RatingHistoryModal({ isOpen, onClose }: RatingHistoryModalProps) {
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useAuthStore();

  useEffect(() => {
    if (isOpen && user) {
      fetchRatingHistory();
    }
  }, [isOpen, user]);

  const fetchRatingHistory = async () => {
    setIsLoading(true);
    setError('');

    try {
      const userEmail = user?.email || user?.ishyigaAccount;
      if (!userEmail) {
        setError('User not authenticated');
        return;
      }

      const res = await fetch(
        `/api/ratings/history?userEmail=${encodeURIComponent(userEmail)}`
      );
      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Failed to load rating history');
      }

      setRatings(data.ratings || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load rating history');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-50 animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div 
          className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden pointer-events-auto animate-in zoom-in-95 duration-200 flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Your Rating History</h2>
              <p className="text-sm text-gray-600">All your product ratings</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-gray-600">Loading your ratings...</p>
                </div>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            ) : ratings.length === 0 ? (
              <div className="text-center py-12">
                <Star className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No ratings yet
                </h3>
                <p className="text-gray-600">
                  Your product ratings will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {ratings.map((rating) => (
                  <div
                    key={rating.orderId}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Package className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">
                            {rating.productName}
                          </h3>
                          <p className="text-sm text-gray-600">
                            from {rating.supplierName}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="text-xs text-gray-500">
                              {formatDate(rating.ratedAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-3xl">
                        {EMOJIS[Math.round(rating.rating) - 1] || '😐'}
                      </div>
                    </div>

                    {rating.feedback && (
                      <div className="bg-gray-50 rounded-lg p-3 mb-3">
                        <div className="flex items-start gap-2">
                          <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-gray-700">{rating.feedback}</p>
                        </div>
                      </div>
                    )}

                    {rating.images && rating.images.length > 0 && (
                      <div className="grid grid-cols-4 gap-2">
                        {rating.images.map((img, idx) => (
                          <img
                            key={idx}
                            src={img}
                            alt={`Rating ${idx + 1}`}
                            className="w-full h-20 object-cover rounded-lg border border-gray-200"
                          />
                        ))}
                      </div>
                    )}

                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs text-gray-500">
                        Order #{rating.orderId}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 border-t border-gray-200 px-6 py-4">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
