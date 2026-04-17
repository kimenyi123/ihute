// Simple test to verify the API response format
async function testShopAPI() {
  try {
    console.log('Testing shop API...')
    
    // Test with the correct endpoint we're using
    const url = `/api/sector-list-suppliers?sector=boutique&Currency=RWF&limit=500`
    console.log('Fetching:', url)
    
    const res = await fetch(url, { cache: "no-store" })
    console.log('Response status:', res.status)
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    
    const data = await res.json()
    console.log('Response type:', typeof data)
    console.log('Is array:', Array.isArray(data))
    console.log('Data length:', Array.isArray(data) ? data.length : 'N/A')
    console.log('Full data:', data)
    
    // Check if it's an object with suppliersByName
    if (!Array.isArray(data) && data.suppliersByName) {
      console.log('Found suppliersByName array:', data.suppliersByName)
      console.log('Sample supplier:', data.suppliersByName[0])
      console.log('All keys in sample supplier:', Object.keys(data.suppliersByName[0] || {}))
    }
    
  } catch (error) {
    console.error('Error:', error)
  }
}

// Test function - run in browser console
testShopAPI()

// Test pharmacy specifically
async function testPharmacyAPI() {
  try {
    console.log('Testing Pharmacy API...')
    
    // Test pharmacy endpoint
    const url = `/api/sector-list-suppliers?sector=pharmacy&Currency=RWF&limit=500`
    console.log('Fetching:', url)
    
    const res = await fetch(url, { cache: "no-store" })
    console.log('Response status:', res.status)
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    
    const data = await res.json()
    console.log('Pharmacy API response:', data)
    console.log('Is array:', Array.isArray(data))
    console.log('Length:', Array.isArray(data) ? data.length : 'N/A')
    
  } catch (error) {
    console.error('Pharmacy API Error:', error)
  }
}

// Test other categories for comparison
async function testAllCategories() {
  const categories = ['boutique', 'pharmacy', 'bar-resto', 'coffee-shop', 'supermarket']
  
  for (const category of categories) {
    try {
      const url = `/api/sector-list-suppliers?sector=${category}&Currency=RWF&limit=500`
      const res = await fetch(url, { cache: "no-store" })
      
      if (res.ok) {
        const data = await res.json()
        console.log(`${category}: ${Array.isArray(data) ? data.length : 'N/A'} suppliers`)
      } else {
        console.log(`${category}: HTTP ${res.status}`)
      }
    } catch (error) {
      console.log(`${category}: Error - ${error.message}`)
    }
  }
}

// Run these tests in browser console
// testPharmacyAPI()
// testAllCategories()
