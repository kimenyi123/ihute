/**
 * React Hook for Enhanced Geocoding
 * Provides accurate geocoding with smart caching for Next.js/React
 */

import { useState, useEffect, useCallback } from 'react'

// ==================== TYPES ====================

export type Coordinates = {
  latitude: number
  longitude: number
  confidence?: number
  displayName?: string
  source?: string
}

export type GeocodingCache = {
  coords: Coordinates
  timestamp: number
  originalAddress: string
}

export type GeocodingStats = {
  size: number
  hits: number
  misses: number
  hitRate: number
}

// ==================== CONFIGURATION ====================

const ENHANCED_GEOCODING = {
  locationiq: {
    apiKey: process.env.NEXT_PUBLIC_LOCATIONIQ_API_KEY || 'pk.cc7d01c84e9813f009525ca58b8e50ad',
    baseUrl: 'https://us1.locationiq.com/v1',
    rateLimit: 1000, // ms between requests
    timeout: 10000
  },
  cache: {
    ttl: 90 * 24 * 60 * 60 * 1000, // 90 days
    storageKey: 'ihute_geocoding_cache_v2'
  },
  rwanda: {
    minLat: -2.9,
    maxLat: -1.0,
    minLng: 28.8,
    maxLng: 31.0,
    viewbox: '28.8,-1.0,31.0,-2.9'
  }
}

// ==================== CACHE UTILITIES ====================

class GeocodingCacheManager {
  private cache: Map<string, GeocodingCache>
  private hits: number = 0
  private misses: number = 0

  constructor() {
    this.cache = new Map()
    this.loadFromLocalStorage()
  }

  private generateKey(address: string): string {
    return address
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
  }

  set(address: string, coords: Coordinates): void {
    const key = this.generateKey(address)
    this.cache.set(key, {
      coords,
      timestamp: Date.now(),
      originalAddress: address
    })
    this.saveToLocalStorage()
  }

  get(address: string): Coordinates | null {
    const key = this.generateKey(address)
    const cached = this.cache.get(key)

    if (!cached) {
      this.misses++
      return null
    }

    // Check expiry
    if (Date.now() - cached.timestamp > ENHANCED_GEOCODING.cache.ttl) {
      this.cache.delete(key)
      this.misses++
      return null
    }

    this.hits++
    return cached.coords
  }

  private saveToLocalStorage(): void {
    if (typeof window === 'undefined') return

    try {
      const data = {
        entries: Array.from(this.cache.entries()),
        savedAt: Date.now()
      }
      localStorage.setItem(
        ENHANCED_GEOCODING.cache.storageKey,
        JSON.stringify(data)
      )
    } catch (e) {
      console.warn('Failed to save geocoding cache:', e)
    }
  }

  private loadFromLocalStorage(): void {
    if (typeof window === 'undefined') return

    try {
      const stored = localStorage.getItem(ENHANCED_GEOCODING.cache.storageKey)
      if (stored) {
        const data = JSON.parse(stored)
        this.cache = new Map(data.entries)
        console.log(`📂 Loaded ${this.cache.size} cached locations`)
      }
    } catch (e) {
      console.warn('Failed to load geocoding cache:', e)
    }
  }

  getStats(): GeocodingStats {
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits / (this.hits + this.misses) || 0
    }
  }

  clear(): void {
    this.cache.clear()
    if (typeof window !== 'undefined') {
      localStorage.removeItem(ENHANCED_GEOCODING.cache.storageKey)
    }
    console.log('🗑️ Cache cleared')
  }
}

// Singleton instance
let cacheInstance: GeocodingCacheManager | null = null

function getCache(): GeocodingCacheManager {
  if (!cacheInstance) {
    cacheInstance = new GeocodingCacheManager()
  }
  return cacheInstance
}

// ==================== UTILITY FUNCTIONS ====================

function cleanAddress(address: string): string | null {
  if (!address || typeof address !== 'string') return null

  const cleaned = address
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s,.-]/g, '')

  // Invalid patterns
  const invalid = /^(na|n\/a|null|undefined|none|unknown|\s*)$/i
  if (invalid.test(cleaned)) return null

  // Extract meaningful location
  const parts = cleaned.split(/[,;]/)
  const meaningful = parts.find(p => {
    const trimmed = p.trim()
    return trimmed.length > 2 && !trimmed.match(/^(rwanda|rw|east africa)$/i)
  })

  return meaningful ? meaningful.trim() : cleaned
}

