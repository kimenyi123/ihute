"use client"

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { CheckCircle, XCircle, Eye, AlertCircle, Search, Trash2 } from 'lucide-react'
import { postAdminApi } from '@/lib/admin-client'
import { CredentialSellersPanel } from '@/app/admin/sellers/CredentialSellersPanel'
import { UrubutoKpiStrip } from '@/components/admin/urubuto-kpi-strip'

interface Seller {
  id: number
  ishyigaAccount: string
  firstName: string
  lastName: string
  email: string
  tel: string
  location: string
  status: string
  certificate?: string
  description?: string
  productCount?: number
  totalSales?: number
}

interface UrubutoMerchantAppRow {
  id: number
  sellerPayerCode: string
  displayName: string
  merchantStatus: string
  urubutoMerchantCode: string
  docCount: number
  firstName: string
  lastName: string
  email: string
  tel: string
  location: string
  sellerAccountStatus: string
  createdAt: string
}

type SellersTab = 'applications' | 'urubuto' | 'active' | 'suspended' | 'credentials'

export default function SellersPage() {
  const [activeTab, setActiveTab] = useState<SellersTab>('applications')
  const [applications, setApplications] = useState<Seller[]>([])
  const [urubutoRows, setUrubutoRows] = useState<UrubutoMerchantAppRow[]>([])
  const [activeSellers, setActiveSellers] = useState<Seller[]>([])
  const [suspendedSellers, setSuspendedSellers] = useState<Seller[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [pageApps, setPageApps] = useState(1)
  const [pageUrubuto, setPageUrubuto] = useState(1)
  const [pageActive, setPageActive] = useState(1)
  const [pageSuspended, setPageSuspended] = useState(1)
  const [totalApps, setTotalApps] = useState(0)
  const [totalUrubuto, setTotalUrubuto] = useState(0)
  const [totalActive, setTotalActive] = useState(0)
  const [totalSuspended, setTotalSuspended] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [urubutoStatusFilter, setUrubutoStatusFilter] = useState('')
  const pageSize = 10

  const [credRefreshTrigger, setCredRefreshTrigger] = useState(0)

  // Debounced search - updates after 300ms of no typing
  const debouncedSearch = useMemo(() => {
    const timer = setTimeout(() => searchTerm, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // reset pagination when switching tabs
  useEffect(() => {
    if (activeTab === 'applications') setPageApps(1)
    if (activeTab === 'urubuto') setPageUrubuto(1)
    if (activeTab === 'active') setPageActive(1)
    if (activeTab === 'suspended') setPageSuspended(1)
  }, [activeTab])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const tab = new URLSearchParams(window.location.search).get('tab')
    if (tab === 'urubuto') setActiveTab('urubuto')
  }, [])

  /** Badge count for Urubuto tab before first visit (same AdminServlet action as the tab). */
  useEffect(() => {
    let cancelled = false
    void postAdminApi({ action: 'getUrubutoMerchantApplications', page: 1, pageSize: 1 })
      .then((r) => r.json())
      .then((d: { ok?: boolean; totalCount?: number }) => {
        if (!cancelled && d.ok) setTotalUrubuto(Number(d.totalCount) || 0)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'credentials') {
      setLoading(false)
      return
    }
    loadSellers()
  }, [activeTab, pageApps, pageUrubuto, pageActive, pageSuspended, searchTerm])

  const loadSellers = async () => {
    try {
      setLoading(true)
      setError(null)
      let action = ''
      let page = 1
      let size = pageSize

      if (activeTab === 'applications') {
        action = 'getSellerApplications'
        page = pageApps
      } else if (activeTab === 'urubuto') {
        action = 'getUrubutoMerchantApplications'
        page = pageUrubuto
      } else if (activeTab === 'active') {
        action = 'getActiveSellers'
        page = pageActive
        // When searching, fetch ALL sellers for client-side filtering
        if (searchTerm.trim()) {
          size = 9999 // Large number to get all
          page = 1
        }
      } else {
        action = 'getSuspendedSellers'
        page = pageSuspended
      }

      const res = await postAdminApi({ action, page, pageSize: size })
      const data = await res.json()

      if (data.ok) {
        if (activeTab === 'applications') {
          setApplications(data.sellers || [])
          setTotalApps(data.totalCount || 0)
        } else if (activeTab === 'urubuto') {
          setUrubutoRows((data.applications as UrubutoMerchantAppRow[]) || [])
          setTotalUrubuto(data.totalCount || 0)
        } else if (activeTab === 'active') {
          setActiveSellers(data.sellers || [])
          setTotalActive(data.totalCount || 0)
        } else {
          setSuspendedSellers(data.sellers || [])
          setTotalSuspended(data.totalCount || 0)
        }
      } else {
        setError(data.error || 'Failed to load sellers')
      }
    } catch (error: any) {
      console.error('Error loading sellers:', error)
      setError(error?.message || 'Failed to load sellers. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (sellerAccount: string) => {
    if (!confirm('Approve this seller application?')) return

    try {
      setActionLoading(sellerAccount)
      const res = await postAdminApi({ action: 'approveSeller', sellerAccount })
      const data = await res.json()

      if (data.ok) {
        alert('Seller approved successfully')
        loadSellers()
      } else {
        alert('Error: ' + (data.error || 'Failed to approve seller'))
      }
    } catch (error) {
      console.error('Error approving seller:', error)
      alert('Error approving seller')
    } finally {
      setActionLoading(null)
    }
  }

  const handleSuspend = async (sellerAccount: string) => {
    const reason = prompt('Enter suspension reason:')
    if (!reason) return

    try {
      setActionLoading(sellerAccount)
      const res = await postAdminApi({ action: 'suspendSeller', sellerAccount, reason })
      const data = await res.json()

      if (data.ok) {
        alert('Seller suspended successfully')
        loadSellers()
      } else {
        alert('Error: ' + (data.error || 'Failed to suspend seller'))
      }
    } catch (error) {
      console.error('Error suspending seller:', error)
      alert('Error suspending seller')
    } finally {
      setActionLoading(null)
    }
  }

  const handlePurgeSeller = async (sellerAccount: string) => {
    if (
      !confirm(
        `Permanently purge seller ${sellerAccount}? This deletes seller_add_stock rows, account_buyer (same ishyiga or seller email), legacy account_signup row, and account_seller. Orders are NOT removed.`,
      )
    ) {
      return
    }
    const typed = window.prompt('Type DELETE in capitals to confirm:')
    if (typed !== 'DELETE') return
    try {
      setActionLoading(sellerAccount)
      const res = await postAdminApi({
        action: 'purgeSellerAccount',
        sellerAccount,
        confirmPurge: 'DELETE',
      })
      const data = await res.json()
      if (!data.ok) {
        alert('Purge failed: ' + (data.error || 'Unknown error'))
        return
      }
      alert(
        `Purge OK. Stock rows: ${data.deletedSellerAddStockRows ?? 0}, buyer: ${data.deletedBuyerRows ?? 0}, signup: ${data.deletedSignupRows ?? 0}, seller: ${data.deletedSellerRows ?? 0}`,
      )
      if (activeTab === 'credentials') {
        setCredRefreshTrigger((n) => n + 1)
      } else {
        loadSellers()
      }
    } catch (e) {
      console.error(e)
      alert('Purge request failed')
    } finally {
      setActionLoading(null)
    }
  }

  const handleReinstate = async (sellerAccount: string) => {
    if (!confirm('Reinstate this seller?')) return

    try {
      setActionLoading(sellerAccount)
      const res = await postAdminApi({ action: 'reinstateSeller', sellerAccount })
      const data = await res.json()

      if (data.ok) {
        alert('Seller reinstated successfully')
        loadSellers()
      } else {
        alert('Error: ' + (data.error || 'Failed to reinstate seller'))
      }
    } catch (error) {
      console.error('Error reinstating seller:', error)
      alert('Error reinstating seller')
    } finally {
      setActionLoading(null)
    }
  }

  // Filter active sellers based on search
  const filteredActiveSellers = useMemo(() => {
    if (activeTab !== 'active' || !searchTerm.trim()) {
      return activeSellers
    }

    const term = searchTerm.toLowerCase()
    return activeSellers.filter(seller =>
      seller.firstName?.toLowerCase().includes(term) ||
      seller.lastName?.toLowerCase().includes(term) ||
      seller.ishyigaAccount?.toLowerCase().includes(term) ||
      seller.email?.toLowerCase().includes(term) ||
      seller.tel?.toLowerCase().includes(term) ||
      seller.location?.toLowerCase().includes(term)
    )
  }, [activeSellers, searchTerm, activeTab])

  const filteredUrubutoRows = useMemo(() => {
    let rows = urubutoRows
    if (urubutoStatusFilter) {
      rows = rows.filter((r) => r.merchantStatus === urubutoStatusFilter)
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      rows = rows.filter(
        (r) =>
          r.sellerPayerCode?.toLowerCase().includes(term) ||
          r.displayName?.toLowerCase().includes(term) ||
          r.email?.toLowerCase().includes(term) ||
          r.firstName?.toLowerCase().includes(term) ||
          r.lastName?.toLowerCase().includes(term)
      )
    }
    return rows
  }, [urubutoRows, urubutoStatusFilter, searchTerm])

  const exportUrubutoCsv = () => {
    const header = ['sellerPayerCode', 'displayName', 'email', 'tel', 'merchantStatus', 'docCount', 'urubutoMerchantCode', 'createdAt']
    const lines = [header.join(',')]
    for (const r of filteredUrubutoRows) {
      lines.push(
        [
          r.sellerPayerCode,
          r.displayName,
          r.email,
          r.tel,
          r.merchantStatus,
          String(r.docCount),
          r.urubutoMerchantCode,
          r.createdAt,
        ]
          .map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`)
          .join(',')
      )
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'urubuto-applications.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const currentSellers = activeTab === 'applications' ? applications :
    activeTab === 'urubuto' ? [] :
    activeTab === 'active' ? filteredActiveSellers : activeTab === 'suspended' ? suspendedSellers : []
  const currentPage = activeTab === 'applications' ? pageApps : activeTab === 'urubuto' ? pageUrubuto : activeTab === 'active' ? pageActive : pageSuspended
  const currentTotal = activeTab === 'applications' ? totalApps : activeTab === 'urubuto' ? totalUrubuto : activeTab === 'active' ? totalActive : totalSuspended

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Sellers Management</h1>
        <p className="text-gray-600 mt-1">
          Manage seller accounts. <strong className="font-medium text-gray-800">LIVE</strong> tab is seller shop
          registrations. <strong className="font-medium text-gray-800">UrubutoPay</strong> tab lists merchant onboarding
          applications from IHUTE, POS, POS MINI, or ERP — all stored on the Trading backend (
          <code className="text-xs bg-gray-100 px-1 rounded">urubuto_merchant</code>).
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'applications' as const, label: 'LIVE registrations', count: totalApps },
            { id: 'urubuto' as const, label: 'UrubutoPay applications', count: totalUrubuto },
            { id: 'active' as const, label: 'Active Sellers', count: totalActive },
            { id: 'suspended' as const, label: 'Suspended Sellers', count: totalSuspended },
            { id: 'credentials' as const, label: 'Credentials', count: 0 },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as SellersTab)}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm
                ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'credentials' && (
        <CredentialSellersPanel
          active={activeTab === 'credentials'}
          onPurgeSeller={handlePurgeSeller}
          actionLoadingKey={actionLoading}
          refreshTrigger={credRefreshTrigger}
        />
      )}

      {activeTab === 'urubuto' && (
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search payer code, shop name, email…"
              className="w-full pl-10 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500 outline-none"
            />
          </div>
        </div>
      )}

      {/* Search Input - Active Sellers Only */}
      {activeTab === 'active' && (
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, email, phone, account ID, or location..."
              className="w-full pl-10 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
          {searchTerm && (
            <div className="mt-2 text-sm text-gray-600">
              Found {filteredActiveSellers.length} seller{filteredActiveSellers.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
          <span className="block sm:inline">{error}</span>
          <button
            className="absolute top-0 bottom-0 right-0 px-4 py-3"
            onClick={() => setError(null)}
          >
            <span className="sr-only">Dismiss</span>
            <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Sellers Table */}
      {activeTab === 'credentials' ? null : loading ? (
        <div className="text-center py-12 text-gray-500">Loading sellers...</div>
      ) : error ? (
        <div className="text-center py-12 text-red-500">{error}</div>
      ) : (activeTab === 'urubuto' ? filteredUrubutoRows.length === 0 : currentSellers.length === 0) ? (
        <div className="text-center py-12 text-gray-500">
          {activeTab === 'urubuto' ? 'No UrubutoPay merchant applications yet.' : 'No sellers found'}
        </div>
      ) : (
        <div>
          {activeTab === 'urubuto' ? (
            <>
            <UrubutoKpiStrip />
            <div className="flex flex-wrap gap-3 mb-3 items-center">
              <select
                className="rounded border px-3 py-1.5 text-sm"
                value={urubutoStatusFilter}
                onChange={(e) => setUrubutoStatusFilter(e.target.value)}
              >
                <option value="">All statuses</option>
                <option value="PENDING">PENDING</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="REJECTED">REJECTED</option>
              </select>
              <button
                type="button"
                onClick={exportUrubutoCsv}
                className="text-sm rounded border px-3 py-1.5 bg-white hover:bg-gray-50"
              >
                Export CSV for Urubuto
              </button>
            </div>
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-violet-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Seller payer (ALG)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Profile / contacts
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Merchant status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Docs
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Urubuto code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Applied
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUrubutoRows.map((row) => {
                    const applied = row.createdAt ? new Date(row.createdAt).getTime() : 0
                    const stale = applied > 0 && Date.now() - applied > 48 * 3600 * 1000 && !row.urubutoMerchantCode
                    return (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-mono font-medium text-gray-900">{row.sellerPayerCode}</div>
                        <div className="text-xs text-gray-500">{row.displayName || '—'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {(row.firstName || row.lastName) ? `${row.firstName} ${row.lastName}`.trim() : '—'}
                        </div>
                        <div className="text-sm text-gray-500">{row.email || '—'}</div>
                        <div className="text-xs text-gray-400">{row.tel || ''}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-800">
                          {row.merchantStatus}
                        </span>
                        {row.sellerAccountStatus && (
                          <div className="text-xs text-gray-500 mt-1">Seller: {row.sellerAccountStatus}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {row.docCount}/3
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-700">
                        {row.urubutoMerchantCode || '—'}
                        {stale && (
                          <span className="block text-xs text-amber-700 font-sans mt-0.5">SLA &gt;48h no code</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                        {row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link
                          href={`/admin/sellers/urubuto/${encodeURIComponent(row.sellerPayerCode)}`}
                          className="text-blue-600 hover:text-blue-900 inline-flex items-center gap-1"
                          title="UrubutoPay application and documents"
                        >
                          <Eye size={18} />
                        </Link>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            </>
          ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Seller
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contacts
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  {activeTab === 'active' && (
                    <>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Products
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Sales
                      </th>
                    </>
                  )}
                  {activeTab === 'applications' && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Certificate
                    </th>
                  )}
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentSellers.map((seller) => (
                  <tr key={seller.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {seller.firstName} {seller.lastName}
                        </div>
                        <div className="text-sm text-gray-500">{seller.ishyigaAccount}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{seller.email}</div>
                      <div className="text-sm text-gray-500">{seller.tel}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {seller.location || 'N/A'}
                    </td>
                    {activeTab === 'active' && (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {seller.productCount || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {seller.totalSales ? new Intl.NumberFormat('en-RW', {
                            style: 'currency',
                            currency: 'RWF',
                            minimumFractionDigits: 0,
                          }).format(seller.totalSales) : '0'}
                        </td>
                      </>
                    )}
                    {activeTab === 'applications' && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        {seller.certificate && seller.certificate !== 'NA' ? (
                          <span className="text-green-600 text-sm">✓ Has Certificate</span>
                        ) : (
                          <span className="text-red-600 text-sm flex items-center gap-1">
                            <AlertCircle size={16} />
                            Missing
                          </span>
                        )}
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/sellers/${seller.ishyigaAccount}`}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Eye size={18} />
                        </Link>
                        {activeTab === 'applications' && seller.status?.toUpperCase() === 'PENDING' && (
                          <button
                            onClick={() => handleApprove(seller.ishyigaAccount)}
                            disabled={actionLoading === seller.ishyigaAccount}
                            className="text-green-600 hover:text-green-900 disabled:opacity-50"
                            title="Approve (PENDING only)"
                          >
                            <CheckCircle size={18} />
                          </button>
                        )}
                        {activeTab === 'applications' && (
                          <button
                            onClick={() => handleSuspend(seller.ishyigaAccount)}
                            disabled={actionLoading === seller.ishyigaAccount}
                            className="text-red-600 hover:text-red-900 disabled:opacity-50"
                            title="Suspend seller"
                          >
                            <XCircle size={18} />
                          </button>
                        )}
                        {activeTab === 'suspended' && (
                          <button
                            onClick={() => handleReinstate(seller.ishyigaAccount)}
                            disabled={actionLoading === seller.ishyigaAccount}
                            className="text-green-600 hover:text-green-900 disabled:opacity-50"
                            title="Reinstate"
                          >
                            <CheckCircle size={18} />
                          </button>
                        )}
                        {activeTab === 'active' && (
                          <button
                            onClick={() => handleSuspend(seller.ishyigaAccount)}
                            disabled={actionLoading === seller.ishyigaAccount}
                            className="text-red-600 hover:text-red-900 disabled:opacity-50"
                            title="Suspend"
                          >
                            <XCircle size={18} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void handlePurgeSeller(seller.ishyigaAccount)}
                          disabled={actionLoading === seller.ishyigaAccount}
                          className="text-red-900 hover:text-red-950 disabled:opacity-50"
                          title="Purge seller (stock + buyer + signup + seller; not orders)"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
          <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
            <div>Page {currentPage} of {Math.max(1, Math.ceil(currentTotal / pageSize))}</div>
            <div className="space-x-2">
              <button
                className="px-3 py-1 border rounded disabled:opacity-50"
                onClick={() => {
                  if (activeTab === 'applications') setPageApps((p) => Math.max(1, p - 1))
                  else if (activeTab === 'urubuto') setPageUrubuto((p) => Math.max(1, p - 1))
                  else if (activeTab === 'active') setPageActive((p) => Math.max(1, p - 1))
                  else setPageSuspended((p) => Math.max(1, p - 1))
                }}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <button
                className="px-3 py-1 border rounded disabled:opacity-50"
                onClick={() => {
                  const maxPage = Math.max(1, Math.ceil(currentTotal / pageSize))
                  if (activeTab === 'applications') setPageApps((p) => (p < maxPage ? p + 1 : p))
                  else if (activeTab === 'urubuto') setPageUrubuto((p) => (p < maxPage ? p + 1 : p))
                  else if (activeTab === 'active') setPageActive((p) => (p < maxPage ? p + 1 : p))
                  else setPageSuspended((p) => (p < maxPage ? p + 1 : p))
                }}
                disabled={currentPage >= Math.max(1, Math.ceil(currentTotal / pageSize))}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
