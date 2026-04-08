"use client"

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Edit, Save, X, XCircle } from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'
import { REJECTION_REASONS } from '@/lib/rejection-reasons'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface SellerProfile {
  id: number
  ishyigaAccount: string
  firstName: string
  lastName: string
  email: string
  tel: string
  location: string
  tin: string
  owner: string
  status: string
  certificate: string
  description: string
  photo: string
  rating: number
  discount: number
  businessName?: string // Business name for sellers
}

interface SalesData {
  orderCount: number
  totalSales: number
  platformCommission: number
}

export default function SellerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuthStore()
  const sellerAccount = params.sellerAccount as string

  const [profile, setProfile] = useState<SellerProfile | null>(null)
  const [sales, setSales] = useState<SalesData | null>(null)
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState<Partial<SellerProfile>>({})
  const [error, setError] = useState<string | null>(null)
  const [productPage, setProductPage] = useState(1)
  const [productPageSize] = useState(20)
  const [totalProducts, setTotalProducts] = useState(0)

  useEffect(() => {
    if (sellerAccount) {
      loadSellerDetails()
    }
  }, [sellerAccount, productPage])

  const loadSellerDetails = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'getSellerDetails',
          sellerAccount,
          adminEmail: user?.email || '',
          productPage,
          productPageSize
        })
      })
      const data = await res.json()

      if (data.ok && data.profile && Object.keys(data.profile).length > 0) {
        setProfile(data.profile)
        setSales(data.sales)
        setProducts(data.products || [])
        setEditData(data.profile)
        setTotalProducts(data.totalProducts || 0)
      } else {
        setError(data.error || 'Seller not found')
        setProfile(null)
      }
    } catch (error) {
      console.error('Error loading seller details:', error)
      setError('Failed to load seller details')
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }

  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [customReason, setCustomReason] = useState('')
  const [rejectLoading, setRejectLoading] = useState(false)

  const handleReject = async () => {
    if (!rejectionReason) {
      alert('Please select a rejection reason')
      return
    }
    if (rejectionReason === 'other' && !customReason.trim()) {
      alert('Please specify the rejection reason')
      return
    }

    if (!confirm(`Are you sure you want to reject this seller application?`)) return

    setRejectLoading(true)
    try {
      const finalReason = rejectionReason === 'other'
        ? customReason
        : REJECTION_REASONS.find(r => r.value === rejectionReason)?.label || rejectionReason

      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rejectSeller',
          sellerAccount,
          rejectionReason: finalReason,
          adminEmail: user?.email || ''
        })
      })
      const data = await res.json()

      if (data.ok) {
        alert('Seller application rejected successfully')
        setShowRejectModal(false)
        router.push('/admin/sellers')
      } else {
        alert('Error: ' + (data.error || 'Failed to reject seller'))
      }
    } catch (error) {
      console.error('Error rejecting seller:', error)
      alert('Error rejecting seller')
    } finally {
      setRejectLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateSeller',
          sellerAccount,
          adminEmail: user?.email || '',
          ...editData
        })
      })
      const data = await res.json()

      if (data.ok) {
        alert('Seller updated successfully')
        setEditing(false)
        loadSellerDetails()
      } else {
        alert('Error: ' + (data.error || 'Failed to update seller'))
      }
    } catch (error) {
      console.error('Error updating seller:', error)
      alert('Error updating seller')
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading seller details...</div>
  }

  if (!profile || error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-500 mb-4">{error || 'Seller not found'}</div>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
        >
          Go Back
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {profile.firstName} {profile.lastName}
          </h1>
          <p className="text-gray-600 mt-1">{profile.ishyigaAccount}</p>
        </div>
        <div className="ml-auto">
          {editing ? (
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Save size={16} />
                Save
              </button>
              <button
                onClick={() => {
                  setEditing(false)
                  setEditData(profile)
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 flex items-center gap-2"
              >
                <X size={16} />
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Edit size={16} />
                Edit
              </button>
              {profile.status === 'PENDING' && (
                <button
                  onClick={() => setShowRejectModal(true)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                >
                  <XCircle size={16} />
                  Reject
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Store Profile</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                {editing ? (
                  <input
                    type="text"
                    value={editData.firstName || ''}
                    onChange={(e) => setEditData({ ...editData, firstName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                ) : (
                  <p className="text-gray-900">{profile.firstName}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                {editing ? (
                  <input
                    type="text"
                    value={editData.lastName || ''}
                    onChange={(e) => setEditData({ ...editData, lastName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                ) : (
                  <p className="text-gray-900">{profile.lastName}</p>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              {editing ? (
                <input
                  type="email"
                  value={editData.email || ''}
                  onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              ) : (
                <p className="text-gray-900">{profile.email}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              {editing ? (
                <input
                  type="tel"
                  value={editData.tel || ''}
                  onChange={(e) => setEditData({ ...editData, tel: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              ) : (
                <p className="text-gray-900">{profile.tel}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              {editing ? (
                <input
                  type="text"
                  value={editData.location || ''}
                  onChange={(e) => setEditData({ ...editData, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              ) : (
                <p className="text-gray-900">{profile.location || 'N/A'}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">TIN</label>
                {editing ? (
                  <input
                    type="text"
                    value={editData.tin || ''}
                    onChange={(e) => setEditData({ ...editData, tin: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                ) : (
                  <p className="text-gray-900">{profile.tin || 'N/A'}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Owner</label>
                {editing ? (
                  <input
                    type="text"
                    value={editData.owner || ''}
                    onChange={(e) => setEditData({ ...editData, owner: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                ) : (
                  <p className="text-gray-900">{profile.owner || 'N/A'}</p>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              {editing ? (
                <select
                  value={editData.status || ''}
                  onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="LIVE">LIVE</option>
                  <option value="PENDING">PENDING</option>
                  <option value="SLEEPING">SLEEPING</option>
                </select>
              ) : (
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${profile.status === 'LIVE' ? 'bg-green-100 text-green-800' :
                  profile.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                  {profile.status}
                </span>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Certificate</label>
              {editing ? (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setEditData({ ...editData, certificate: editData.certificate === 'YES' ? 'NO' : 'YES' })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${editData.certificate === 'YES' ? 'bg-green-600' : 'bg-gray-200'
                      }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editData.certificate === 'YES' ? 'translate-x-6' : 'translate-x-1'
                        }`}
                    />
                  </button>
                  <span className={`text-sm font-medium ${editData.certificate === 'YES' ? 'text-green-600' : 'text-gray-500'}`}>
                    {editData.certificate === 'YES' ? '✓ Has Certificate' : '✗ No Certificate'}
                  </span>
                </div>
              ) : (
                <p className="text-gray-900">
                  {profile.certificate === 'YES' || profile.certificate === 'NA' ? (
                    <span className="text-green-600">✓ Has Certificate</span>
                  ) : (
                    <span className="text-red-600">✗ No Certificate</span>
                  )}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              {editing ? (
                <textarea
                  value={editData.description || ''}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  placeholder="Add your description"
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                />
              ) : (
                <p className="text-gray-900">{profile.description || 'N/A'}</p>
              )}
            </div>
          </div>
        </div>

        {/* Sales & Commission Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Sales & Commission</h2>
          {sales && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Total Orders</p>
                <p className="text-2xl font-bold text-gray-900">{sales.orderCount}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Sales</p>
                <p className="text-2xl font-bold text-gray-900">
                  {new Intl.NumberFormat('en-RW', {
                    style: 'currency',
                    currency: 'RWF',
                    minimumFractionDigits: 0,
                  }).format(sales.totalSales)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Platform Commission</p>
                <p className="text-2xl font-bold text-blue-600">
                  {new Intl.NumberFormat('en-RW', {
                    style: 'currency',
                    currency: 'RWF',
                    minimumFractionDigits: 0,
                  }).format(sales.platformCommission)}
                </p>
                <p className="text-xs text-gray-500">0.5% of total sales</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Products/Listings */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Products/Listings {totalProducts > 0 && `(${totalProducts})`}
          </h2>
        </div>
        {products.length === 0 ? (
          <p className="text-gray-500">No products found</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sector</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {products.map((product: any) => (
                    <tr key={product.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{product.itemCode}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{product.itemName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{product.quantity}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Intl.NumberFormat('en-RW', {
                          style: 'currency',
                          currency: 'RWF',
                          minimumFractionDigits: 0,
                        }).format(product.price)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.sector || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalProducts > productPageSize && (
              <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4">
                <div className="text-sm text-gray-700">
                  Showing {(productPage - 1) * productPageSize + 1} to {Math.min(productPage * productPageSize, totalProducts)} of {totalProducts} products
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setProductPage(p => Math.max(1, p - 1))}
                    disabled={productPage === 1}
                    className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-2 text-sm font-medium text-gray-700">
                    Page {productPage} of {Math.ceil(totalProducts / productPageSize)}
                  </span>
                  <button
                    onClick={() => setProductPage(p => p + 1)}
                    disabled={productPage >= Math.ceil(totalProducts / productPageSize)}
                    className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <XCircle size={24} />
                Reject Seller Application
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seller: {profile.firstName} {profile.lastName}
                </label>
                <p className="text-sm text-gray-600">Business: {profile.businessName || 'N/A'}</p>
                <p className="text-sm text-gray-600">Email: {profile.email}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rejection Reason *
                </label>
                <select
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="">Select a reason...</option>
                  {REJECTION_REASONS.map((reason) => (
                    <option key={reason.value} value={reason.value}>
                      {reason.label}
                    </option>
                  ))}
                </select>
              </div>

              {rejectionReason === 'other' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Specify Reason *
                  </label>
                  <textarea
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Please explain the rejection reason..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>
              )}

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  ⚠️ This action cannot be undone. The seller will be notified via email.
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleReject}
                  disabled={rejectLoading}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  {rejectLoading ? 'Rejecting...' : 'Confirm Rejection'}
                </Button>
                <Button
                  onClick={() => {
                    setShowRejectModal(false)
                    setRejectionReason('')
                    setCustomReason('')
                  }}
                  variant="outline"
                  className="flex-1"
                  disabled={rejectLoading}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
