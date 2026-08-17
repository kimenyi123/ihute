"use client"

import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, FileText, Grid3x3 } from 'lucide-react'
import { postAdminApi } from '@/lib/admin-client'

interface Sector {
  name: string
  sellerCount: number
  productCount: number
}

interface HomepageCategory {
  id?: number
  categoryId: string
  nameKey: string
  descKey: string
  imageUrl: string
  colorClass: string
  displayOrder?: number
  isActive?: boolean
  sellerCount?: number
}

export default function CategoriesPage() {
  const [sectors, setSectors] = useState<Sector[]>([])
  const [homepageCategories, setHomepageCategories] = useState<HomepageCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSector, setSelectedSector] = useState<string | null>(null)
  const [complianceRules, setComplianceRules] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'sectors' | 'homepage'>('sectors')
  const [editingCategory, setEditingCategory] = useState<HomepageCategory | null>(null)

  useEffect(() => {
    if (activeTab === 'sectors') {
      loadSectors()
    } else {
      loadHomepageCategories()
    }
  }, [activeTab])

  useEffect(() => {
    if (selectedSector) {
      loadComplianceRules()
    }
  }, [selectedSector])

  const loadSectors = async () => {
    try {
      setLoading(true)
      const res = await postAdminApi({ action: 'getSectors' })
      const data = await res.json()
      
      if (data.ok) {
        setSectors(data.sectors || [])
      }
    } catch (error) {
      console.error('Error loading sectors:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadComplianceRules = async () => {
    if (!selectedSector) return
    
    try {
      const res = await postAdminApi({
        action: 'getSectorComplianceRules',
        sector: selectedSector,
      })
      const data = await res.json()
      
      if (data.ok) {
        setComplianceRules(data.rules)
      }
    } catch (error) {
      console.error('Error loading compliance rules:', error)
    }
  }

  const loadHomepageCategories = async () => {
    try {
      setLoading(true)
      const res = await postAdminApi({ action: 'getHomepageCategories' })
      const data = await res.json()
      
      if (data.ok) {
        setHomepageCategories(data.categories || [])
      }
    } catch (error) {
      console.error('Error loading homepage categories:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveCategory = async (category: HomepageCategory) => {
    try {
      const action = category.id ? 'updateHomepageCategory' : 'createHomepageCategory'
      const res = await postAdminApi({
        action,
        categoryId: category.categoryId,
        nameKey: category.nameKey,
        descKey: category.descKey,
        imageUrl: category.imageUrl,
        colorClass: category.colorClass,
        displayOrder: category.displayOrder || 0,
        isActive: category.isActive !== false,
      })
      const data = await res.json()
      if (data.ok) {
        setEditingCategory(null)
        loadHomepageCategories()
      }
    } catch (error) {
      console.error('Error saving category:', error)
    }
  }

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return
    
    try {
      const res = await postAdminApi({ action: 'deleteHomepageCategory', categoryId })
      const data = await res.json()
      if (data.ok) {
        loadHomepageCategories()
      }
    } catch (error) {
      console.error('Error deleting category:', error)
    }
  }

  const handleToggleCategory = async (categoryId: string, isActive: boolean) => {
    try {
      const res = await postAdminApi({
        action: 'toggleHomepageCategory',
        categoryId,
        isActive,
      })
      const data = await res.json()
      if (data.ok) {
        loadHomepageCategories()
      } else {
        alert('Error toggling category: ' + (data.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Error toggling category:', error)
      alert('Error toggling category')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Categories & Sectors</h1>
          <p className="text-gray-600 mt-1">Manage platform sectors and homepage categories</p>
        </div>
        {activeTab === 'homepage' && (
          <button
            onClick={() => setEditingCategory({ categoryId: '', nameKey: '', descKey: '', imageUrl: '', colorClass: '', displayOrder: 0, isActive: true })}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus size={16} />
            Add Category
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('sectors')}
              className={`px-6 py-4 text-sm font-medium border-b-2 ${
                activeTab === 'sectors'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Sectors
            </button>
            <button
              onClick={() => setActiveTab('homepage')}
              className={`px-6 py-4 text-sm font-medium border-b-2 ${
                activeTab === 'homepage'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Grid3x3 size={16} className="inline mr-2" />
              Homepage Categories
            </button>
          </nav>
        </div>
      </div>

      {activeTab === 'homepage' ? (
        <div className="bg-white rounded-lg shadow p-6">
          {editingCategory ? (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingCategory.id ? 'Edit' : 'Create'} Homepage Category
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category ID</label>
                  <input
                    type="text"
                    value={editingCategory.categoryId}
                    onChange={(e) => setEditingCategory({ ...editingCategory, categoryId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="e.g., pharmacy"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name Key</label>
                  <input
                    type="text"
                    value={editingCategory.nameKey}
                    onChange={(e) => setEditingCategory({ ...editingCategory, nameKey: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="e.g., pharmacy"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description Key</label>
                  <input
                    type="text"
                    value={editingCategory.descKey}
                    onChange={(e) => setEditingCategory({ ...editingCategory, descKey: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="e.g., pharmacyDesc"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                  <input
                    type="text"
                    value={editingCategory.imageUrl}
                    onChange={(e) => setEditingCategory({ ...editingCategory, imageUrl: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="/images/category.jpg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color Class</label>
                  <input
                    type="text"
                    value={editingCategory.colorClass}
                    onChange={(e) => setEditingCategory({ ...editingCategory, colorClass: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="bg-blue-500/10"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
                  <input
                    type="number"
                    value={editingCategory.displayOrder || 0}
                    onChange={(e) => setEditingCategory({ ...editingCategory, displayOrder: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => handleSaveCategory(editingCategory)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingCategory(null)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {loading ? (
                <div className="text-center py-8 text-gray-500">Loading categories...</div>
              ) : homepageCategories.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No homepage categories</div>
              ) : (
                <div className="space-y-4">
                  {homepageCategories.map((category) => (
                    <div key={category.categoryId} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-gray-900">{category.categoryId}</h3>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              category.isActive !== false
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {category.isActive !== false ? 'Active' : 'Inactive'}
                            </span>
                            {category.sellerCount !== undefined && (
                              <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                {category.sellerCount} {category.sellerCount === 1 ? 'supplier' : 'suppliers'}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            Name: {category.nameKey} | Order: {category.displayOrder || 0}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={category.isActive !== false}
                              onChange={(e) => handleToggleCategory(category.categoryId, e.target.checked)}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">Enable</span>
                          </label>
                          <button
                            onClick={() => setEditingCategory(category)}
                            className="p-2 text-gray-400 hover:text-blue-600"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(category.categoryId)}
                            className="p-2 text-gray-400 hover:text-red-600"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sectors List */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Sector List</h2>
          </div>
          {loading ? (
            <div className="p-6 text-center text-gray-500">Loading sectors...</div>
          ) : sectors.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No sectors found</div>
          ) : (
            <div className="divide-y divide-gray-200">
              {sectors.map((sector) => (
                <div
                  key={sector.name}
                  onClick={() => setSelectedSector(sector.name)}
                  className={`p-6 cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedSector === sector.name ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">{sector.name}</h3>
                      <div className="mt-2 flex items-center gap-4 text-sm text-gray-600">
                        <span>{sector.sellerCount} sellers</span>
                        <span>{sector.productCount} products</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="p-2 text-gray-400 hover:text-gray-600">
                        <Edit size={18} />
                      </button>
                      <button className="p-2 text-gray-400 hover:text-red-600">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Compliance Rules */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FileText size={20} />
              Compliance Rules
            </h2>
          </div>
          <div className="p-6">
            {selectedSector ? (
              complianceRules ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Sector: {selectedSector}</p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-700">Requires Certificate</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        complianceRules.requiresCertificate
                          ? 'bg-red-100 text-red-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {complianceRules.requiresCertificate ? 'Yes' : 'No'}
                      </span>
                    </div>
                    {complianceRules.certificateType && (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm font-medium text-gray-700 mb-1">Certificate Type</p>
                        <p className="text-sm text-gray-600">{complianceRules.certificateType}</p>
                      </div>
                    )}
                    {complianceRules.requiresAgeVerification !== undefined && (
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-700">Age Verification</span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          complianceRules.requiresAgeVerification
                            ? 'bg-red-100 text-red-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {complianceRules.requiresAgeVerification ? 'Required' : 'Not Required'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">Loading compliance rules...</div>
              )
            ) : (
              <div className="text-center text-gray-500 py-8">
                Select a sector to view compliance rules
              </div>
            )}
          </div>
        </div>
        </div>
      )}
    </div>
  )
}
