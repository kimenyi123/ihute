// lib/recommendation-service.ts
"use client"

import { getSessionId, getRecentInteractions, type Interaction } from "./interaction-tracker"
import { useAuthStore } from "./auth-store"
import { getCacheDuration } from "./recommendation-config"

/** Shuffle array (Fisher–Yates) and return new array, so personalization order changes each time. */
export function shuffle<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Smart Recommendation Service
 * Implements Amazon-style recommendation algorithm with intelligent caching
 * 
 * Features:
 * - Session-based caching (5 minutes)
 * - Collaborative filtering
 * - Category-based recommendations
 * - Supplier-based recommendations
 * - View history analysis
 */

export type RecommendationContext = {
    categories: string[]
    suppliers: string[]
    products: string[]
    recentSearches: string[]
}

type CachedRecommendations = {
    products: string[]
    suppliers: string[]
    categories: string[]
    timestamp: number
    context: RecommendationContext
}

const CACHE_KEY = "ihute-recommendations-cache"

/**
 * Get recommendation context from user's browsing history
 */
export function getRecommendationContext(): RecommendationContext {
    const interactions = getRecentInteractions(undefined, 50)

    const categories = new Set<string>()
    const suppliers = new Set<string>()
    const products = new Set<string>()
    const searches = new Set<string>()

    // Analyze browsing history
    for (const interaction of interactions) {
        if (interaction.entityType === "category") {
            categories.add(interaction.entityId)
        } else if (interaction.entityType === "supplier") {
            suppliers.add(interaction.entityId)
        } else if (interaction.entityType === "product") {
            products.add(interaction.entityId)
            // Extract category from metadata if available
            if (interaction.metadata?.categoryId) {
                categories.add(interaction.metadata.categoryId)
            }
            // Extract supplier from metadata if available
            if (interaction.metadata?.supplierId) {
                suppliers.add(interaction.metadata.supplierId)
            }
        } else if (interaction.entityType === "search") {
            searches.add(interaction.entityId)
        }
    }

    return {
        categories: Array.from(categories).slice(0, 10),
        suppliers: Array.from(suppliers).slice(0, 10),
        products: Array.from(products).slice(0, 20),
        recentSearches: Array.from(searches).slice(0, 5),
    }
}

/**
 * Get cached recommendations if still valid
 */
function getCachedRecommendations(): CachedRecommendations | null {
    if (typeof window === "undefined") return null

    try {
        const cached = sessionStorage.getItem(CACHE_KEY)
        if (!cached) return null

        const data: CachedRecommendations = JSON.parse(cached)
        const age = Date.now() - data.timestamp

        // Check if cache is still valid (using configurable duration)
        if (age > getCacheDuration()) {
            sessionStorage.removeItem(CACHE_KEY)
            return null
        }

        return data
    } catch {
        return null
    }
}

/**
 * Save recommendations to cache
 */
function cacheRecommendations(
    products: string[],
    suppliers: string[],
    categories: string[],
    context: RecommendationContext
) {
    if (typeof window === "undefined") return

    try {
        const data: CachedRecommendations = {
            products,
            suppliers,
            categories,
            timestamp: Date.now(),
            context,
        }
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(data))
    } catch (e) {
        console.warn("Failed to cache recommendations:", e)
    }
}

/**
 * Check if context has changed significantly (requires refresh)
 */
function hasContextChanged(oldContext: RecommendationContext, newContext: RecommendationContext): boolean {
    // If user viewed new categories, refresh
    const newCategories = newContext.categories.filter(c => !oldContext.categories.includes(c))
    if (newCategories.length > 0) return true

    // If user viewed new suppliers, refresh
    const newSuppliers = newContext.suppliers.filter(s => !oldContext.suppliers.includes(s))
    if (newSuppliers.length > 0) return true

    // If user made new searches, refresh
    const newSearches = newContext.recentSearches.filter(s => !oldContext.recentSearches.includes(s))
    if (newSearches.length > 0) return true

    return false
}

/**
 * Invalidate recommendation cache (call when user makes significant interactions)
 */
export function invalidateRecommendationCache() {
    if (typeof window === "undefined") return
    sessionStorage.removeItem(CACHE_KEY)
}

/**
 * Get smart recommendations with caching
 * Only fetches from backend if:
 * 1. Cache is expired (> 5 minutes)
 * 2. User context has changed significantly
 * 3. No cache exists
 */
