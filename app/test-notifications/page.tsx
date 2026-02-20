"use client"

import { useState, useEffect } from "react"
import { Bell, BellOff, CheckCircle, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { subscribeToPushNotifications, unsubscribeFromPushNotifications } from "@/lib/notification-service"

export default function TestNotificationsPage() {
  const [permission, setPermission] = useState<NotificationPermission>("default")
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev])
    console.log(`[Test] ${message}`)
  }

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("Notification" in window)) {
      addLog("❌ Notifications not supported in this browser")
      return
    }

    setPermission(Notification.permission)
    addLog(`📋 Initial permission: ${Notification.permission}`)

    // Check if already subscribed
    checkSubscription()
  }, [])

  async function checkSubscription() {
    try {
      if (!("serviceWorker" in navigator)) return

      const registration = await navigator.serviceWorker.getRegistration()
      if (!registration) {
        addLog("⚠️ No service worker registered")
        return
      }

      const sub = await registration.pushManager.getSubscription()
      if (sub) {
        setIsSubscribed(true)
        setSubscription(sub)
        addLog("✅ Already subscribed to push notifications")
      } else {
        addLog("ℹ️ Not subscribed to push notifications")
      }
    } catch (error: any) {
      addLog(`❌ Error checking subscription: ${error.message}`)
    }
  }

  async function handleSubscribe() {
    setIsLoading(true)
    addLog("🔄 Starting subscription process...")

    try {
      const sub = await subscribeToPushNotifications()
      if (sub) {
        setIsSubscribed(true)
        setSubscription(sub)
        setPermission(Notification.permission)
        addLog("✅ Successfully subscribed!")
        addLog(`📍 Endpoint: ${sub.endpoint.substring(0, 50)}...`)
      } else {
        addLog("❌ Subscription returned null")
      }
    } catch (error: any) {
      addLog(`❌ Subscription failed: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleUnsubscribe() {
    setIsLoading(true)
    addLog("🔄 Starting unsubscribe process...")

    try {
      await unsubscribeFromPushNotifications()
      setIsSubscribed(false)
      setSubscription(null)
      addLog("✅ Successfully unsubscribed!")
    } catch (error: any) {
      addLog(`❌ Unsubscribe failed: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleTestNotification() {
    if (Notification.permission !== "granted") {
      addLog("❌ Permission not granted")
      return
    }

    addLog("🔔 Sending test notification...")
    try {
      const notification = new Notification("Test Notification", {
        body: "This is a test notification from iHute",
        icon: "/icon-192x192.png",
        badge: "/icon-192x192.png",
        tag: "test-notification",
      })

      notification.onclick = () => {
        addLog("👆 Notification clicked!")
        notification.close()
      }

      addLog("✅ Test notification sent!")
    } catch (error: any) {
      addLog(`❌ Failed to send notification: ${error.message}`)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-6 h-6" />
              Notification Testing Dashboard
            </CardTitle>
            <CardDescription>
              Test push notification subscribe/unsubscribe functionality
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Current Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <div
                  className={`w-3 h-3 rounded-full ${
                    permission === "granted"
                      ? "bg-green-500"
                      : permission === "denied"
                      ? "bg-red-500"
                      : "bg-yellow-500"
                  }`}
                />
                <span className="text-sm">
                  Permission: <strong>{permission}</strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                {isSubscribed ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-gray-400" />
                )}
                <span className="text-sm">
                  Subscription: <strong>{isSubscribed ? "Active" : "Inactive"}</strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm">
                  Service Worker:{" "}
                  <strong>
                    {typeof window !== "undefined" && "serviceWorker" in navigator
                      ? "Supported"
                      : "Not Supported"}
                  </strong>
                </span>
              </div>
            </div>

            {subscription && (
              <div className="mt-4 p-3 bg-gray-100 rounded text-xs font-mono break-all">
                <strong>Endpoint:</strong> {subscription.endpoint}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handleSubscribe}
                disabled={isLoading || isSubscribed}
                className="gap-2"
              >
                <Bell className="w-4 h-4" />
                Subscribe to Notifications
              </Button>

              <Button
                onClick={handleUnsubscribe}
                disabled={isLoading || !isSubscribed}
                variant="destructive"
                className="gap-2"
              >
                <BellOff className="w-4 h-4" />
                Unsubscribe
              </Button>

              <Button
                onClick={handleTestNotification}
                disabled={permission !== "granted"}
                variant="outline"
                className="gap-2"
              >
                🔔 Send Test Notification
              </Button>

              <Button onClick={checkSubscription} variant="outline">
                🔄 Refresh Status
              </Button>

              <Button onClick={() => setLogs([])} variant="ghost">
                🗑️ Clear Logs
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Logs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Activity Log</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-black text-green-400 p-4 rounded font-mono text-xs h-96 overflow-y-auto">
              {logs.length === 0 ? (
                <div className="text-gray-500">No logs yet...</div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="mb-1">
                    {log}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Testing Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <ol className="list-decimal list-inside space-y-2">
              <li>
                <strong>Subscribe:</strong> Click "Subscribe to Notifications" to enable push
                notifications. This will call the <code>/api/notification/subscribe</code> endpoint.
              </li>
              <li>
                <strong>Check Status:</strong> The subscription status will update automatically.
                Check the logs for detailed information.
              </li>
              <li>
                <strong>Test Notification:</strong> Click "Send Test Notification" to see a local
                notification (doesn't use the backend).
              </li>
              <li>
                <strong>Unsubscribe:</strong> Click "Unsubscribe" to remove the subscription. This
                will call the <code>/api/notification/unsubscribe</code> endpoint.
              </li>
              <li>
                <strong>Check Network:</strong> Open DevTools → Network tab to see the API calls to{" "}
                <code>/api/notification/subscribe</code> and <code>/api/notification/unsubscribe</code>
                .
              </li>
            </ol>

            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <strong>⚠️ Note:</strong> The backend NotificationServlet must implement the{" "}
              <code>subscribe</code> and <code>unsubscribe</code> actions to store/remove
              subscriptions in the database.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
