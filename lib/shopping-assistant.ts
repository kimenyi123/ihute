/**
 * Shopping Assistant - AI-powered product search helper
 * 
 * STRICT RULES:
 * - NEVER invent products, prices, suppliers, or policies
 * - NEVER answer questions that cannot be resolved using provided data
 * - NEVER give general advice unrelated to shopping on this site
 * - If information is missing, ask ONE short clarification question
 * - If still unclear, redirect the user to standard search
 */

export type AssistantIntent = "search" | "clarify" | "redirect" | "faq"

export interface AssistantEntities {
  product: string
  category: string
  attributes: Record<string, string>
  location: string
}

export interface AssistantResponse {
  intent: AssistantIntent
  entities: AssistantEntities
  message: string
  action: "call_api" | "ask_question" | "show_results" | "fallback"
  searchQuery?: string
  filters?: {
    location?: string
    priceRange?: { min?: number; max?: number }
    category?: string
  }
}

/**
 * Parse user message and determine intent
 */
export function parseUserIntent(message: string): AssistantResponse {
  const lowerMessage = message.toLowerCase().trim()
  const originalMessage = message.trim()

  // Empty message
  if (!originalMessage) {
    return {
      intent: "redirect",
      entities: { product: "", category: "", attributes: {}, location: "" },
      message: "I can help you find products, categories, or suppliers. What are you looking for?",
      action: "fallback"
    }
  }

  // Out of scope - general advice, non-shopping questions
  if (
    lowerMessage.includes("how to build") ||
    lowerMessage.includes("how to make") ||
    lowerMessage.includes("tutorial") ||
    lowerMessage.includes("guide") ||
    lowerMessage.includes("advice") ||
    (lowerMessage.includes("best") && !lowerMessage.includes("product") && !lowerMessage.includes("supplier") && !lowerMessage.includes("shop"))
  ) {
    return {
      intent: "redirect",
      entities: { product: "", category: "", attributes: {}, location: "" },
      message: "I can help you find building materials and products. What are you looking for?",
      action: "fallback"
    }
  }

  // Handle "near me" queries
  if (lowerMessage.includes("near me")) {
    // Extract product/supplier name before "near me"
    const beforeNearMe = lowerMessage.replace(/\s*near\s+me.*$/i, "").trim()
    const cleanedQuery = beforeNearMe
      .replace(/^(find|search|show|get|i need|i want|looking for)\s+/i, "")
      .trim()
    
    // Handle "Find Supplier near me" or "Find supplier near me"
    if (cleanedQuery.toLowerCase().includes("supplier") || cleanedQuery.toLowerCase().includes("shop") || cleanedQuery.toLowerCase().includes("store")) {
      return {
        intent: "search",
        entities: { product: "", category: "", attributes: {}, location: "" },
        message: "Searching for suppliers near you...",
        action: "call_api",
        searchQuery: "supplier",
        filters: {
          // Location will be handled by the API using user's GPS if available
        }
      }
    }
    
    if (cleanedQuery && cleanedQuery.length > 0) {
      return {
        intent: "search",
        entities: { product: cleanedQuery, category: "", attributes: {}, location: "" },
        message: `Searching for ${cleanedQuery} near you...`,
        action: "call_api",
        searchQuery: cleanedQuery,
        filters: {
          // Location will be handled by the API using user's GPS if available
        }
      }
    }
  }

  // Handle "nearest shop" or "nearest supplier" - search for suppliers
  if (lowerMessage.includes("nearest") && (lowerMessage.includes("shop") || lowerMessage.includes("supplier") || lowerMessage.includes("store"))) {
    return {
      intent: "search",
      entities: { product: "", category: "", attributes: {}, location: "" },
      message: "Searching for nearest shops...",
      action: "call_api",
      searchQuery: "shop",
      filters: {}
    }
  }

  // Extract location
  const locationMatch = lowerMessage.match(/(?:in|at|near|from)\s+([a-z\s]+?)(?:\s|$)/i)
  const location = locationMatch ? locationMatch[1].trim() : ""

  // Extract category/sector
  const categoryMatch = lowerMessage.match(/(?:category|sector|type|kind)\s+(?:of|is)?\s*([a-z\s-]+)/i)
  const category = categoryMatch ? categoryMatch[1].trim() : ""

  // Extract attributes (strength, size, etc.)
  const attributes: Record<string, string> = {}
  
  // Cement strength
  const strengthMatch = lowerMessage.match(/(?:strength|grade)\s*([\d.]+)/i) || lowerMessage.match(/([\d.]+)\s*(?:strength|grade)/i)
  if (strengthMatch) {
    attributes.strength = strengthMatch[1]
  }

  // Size/dimensions
  const sizeMatch = lowerMessage.match(/(?:size|dimension)\s+([a-z0-9\sx]+)/i)
  if (sizeMatch) {
    attributes.size = sizeMatch[1].trim()
  }

  // Price range
  const priceMatch = lowerMessage.match(/(?:price|cost|under|below|less than|max|maximum)\s*([\d,]+)/i)
  if (priceMatch) {
    attributes.maxPrice = priceMatch[1].replace(/,/g, "")
  }

  // Extract product name - try patterns first
  const productPatterns = [
    /(?:need|want|looking for|search|find|buy|get|show|give me)\s+(?:a|an|the)?\s*([a-z\s]+?)(?:\s+(?:in|at|from|near|for|with|that|which))?/i,
    /([a-z\s]+?)\s+(?:cement|brick|steel|paint|tile|door|window|roof|floor)/i,
  ]

  let product = ""
  for (const pattern of productPatterns) {
    const match = lowerMessage.match(pattern)
    if (match && match[1]) {
      product = match[1].trim()
      break
    }
  }

  // If no product found from patterns, use the entire message as search query (unless it's clearly not a product)
  if (!product) {
    // Remove common question words and use the rest as search query
    const cleaned = originalMessage
      .replace(/^(i|need|want|looking for|search|find|buy|get|show|give me|where|what|who|when|how)\s+/i, "")
      .replace(/\s+(in|at|near|from|for|with|that|which|please|can you|could you)\s*$/i, "")
      .trim()
    
    // If cleaned message is not empty and not a question, use it as search query
    if (cleaned && cleaned.length > 0 && !cleaned.endsWith("?")) {
      product = cleaned
    } else if (cleaned && cleaned.length > 0) {
      product = cleaned.replace(/\?$/, "").trim()
    }
  }

  // If still no product, use original message (treat everything as search query)
  if (!product || product.length < 2) {
    product = originalMessage
  }

  // If we have a product but missing critical attribute, ask for clarification
  if (product && product.toLowerCase().includes("cement") && !attributes.strength && !lowerMessage.includes("any") && !lowerMessage.includes("all")) {
    return {
      intent: "clarify",
      entities: { product, category, attributes, location },
      message: "Which strength? 32.5 or 42.5?",
      action: "ask_question"
    }
  }

  // FAQ patterns
  if (lowerMessage.includes("delivery") || lowerMessage.includes("shipping")) {
    return {
      intent: "faq",
      entities: { product: "", category: "", attributes: {}, location: "" },
      message: "I can help you find products. For delivery information, please contact support.",
      action: "fallback"
    }
  }

  // Default: treat as search query (ANY non-empty message is a search)
  return {
    intent: "search",
    entities: { product, category, attributes, location },
    message: `Searching for ${product}${location ? ` in ${location}` : ""}...`,
    action: "call_api",
    searchQuery: product,
    filters: {
      location: location || undefined,
      category: category || undefined,
    }
  }
}

