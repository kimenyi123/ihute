// lib/recommendation-config.ts
"use client"

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

/**
 * Recommendation Configuration Store
 * Allows configurable settings for recommendation behavior
 */

export type RecommendationAlgorithm = "collaborative" | "category-based" | "hybrid"

export type ABTestVariant = "control" | "variant-a" | "variant-b"

export interface RecommendationConfig {
    // Cache settings
    cacheDurationMinutes: number

    // Algorithm selection
    algorithm: RecommendationAlgorithm

    // A/B testing
    abTestVariant: ABTestVariant
    abTestEnabled: boolean

    // Feature flags
    enableTrendingFallback: boolean
    enableCollaborativeFiltering: boolean
    enableCategoryBased: boolean

    // UI settings
    showRecommendationSource: boolean
    showCacheStatus: boolean
}

type RecommendationConfigState = {
    config: RecommendationConfig
    setConfig: (updates: Partial<RecommendationConfig>) => void
    resetToDefaults: () => void
}

const DEFAULT_CONFIG: RecommendationConfig = {
    cacheDurationMinutes: 5,
    algorithm: "hybrid",
    abTestVariant: "control",
    abTestEnabled: false,
    enableTrendingFallback: true,
    enableCollaborativeFiltering: true,
    enableCategoryBased: true,
    showRecommendationSource: false,
    showCacheStatus: false,
}

/**
 * A/B Test Assignment Logic
 * Assigns users to test variants consistently
 */
function assignABTestVariant(): ABTestVariant {
    if (typeof window === "undefined") return "control"

    // Check if already assigned
    const stored = localStorage.getItem("ihute-ab-test-variant")
    if (stored && ["control", "variant-a", "variant-b"].includes(stored)) {
        return stored as ABTestVariant
    }

    // Assign based on random distribution
    const random = Math.random()
    let variant: ABTestVariant

    if (random < 0.33) {
        variant = "control"
    } else if (random < 0.66) {
        variant = "variant-a"
    } else {
        variant = "variant-b"
    }

    localStorage.setItem("ihute-ab-test-variant", variant)
    return variant
}

export const useRecommendationConfig = create<RecommendationConfigState>()(
    persist(
        (set) => ({
            config: {
                ...DEFAULT_CONFIG,
                abTestVariant: assignABTestVariant(),
            },

            setConfig: (updates) =>
                set((state) => ({
                    config: { ...state.config, ...updates },
                })),

            resetToDefaults: () =>
                set({
                    config: {
                        ...DEFAULT_CONFIG,
                        abTestVariant: assignABTestVariant(),
                    },
                }),
        }),
        {
            name: "recommendation-config",
            storage: createJSONStorage(() => localStorage),
        }
    )
)

/**
 * Get cache duration in milliseconds based on config
 */
export function getCacheDuration(): number {
    const { config } = useRecommendationConfig.getState()
    return config.cacheDurationMinutes * 60 * 1000
}

/**
 * Get active recommendation algorithm based on A/B test variant
 */
export function getActiveAlgorithm(): RecommendationAlgorithm {
    const { config } = useRecommendationConfig.getState()

    if (!config.abTestEnabled) {
        return config.algorithm
    }

    // A/B test variant mapping
    switch (config.abTestVariant) {
        case "control":
            return "hybrid"
        case "variant-a":
            return "collaborative"
        case "variant-b":
            return "category-based"
        default:
            return "hybrid"
    }
}

/**
 * Track A/B test event for analytics
 */
export function trackABTestEvent(
    eventName: string,
    metadata?: Record<string, any>
) {
    const { config } = useRecommendationConfig.getState()

    if (!config.abTestEnabled) return

    console.log("[A/B Test]", {
        variant: config.abTestVariant,
        event: eventName,
        metadata,
    })

    // TODO: Send to analytics service
    // analytics.track(eventName, {
    //   ab_test_variant: config.abTestVariant,
    //   ...metadata
    // })
}
