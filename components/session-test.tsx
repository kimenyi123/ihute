"use client"

import { useAuthStore } from "@/lib/auth-store"
import { useSession } from "@/hooks/use-session"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

/**
 * Test component to verify session management is working correctly
 * This should only be used in development
 */
export function SessionTest() {
  const { user, isAuthenticated, loginTime, sessionTimeout } = useAuthStore()
  const { checkSession } = useSession()

  if (process.env.NODE_ENV !== "development") {
    return null
  }

  const sessionTimeRemaining = loginTime 
    ? Math.max(0, sessionTimeout - (Date.now() - loginTime))
    : 0

  const hoursRemaining = Math.floor(sessionTimeRemaining / (1000 * 60 * 60))
  const minutesRemaining = Math.floor((sessionTimeRemaining % (1000 * 60 * 60)) / (1000 * 60))

  return (
    <Card className="fixed bottom-4 right-4 w-80 z-50 bg-yellow-50 border-yellow-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Session Debug (Dev Only)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div>
          <strong>Authenticated:</strong> {isAuthenticated ? "Yes" : "No"}
        </div>
        {user && (
          <div>
            <strong>User:</strong> {user.email}
          </div>
        )}
        {loginTime && (
          <div>
            <strong>Login Time:</strong> {new Date(loginTime).toLocaleTimeString()}
          </div>
        )}
        <div>
          <strong>Session Timeout:</strong> {Math.floor(sessionTimeout / (1000 * 60 * 60))} hours
        </div>
        {sessionTimeRemaining > 0 && (
          <div>
            <strong>Time Remaining:</strong> {hoursRemaining}h {minutesRemaining}m
          </div>
        )}
        <div className="pt-2">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => checkSession()}
            className="w-full"
          >
            Check Session
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
