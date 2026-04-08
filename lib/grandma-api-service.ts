// API service for grandma page to interact with fetchSuggestions backend

export interface Supplier {
  ISHYIGA_ACCOUNT: string
  OWNER: string
  NICKNAME?: string
  loc_cell?: string
  loc_district?: string
  loc_province?: string
  PREFERRED_CATEGORIES?: string
  DEPARTMENT?: string
  distance?: number
  rating?: number
  reviewCount?: number
}

export interface Product {
  item_commercial_name?: string
  item_name?: string
  selling_price?: number | string
  price?: number | string
  image_url?: string
  item_image_url?: string
  image?: string
  IMAGE_URL?: string
  item_image?: string
  photo_url?: string
  famille?: string
  FAMILLE?: string
  item_department?: string
  ITEM_CODE?: string
  item_code?: string
  item_key_words?: string
  item_state?: string
  item_packet?: string
  stock?: number | string
  in_stock?: boolean
  category?: string
  source?: string
}

export interface FetchSuggestionsResponse {
  ok: boolean
  suppliersByName?: Supplier[]
  suppliersByProduct?: Supplier[]
  products?: Product[]
  query?: string
  warning?: string
}

import type { Category } from '@/app/grandma/page'

export interface ShopEntry {
  id: string
  name: string
  category: Category
  tagline: string
  favorite: boolean
  orderedBefore: boolean
  trending: boolean
  onSale: boolean
  distanceKm: number
  momo: string
  rating?: number
  reviewCount?: number
  logoSrc: string
  bankName?: string
  payoutAccount?: string
}

class GrandmaApiService {
  private baseUrl = '/api/fetchSuggestions'

  /**
   * Fetch suppliers by sector/category
   * Uses listSuppliersBySector parameter from fetchSuggestions
   */
  async getSuppliersBySector(sector: string, location?: string): Promise<Supplier[]> {
    const params = new URLSearchParams({
      listSuppliersBySector: sector,
    })
    
    if (location) {
      params.append('location', location)
    }

    try {
      const url = `${this.baseUrl}?${params.toString()}`
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      
      // Handle both response formats:
      // 1. listSuppliersBySector returns direct array
      // 2. Other endpoints return object with suppliersByName field
      if (Array.isArray(data)) {
        return data
      } else {
        return data.suppliersByName || []
      }
    } catch (error) {
      console.error('Error fetching suppliers by sector:', error)
      return []
    }
  }

