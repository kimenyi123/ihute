/**
 * Service Worker for Web Push Notifications
 * 
 * Handles:
 * - Push notification reception
 * - Notification display
 * - Click tracking
 * - Background sync
 */

const CACHE_NAME = 'ihute-v1';
// VAPID public key - this will be passed from the notification service
// during subscription via applicationServerKey parameter
// You can also hardcode it here if needed: const VAPID_PUBLIC_KEY = 'YOUR_KEY_HERE';
const VAPID_PUBLIC_KEY = self.VAPID_PUBLIC_KEY || '';

// Install event
self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker installing');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker activating');
  event.waitUntil(clients.claim());
});

// Push event - receive push notification
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);

  let notificationData = {
    title: 'New Update',
    body: 'You have a new notification',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    data: {
      url: '/',
    },
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      notificationData = {
        title: payload.title || notificationData.title,
        body: payload.body || notificationData.body,
        icon: payload.icon || notificationData.icon,
        badge: payload.badge || notificationData.badge,
        data: payload.data || notificationData.data,
      };
    } catch (e) {
      console.error('[SW] Error parsing push payload:', e);
      notificationData.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      data: {
        ...notificationData.data,
        // Ensure we have the URL for deep linking
        url: notificationData.data?.url || '/',
        // Preserve notification type for tracking
        type: notificationData.data?.type || 'default',
      },
      tag: notificationData.data?.type || 'default',
      requireInteraction: false,
      // Actions are optional (browser support varies)
      actions: notificationData.data?.actions || [
        {
          action: 'open',
          title: 'View',
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
        },
      ],
    })
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);

  event.notification.close();

  const action = event.action;
  const data = event.notification.data || {};

  // Handle dismiss action
  if (action === 'dismiss') {
    // Mark as ignored (if we have notification tracking)
    if (data.url && data.type) {
      const apiUrl = '/api/NotificationServlet?action=markIgnored';
      fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          notificationId: data.notificationId || '',
          userId: data.userId || '',
          sessionId: data.sessionId || '',
        }),
      }).catch((err) => {
        console.error('[SW] Failed to mark notification as ignored:', err);
      });
    }
    return;
  }

  // Get the deep link URL from notification data
  // For search notifications, this should be: /search?q=keyword
  // For other notifications, it could be: /product/{id}, /category/{id}, etc.
  const urlToOpen = data.url || '/';

  event.waitUntil(
    clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then((clientList) => {
        // Check if there's already a window/tab open for this origin
        const origin = self.location.origin;
        for (const client of clientList) {
          // Focus any open window from the same origin
          if (client.url.startsWith(origin)) {
            // Navigate to the deep link URL and focus
            return client.focus().then(() => {
              // Try to navigate to the deep link (if client supports it)
              if (client.navigate && client.url !== urlToOpen) {
                return client.navigate(urlToOpen);
              }
              return client;
            });
          }
        }

        // No existing window found, open a new one with the deep link
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
      .then((client) => {
        // Mark notification as opened (if we have notification tracking)
        if (data.notificationId || (data.url && data.type)) {
          const apiUrl = '/api/NotificationServlet?action=markOpened';
          fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              notificationId: data.notificationId || '',
            }),
          }).catch((err) => {
            console.error('[SW] Failed to mark notification as opened:', err);
          });
        }
      })
      .catch((err) => {
        console.error('[SW] Error handling notification click:', err);
        // Fallback: try to open the URL anyway
        if (clients.openWindow) {
          clients.openWindow(urlToOpen);
        }
      })
  );
});

// Background sync (optional)
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);

  if (event.tag === 'sync-search-history') {
    event.waitUntil(syncSearchHistory());
  }

  // GPS queue sync
  if (event.tag === 'sync-gps-updates') {
    event.waitUntil(syncGPSUpdates());
  }
});

async function syncSearchHistory() {
  // Sync local search history to backend
  try {
    const response = await fetch('/api/search-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'syncLocalHistory',
      }),
    });

    if (response.ok) {
      console.log('[SW] Search history synced');
    }
  } catch (error) {
    console.error('[SW] Error syncing search history:', error);
  }
}

/**
 * Sync GPS updates from IndexedDB
 */
async function syncGPSUpdates() {
  console.log('[SW] Starting GPS sync...');

  try {
    // Open IndexedDB
    const db = await openGPSDatabase();
    const pending = await getPendingGPSUpdates(db);

    console.log(`[SW] Found ${pending.length} pending GPS updates`);

    for (const update of pending) {
      try {
        const response = await fetch('/api/supplier/location/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat: update.lat,
            lng: update.lng,
            accuracy: update.accuracy,
            speed: update.speed,
            heading: update.heading,
            source: update.source + '_bg_sync',
          }),
          credentials: 'include',
        });

        if (response.ok) {
          await markGPSAsSynced(db, update.id);
          console.log('[SW] Synced GPS update:', update.id);
        } else {
          console.warn('[SW] Failed to sync GPS update:', update.id, response.status);
        }
      } catch (error) {
        console.error('[SW] Error syncing GPS update:', update.id, error);
      }
    }

    console.log('[SW] GPS sync complete');
  } catch (error) {
    console.error('[SW] GPS sync failed:', error);
    throw error;
  }
}

/**
 * Open GPS Queue IndexedDB
 */
function openGPSDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('GPSQueueDB', 1);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('gpsQueue')) {
        const store = db.createObjectStore('gpsQueue', { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp');
        store.createIndex('synced', 'synced');
      }
    };
  });
}

/**
 * Get pending GPS updates from IndexedDB
 */
function getPendingGPSUpdates(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['gpsQueue'], 'readonly');
    const store = transaction.objectStore('gpsQueue');
    const index = store.index('synced');
    const request = index.getAll(false);

    request.onsuccess = () => {
      const updates = request.result.filter(item => item.retries < 5);
      resolve(updates);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Mark GPS update as synced
 */
function markGPSAsSynced(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['gpsQueue'], 'readwrite');
    const store = transaction.objectStore('gpsQueue');
    const request = store.get(id);

    request.onsuccess = () => {
      const update = request.result;
      update.synced = true;
      const updateRequest = store.put(update);
      updateRequest.onsuccess = () => resolve();
      updateRequest.onerror = () => reject(updateRequest.error);
    };
    request.onerror = () => reject(request.error);
  });
}



