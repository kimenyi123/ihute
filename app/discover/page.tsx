"use client"

import { useEffect, useState } from "react"
import { ProductCard } from "@/components/product-card"
import { TrendingUp, Sparkles, Clock, Heart, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react"
import { useAuthStore } from "@/lib/auth-store"
import { getSessionId, getRecentProductIds } from "@/lib/interaction-tracker"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

interface Product {
  id: string
  name: string
  description?: string
  price: number
  unit?: string
  image?: string
  supplierId?: string
  supplierName?: string
  supplierLocation?: string
  momo?: string
  inStock?: boolean
  rating?: number
}

interface RecommendationSection {
  title: string
  subtitle?: string
  icon: React.ReactNode
  products: Product[]
  loading: boolean
}

const PRODUCTS_PER_PAGE = 6 // Show 6 products per page

/**
 * PRODUCT REFRESH BEHAVIOR:
 * 
 * Products refresh automatically when:
 * 1. User logs in/out (user state changes)
 * 2. User navigates to the page (component mounts)
 * 3. User clicks "Refresh" button (manual refresh)
 * 
 * Products DON'T disappear automatically - they stay until:
 * - User refreshes the page
 * - User logs in/out
 * - User clicks refresh button
 * - New interactions change the recommendations (on next page load)
 * 
 * This prevents annoying constant changes while browsing.
 */

export default function DiscoverPage() {
  const { user } = useAuthStore()
  const [sections, setSections] = useState<RecommendationSection[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPages, setCurrentPages] = useState<Record<number, number>>({}) // Track current page for each section

  useEffect(() => {
    loadAllRecommendations()
  }, [user])

  // Get paginated products for a section
  function getPaginatedProducts(sectionIndex: number, allProducts: Product[]): Product[] {
    const currentPage = currentPages[sectionIndex] || 1
    const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE
    const endIndex = startIndex + PRODUCTS_PER_PAGE
    return allProducts.slice(startIndex, endIndex)
  }

  // Get total pages for a section
  function getTotalPages(productsCount: number): number {
    return Math.ceil(productsCount / PRODUCTS_PER_PAGE)
  }

  // Change page for a section
  function changePage(sectionIndex: number, newPage: number) {
    setCurrentPages(prev => ({
      ...prev,
      [sectionIndex]: newPage
    }))
    // Scroll to top of section
    const element = document.getElementById(`section-${sectionIndex}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  async function loadAllRecommendations() {
    setLoading(true)
    
    try {
      const userId = user?.email || null
      const sessionId = getSessionId()
      
      // 🔒 DEBUG: Log session info for verification
      if (process.env.NODE_ENV === 'development') {
        console.log("[Discover] Loading recommendations", {
          userId: userId || "null",
          sessionId: sessionId ? sessionId.substring(0, 50) + "..." : "null",
          hasUser: !!user
        })
      }
      
      const params = new URLSearchParams()
      if (userId) params.set("userId", userId)
      if (sessionId) params.set("sessionId", sessionId)
      params.set("limit", "20") // More products for discover page

      // Get recommendations
      const res = await fetch(`/api/personalization/recommendations?${params.toString()}`)
      const data = await res.json()
      
      // 🔒 DEBUG: Log response source
      if (process.env.NODE_ENV === 'development') {
        console.log("[Discover] Recommendations response", {
          ok: data.ok,
          source: data.source || "unknown",
          productCount: data.products?.length || 0,
          hasScores: !!data.productScores
        })
      }

      const newSections: RecommendationSection[] = []

      // Recently viewed
      const recentIds = getRecentProductIds(12)
      if (recentIds.length > 0) {
        const recentProducts = await fetchProductDetails(recentIds)
        if (recentProducts.length > 0) {
          newSections.push({
            title: "Recently Viewed",
            subtitle: "Continue browsing where you left off",
            icon: <Clock className="h-5 w-5" />,
            products: recentProducts,
            loading: false,
          })
        }
      }

      // Recommended products
      if (data.ok && data.products && data.products.length > 0 && !data.isFirstTime) {
        const recommendedProducts = await fetchProductDetails(data.products)
        if (recommendedProducts.length > 0) {
          newSections.push({
            title: "Recommended for You",
            subtitle: "Based on your browsing history",
            icon: <Sparkles className="h-5 w-5" />,
            products: recommendedProducts,
            loading: false,
          })
        }
      }

      // 🔒 FIRST-TIME USER: Don't show trending fallback - keep it empty
      // Only show trending if user explicitly has no recommendations but has interactions
      // (This should rarely happen, but handle edge case)
      if (newSections.length === 0 && data.ok && !data.isFirstTime && data.source === "trending") {
        const trendingRes = await fetch("/api/personalization/recommendations?action=getRecommendations&limit=20")
        const trendingData = await trendingRes.json()
        
        if (trendingData.ok && trendingData.products && !trendingData.isFirstTime) {
          const trendingProducts = await fetchProductDetails(trendingData.products)
          if (trendingProducts.length > 0) {
            newSections.push({
              title: "Trending Now",
              subtitle: "Popular products this week",
              icon: <TrendingUp className="h-5 w-5" />,
              products: trendingProducts,
              loading: false,
            })
          }
        }
      }

      setSections(newSections)
    } catch (error) {
      console.error("Error loading recommendations:", error)
      setSections([])
    } finally {
      setLoading(false)
    }
  }

  async function fetchProductDetails(productNames: string[]): Promise<Product[]> {
    if (productNames.length === 0) return []
    
    try {
      const allProducts: Product[] = []
      const seenIds = new Set<string>()
      
      const searchLimit = Math.min(productNames.length, 20)
      
      for (let i = 0; i < searchLimit; i++) {
        const productName = productNames[i]?.trim()
        if (!productName) continue
        
        try {
          const res = await fetch(
            `/api/fetchSuggestions?globalSearch=${encodeURIComponent(productName)}&limit=3&Currency=RWF`,
            { cache: "no-store" }
          )
          
          if (!res.ok) continue
          
          const data = await res.json()
          const products = data.products || []
          
          for (const p of products) {
            const productId = p.ITEM_CODE || p.item_code || p.id || `${productName}-${i}`
            
            if (seenIds.has(productId)) continue
            seenIds.add(productId)
            
            const price = parseFloat(p.SALE_PRICE_INCLUSIVE || p.item_emballage || p.price || "0")
            
            allProducts.push({
              id: productId,
              name: p.ITEM_NAME || p.item_commercial_name || p.name || productName,
              description: p.DESCRIPTION_KEYWORD || p.item_key_words || "",
              price: isNaN(price) ? 0 : price,
              unit: p.UNIT || p.item_packet || "",
              image: p.IMAGE_URL || p.image || undefined,
              supplierId: p.SELLER_ISHYIGA_ACCOUNT || p.item_seller_account || "",
              supplierName: p.SELLER_NAMES || p.supplier_name || "",
              supplierLocation: p.LOCATION || p.supplier_location || "",
              momo: p.momo || undefined,
              inStock: true,
            })
            
            break
          }
        } catch (error) {
          console.warn(`Error searching for product "${productName}":`, error)
        }
      }
      
      return allProducts
    } catch (error) {
      console.error("Error fetching product details:", error)
      return []
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-muted-foreground">Loading recommendations...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between mb-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </Link>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                setCurrentPages({}) // Reset pagination
                loadAllRecommendations()
              }}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          <h1 className="text-3xl font-bold">Discover</h1>
          <p className="text-muted-foreground mt-2">
            Personalized recommendations just for you
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Recommendations update based on your browsing activity. Refresh to see latest updates.
          </p>
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-2 p-2 bg-muted rounded text-xs font-mono">
              <div>User: {user?.email || "Anonymous"}</div>
              <div>Session: {getSessionId().substring(0, 50)}...</div>
            </div>
          )}
        </div>

        {/* Sections */}
        {sections.length === 0 ? (
          <div className="text-center py-12">
            <div className="max-w-md mx-auto">
              <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
              <h2 className="text-xl font-semibold mb-2">Start Your Shopping Journey</h2>
              <p className="text-muted-foreground mb-4">
                We'll personalize your recommendations based on what you browse and search for.
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                Visit the homepage to explore products, search for items, or browse categories.
              </p>
              <Link href="/">
                <Button>
                  Explore Products
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-12">
            {sections.map((section, idx) => {
              const paginatedProducts = getPaginatedProducts(idx, section.products)
              const totalPages = getTotalPages(section.products.length)
              const currentPage = currentPages[idx] || 1
              
              return (
                <section key={idx} id={`section-${idx}`}>
                  <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-primary">{section.icon}</div>
                      <div>
                        <h2 className="text-2xl font-bold">{section.title}</h2>
                        {section.subtitle && (
                          <p className="text-sm text-muted-foreground mt-1">{section.subtitle}</p>
                        )}
                      </div>
                    </div>
                    {totalPages > 1 && (
                      <div className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages} ({section.products.length} products)
                      </div>
                    )}
                  </div>

                  {paginatedProducts.length > 0 ? (
                    <>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                        {paginatedProducts.map((product) => (
                          <ProductCard key={product.id} product={product} />
                        ))}
                      </div>
                      
                      {/* Pagination Controls */}
                      {totalPages > 1 && (
                        <div className="mt-6 flex items-center justify-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => changePage(idx, Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                          >
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                          </Button>
                          
                          <div className="flex items-center gap-1">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                              // Show first page, last page, current page, and pages around current
                              const showPage = 
                                page === 1 || 
                                page === totalPages || 
                                (page >= currentPage - 1 && page <= currentPage + 1)
                              
                              if (!showPage) {
                                // Show ellipsis
                                if (page === currentPage - 2 || page === currentPage + 2) {
                                  return <span key={page} className="px-2">...</span>
                                }
                                return null
                              }
                              
                              return (
                                <Button
                                  key={page}
                                  variant={currentPage === page ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => changePage(idx, page)}
                                  className="min-w-[40px]"
                                >
                                  {page}
                                </Button>
                              )
                            })}
                          </div>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => changePage(idx, Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage === totalPages}
                          >
                            Next
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No products available in this section
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