function isWithinRwanda(lat: number, lng: number): boolean {
  const bounds = ENHANCED_GEOCODING.rwanda
  return lat >= bounds.minLat && lat <= bounds.maxLat &&
         lng >= bounds.minLng && lng <= bounds.maxLng
}

// ==================== LOCATIONIQ API ====================

let lastRequestTime = 0

async function callLocationIQAPI(address: string): Promise<Coordinates | null> {
  const config = ENHANCED_GEOCODING.locationiq

  // Rate limiting
  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestTime
  if (timeSinceLastRequest < config.rateLimit) {
    await new Promise(resolve => 
      setTimeout(resolve, config.rateLimit - timeSinceLastRequest)
    )
  }
  lastRequestTime = Date.now()

  try {
    const params = new URLSearchParams({
      key: config.apiKey,
      q: `${address}, Rwanda`,
      format: 'json',
      limit: '1',
      countrycodes: 'rw',
      bounded: '1',
      viewbox: ENHANCED_GEOCODING.rwanda.viewbox,
      addressdetails: '1'
    })

    const url = `${config.baseUrl}/search.php?${params}`

    const response = await Promise.race([
      fetch(url),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), config.timeout)
      )
    ])

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()

    if (data && data.length > 0) {
      const result = data[0]
      const lat = parseFloat(result.lat)
      const lon = parseFloat(result.lon)

      if (isWithinRwanda(lat, lon)) {
        return {
          latitude: lat,
          longitude: lon,
          confidence: parseFloat(result.importance) || 0.8,
          displayName: result.display_name,
          source: 'locationiq_api'
        }
      }
    }

    return null
  } catch (error: any) {
    console.warn(`LocationIQ API failed for "${address}":`, error.message)
    return null
  }
}

// ==================== MAIN HOOK ====================

export function useEnhancedGeocoding() {
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cache = getCache()

  // Geocode a single address
  const geocode = useCallback(async (address: string): Promise<Coordinates | null> => {
    if (!address) return null

    setIsGeocoding(true)
    setError(null)

    try {
      const cleanAddr = cleanAddress(address)
      if (!cleanAddr) {
        console.warn(`⚠️ Invalid address: "${address}"`)
        return null
      }

      // Check cache first
      const cached = cache.get(cleanAddr)
      if (cached) {
        console.log(`✅ Cache hit: ${cleanAddr}`)
        return cached
      }

      // Call LocationIQ API
      const coords = await callLocationIQAPI(cleanAddr)

      if (coords && isWithinRwanda(coords.latitude, coords.longitude)) {
        console.log(`✅ Geocoded: ${cleanAddr} → (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`)
        cache.set(cleanAddr, coords)
        return coords
      }

      console.warn(`❌ Could not geocode: "${address}"`)
      return null
    } catch (err: any) {
      console.error(`❌ Geocoding failed:`, err)
      setError(err.message)
      return null
    } finally {
      setIsGeocoding(false)
    }
  }, [cache])

  // Batch geocode multiple addresses
  const geocodeBatch = useCallback(async (
    addresses: string[],
    onProgress?: (processed: number, total: number) => void
  ): Promise<Map<string, Coordinates | null>> => {
    const results = new Map<string, Coordinates | null>()
    const total = addresses.length

    console.log(`🔄 Starting batch geocoding of ${total} addresses...`)

    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i]
      const coords = await geocode(address)
      results.set(address, coords)

      if (onProgress && (i + 1) % 10 === 0) {
        onProgress(i + 1, total)
      }

      // Respect rate limits
      if (i < addresses.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    const successful = Array.from(results.values()).filter(c => c !== null).length
    console.log(`✅ Batch complete: ${successful}/${total} geocoded successfully`)

    return results
  }, [geocode])

  // Get cache statistics
  const getCacheStats = useCallback((): GeocodingStats => {
    return cache.getStats()
  }, [cache])

  // Clear cache
  const clearCache = useCallback((): void => {
    cache.clear()
  }, [cache])

  return {
    geocode,
    geocodeBatch,
    getCacheStats,
    clearCache,
    isGeocoding,
    error,
    isWithinRwanda
  }
}

// ==================== HAVERSINE DISTANCE ====================

export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371 // Earth's radius in kilometers

  const toRadians = (degrees: number) => degrees * Math.PI / 180

  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c // Distance in kilometers
}

// ==================== EXPORTS ====================

export { getCache, cleanAddress, isWithinRwanda }