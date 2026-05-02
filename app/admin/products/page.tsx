"use client"

import { useState, useEffect } from 'react'
import { CheckCircle, XCircle } from 'lucide-react'
import { postAdminApi } from '@/lib/admin-client'

interface Product {
  id: number
  itemCode: string
  itemName: string
  sellerAccount: string
  sellerName: string
  quantity: number
  price: number
  sector: string
}

export default function ProductsPage() {
  const [pendingProducts, setPendingProducts] = useState<Product[]>([])
  const [flaggedProducts, setFlaggedProducts] = useState<Product[]>([])
  const [bannedProducts, setBannedProducts] = useState<Product[]>([])
  const [activeTab, setActiveTab] = useState<'pending' | 'flagged' | 'banned'>('pending')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProducts()
  }, [activeTab])

  const loadProducts = async () => {
    try {
      setLoading(true)
      
      if (activeTab === 'pending') {
        const res = await postAdminApi({ action: 'getPendingProducts' })
        const data = await res.json()
        if (data.ok) {
          setPendingProducts(data.products || [])
        }
      } else if (activeTab === 'flagged') {
        const res = await postAdminApi({ action: 'getFlaggedProducts' })
        const data = await res.json()
        if (data.ok) {
          setFlaggedProducts(data.products || [])
        }
      } else {
        const res = await postAdminApi({ action: 'getBannedProducts' })
        const data = await res.json()
        if (data.ok) {
          setBannedProducts(data.products || [])
        }
      }
    } catch (error) {
      console.error('Error loading products:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (itemCode: string, sellerAccount: string) => {
    try {
      const res = await postAdminApi({ action: 'approveProduct', itemCode, sellerAccount })
      const data = await res.json()
      if (data.ok) {
        loadProducts()
      }
    } catch (error) {
      console.error('Error approving product:', error)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-RW', {
      style: 'currency',
      currency: 'RWF',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const currentProducts = activeTab === 'pending' ? pendingProducts : 
                         activeTab === 'flagged' ? flaggedProducts : bannedProducts

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Product Moderation</h1>
        <p className="text-gray-600 mt-1">Review and manage products on the platform</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-6 py-4 text-sm font-medium border-b-2 ${
                activeTab === 'pending'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Pending Approval ({pendingProducts.length})
            </button>
            <button
              onClick={() => setActiveTab('flagged')}
              className={`px-6 py-4 text-sm font-medium border-b-2 ${
                activeTab === 'flagged'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Flagged Items ({flaggedProducts.length})
            </button>
            <button
              onClick={() => setActiveTab('banned')}
              className={`px-6 py-4 text-sm font-medium border-b-2 ${
                activeTab === 'banned'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Banned Items ({bannedProducts.length})
            </button>
          </nav>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading products...</div>
          ) : currentProducts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No products found</div>
          ) : (
            <div className="space-y-4">
              {currentProducts.map((product) => (
                <div key={product.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">{product.itemName}</h3>
                      <div className="mt-2 space-y-1 text-sm text-gray-600">
                        <p>Code: {product.itemCode}</p>
                        <p>Seller: {product.sellerName} ({product.sellerAccount})</p>
                        <p>Sector: {product.sector}</p>
                        <p>Price: {formatCurrency(product.price)} | Qty: {product.quantity}</p>
                      </div>
                    </div>
                    {activeTab === 'pending' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApprove(product.itemCode, product.sellerAccount)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                        >
                          <CheckCircle size={16} />
                          Approve
                        </button>
                        <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2">
                          <XCircle size={16} />
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