/**
 * Call search API
 */
export async function callSearchAPI(
  query: string,
  filters?: {
    location?: string
    priceRange?: { min?: number; max?: number }
    category?: string
  }
): Promise<{
  products: any[]
  categories: any[]
  suppliers: any[]
}> {
  try {
    // Get location from enhanced location store
    let userDistrict: string | undefined
    let userCell: string | undefined
    
    if (typeof window !== "undefined") {
      try {
        const { useLocationStoreEnhanced } = await import("@/lib/location-store-enhanced")
        const locationData = useLocationStoreEnhanced.getState().location
        userDistrict = locationData?.district
        userCell = locationData?.cell
      } catch (e) {
        // Location store not available, continue without location
      }
    }

    const params = new URLSearchParams({
      globalSearch: query,
      limit: "10",
      Currency: "RWF",
    })

    if (filters?.location) {
      params.set("location", filters.location)
    }
    if (filters?.category) {
      params.set("sector", filters.category)
    }
    // Add location-aware parameters (district and cell)
    if (userDistrict) {
      params.set("district", userDistrict)
    }
    if (userCell) {
      params.set("cell", userCell)
    }

    const res = await fetch(`/api/fetchSuggestions?${params}`, {
      cache: "no-store",
      headers: { Accept: "application/json" }
    })

    if (!res.ok) {
      throw new Error(`Search failed: ${res.status}`)
    }

    const json = await res.json()

    return {
      products: json.products || [],
      categories: [], // Backend doesn't return categories separately
      suppliers: [
        ...(json.suppliersByName || []),
        ...(json.suppliersByProduct || [])
      ]
    }
  } catch (error) {
    console.error("[ShoppingAssistant] Search API error:", error)
    return { products: [], categories: [], suppliers: [] }
  }
}

/**
 * Format search results into user-friendly message
 */
export function formatSearchResults(
  results: { products: any[]; categories: any[]; suppliers: any[] },
  query: string
): string {
  const { products, suppliers } = results
  const totalResults = products.length + suppliers.length

  if (totalResults === 0) {
    return "I couldn't find matching items. Want me to try a different search?"
  }

  let message = `Found ${totalResults} result${totalResults > 1 ? "s" : ""} for "${query}":\n\n`

  // Show top 3-5 products
  const topProducts = products.slice(0, 5)
  if (topProducts.length > 0) {
    message += "📦 Products:\n"
    topProducts.forEach((p, i) => {
      const name = p.item_commercial_name || p.ITEM_NAME || "Product"
      const supplier = p.supplier_name || p.item_seller_name || "Supplier"
      message += `${i + 1}. ${name} - ${supplier}\n`
    })
    message += "\n"
  }

  // Show top suppliers if no products
  if (topProducts.length === 0 && suppliers.length > 0) {
    const topSuppliers = suppliers.slice(0, 3)
    message += "🏭 Suppliers:\n"
    topSuppliers.forEach((s, i) => {
      const name = s.supplier_name || s.seller_name || "Supplier"
      message += `${i + 1}. ${name}\n`
    })
    message += "\n"
  }

  message += "Click on any result to view details."

  return message
}

