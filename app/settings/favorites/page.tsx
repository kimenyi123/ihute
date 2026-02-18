"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useAuthStore } from "@/lib/auth-store"
import { getFavoriteEmailPrefs, saveFavoriteEmailPrefs } from "@/lib/favorites-api"

export default function FavoriteEmailSettingsPage() {
  const { isAuthenticated } = useAuthStore()
  const [enabled, setEnabled] = useState(true)
  const [quietHoursStart, setQuietHoursStart] = useState<string>("")
  const [quietHoursEnd, setQuietHoursEnd] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated) return
    setLoading(true)
    getFavoriteEmailPrefs()
      .then((prefs) => {
        setEnabled(prefs?.enabled ?? true)
        setQuietHoursStart(prefs?.quietHoursStart || "")
        setQuietHoursEnd(prefs?.quietHoursEnd || "")
      })
      .catch((err: any) => setError(err?.message || "Failed to load preferences"))
      .finally(() => setLoading(false))
  }, [isAuthenticated])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await saveFavoriteEmailPrefs({
        enabled,
        quietHoursStart: quietHoursStart || null,
        quietHoursEnd: quietHoursEnd || null,
      })
    } catch (err: any) {
      setError(err?.message || "Failed to save preferences")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Wishlist email preferences</h1>
          <p className="text-sm text-muted-foreground">
            Control reminders about items you saved from suppliers.
          </p>
        </div>

        {!isAuthenticated ? (
          <div className="rounded-lg border p-6 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Please sign in to manage your wishlist email settings.
            </p>
            <Button asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        ) : (
          <div className="max-w-lg space-y-6 rounded-lg border bg-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="enabled">Wishlist reminders</Label>
                <p className="text-xs text-muted-foreground">
                  Send me occasional availability reminders for favorites.
                </p>
              </div>
              <Switch id="enabled" checked={enabled} onCheckedChange={setEnabled} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="quietStart">Quiet hours start (optional)</Label>
                <Input
                  id="quietStart"
                  type="time"
                  value={quietHoursStart}
                  onChange={(e) => setQuietHoursStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quietEnd">Quiet hours end (optional)</Label>
                <Input
                  id="quietEnd"
                  type="time"
                  value={quietHoursEnd}
                  onChange={(e) => setQuietHoursEnd(e.target.value)}
                />
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {loading && <p className="text-sm text-muted-foreground">Loading preferences...</p>}

            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save preferences"}
            </Button>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
