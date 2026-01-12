/**
 * Notification Service
 * 
 * Handles Web Push notification subscription and management.
 * Uses VAPID for authentication.
 */

let cachedVapidKey: string | null = null;

/**
 * Get VAPID public key from environment
 */
async function getVapidPublicKey(): Promise<string> {
  // Return cached key if available
  if (cachedVapidKey) {
    return cachedVapidKey;
  }

  // Get from environment variable
  const envKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (envKey && envKey.trim().length > 0) {
    cachedVapidKey = envKey.trim();
    return cachedVapidKey;
  }

  throw new Error('VAPID public key not configured. Please set NEXT_PUBLIC_VAPID_PUBLIC_KEY in .env.local');
}

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

  // Register service worker if not already registered
  let registration: ServiceWorkerRegistration;
  try {
    // Check if service worker is already registered
    let existingRegistration = await navigator.serviceWorker.getRegistration();

    if (!existingRegistration) {
      console.log('[Notifications] Service worker not found, registering...');
      existingRegistration = await navigator.serviceWorker.register('/sw.js');
      console.log('[Notifications] Service worker registered, waiting for activation...');
    }

    // Wait for service worker to be ready
    registration = await navigator.serviceWorker.ready;
    console.log('[Notifications] Service worker is ready');
  } catch (error) {
    console.error('[Notifications] Service worker error:', error);
    throw new Error('Failed to register service worker. Please refresh the page and try again.');
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
    // Get VAPID public key
    const vapidKey = await getVapidPublicKey();

    if (!vapidKey || vapidKey.trim().length === 0) {
      throw new Error('VAPID public key is empty. Please configure VAPID keys on the server.');
    }

    // Validate and convert key
    let keyArray: BufferSource;
    try {
      keyArray = urlBase64ToUint8Array(vapidKey);

      // Validate the key array has reasonable length (VAPID keys are typically 65 bytes = 87 base64 chars)
      if (keyArray instanceof Uint8Array && keyArray.length < 60) {
        throw new Error('VAPID key appears to be invalid (too short)');
      }
    } catch (keyError) {
      console.error('[Notifications] Invalid VAPID key format:', keyError);
      throw new Error('Invalid VAPID public key format. Please check server configuration.');
    }

    console.log('[Notifications] Subscribing with VAPID key (length:', vapidKey.length, ')');

    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyArray,
    });

    if (!subscription) {
      throw new Error('Subscription returned null');
    }

    // Send subscription to backend
    await sendSubscriptionToBackend(subscription);

    console.log('[Notifications] Successfully subscribed to push notifications');
    return subscription;
  } catch (error: any) {
    console.error('[Notifications] Error subscribing:', error);

    // Provide user-friendly error messages
    if (error.name === 'InvalidAccessError' || error.message?.includes('applicationServerKey')) {
      throw new Error('Invalid VAPID key. Please contact support or check server configuration.');
    } else if (error.message) {
      throw error;
    } else {
      throw new Error('Failed to subscribe to notifications. Please try again.');
    }
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
  const subscriptionData = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: arrayBufferToBase64(subscription.getKey('p256dh')!),
      auth: arrayBufferToBase64(subscription.getKey('auth')!),
    },
  };

  try {
    const response = await fetch('/api/notification/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscriptionData),
    });

    if (!response.ok) {
      throw new Error(`Subscription failed: ${response.status}`);
    }

    console.log('[Notifications] Subscription registered with backend');
  } catch (error) {
    console.error('[Notifications] Error sending subscription:', error);
    throw error;
  }
}

/**
 * Remove subscription from backend
 */
async function removeSubscriptionFromBackend(subscription: PushSubscription): Promise<void> {
  try {
    await fetch('/api/notification/unsubscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
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

  // Get session ID - use the same key as interaction-tracker
  let sessionId = 'server';
  if (typeof window !== 'undefined') {
    try {
      // Try to use the session ID from interaction-tracker
      const { getSessionId } = require('@/lib/interaction-tracker');
      sessionId = getSessionId();
    } catch (e) {
      // Fallback: use localStorage directly with correct key
      const key = 'ihute-session-id'; // Match interaction-tracker key
      sessionId = localStorage.getItem(key) || `anon_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, sessionId);
      }
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



