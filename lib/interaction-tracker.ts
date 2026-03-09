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
  | "add_to_cart"

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

// Throttle backend sync to avoid infinite/heavy loading (max 1 request per 3s)
const TRACK_THROTTLE_MS = 3000
let lastTrackSyncAt = 0

/**
 * Generate a browser fingerprint for session isolation
 * This ensures each browser/device gets a unique session ID
 */
function generateBrowserFingerprint(): string {
  if (typeof window === "undefined") return ""

  try {
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.textBaseline = "top"
      ctx.font = "14px 'Arial'"
      ctx.fillText("Browser fingerprint", 2, 2)
    }

    // Access experimental APIs with type assertion
    const nav = navigator as Navigator & { deviceMemory?: number }

    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + "x" + screen.height,
      new Date().getTimezoneOffset(),
      canvas.toDataURL(),
      navigator.hardwareConcurrency || "",
      nav.deviceMemory || "",
    ].join("|")

    // Create a simple hash
    let hash = 0
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(36)
  } catch {
    // Fallback if fingerprinting fails
    return Math.random().toString(36).substring(2, 9)
  }
}

/**
 * Get or create session ID
 * Enhanced with browser fingerprinting to ensure proper isolation
 */
export function getSessionId(): string {
  if (typeof window === "undefined") return ""

  let sessionId = localStorage.getItem(SESSION_KEY)
  const browserFingerprint = generateBrowserFingerprint()

  // Validate existing session ID format (should include fingerprint)
  if (sessionId) {
    // Check if session ID is in the new format (includes fingerprint)
    // Old format: anon_TIMESTAMP_RANDOM
    // New format: anon_TIMESTAMP_FINGERPRINT_RANDOM
    const parts = sessionId.split("_")
    if (parts.length >= 3 && parts[0] === "anon") {
      // If fingerprint doesn't match, generate new session (different browser/device)
      if (parts.length >= 4 && parts[2] !== browserFingerprint) {
        console.warn("[Session] Browser fingerprint mismatch, generating new session")
        sessionId = null // Force regeneration
      }
    } else {
      // Invalid format, regenerate
      sessionId = null
    }
  }

  if (!sessionId) {
    // Generate new session ID with fingerprint
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 11)
    sessionId = `anon_${timestamp}_${browserFingerprint}_${random}`
    localStorage.setItem(SESSION_KEY, sessionId)
    console.log("[Session] Generated new session ID:", sessionId.substring(0, 50) + "...")
  }

  return sessionId
}

/**
 * Clear session (useful for testing or logout)
 */
export function clearSession(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem(STORAGE_KEY)
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
 * Event system for notifying components when interactions change
 */
type InteractionChangeListener = () => void
const interactionChangeListeners = new Set<InteractionChangeListener>()

/**
 * Subscribe to interaction changes (returns unsubscribe function)
 */
export function onInteractionChange(listener: InteractionChangeListener): () => void {
  interactionChangeListeners.add(listener)
  return () => {
    interactionChangeListeners.delete(listener)
  }
}

/**
 * Notify all listeners that interactions have changed
 */
function notifyInteractionChange() {
  if (typeof window === "undefined") return
  // Dispatch custom event for components that use event listeners
  window.dispatchEvent(new CustomEvent("ihute:interaction-change"))
  // Call all registered listeners
  interactionChangeListeners.forEach(listener => {
    try {
      listener()
    } catch (error) {
      console.warn("Error in interaction change listener:", error)
    }
  })
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

  // Notify listeners that interactions have changed (only once)
  notifyInteractionChange()

  // Sync with backend: throttle to avoid request flood (max 1 per TRACK_THROTTLE_MS)
  const now = Date.now()
  if (now - lastTrackSyncAt < TRACK_THROTTLE_MS) return
  lastTrackSyncAt = now

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

