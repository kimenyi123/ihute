/**
 * Notification Service
 * 
 * Handles Web Push notification subscription and management.
 * Uses VAPID for authentication.
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

/**
 * Request notification permission (call after user interaction)
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('[Notifications] Not supported in this browser');
    return 'denied';
  }
  
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  
  if (Notification.permission === 'denied') {
    return 'denied';
  }
  
  // Request permission
  const permission = await Notification.requestPermission();
  return permission;
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPushNotifications(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[Notifications] Push not supported');
    return null;
  }
  
  // Check permission
  const permission = await requestNotificationPermission();
  if (permission !== 'granted') {
    console.warn('[Notifications] Permission denied');
    return null;
  }
  
  // Register service worker
  let registration: ServiceWorkerRegistration;
  try {
    registration = await navigator.serviceWorker.ready;
  } catch (error) {
    console.error('[Notifications] Service worker not ready:', error);
    return null;
  }
  
  // Check if already subscribed
  let subscription = await registration.pushManager.getSubscription();
  
  if (subscription) {
    // Update subscription on backend
    await sendSubscriptionToBackend(subscription);
    return subscription;
  }
  
  // Subscribe
  try {
    const keyArray = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyArray,
    });
    
    // Send subscription to backend
    await sendSubscriptionToBackend(subscription);
    
    return subscription;
  } catch (error) {
    console.error('[Notifications] Error subscribing:', error);
    return null;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false;
  }
  
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await subscription.unsubscribe();
      
      // Remove from backend
      await removeSubscriptionFromBackend(subscription);
      
      return true;
    }
  } catch (error) {
    console.error('[Notifications] Error unsubscribing:', error);
  }
  
  return false;
}

/**
 * Send subscription to backend
 */
async function sendSubscriptionToBackend(subscription: PushSubscription): Promise<void> {
  const { userId, sessionId } = getUserIdentifiers();
  
  const subscriptionData = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: arrayBufferToBase64(subscription.getKey('p256dh')!),
      auth: arrayBufferToBase64(subscription.getKey('auth')!),
    },
  };
  
  try {
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'subscribe',
        userId: userId || '',
        sessionId,
        endpoint: subscriptionData.endpoint,
        p256dh: subscriptionData.keys.p256dh,
        auth: subscriptionData.keys.auth,
      }),
    });
  } catch (error) {
    console.error('[Notifications] Error sending subscription:', error);
  }
}

/**
 * Remove subscription from backend
 */
async function removeSubscriptionFromBackend(subscription: PushSubscription): Promise<void> {
  try {
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'unsubscribe',
        endpoint: subscription.endpoint,
      }),
    });
  } catch (error) {
    console.error('[Notifications] Error removing subscription:', error);
  }
}

/**
 * Get user identifiers
 */
function getUserIdentifiers(): { userId: string | null; sessionId: string } {
  let userId: string | null = null;
  
  try {
    // Use dynamic import to avoid SSR issues
    if (typeof window !== 'undefined') {
      const { useAuthStore } = require('@/lib/auth-store');
      const store = useAuthStore.getState();
      if (store?.user?.email) {
        userId = store.user.email;
      }
    }
  } catch (e) {
    // Fallback: try localStorage
    try {
      const stored = localStorage.getItem('ihute_user_email');
      if (stored) userId = stored;
    } catch (e2) {
      // Ignore
    }
  }
  
  // Get session ID
  let sessionId = 'server';
  if (typeof window !== 'undefined') {
    const key = 'ihute_session_id';
    sessionId = localStorage.getItem(key) || `anon_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, sessionId);
    }
  }
  
  return { userId, sessionId };
}

/**
 * Convert VAPID public key from URL-safe base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const bytes = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    bytes[i] = rawData.charCodeAt(i);
  }
  
  return bytes;
}

/**
 * Convert ArrayBuffer to base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}



