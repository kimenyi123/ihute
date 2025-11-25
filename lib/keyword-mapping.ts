// lib/keyword-mapping.ts
/**
 * Multilingual Keyword Mapping
 * Maps Kinyarwanda terms to English equivalents for better search results
 */

export type KeywordMapping = {
  kinyarwanda: string[]
  english: string[]
  french?: string[]
}

/**
 * Comprehensive keyword mappings for common products
 * Add more mappings as needed
 */
export const KEYWORD_MAPPINGS: KeywordMapping[] = [
  // Beverages
  {
    kinyarwanda: ["amazi", "amazi meza", "amazi yera"],
    english: ["water", "drinking water", "mineral water", "bottled water"],
    french: ["eau", "eau minérale"]
  },
  {
    kinyarwanda: ["ikawa"],
    english: ["coffee"],
    french: ["café"]
  },
  {
    kinyarwanda: ["icyayi"],
    english: ["tea"],
    french: ["thé"]
  },
  {
    kinyarwanda: ["inzoga"],
    english: ["beer", "alcohol", "liquor"],
    french: ["bière", "alcool"]
  },
  {
    kinyarwanda: ["divayi"],
    english: ["wine"],
    french: ["vin"]
  },

  // Food items
  {
    kinyarwanda: ["ubuki"],
    english: ["honey"],
    french: ["miel"]
  },
  {
    kinyarwanda: ["umunyu"],
    english: ["salt"],
    french: ["sel"]
  },
  {
    kinyarwanda: ["isukari", "sukari"],
    english: ["sugar"],
    french: ["sucre"]
  },
  {
    kinyarwanda: ["ifu"],
    english: ["flour"],
    french: ["farine"]
  },
  {
    kinyarwanda: ["amata"],
    english: ["milk"],
    french: ["lait"]
  },
  {
    kinyarwanda: ["amavuta"],
    english: ["oil", "cooking oil"],
    french: ["huile"]
  },
  {
    kinyarwanda: ["umuceri"],
    english: ["rice"],
    french: ["riz"]
  },
  {
    kinyarwanda: ["ibirayi"],
    english: ["potato", "potatoes", "irish potato"],
    french: ["pomme de terre"]
  },
  {
    kinyarwanda: ["ibishyimbo"],
    english: ["beans"],
    french: ["haricots"]
  },
  {
    kinyarwanda: ["igikoma"],
    english: ["maize", "corn", "maize flour"],
    french: ["maïs"]
  },
  {
    kinyarwanda: ["umugati"],
    english: ["bread"],
    french: ["pain"]
  },
  {
    kinyarwanda: ["inyama"],
    english: ["meat", "beef"],
    french: ["viande"]
  },
  {
    kinyarwanda: ["ifi"],
    english: ["fish"],
    french: ["poisson"]
  },
  {
    kinyarwanda: ["inkoko"],
    english: ["chicken"],
    french: ["poulet"]
  },
  {
    kinyarwanda: ["amagi"],
    english: ["eggs", "egg"],
    french: ["oeufs", "oeuf"]
  },

  // Household items
  {
    kinyarwanda: ["isabune"],
    english: ["soap"],
    french: ["savon"]
  },
  {
    kinyarwanda: ["umwanda"],
    english: ["detergent", "washing powder"],
    french: ["détergent", "lessive"]
  },
  {
    kinyarwanda: ["icyuma"],
    english: ["metal", "iron"],
    french: ["métal", "fer"]
  },
  {
    kinyarwanda: ["umwenda"],
    english: ["cloth", "fabric", "textile"],
    french: ["tissu", "textile"]
  },

  // Personal care
  {
    kinyarwanda: ["amazamaki"],
    english: ["toothpaste"],
    french: ["dentifrice"]
  },
  {
    kinyarwanda: ["umusatsi"],
    english: ["hair", "shampoo"],
    french: ["cheveux", "shampooing"]
  },
  {
    kinyarwanda: ["ibicuruzwa byo kwisiga"],
    english: ["cosmetics", "beauty products"],
    french: ["cosmétiques", "produits de beauté"]
  },

  // Medicine/Health
  {
    kinyarwanda: ["imiti"],
    english: ["medicine", "medication", "drug", "drugs"],
    french: ["médicament", "médicaments"]
  },
  {
    kinyarwanda: ["umubiri"],
    english: ["body", "health"],
    french: ["corps", "santé"]
  },

  // Fruits & Vegetables
  {
    kinyarwanda: ["imbuto"],
    english: ["fruit", "fruits", "seeds"],
    french: ["fruit", "fruits", "graines"]
  },
  {
    kinyarwanda: ["imboga"],
    english: ["vegetables", "greens"],
    french: ["légumes"]
  },
  {
    kinyarwanda: ["umunyu"],
    english: ["tomato", "tomatoes"],
    french: ["tomate", "tomates"]
  },
  {
    kinyarwanda: ["igitunguru"],
    english: ["onion", "onions"],
    french: ["oignon", "oignons"]
  },
  {
    kinyarwanda: ["indimu"],
    english: ["lemon", "lime"],
    french: ["citron"]
  },
  {
    kinyarwanda: ["ipapayi"],
    english: ["papaya"],
    french: ["papaye"]
  },
  {
    kinyarwanda: ["inananasi"],
    english: ["pineapple"],
    french: ["ananas"]
  },

  // School/Office supplies
  {
    kinyarwanda: ["igitabo"],
    english: ["book", "notebook"],
    french: ["livre", "cahier"]
  },
  {
    kinyarwanda: ["ikaramu"],
    english: ["pen", "pencil"],
    french: ["stylo", "crayon"]
  },
  {
    kinyarwanda: ["impapuro"],
    english: ["paper"],
    french: ["papier"]
  },
]

