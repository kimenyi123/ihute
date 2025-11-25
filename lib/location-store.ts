"use client"

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

export type UserLocation = {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: number
  district?: string
  address?: string
}

type LocationState = {
  userLocation: UserLocation | null
  isTracking: boolean
  error: string | null

  // Actions
  setUserLocation: (location: UserLocation) => void
  clearUserLocation: () => void
  setError: (error: string | null) => void
  setTracking: (tracking: boolean) => void

  // Get current location from browser
  requestLocation: () => Promise<UserLocation | null>
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set, get) => ({
      userLocation: null,
      isTracking: false,
      error: null,

      setUserLocation: (location) =>
        set({
          userLocation: location,
          error: null,
        }),

      clearUserLocation: () =>
        set({
          userLocation: null,
          error: null,
        }),

      setError: (error) =>
        set({ error }),

      setTracking: (tracking) =>
        set({ isTracking: tracking }),

      requestLocation: async () => {
        set({ isTracking: true, error: null })

        try {
          // Check if geolocation is supported
          if (!navigator.geolocation) {
            throw new Error("Geolocation is not supported by your browser")
          }

          // Request location with high accuracy
          const position = await new Promise<GeolocationPosition>(
            (resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0,
              })
            }
          )

          const location: UserLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          }

          // Try to get address from coordinates (reverse geocoding)
          try {
            const address = await reverseGeocode(
              location.latitude,
              location.longitude
            )
            location.address = address
          } catch (err) {
            console.warn("Failed to get address:", err)
          }

          set({
            userLocation: location,
            isTracking: false,
            error: null,
          })

          return location
        } catch (error: any) {
          const errorMsg =
            error.code === 1
              ? "Location access denied. Please enable location permissions."
              : error.code === 2
              ? "Location unavailable. Please check your device settings."
              : error.code === 3
              ? "Location request timed out. Please try again."
              : error.message || "Failed to get location"

          set({
            isTracking: false,
            error: errorMsg,
          })

          return null
        }
      },
    }),
    {
      name: "location-storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
)

// Helper function for reverse geocoding (using browser's geolocation + nominatim)
async function reverseGeocode(
  lat: number,
  lon: number
): Promise<string | undefined> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
      {
        headers: {
          "User-Agent": "Ishyiga-Rwanda-App",
        },
      }
    )

    if (!response.ok) return undefined

    const data = await response.json()

    // Try to extract district/sector from address
    const address = data.address || {}
    const district = address.county || address.state_district || address.city
    const sector = address.suburb || address.neighbourhood

    return district
      ? `${sector ? sector + ", " : ""}${district}, Rwanda`
      : data.display_name
  } catch (error) {
    console.error("Reverse geocoding failed:", error)
    return undefined
  }
}

// Calculate distance between two coordinates (Haversine formula)
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371 // Radius of Earth in kilometers
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c // Distance in kilometers
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180
}
