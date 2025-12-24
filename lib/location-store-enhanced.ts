"use client"

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

export type LocationData = {
  district: string
  cell?: string
  province?: string
  latitude?: number
  longitude?: number
  timestamp: number
  source: "gps" | "manual"
}

type LocationState = {
  location: LocationData | null
  hasAskedForLocation: boolean
  locationExpiryDays: number

  // Actions
  setLocation: (location: LocationData) => void
  clearLocation: () => void
  setHasAskedForLocation: (asked: boolean) => void
  isLocationExpired: () => boolean
}

export const useLocationStoreEnhanced = create<LocationState>()(
  persist(
    (set, get) => ({
      location: null,
      hasAskedForLocation: false,
      locationExpiryDays: 30, // Re-ask after 30 days

      setLocation: (location) => {
        set({ location, hasAskedForLocation: true })
        // Also set cookie for backend
        if (typeof document !== "undefined") {
          document.cookie = `user_district=${location.district}; path=/; max-age=${60 * 60 * 24 * 30}` // 30 days
          if (location.cell) {
            document.cookie = `user_cell=${location.cell}; path=/; max-age=${60 * 60 * 24 * 30}`
          }
        }
      },

      clearLocation: () => {
        set({ location: null })
        if (typeof document !== "undefined") {
          document.cookie = "user_district=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT"
          document.cookie = "user_cell=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT"
        }
      },

      setHasAskedForLocation: (asked) => set({ hasAskedForLocation: asked }),

      isLocationExpired: () => {
        const location = get().location
        if (!location) return true
        const daysSince = (Date.now() - location.timestamp) / (1000 * 60 * 60 * 24)
        return daysSince > get().locationExpiryDays
      },
    }),
    {
      name: "location-enhanced-storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
)

/**
 * Reverse geocode GPS coordinates to district and cell
 * Uses Rwanda-specific geocoding service
 */
export async function reverseGeocodeToDistrict(
  latitude: number,
  longitude: number
): Promise<{ district: string; cell?: string; province?: string } | null> {
  try {
    // Try LocationIQ first (has Rwanda data)
    const response = await fetch(
      `https://us1.locationiq.com/v1/reverse.php?key=pk.cc7d01c84e9813f009525ca58b8e50ad&lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
      {
        headers: {
          "User-Agent": "Ishyiga-Rwanda-App",
        },
      }
    )

    if (!response.ok) {
      throw new Error("Geocoding failed")
    }

    const data = await response.json()
    const address = data.address || {}

    // Extract district (county in LocationIQ)
    const district = address.county || address.state_district || address.city_district

    // Extract cell (suburb or neighbourhood)
    const cell = address.suburb || address.neighbourhood || address.village

    // Extract province
    const province = address.state || address.region

    if (district) {
      return { district, cell, province }
    }

    // Fallback to Nominatim
    return await reverseGeocodeNominatim(latitude, longitude)
  } catch (error) {
    console.warn("LocationIQ geocoding failed, trying Nominatim:", error)
    return await reverseGeocodeNominatim(latitude, longitude)
  }
}

/**
 * Fallback to Nominatim for reverse geocoding
 */
async function reverseGeocodeNominatim(
  latitude: number,
  longitude: number
): Promise<{ district: string; cell?: string; province?: string } | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
      {
        headers: {
          "User-Agent": "Ishyiga-Rwanda-App",
        },
      }
    )

    if (!response.ok) return null

    const data = await response.json()
    const address = data.address || {}

    const district = address.county || address.state_district || address.city
    const cell = address.suburb || address.neighbourhood
    const province = address.state || address.region

    return district ? { district, cell, province } : null
  } catch (error) {
    console.error("Nominatim geocoding failed:", error)
    return null
  }
}

