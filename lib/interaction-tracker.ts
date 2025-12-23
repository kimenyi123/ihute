// lib/interaction-tracker.ts
"use client"

import { useAuthStore } from "./auth-store"

/**
 * Interaction tracking service for personalization
 * 
 * Tracks user behavior and stores locally (localStorage) for anonymous users,
 * syncs with backend for logged-in users.
 */

export type InteractionType = 
  | "product_view"
  | "supplier_view"
  | "search"
  | "category_view"
  | "click"
  | "favorite"
  | "time_spent"

export type EntityType = "product" | "supplier" | "category" | "search"

export interface Interaction {
  interactionType: InteractionType
  entityType: EntityType
  entityId: string
  entityName?: string
  metadata?: Record<string, any>
  timeSpentSeconds?: number
  timestamp: number
}

// Local storage keys
const STORAGE_KEY = "ihute-interactions"
const SESSION_KEY = "ihute-session-id"
const MAX_LOCAL_INTERACTIONS = 500 // Limit local storage size

/**
 * Get or create session ID
 */
export function getSessionId(): string {
  if (typeof window === "undefined") return ""
  
  let sessionId = localStorage.getItem(SESSION_KEY)
  if (!sessionId) {
    sessionId = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    localStorage.setItem(SESSION_KEY, sessionId)
  }
  return sessionId
}

/**
 * Get stored interactions from localStorage
 */
function getLocalInteractions(): Interaction[] {
  if (typeof window === "undefined") return []
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    
    const interactions: Interaction[] = JSON.parse(stored)
    // Clean old interactions (older than 90 days)
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000
    const recent = interactions.filter(i => i.timestamp > ninetyDaysAgo)
    
    // Limit size
    if (recent.length > MAX_LOCAL_INTERACTIONS) {
      const sorted = recent.sort((a, b) => b.timestamp - a.timestamp)
      return sorted.slice(0, MAX_LOCAL_INTERACTIONS)
    }
    
    return recent
  } catch {
    return []
  }
}

/**
 * Save interactions to localStorage
 */
function saveLocalInteractions(interactions: Interaction[]) {
  if (typeof window === "undefined") return
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(interactions))
  } catch (e) {
    console.error("Failed to save interactions to localStorage", e)
  }
}

/**
 * Track an interaction
 */
export async function trackInteraction(
  interactionType: InteractionType,
  entityType: EntityType,
  entityId: string,
  options?: {
    entityName?: string
    metadata?: Record<string, any>
    timeSpentSeconds?: number
  }
) {
  const interaction: Interaction = {
    interactionType,
    entityType,
    entityId,
    entityName: options?.entityName,
    metadata: options?.metadata,
    timeSpentSeconds: options?.timeSpentSeconds,
    timestamp: Date.now(),
  }

  // Get user info
  const authStore = useAuthStore.getState()
  const userId = authStore.user?.email || null
  const sessionId = getSessionId()

  // Store locally first (for offline support)
  const localInteractions = getLocalInteractions()
  localInteractions.push(interaction)
  saveLocalInteractions(localInteractions)

  // Sync with backend (fire and forget)
  try {
    const response = await fetch("/api/personalization/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        sessionId,
        ...interaction,
      }),
    })

    if (!response.ok) {
      console.warn("Failed to sync interaction to backend")
    }
  } catch (error) {
    // Silently fail - interactions are stored locally
    console.warn("Error syncing interaction:", error)
  }
}

/**
 * Track product view
 */
export function trackProductView(
  productId: string,
  productName?: string,
  metadata?: { supplierId?: string; categoryId?: string }
) {
  return trackInteraction("product_view", "product", productId, {
    entityName: productName,
    metadata,
  })
}

/**
 * Track supplier view
 */
export function trackSupplierView(supplierId: string, supplierName?: string) {
  return trackInteraction("supplier_view", "supplier", supplierId, {
    entityName: supplierName,
  })
}

/**
 * Track search query
 */
export function trackSearch(query: string, resultsCount?: number) {
  return trackInteraction("search", "search", query, {
    metadata: { resultsCount },
  })
}

/**
 * Track category view
 */
export function trackCategoryView(categoryId: string, categoryName?: string) {
  return trackInteraction("category_view", "category", categoryId, {
    entityName: categoryName,
  })
}

/**
 * Track click
 */
export function trackClick(entityType: EntityType, entityId: string, entityName?: string) {
  return trackInteraction("click", entityType, entityId, { entityName })
}

/**
 * Track time spent on a page/product
 */
export function trackTimeSpent(
  entityType: EntityType,
  entityId: string,
  seconds: number,
  entityName?: string
) {
  return trackInteraction("time_spent", entityType, entityId, {
    timeSpentSeconds: seconds,
    entityName,
  })
}

/**
 * Merge anonymous session to user account (call on login)
 */
export async function mergeSessionToUser(userId: string) {
  const sessionId = getSessionId()
  
  try {
    const response = await fetch("/api/personalization/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, sessionId }),
    })

    if (response.ok) {
      // Clear local interactions after merge
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch (error) {
    console.error("Error merging session:", error)
  }
}

/**
 * Get recent interactions from local storage
 */
export function getRecentInteractions(
  entityType?: EntityType,
  limit: number = 20
): Interaction[] {
  const interactions = getLocalInteractions()
  
  let filtered = interactions
  if (entityType) {
    filtered = interactions.filter(i => i.entityType === entityType)
  }
  
  return filtered
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit)
}

/**
 * Get recent product IDs
 */
export function getRecentProductIds(limit: number = 10): string[] {
  const interactions = getRecentInteractions("product", limit)
  const productIds = new Set<string>()
  
  for (const interaction of interactions) {
    if (interaction.entityType === "product") {
      productIds.add(interaction.entityId)
    }
  }
  
  return Array.from(productIds)
}