  /**
   * Fetch suppliers with their products for a specific sector
   * Uses listSuppliersWithProducts parameter from fetchSuggestions
   */
  async getSuppliersWithProducts(
    sector: string, 
    sellerLimit: number = 5,
    productsPerSeller: number = 6,
    currency: string = 'RWF'
  ): Promise<Supplier[]> {
    const params = new URLSearchParams({
      listSuppliersWithProducts: sector,
      sellerLimit: sellerLimit.toString(),
      productsPerSeller: productsPerSeller.toString(),
      Currency: currency,
    })

    try {
      const response = await fetch(`${this.baseUrl}?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      return data.suppliersByName || []
    } catch (error) {
      console.error('Error fetching suppliers with products:', error)
      return []
    }
  }

  /**
   * Get products for a specific supplier
   * Uses supplierProducts parameter from fetchSuggestions
   */
  async getSupplierProducts(
    supplierAccount: string,
    limit: number = 20,
    currency: string = 'RWF'
  ): Promise<Product[]> {
    const params = new URLSearchParams({
      supplierProducts: supplierAccount,
      limit: limit.toString(),
      Currency: currency,
    })

    try {
      const response = await fetch(`${this.baseUrl}?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      return data.products || []
    } catch (error) {
      console.error('Error fetching supplier products:', error)
      return []
    }
  }

  /**
   * Global search with optional category filter
   * Uses globalSearch parameter from fetchSuggestions
   */
  async globalSearch(
    query: string,
    category?: string,
    location?: string,
    currency: string = 'RWF'
  ): Promise<FetchSuggestionsResponse> {
    const params = new URLSearchParams({
      globalSearch: query,
      Currency: currency,
    })

    if (category) {
      params.append('category', category)
    }

    if (location) {
      params.append('location', location)
    }

    try {
      const response = await fetch(`${this.baseUrl}?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error performing global search:', error)
      return {
        ok: false,
        suppliersByName: [],
        suppliersByProduct: [],
        products: [],
        query,
        warning: 'Search service temporarily unavailable'
      }
    }
  }

  /**
   * Suggest suppliers by name with optional category filter
   * Uses suggestSupplier parameter from fetchSuggestions
   */
  async suggestSuppliers(
    query: string,
    category?: string,
    location?: string
  ): Promise<Supplier[]> {
    const params = new URLSearchParams({
      suggestSupplier: query,
    })

    if (category) {
      params.append('category', category)
    }

    if (location) {
      params.append('location', location)
    }

    try {
      const response = await fetch(`${this.baseUrl}?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      return data.suppliersByName || []
    } catch (error) {
      console.error('Error suggesting suppliers:', error)
      return []
    }
  }

  /**
   * Transform backend supplier data to frontend ShopEntry format
   */
  transformSupplierToShopEntry(supplier: Supplier, category: Category): ShopEntry {
    return {
      id: supplier.ISHYIGA_ACCOUNT,
      name: supplier.OWNER || supplier.NICKNAME || supplier.ISHYIGA_ACCOUNT,
      category,
      tagline: supplier.DEPARTMENT || 'Local shop',
      favorite: false, // Will be determined by user preferences
      orderedBefore: false, // Will be determined by order history
      trending: false, // Could be determined by order volume
      onSale: false, // Could be determined by promotions
      distanceKm: supplier.distance || 0,
      momo: `MTN MoMo: ${supplier.ISHYIGA_ACCOUNT}`,
      rating: supplier.rating,
      reviewCount: supplier.reviewCount,
      logoSrc: '/img/shops/default.png', // Will need to implement logo mapping
      bankName: 'Bank of Kigali', // Default
      payoutAccount: supplier.ISHYIGA_ACCOUNT,
    }
  }

  /**
   * Transform backend product data to frontend Product format
   */
  transformProductToProduct(product: Product, category: string, id: number) {
    const name = String(product.item_commercial_name || product.item_name || 'Product').trim()
    const price = typeof product.selling_price === 'number' ? product.selling_price : 
                  typeof product.price === 'number' ? product.price :
                  parseFloat(String(product.selling_price || product.price || '0')) || 0

    return {
      id,
      category: category as Category,
      name,
      price,
      emoji: this.getEmojiForProduct(name, category),
      imageUrl: product.image_url || product.item_image_url || product.IMAGE_URL || product.photo_url,
      qty: 0,
      liveKey: product.ITEM_CODE || product.item_code || `product_${id}`,
      liveInStock: product.in_stock === true,
      liveCategory: product.famille || product.FAMILLE || category,
    }
  }

  /**
   * Get appropriate emoji for product based on category and name
   */
  private getEmojiForProduct(name: string, category: string): string {
    const n = name.toLowerCase()
    
    if (category.toLowerCase().includes('pharmacy') || category.toLowerCase().includes('farumasi')) {
      if (/syrup|sachet|oral/.test(n)) return "🧴"
      if (/cream|ointment|gel/.test(n)) return "🧪"
      if (/inject|ampoule|vial/.test(n)) return "💉"
      if (/tablet|capsule|comp\.|mg|ml/.test(n)) return "💊"
      return "💊"
    }
    
    if (category.toLowerCase().includes('restaurant') || category.toLowerCase().includes('resitora')) {
      if (/salad/.test(n)) return "🥗"
      if (/pizza/.test(n)) return "🍕"
      if (/rice/.test(n)) return "🍛"
      if (/burger/.test(n)) return "🍔"
      if (/avocado/.test(n)) return "🥑"
      if (/macaroni|pasta/.test(n)) return "🍝"
      if (/coffee/.test(n)) return "☕"
      return "🍽️"
    }

    // Default emojis for other categories
    if (/milk|dairy/.test(n)) return "🥛"
    if (/bread|bakery/.test(n)) return "🍞"
    if (/beer|alcohol/.test(n)) return "🍺"
    if (/water|juice|drink/.test(n)) return "🥤"
    if (/rice/.test(n)) return "🍚"
    if (/oil/.test(n)) return "🫗"
    if (/soap/.test(n)) return "🧼"
    if (/sugar|salt/.test(n)) return "🧂"
    
    return "📦"
  }
}

export const grandmaApiService = new GrandmaApiService()
