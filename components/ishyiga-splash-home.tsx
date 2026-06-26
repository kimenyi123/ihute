"use client"

import Image from "next/image"
import type { ReactNode } from "react"
import { useEffect, useState, useRef } from "react"
import { MapPin, Star, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLanguageStore, type Language } from "@/lib/language-store"

type IshyigaSplashHomeProps = {
  /** After the splash, e.g. full home with sector UI. If omitted, shows the default tagline only. */
  children?: ReactNode
}

const SPLASH_HOME_UI: Record<Language, {
  trendingTitle: string
  trendingViewAll: string
  nearbyShopsTitle: string
  nearbyShopsViewAll: string
  requestLocation: string
  distance: string
  rating: string
  category: string
}> = {
  en: {
    trendingTitle: "Trending Products",
    trendingViewAll: "View all",
    nearbyShopsTitle: "Shops Near You",
    nearbyShopsViewAll: "View all",
    requestLocation: "Enable location to find nearby shops",
    distance: "km away",
    rating: "Rating",
    category: "Category",
  },
  rw: {
    trendingTitle: "Ibicuruzwa Bikunzwe",
    trendingViewAll: "Reba byose",
    nearbyShopsTitle: "Amaduka Hafi Yawe",
    nearbyShopsViewAll: "Reba byose",
    requestLocation: "Vumira lokasyon kugira ngo mubone amaduka ahafi",
    distance: "km hafi",
    rating: "Igipimo",
    category: "Icyiciro",
  },
  fr: {
    trendingTitle: "Produits Tendance",
    trendingViewAll: "Voir tout",
    nearbyShopsTitle: "Boutiques Près de Vous",
    nearbyShopsViewAll: "Voir tout",
    requestLocation: "Activez la localisation pour trouver des boutiques à proximité",
    distance: "km",
    rating: "Note",
    category: "Catégorie",
  },
}

// Mock data for trending products
const MOCK_TRENDING_PRODUCTS = [
  {
    id: "1",
    name: "Premium Coffee",
    price: 5500,
    image: "https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=160&h=240&fit=crop",
    shop: "Mountain Roasters",
  },
  {
    id: "2",
    name: "Organic Vegetables",
    price: 3200,
    image: "https://images.unsplash.com/photo-1518977822534-7049a61ee0c2?w=160&h=240&fit=crop",
    shop: "Fresh Farm",
  },
  {
    id: "3",
    name: "Handmade Soap",
    price: 2800,
    image: "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=160&h=240&fit=crop",
    shop: "Natural Beauty",
  },
  {
    id: "4",
    name: "Local Honey",
    price: 4500,
    image: "https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=160&h=240&fit=crop",
    shop: "Bee Farm Co",
  },
  {
    id: "5",
    name: "Artisan Bread",
    price: 1500,
    image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=160&h=240&fit=crop",
    shop: "Golden Bakery",
  },
]

// Mock data for nearby shops
const MOCK_NEARBY_SHOPS = [
  {
    id: "1",
    name: "Mountain Roasters",
    category: "Coffee & Cafe",
    distance: 0.8,
    rating: 4.8,
    lat: -1.9547,
    lng: 29.8739,
  },
  {
    id: "2",
    name: "Fresh Farm Market",
    category: "Groceries",
    distance: 1.2,
    rating: 4.6,
    lat: -1.9550,
    lng: 29.8745,
  },
  {
    id: "3",
    name: "Natural Beauty Store",
    category: "Beauty & Wellness",
    distance: 1.5,
    rating: 4.9,
    lat: -1.9540,
    lng: 29.8750,
  },
  {
    id: "4",
    name: "Golden Bakery",
    category: "Bakery",
    distance: 2.1,
    rating: 4.7,
    lat: -1.9555,
    lng: 29.8735,
  },
]