export async function getSmartRecommendations(
    limit: number = 20,
    forceRefresh: boolean = false
): Promise<{
    products: string[]
    suppliers: string[]
    categories: string[]
    source: "cache" | "backend"
    cacheAge?: number
}> {
    const currentContext = getRecommendationContext()

    // Check cache first
    if (!forceRefresh) {
        const cached = getCachedRecommendations()

        if (cached) {
            const cacheAge = Date.now() - cached.timestamp

            // Use cache if context hasn't changed significantly (shuffle so order varies)
            if (!hasContextChanged(cached.context, currentContext)) {
                console.log(`[Recommendations] Using cached (age: ${Math.round(cacheAge / 1000)}s), shuffled`)
                return {
                    products: shuffle(cached.products),
                    suppliers: shuffle(cached.suppliers),
                    categories: shuffle(cached.categories),
                    source: "cache",
                    cacheAge,
                }
            } else {
                console.log("[Recommendations] Context changed significantly, refreshing...")
            }
        }
    }

    // Fetch fresh recommendations from backend
    try {
        const authStore = useAuthStore.getState()
        const userId = authStore.user?.email || null
        const sessionId = getSessionId()

        const params = new URLSearchParams()
        params.set("action", "getRecommendations")
        params.set("limit", limit.toString())
        if (userId) params.set("userId", userId)
        if (sessionId) params.set("sessionId", sessionId)

        // Send context to backend for better recommendations
        if (currentContext.categories.length > 0) {
            params.set("categories", currentContext.categories.join(","))
        }
        if (currentContext.suppliers.length > 0) {
            params.set("suppliers", currentContext.suppliers.join(","))
        }
        if (currentContext.products.length > 0) {
            params.set("products", currentContext.products.slice(0, 10).join(","))
        }

        const res = await fetch(`/api/personalization/recommendations?${params.toString()}`, {
            method: "GET",
            cache: "no-store",
            headers: {
                "Cache-Control": "no-cache, no-store, must-revalidate",
            },
        })

        const data = await res.json()

        if (data.ok && data.products) {
            const products = Array.isArray(data.products) ? data.products : []
            const suppliers = Array.isArray(data.suppliers) ? data.suppliers : []
            const categories = Array.isArray(data.categories) ? data.categories : []

            // Cache raw order for consistency when reading from cache; return shuffled so UI varies
            cacheRecommendations(products, suppliers, categories, currentContext)

            console.log("[Recommendations] Fetched fresh from backend, shuffled")
            return {
                products: shuffle(products),
                suppliers: shuffle(suppliers),
                categories: shuffle(categories),
                source: "backend",
            }
        }

        throw new Error("Invalid response from backend")
    } catch (error) {
        console.error("[Recommendations] Error fetching:", error)

        // Fallback to cache even if expired (shuffle so order varies)
        const cached = getCachedRecommendations()
        if (cached) {
            console.log("[Recommendations] Using stale cache as fallback, shuffled")
            return {
                products: shuffle(cached.products),
                suppliers: shuffle(cached.suppliers),
                categories: shuffle(cached.categories),
                source: "cache",
                cacheAge: Date.now() - cached.timestamp,
            }
        }

        return {
            products: [],
            suppliers: [],
            categories: [],
            source: "backend",
        }
    }
}

/**
 * Get category-specific recommendations
 * "User browsed computers -> Show more computers"
 */
export function getCategoryRecommendations(categoryId: string, limit: number = 10): string[] {
    const interactions = getRecentInteractions("product", 100)

    // Find products in the same category
    const categoryProducts = new Set<string>()

    for (const interaction of interactions) {
        if (interaction.metadata?.categoryId === categoryId) {
            categoryProducts.add(interaction.entityId)
        }
    }

    return Array.from(categoryProducts).slice(0, limit)
}

/**
 * Get supplier-based recommendations
 * "User viewed suppliers selling computers -> Show those suppliers"
 */
export function getSupplierRecommendations(limit: number = 5): string[] {
    const context = getRecommendationContext()

    // Return suppliers user has shown interest in
    return context.suppliers.slice(0, limit)
}

/**
 * Collaborative filtering: "Users who viewed X also viewed Y"
 */
export async function getCollaborativeRecommendations(
    productId: string,
    limit: number = 10
): Promise<string[]> {
    try {
        const params = new URLSearchParams()
        params.set("action", "getSimilar")
        params.set("entityId", productId)
        params.set("entityType", "product")
        params.set("limit", limit.toString())

        const res = await fetch(`/api/personalization/recommendations?${params.toString()}`)
        const data = await res.json()

        if (data.ok && data.products) {
            const list = Array.isArray(data.products) ? data.products : []
            return shuffle(list)
        }

        return []
    } catch (error) {
        console.error("[Collaborative] Error:", error)
        return []
    }
}
