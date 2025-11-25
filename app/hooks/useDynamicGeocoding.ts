// hooks/useDynamicGeocoding.ts
import { useState, useCallback } from 'react'

type Coordinates = {
  latitude: number
  longitude: number
  source: 'locationiq' | 'nominatim'
}

type LocationIQResponse = {
  lat: string
  lon: string
  display_name?: string
  importance?: number
}

type NominatimResponse = {
  lat: string
  lon: string
  display_name?: string
}

type UseDynamicGeocodingReturn = {
  geocodeLocation: (location: string) => Promise<Coordinates | null>
  isGeocoding: boolean
  cacheSize: number
}

export function useDynamicGeocoding(): UseDynamicGeocodingReturn {
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [cache, setCache] = useState<Map<string, Coordinates>>(new Map())

  const geocodeLocation = useCallback(async (location: string): Promise<Coordinates | null> => {
    if (!location) return null

    // Check cache first
    const cacheKey = location.toLowerCase().trim()
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey)!
    }

    setIsGeocoding(true)
    try {
      // Try LocationIQ first
      const coords = await geocodeWithLocationIQ(location)
      if (coords) {
        setCache(prev => new Map(prev).set(cacheKey, coords))
        return coords
      }

      // Fallback to Nominatim
      const fallbackCoords = await geocodeWithNominatim(location)
      if (fallbackCoords) {
        setCache(prev => new Map(prev).set(cacheKey, fallbackCoords))
        return fallbackCoords
      }

      return null
    } finally {
      setIsGeocoding(false)
    }
  }, [cache])

  const geocodeWithLocationIQ = async (location: string): Promise<Coordinates | null> => {
    try {
      const apiKey = 'AIzaSyC0k31_xQtaoX1Xtgv3vxLrA30aFHxeqlw'
      const encodedLocation = encodeURIComponent(location + ', Rwanda')
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/js?key=${apiKey}&q=${encodedLocation}&format=json&limit=1`,
        {
          method: 'GET',
          headers: { 'User-Agent': 'Ishyiga-App/1.0' }
        }
      )

      if (response.ok) {
        const data: LocationIQResponse[] = await response.json()
        if (data && data.length > 0) {
          return {
            latitude: parseFloat(data[0].lat),
            longitude: parseFloat(data[0].lon),
            source: 'locationiq'
          }
        }
      }
    } catch (error) {
      console.warn('LocationIQ geocoding failed:', error)
    }
    return null
  }

  const geocodeWithNominatim = async (location: string): Promise<Coordinates | null> => {
    try {
      const encodedLocation = encodeURIComponent(location)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodedLocation}&countrycodes=rw&limit=1`,
        {
          method: 'GET',
          headers: { 'User-Agent': 'Ishyiga-App/1.0' }
        }
      )

      if (response.ok) {
        const data: NominatimResponse[] = await response.json()
        if (data && data.length > 0) {
          return {
            latitude: parseFloat(data[0].lat),
            longitude: parseFloat(data[0].lon),
            source: 'nominatim'
          }
        }
      }
    } catch (error) {
      console.warn('Nominatim geocoding failed:', error)
    }
    return null
  }

  return {
    geocodeLocation,
    isGeocoding,
    cacheSize: cache.size
  }
}
