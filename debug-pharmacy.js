// Run this directly in browser console to debug pharmacy issue

async function debugPharmacy() {
  console.log('=== DEBUGGING PHARMACY API ===')
  
  // Test different endpoints for pharmacy
  const endpoints = [
    '/api/fetchSuggestions?listSuppliersBySector=pharmacy',
    '/api/fetchSuggestions?listSuppliersWithProducts=pharmacy&Currency=RWF&limit=500',
    '/api/fetchSuggestions?listSuppliersBySector=pharmacy&cache=no'
  ]
  
  for (const endpoint of endpoints) {
    try {
      console.log(`\nTesting: ${endpoint}`)
      const res = await fetch(endpoint, { cache: "no-store" })
      console.log(`Status: ${res.status}`)
      
      if (res.ok) {
        const data = await res.json()
        console.log('Response type:', typeof data)
        console.log('Is array:', Array.isArray(data))
        console.log('Length:', Array.isArray(data) ? data.length : 'N/A')
        console.log('Keys:', typeof data === 'object' ? Object.keys(data) : 'N/A')
        console.log('Full response:', data)
      } else {
        console.log('Error response:', await res.text())
      }
    } catch (error) {
      console.log('Fetch error:', error)
    }
  }
  
  // Test all categories for comparison
  console.log('\n=== ALL CATEGORIES COMPARISON ===')
  const categories = ['boutique', 'pharmacy', 'bar-resto', 'coffee-shop', 'supermarket']
  
  for (const cat of categories) {
    try {
      const url = `/api/fetchSuggestions?listSuppliersBySector=${cat}`
      const res = await fetch(url, { cache: "no-store" })
      
      if (res.ok) {
        const data = await res.json()
        const count = Array.isArray(data) ? data.length : (data.suppliersByName ? data.suppliersByName.length : 0)
        console.log(`${cat}: ${count} suppliers`)
      } else {
        console.log(`${cat}: HTTP ${res.status}`)
      }
    } catch (error) {
      console.log(`${cat}: Error - ${error.message}`)
    }
  }
}

// Run the debug function
debugPharmacy()
