import { getBackendBase } from './backend-config'

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
    const response = await fetch(`${getBackendBase()}/Kaos/fetchSuggestions?getUserPreferences=${userId}`)
    
    if (!response.ok) {
      throw new Error('Failed to fetch user preferences')
    }
    
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching user preferences:', error)
    throw error
  }
}

// Load user preferences and convert backend IDs to frontend format
export async function loadUserPreferences(userId: string, allAvailableShops: any[]): Promise<string[]> {
  try {
    const response = await getUserPreferences(userId)
    const backendShopIds = response.preferences.map(p => p.shop_id)
    
    // Convert backend IDs to frontend format
    const frontendShopIds: string[] = []
    
    for (const backendId of backendShopIds) {
      // Find matching shop in allAvailableShops (new format without index)
      const matchingShop = allAvailableShops.find(shop => {
        const baseId = shop.id.replace('supplier_', '')
        return baseId === backendId
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
    // Extract base ID from frontend format (e.g., supplier_ALGGG1047005 -> ALGGG1047005)
    const baseShopId = shopId.replace('supplier_', '')
    
    const response = await fetch(`${getBackendBase()}/Kaos/fetchSuggestions?toggleUserPreference`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        userId,
        shopId: baseShopId,
      }),
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
    const response = await fetch(`${getBackendBase()}/Kaos/fetchSuggestions?saveUserPreferences`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        userId,
        shopIds: shopIds.join(','),
      }),
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
