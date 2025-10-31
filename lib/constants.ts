// lib/constants.ts

export const RWANDA_DISTRICTS = [
  // Eastern Province
  "Bugesera", "Gatsibo", "Kayonza", "Kirehe", "Ngoma", "Nyagatare", "Rwamagana",
  // Kigali City
  "Gasabo", "Kicukiro", "Nyarugenge",
  // Northern Province
  "Burera", "Gakenke", "Gicumbi", "Musanze", "Rulindo",
  // Southern Province
  "Gisagara", "Huye", "Kamonyi", "Muhanga", "Nyamagabe", "Nyanza", "Nyaruguru", "Ruhango",
  // Western Province
  "Karongi", "Ngororero", "Nyabihu", "Nyamasheke", "Rubavu", "Rusizi", "Rutsiro",
] as const

// Bar/Restaurant keywords for detecting table command eligible locations
export const BAR_RESTAURANT_KEYWORDS = [
  "bar", "pub", "restaurant", "resto", "cafe", "coffee", "lounge",
  "grill", "bistro", "eatery", "diner", "brewery", "tavern", "club",
  "kitchen", "burrows", "pangolin", "algorithm", "terrace", "rooftop"
] as const

/**
 * Check if a location name suggests it's a bar or restaurant
 * that supports table command ordering
 */
export function isBarOrRestaurant(locationName: string): boolean {
  if (!locationName) return false
  const lower = locationName.toLowerCase()
  return BAR_RESTAURANT_KEYWORDS.some(keyword => lower.includes(keyword))
}
