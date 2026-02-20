'use client';

import { useState, useEffect } from 'react';
import { Bell, ArrowLeft, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';

interface Notification {
  id: number;
  title: string;
  message: string;
  actionUrl: string;
  type: string;
  createdAt: number;
  isRead: boolean;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { user, isAuthenticated, hasHydrated } = useAuthStore();

  useEffect(() => {
    // Wait for auth store to hydrate before checking authentication
    if (!hasHydrated) return;
    
    if (isAuthenticated && user) {
      fetchAllNotifications();
    } else {
      setIsLoading(false);
      router.push('/login');
    }
  }, [isAuthenticated, user, router, hasHydrated]);

  const fetchAllNotifications = async () => {
    try {
      const userEmail = user?.email || user?.ishyigaAccount;
      if (!userEmail) return;

      const res = await fetch(`/api/notifications/all?userId=${encodeURIComponent(userEmail)}`);
      const data = await res.json();
      
      if (data.ok) {
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (id: number, actionUrl?: string) => {
    try {
      const userEmail = user?.email || user?.ishyigaAccount;
      if (!userEmail) return;

      await fetch(`/api/notifications/${id}/read?userId=${encodeURIComponent(userEmail)}`, { 
        method: 'POST' 
      });
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, isRead: true } : n)
      );
      
      // Navigate if there's an action URL
      if (actionUrl) {
        router.push(actionUrl);
      }
    } catch (error) {
      console.error('Failed to mark as read:', error);
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

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'order':
        return '🛒';
      case 'delivery':
        return '📦';
      case 'table':
        return '🍽️';
      case 'rating':
        return '⭐';
      case 'price_drop':
        return '💰';
      case 'stock':
        return '📦';
      default:
        return '🔔';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Bell className="w-12 h-12 mx-auto mb-4 text-gray-400 animate-pulse" />
          <p className="text-gray-600">Loading notifications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-2xl font-bold">Notifications</h1>
              <p className="text-sm text-gray-600">
                {notifications.filter(n => !n.isRead).length} unread
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {notifications.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Bell className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              No notifications yet
            </h2>
            <p className="text-gray-600">
              When you receive notifications, they'll appear here
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className={`bg-white rounded-lg shadow-sm p-4 transition-all hover:shadow-md cursor-pointer ${
                  !notif.isRead ? 'border-l-4 border-blue-500' : ''
                }`}
                onClick={() => markAsRead(notif.id, notif.actionUrl)}
              >
                <div className="flex items-start gap-4">
                  <div className="text-3xl flex-shrink-0">
                    {getNotificationIcon(notif.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className={`font-semibold ${!notif.isRead ? 'text-gray-900' : 'text-gray-700'}`}>
                        {notif.title}
                      </h3>
                      {!notif.isRead && (
                        <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2" />
                      )}
                    </div>
                    <p className="text-gray-600 text-sm mb-2">
                      {notif.message}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">
                        {formatTime(notif.createdAt)}
                      </span>
                      {notif.actionUrl && (
                        <span className="text-xs text-blue-600 flex items-center gap-1">
                          View details
                          <ExternalLink className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