/**
 * Create a reverse lookup map for faster searches
 * Maps any keyword (kinyarwanda/english/french) to all related terms
 */
export function createKeywordLookupMap(): Map<string, string[]> {
  const lookupMap = new Map<string, string[]>()

  KEYWORD_MAPPINGS.forEach(mapping => {
    // Combine all terms from this mapping
    const allTerms = [
      ...mapping.kinyarwanda,
      ...mapping.english,
      ...(mapping.french || [])
    ]

    // For each term, map it to all related terms
    allTerms.forEach(term => {
      const normalizedTerm = term.toLowerCase().trim()
      if (!lookupMap.has(normalizedTerm)) {
        lookupMap.set(normalizedTerm, [])
      }

      // Add all related terms (excluding itself)
      const relatedTerms = allTerms.filter(t =>
        t.toLowerCase().trim() !== normalizedTerm
      )

      const existing = lookupMap.get(normalizedTerm) || []
      lookupMap.set(normalizedTerm, [...new Set([...existing, ...relatedTerms])])
    })
  })

  return lookupMap
}

/**
 * Global lookup map instance (created once)
 */
const KEYWORD_LOOKUP = createKeywordLookupMap()

/**
 * Expand a search query to include multilingual equivalents
 * Example: "amazi" -> ["amazi", "water", "drinking water", "mineral water", "eau"]
 */
export function expandSearchQuery(query: string): string[] {
  const normalizedQuery = query.toLowerCase().trim()
  const expandedTerms = [normalizedQuery]

  // Get all related terms from the lookup map
  const relatedTerms = KEYWORD_LOOKUP.get(normalizedQuery) || []
  expandedTerms.push(...relatedTerms)

  // Also check for partial matches in multi-word queries
  const queryWords = normalizedQuery.split(/\s+/)
  queryWords.forEach(word => {
    if (word.length >= 3) { // Only expand words with 3+ characters
      const wordRelated = KEYWORD_LOOKUP.get(word) || []
      expandedTerms.push(...wordRelated)
    }
  })

  // Return unique terms
  return [...new Set(expandedTerms)]
}

/**
 * Get translation suggestions for a query
 * Returns object with translations if found
 */
export function getTranslations(query: string): {
  original: string
  kinyarwanda: string[]
  english: string[]
  french: string[]
} | null {
  const normalizedQuery = query.toLowerCase().trim()

  // Find matching mapping
  const mapping = KEYWORD_MAPPINGS.find(m =>
    m.kinyarwanda.some(k => k.toLowerCase() === normalizedQuery) ||
    m.english.some(e => e.toLowerCase() === normalizedQuery) ||
    m.french?.some(f => f.toLowerCase() === normalizedQuery)
  )

  if (!mapping) return null

  return {
    original: query,
    kinyarwanda: mapping.kinyarwanda,
    english: mapping.english,
    french: mapping.french || []
  }
}

/**
 * Check if a text contains any of the search terms or their translations
 */
export function matchesWithTranslation(text: string, searchQuery: string): boolean {
  const expandedTerms = expandSearchQuery(searchQuery)
  const normalizedText = text.toLowerCase()

  return expandedTerms.some(term =>
    normalizedText.includes(term.toLowerCase())
  )
}
