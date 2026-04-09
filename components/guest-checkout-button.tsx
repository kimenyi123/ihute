"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAutoGuest } from "@/hooks/use-auto-guest"
import { User, Phone, MapPin, Loader2 } from "lucide-react"

interface GuestCheckoutButtonProps {
  onGuestCreated?: (guestData: { ishyigaAccount: string; email: string }) => void
  buttonText?: string
}

/**
 * Guest Checkout Button - Auto-creates guest users without any environment
 * Usage: <GuestCheckoutButton onGuestCreated={handleGuestCreated} />
 */
export function GuestCheckoutButton({ 
  onGuestCreated,
  buttonText = "Continue as Guest"
}: GuestCheckoutButtonProps) {
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    location: "",
  })
  const { createGuest, loading, error } = useAutoGuest()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const result = await createGuest(formData)
    
    if (result.ok && result.ishyigaAccount && result.email) {
      onGuestCreated?.({
        ishyigaAccount: result.ishyigaAccount,
        email: result.email,
      })
      setShowForm(false)
      setFormData({ name: "", phone: "", location: "" })
    }
  }

  const handleQuickGuest = async () => {
    const result = await createGuest()
    
    if (result.ok && result.ishyigaAccount && result.email) {
      onGuestCreated?.({
        ishyigaAccount: result.ishyigaAccount,
        email: result.email,
      })
    }
  }

  if (showForm) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Guest Checkout
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="guest-name">Name (Optional)</Label>
              <Input
                id="guest-name"
                placeholder="Your name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            
            <div>
              <Label htmlFor="guest-phone">Phone (Optional)</Label>
              <Input
                id="guest-phone"
                placeholder="Your phone number"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            
            <div>
              <Label htmlFor="guest-location">Location (Optional)</Label>
              <Input
                id="guest-location"
                placeholder="Your location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>

            {error && (
              <div className="text-red-600 text-sm p-2 bg-red-50 rounded">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={loading}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Guest Account"
                )}
              </Button>
              
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={handleQuickGuest}
        variant="outline"
        className="w-full"
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Creating Guest...
          </>
        ) : (
          <>
            <User className="h-4 w-4 mr-2" />
            {buttonText}
          </>
        )}
      </Button>

      <Button
        onClick={() => setShowForm(true)}
        variant="ghost"
        size="sm"
        className="w-full"
      >
        <Phone className="h-4 w-4 mr-2" />
        Guest with Details
      </Button>

      {error && (
        <div className="text-red-600 text-sm p-2 bg-red-50 rounded">
          {error}
        </div>
      )}
    </div>
  )
}
