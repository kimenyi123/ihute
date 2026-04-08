"use client"

import { useState, useEffect } from 'react'
import { Image as ImageIcon, Star, Zap, FolderTree } from 'lucide-react'

export default function ContentPage() {
  const [banners, setBanners] = useState<any[]>([])
  const [featuredSellers, setFeaturedSellers] = useState<any[]>([])
  const [flashSales, setFlashSales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadContent()
  }, [])

  const loadContent = async () => {
    try {
      setLoading(true)
      
      // Load banners
      const bannersRes = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getHomepageBanners' })
      })
      const bannersData = await bannersRes.json()
      if (bannersData.ok) {
        setBanners(bannersData.banners || [])
      }

      // Load featured sellers
      const sellersRes = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getFeaturedSellers' })
      })
      const sellersData = await sellersRes.json()
      if (sellersData.ok) {
        setFeaturedSellers(sellersData.sellers || [])
      }

      // Load flash sales
      const salesRes = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getFlashSales' })
      })
      const salesData = await salesRes.json()
      if (salesData.ok) {
        setFlashSales(salesData.sales || [])
      }
    } catch (error) {
      console.error('Error loading content:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Content Manager</h1>
        <p className="text-gray-600 mt-1">Manage homepage content and featured items</p>
      </div>

      {/* Homepage Banners */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-3 mb-4">
          <ImageIcon className="text-blue-600" size={24} aria-hidden />
          <h2 className="text-xl font-semibold text-gray-900">Homepage Banners</h2>
        </div>
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading banners...</div>
        ) : banners.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No banners configured</p>
            <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Add Banner
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {banners.map((banner) => (
              <div key={banner.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{banner.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{banner.link}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    banner.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {banner.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Featured Sellers */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-3 mb-4">
          <Star className="text-yellow-600" size={24} />
          <h2 className="text-xl font-semibold text-gray-900">Featured Sellers</h2>
        </div>
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading featured sellers...</div>
        ) : featuredSellers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No featured sellers</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {featuredSellers.map((seller) => (
              <div key={seller.account} className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900">{seller.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{seller.email}</p>
                <div className="mt-2 flex items-center gap-4 text-sm">
                  <span>{seller.orderCount} orders</span>
                  <span className="text-green-600 font-medium">
                    {new Intl.NumberFormat('en-RW', { style: 'currency', currency: 'RWF', minimumFractionDigits: 0 }).format(seller.totalSales)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Flash Sales */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-3 mb-4">
          <Zap className="text-orange-600" size={24} />
          <h2 className="text-xl font-semibold text-gray-900">Flash Sales</h2>
        </div>
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading flash sales...</div>
        ) : flashSales.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No flash sales configured</p>
            <button className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700">
              Create Flash Sale
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {flashSales.map((sale) => (
              <div key={sale.id} className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900">{sale.name}</h3>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sector Ordering */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-3 mb-4">
          <FolderTree className="text-purple-600" size={24} />
          <h2 className="text-xl font-semibold text-gray-900">Homepage Sector Ordering</h2>
        </div>
        <p className="text-gray-600">Manage the display order of sectors on the homepage</p>
        <button className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
          Manage Ordering
        </button>
      </div>
    </div>
  )
}


