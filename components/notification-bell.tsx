'use client';

import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import { RatingModal } from './RatingModal';

interface Notification {
  id: number;
  title: string;
  message: string;
  actionUrl: string;
  type: string;
  createdAt: number;
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [ratingData, setRatingData] = useState<{
    orderId: string;
    sellerId: string;
    sellerName: string;
    items: Array<{ code: string; name: string }>;
  } | null>(null);
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchNotifications();
      // Poll every 30 seconds
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, user?.email, user?.ishyigaAccount]);

  const fetchNotifications = async () => {
    try {
      // Get user email from auth store
      const userEmail = user?.email || user?.ishyigaAccount;
      if (!userEmail) {
        console.log('[NotificationBell] No user email found');
        return;
      }

      const res = await fetch(`/api/notifications/unread?userId=${encodeURIComponent(userEmail)}`);
      const data = await res.json();
      
      if (data.ok) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.count || 0);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const markAsRead = async (id: number, actionUrl?: string) => {
    try {
      const userEmail = user?.email || user?.ishyigaAccount;
      if (!userEmail) return;

      await fetch(`/api/notifications/${id}/read?userId=${encodeURIComponent(userEmail)}`, { method: 'POST' });
      
      // Update local state
      setNotifications(prev => prev.filter(n => n.id !== id));
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      // Check if it's a rating notification
      if (actionUrl && actionUrl.includes('/products/rate')) {
        // Extract orderId from URL
        const urlParams = new URLSearchParams(actionUrl.split('?')[1]);
        const orderId = urlParams.get('orderId');
        
        if (orderId) {
          setIsOpen(false);
          
          // Fetch order details for rating modal
          try {
            const res = await fetch(`/api/orders/details?orderId=${orderId}&userEmail=${encodeURIComponent(userEmail)}`);
            const data = await res.json();
            
            if (data.ok && data.order) {
              setRatingData({
                orderId: orderId,
                sellerId: data.order.sellerAccount || '',
                sellerName: data.order.sellerName || 'Supplier',
                items: data.order.items || [],
              });
              setRatingModalOpen(true);
            } else {
              // Fallback: open with minimal data
              setRatingData({
                orderId: orderId,
                sellerId: '',
                sellerName: 'Supplier',
                items: [],
              });
              setRatingModalOpen(true);
            }
          } catch (error) {
            console.error('Failed to fetch order details:', error);
            // Fallback: open with minimal data
            setRatingData({
              orderId: orderId,
              sellerId: '',
              sellerName: 'Supplier',
              items: [],
            });
            setRatingModalOpen(true);
          }
          return;
        }
      }
      
      // Navigate if there's an action URL
      if (actionUrl) {
        setIsOpen(false);
        router.push(actionUrl);
      }
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const markAllAsRead = async () => {
    setIsLoading(true);
    try {
      const userEmail = user?.email || user?.ishyigaAccount;
      if (!userEmail) return;

      await fetch(`/api/notifications/read-all?userId=${encodeURIComponent(userEmail)}`, { method: 'POST' });
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-gray-100 rounded-full transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-6 h-6 text-gray-700" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Notification Panel */}
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-2xl border border-gray-200 z-50 max-h-[600px] flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-lg">
              <h3 className="font-semibold text-lg">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    disabled={isLoading}
                    className="text-sm text-blue-600 hover:text-blue-800 hover:underline disabled:opacity-50"
                  >
                    {isLoading ? 'Marking...' : 'Mark all read'}
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="font-medium">No new notifications</p>
                  <p className="text-sm mt-1">You're all caught up!</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className="p-4 hover:bg-blue-50 cursor-pointer transition-colors group"
                      onClick={() => markAsRead(notif.id, notif.actionUrl)}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <div className="font-medium text-gray-900 group-hover:text-blue-600">
                          {notif.title}
                        </div>
                        <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />
                      </div>
                      <div className="text-sm text-gray-600 mb-2 line-clamp-2">
                        {notif.message}
                      </div>
                      <div className="text-xs text-gray-400">
                        {formatTime(notif.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    router.push('/notifications');
                  }}
                  className="w-full text-center text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  View all notifications
                </button>
              </div>
            )}
          </div>
        </>
      )}
      
      {/* Rating Modal */}
      {ratingData && (
        <RatingModal
          open={ratingModalOpen}
          onClose={() => {
            setRatingModalOpen(false);
            setRatingData(null);
          }}
          onSuccess={() => {
            setRatingModalOpen(false);
            setRatingData(null);
            // Refresh notifications
            fetchNotifications();
          }}
          orderId={ratingData.orderId}
          sellerId={ratingData.sellerId}
          sellerName={ratingData.sellerName}
          buyerPhone={user?.phone}
          items={ratingData.items}
        />
      )}
    </div>
  );
}
