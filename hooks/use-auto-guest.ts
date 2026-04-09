import { useState, useCallback } from "react"
import { useAuthStore } from "@/lib/auth-store"

interface AutoGuestData {
  name?: string
  phone?: string
  location?: string
}

interface AutoGuestResult {
  ok: boolean
  ishyigaAccount?: string
  email?: string
  isNew?: boolean
  error?: string
  message?: string
}

/**
 * Hook for automatic guest user creation
 * Usage: const { createGuest, loading, error } = useAutoGuest()
 */
export function useAutoGuest() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { login } = useAuthStore()

  const createGuest = useCallback(async (guestData?: AutoGuestData): Promise<AutoGuestResult> => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/account/auto-guest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(guestData || {}),
        cache: "no-store",
      })

      const result = await response.json() as AutoGuestResult

      if (!result.ok) {
        setError(result.error || "Failed to create guest user")
        return result
      }

      // Auto-login the guest user
      if (result.ishyigaAccount && result.email) {
        login({
          id: result.ishyigaAccount,
          email: result.email,
          name: guestData?.name || result.email.split('@')[0],
          role: "customer",
          phone: guestData?.phone || "",
          location: guestData?.location || "",
          ishyigaAccount: result.ishyigaAccount,
          owner: guestData?.name || result.email.split('@')[0],
        })
      }

      console.log("[UseAutoGuest] Guest user ready:", {
        ishyigaAccount: result.ishyigaAccount,
        email: result.email,
        isNew: result.isNew,
      })

      return result

    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Network error"
      setError(errorMsg)
      return {
        ok: false,
        error: errorMsg,
      }
    } finally {
      setLoading(false)
    }
  }, [login])

  return {
    createGuest,
    loading,
    error,
  }
}

/**
 * Quick guest creation for checkout
 * Automatically creates and logs in guest user
 */
export async function quickGuestCheckout(buyerInfo?: AutoGuestData): Promise<AutoGuestResult> {
  try {
    const response = await fetch("/api/account/auto-guest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buyerInfo || {}),
      cache: "no-store",
    })

    return await response.json() as AutoGuestResult
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to create guest",
    }
  }
}