/** Kaos-style load splash (`index.jsp` loading-screen): full view, logo, then content. */
export function IshyigaSplashHome({ children }: IshyigaSplashHomeProps) {
  const [splashDone, setSplashDone] = useState(false)
  const [activeSlide, setActiveSlide] = useState(0)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const mapRef = useRef<any>(null)
  const userMarkerRef = useRef<any>(null)
  const leafletRef = useRef<any>(null)
  const language = useLanguageStore((s) => s.language)
  const ui = SPLASH_HOME_UI[language] ?? SPLASH_HOME_UI.en

  useEffect(() => {
    const t = window.setTimeout(() => setSplashDone(true), 1700)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % MOCK_TRENDING_PRODUCTS.length)
    }, 3000)
    return () => window.clearInterval(interval)
  }, [])

  const handlePrevSlide = () => {
    setActiveSlide((current) =>
      current === 0 ? MOCK_TRENDING_PRODUCTS.length - 1 : current - 1
    )
  }

  const handleNextSlide = () => {
    setActiveSlide((current) => (current + 1) % MOCK_TRENDING_PRODUCTS.length)
  }

  const handleLocationRequest = () => {
    setLocationError(null)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          setUserLocation({ lat: latitude, lng: longitude })

          // Re-center map to user's location
          if (mapRef.current && leafletRef.current) {
            const L = leafletRef.current
            mapRef.current.setView([latitude, longitude], 13)

            // Remove existing user marker if any
            if (userMarkerRef.current) {
              mapRef.current.removeLayer(userMarkerRef.current)
            }

            // Add user location marker (blue)
            const userMarker = L.marker([latitude, longitude], {
              icon: L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
              }),
            }).addTo(mapRef.current)
            userMarker.bindPopup('Aho uri')
            userMarkerRef.current = userMarker
          }
          console.log("Location granted:", { latitude, longitude })
        },
        (error) => {
          setLocationError("Location access denied")
          console.error("Location error:", error)
        }
      )
    }
  }

  useEffect(() => {
    // Load Leaflet CSS
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)

    // Initialize map
    const initMap = async () => {
      const L = (await import('leaflet')).default
      leafletRef.current = L
      
      // Check if map is already initialized
      if (mapRef.current) {
        return
      }

      const mapElement = document.getElementById('nearby-map')
      if (!mapElement) {
        return
      }

      // Create map
      const map = L.map('nearby-map').setView([-1.9441, 30.0619], 13)

      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)

      // Add markers for nearby shops
      MOCK_NEARBY_SHOPS.forEach((shop) => {
        const marker = L.marker([shop.lat, shop.lng]).addTo(map)
        marker.bindPopup(`<strong>${shop.name}</strong><br/>${shop.category}`)
      })

      mapRef.current = map
    }

    if (typeof window !== 'undefined') {
      initMap().catch((err) => console.error('Failed to initialize map:', err))
    }

    return () => {
      if (link.parentNode) {
        link.parentNode.removeChild(link)
      }
    }
  }, [])

  return (
    <div
      className={cn(
        "relative min-h-screen w-full",
        !children && "overflow-hidden bg-white"
      )}
    >
      {/* Splash — white ground + full Ishyiga wordmark (icon + ISHYIGA / SOFTWARE) */}
      <div
        aria-hidden={splashDone}
        className={cn(
          "fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white transition-opacity duration-700 ease-out",
          splashDone ? "pointer-events-none opacity-0" : "opacity-100"
        )}
      >
        <div className="loading-container flex flex-col items-center px-6">
          <div className="loading-logo flex items-center justify-center">
            <div className={cn("splash-breathe", splashDone && "[animation:none]")}>
              <Image
                src="/images/ishyiga-logo-brand.png"
                alt="Ishyiga Software"
                width={480}
                height={160}
                priority
                sizes="(max-width: 640px) 90vw, 420px"
                className="h-auto w-[min(90vw,420px)] object-contain"
              />
            </div>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "w-full transition-opacity duration-700 ease-out",
          splashDone ? "opacity-100" : "opacity-0"
        )}
      >
        {children}

        {/* Trending Products Section */}
        <section className="border-b border-gray-200 bg-white px-4 py-8 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">
                {ui.trendingTitle}
              </h2>
              <a
                href="#"
                className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                {ui.trendingViewAll}
                <ChevronRight className="h-4 w-4" />
              </a>
            </div>

            <div className="relative overflow-hidden rounded-[2rem] bg-slate-900 shadow-xl py-6 w-1/2 mx-auto">
              <div className="relative overflow-hidden px-4 mx-auto max-w-[940px]">
                <div
                  className="flex gap-4 transition-transform duration-700 ease-out"
                  style={{ transform: `translateX(-${activeSlide * 176}px)` }}
                >
                  {MOCK_TRENDING_PRODUCTS.map((product) => (
                    <div
                      key={product.id}
                      className="relative flex-shrink-0 h-[240px] w-[160px] overflow-hidden rounded-[1.75rem] bg-slate-900 shadow-xl"
                    >
                      <Image
                        src={product.image}
                        alt={product.name}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-slate-950/95 to-transparent p-4 text-white">
                        <div className="flex flex-col justify-end h-full">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300">
                            {product.shop}
                          </p>
                          <h3 className="mt-2 text-sm font-bold leading-tight">
                            {product.name}
                          </h3>
                          <p className="mt-1 text-sm font-semibold text-amber-200">
                            {product.price.toLocaleString()} RWF
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handlePrevSlide}
                className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-2 text-slate-900 shadow-md transition hover:bg-white"
                aria-label="Previous slide"
              >
                <ChevronRight className="h-4 w-4 rotate-180" />
              </button>
              <button
                type="button"
                onClick={handleNextSlide}
                className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-2 text-slate-900 shadow-md transition hover:bg-white"
                aria-label="Next slide"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex justify-center gap-2">
              {MOCK_TRENDING_PRODUCTS.map((_, dotIndex) => (
                <button
                  key={dotIndex}
                  onClick={() => setActiveSlide(dotIndex)}
                  className={cn(
                    "h-2.5 w-2.5 rounded-full transition-all",
                    activeSlide === dotIndex ? "bg-slate-900 w-8" : "bg-slate-300"
                  )}
                  aria-label={`Go to slide ${dotIndex + 1}`}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Nearby Shops Section */}
        <section className="border-t border-gray-200 bg-gray-50 px-4 py-8 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">
                {ui.nearbyShopsTitle}
              </h2>
              <a
                href="#"
                className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                {ui.nearbyShopsViewAll}
                <ChevronRight className="h-4 w-4" />
              </a>
            </div>

            {/* Location Permission Banner */}
            <div className="mb-6 flex items-center gap-3 rounded-lg bg-blue-50 border border-blue-200 p-4">
              <MapPin className="h-5 w-5 text-blue-600 flex-shrink-0" />
              <p className="flex-1 text-sm text-blue-900">{ui.requestLocation}</p>
              <button
                onClick={handleLocationRequest}
                className="flex-shrink-0 rounded-md bg-blue-600 px-3 py-1 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
              >
                Enable
              </button>
            </div>

            {locationError && (
              <div className="mb-6 flex items-center gap-3 rounded-lg bg-red-50 border border-red-200 p-4">
                <MapPin className="h-5 w-5 text-red-600 flex-shrink-0" />
                <p className="flex-1 text-sm text-red-900">{locationError}</p>
              </div>
            )}

            {/* Map Container */}
            <div id="nearby-map" className="mb-6 h-[300px] w-full overflow-hidden rounded-3xl shadow-inner border border-slate-200" />

            {/* Nearby Shops List */}
            <div className="flex gap-4 overflow-x-auto pb-4 sm:gap-6">
              {MOCK_NEARBY_SHOPS.map((shop) => (
                <div
                  key={shop.id}
                  className="flex-shrink-0 cursor-pointer rounded-lg bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
                  style={{ minWidth: "220px" }}
                >
                  <div className="mb-3 h-20 w-20 overflow-hidden rounded-3xl bg-gray-100">
                    <img
                      src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=100&h=100&fit=crop"
                      alt={shop.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 mb-2">
                    {shop.name}
                  </h3>
                  <p className="text-xs text-gray-600 mb-2">{shop.category}</p>
                  <div className="flex items-center justify-between text-xs text-gray-700 mb-2">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {shop.distance} {ui.distance}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <span className="text-xs font-semibold text-gray-900">
                      {shop.rating}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
