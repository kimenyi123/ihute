/** Same-origin proxy so browser code does not call Java directly (CORS + non‑public env vars). */
function fetchSuggestionsUrl(query: string): string {
  const q = query.startsWith("?") ? query.slice(1) : query
  return `/api/fetchSuggestions?${q}`
}

export interface UserPreference {
  shop_id: string
}

export interface UserPreferenceResponse {
  preferences: UserPreference[]
}

export interface TogglePreferenceResponse {
  message: string
  isPreferred: boolean
}

export interface SavePreferenceResponse {
  message: string
}

// Get current user's preferred shops
export async function getUserPreferences(userId: string): Promise<UserPreferenceResponse> {
  try {
    const response = await fetch(
      fetchSuggestionsUrl(`getUserPreferences=${encodeURIComponent(userId)}`),
      { cache: "no-store" },
    )
    
    if (!response.ok) {
      throw new Error('Failed to fetch user preferences')
    }
    
    const data = await response.json()
    console.log('User preferences response:', data)
    return data
  } catch (error) {
    console.error('Error fetching user preferences:', error)
    throw error
  }
}

/** `supplier_ALGG__Boutique` or `ALGG` → seller account key for matching backend `shop_id`. */
function sellerAccountKeyFromFrontendShopId(shopId: string): string {
  const raw = String(shopId ?? "").replace(/^supplier_/i, "").trim()
  const i = raw.indexOf("__")
  const base = i === -1 ? raw : raw.slice(0, i)
  return base.trim().toLowerCase()
}

function sellerAccountKeyFromBackendPref(raw: string): string {
  return String(raw ?? "")
    .replace(/^supplier_/i, "")
    .trim()
    .split("__")[0]
    .toLowerCase()
}

/** Kaos account string for POST bodies (preserves casing from the frontend shop id). */
function sellerAccountForBackendApi(shopId: string): string {
  const raw = String(shopId ?? "").replace(/^supplier_/i, "").trim()
  const i = raw.indexOf("__")
  return (i === -1 ? raw : raw.slice(0, i)).trim()
}

// Load user preferences and convert backend IDs to frontend format
export async function loadUserPreferences(userId: string, allAvailableShops: any[]): Promise<string[]> {
  try {
    const response = await getUserPreferences(userId)
    
    // Check if response has preferences property
    if (!response || !response.preferences) {
      console.warn('No preferences found or invalid response structure:', response)
      return []
    }
    
    const backendShopIds = response.preferences.map(p => p.shop_id)
    
    // Convert backend IDs to frontend format
    const frontendShopIds: string[] = []
    
    for (const backendId of backendShopIds) {
      const backKey = sellerAccountKeyFromBackendPref(String(backendId))
      if (!backKey) continue
      // Backend sends bare Kaos account; frontend uses `supplier_<ACCOUNT>__<SectorTag>`.
      const matchingShop = allAvailableShops.find((shop: { id?: string }) => {
        const shopKey = sellerAccountKeyFromFrontendShopId(String(shop?.id ?? ""))
        return shopKey === backKey
      })
      
      if (matchingShop) {
        frontendShopIds.push(matchingShop.id)
      }
    }
    
    console.log('Converted backend preferences:', backendShopIds, 'to frontend:', frontendShopIds)
    return frontendShopIds
  } catch (error) {
    console.error('Error loading user preferences:', error)
    return []
  }
}

// Toggle a shop preference (add/remove)
export async function toggleUserPreference(userId: string, shopId: string): Promise<TogglePreferenceResponse> {
  try {
    const baseShopId = sellerAccountForBackendApi(shopId)
    
    const response = await fetch(fetchSuggestionsUrl("toggleUserPreference"), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        userId,
        shopId: baseShopId,
      }),
      cache: "no-store",
    })
    
    if (!response.ok) {
      throw new Error('Failed to toggle user preference')
    }
    
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error toggling user preference:', error)
    throw error
  }
}

// Save all user preferences at once
export async function saveUserPreferences(userId: string, shopIds: string[]): Promise<SavePreferenceResponse> {
  try {
    const response = await fetch(fetchSuggestionsUrl("saveUserPreferences"), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        userId,
        shopIds: shopIds
          .filter((id) => id && String(id).trim() && String(id).trim() !== "__ALL__")
          .map((id) => sellerAccountForBackendApi(String(id)))
          .filter(Boolean)
          .join(","),
      }),
      cache: "no-store",
    })
    
    if (!response.ok) {
      throw new Error('Failed to save user preferences')
    }
    
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error saving user preferences:', error)
    throw error
  }
}

// Get a mock user ID for demo purposes
export function getCurrentUserId(): string {
  // In a real app, this would come from authentication
  // For now, we'll use a simple identifier based on browser storage
  let userId = localStorage.getItem('currentUserId')
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    localStorage.setItem('currentUserId', userId)
  }
  return userId
}
