'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertCircle, Plus, Edit, Trash2, Search, Package, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { 
  importStockExcel, 
  ImportResult, 
  getStock, 
  searchStock, 
  deleteItem,
  upsertItem, 
  StockItem 
} from '@/lib/supplierStockApi';
import { useAuthStore } from '@/lib/auth-store';

type Tab = 'upload' | 'manage';

// Modal Component for Edit/Add Item
function ItemModal({ 
  isOpen, 
  onClose, 
  item, 
  onSave 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  item: StockItem | null; 
  onSave: (item: StockItem) => void; 
}) {
  const [formData, setFormData] = useState<StockItem>({
    item_commercial_name: '',
    item_packet: '',
    item_emballage: '',
    item_key_words: '',
    item_state: 'Ba:NA| Ex:NA',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setFormData(item);
    } else {
      setFormData({
        item_commercial_name: '',
        item_packet: '',
        item_emballage: '',
        item_key_words: '',
        item_state: 'Ba:NA| Ex:NA',
      });
    }
  }, [item, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.item_commercial_name || !formData.item_key_words) {
      alert('Product name and code are required');
      return;
    }
    
    setSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {item ? 'Edit Item' : 'Add New Item'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.item_commercial_name}
                onChange={(e) => setFormData({ ...formData, item_commercial_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.item_key_words}
                onChange={(e) => setFormData({ ...formData, item_key_words: e.target.value })}
                disabled={!!item}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantity
              </label>
              <input
                type="text"
                value={formData.item_packet}
                onChange={(e) => setFormData({ ...formData, item_packet: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price
              </label>
              <input
                type="text"
                value={formData.item_emballage}
                onChange={(e) => setFormData({ ...formData, item_emballage: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.item_state.replace('Ba:NA| Ex:NA| Desc:', '').replace('Ba:NA| Ex:NA', '')}
                onChange={(e) => {
                  const desc = e.target.value.trim();
                  setFormData({ 
                    ...formData, 
                    item_state: desc ? `Ba:NA| Ex:NA| Desc:${desc}` : 'Ba:NA| Ex:NA'
                  });
                }}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition"
            >
              {saving ? 'Saving...' : (item ? 'Update' : 'Add')} Item
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Pagination Component
function Pagination({ 
  currentPage, 
  totalPages, 
  onPageChange 
}: { 
  currentPage: number; 
  totalPages: number; 
  onPageChange: (page: number) => void; 
}) {
  if (totalPages <= 1) return null;

  const pages = [];
  const maxVisiblePages = 5;
  
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
  
  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      
      {startPage > 1 && (
        <>
          <button
            onClick={() => onPageChange(1)}
            className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
          >
            1
          </button>
          {startPage > 2 && <span className="px-2">...</span>}
        </>
      )}
      
      {pages.map(page => (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          className={`px-3 py-2 rounded-lg border ${
            page === currentPage
              ? 'bg-blue-600 text-white border-blue-600'
              : 'border-gray-300 hover:bg-gray-50'
          }`}
        >
          {page}
        </button>
      ))}
      
      {endPage < totalPages && (
        <>
          {endPage < totalPages - 1 && <span className="px-2">...</span>}
          <button
            onClick={() => onPageChange(totalPages)}
            className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
          >
            {totalPages}
          </button>
        </>
      )}
      
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function SupplierStockUploadPage() {
  const router = useRouter();
  const { isAuthenticated, hasHydrated } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  
  // Stock management state
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [showModal, setShowModal] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [allItems, setAllItems] = useState<StockItem[]>([]);

  // Session expiration check
  useEffect(() => {
    if (hasHydrated && !isAuthenticated) {
      router.replace('/login');
    }
  }, [hasHydrated, isAuthenticated, router]);

  // Calculate pagination
  const totalPages = Math.ceil(allItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedItems = allItems.slice(startIndex, endIndex);

  // Load stock items when manage tab is active
  useEffect(() => {
    if (activeTab === 'manage') {
      loadStock();
    }
  }, [activeTab]);

  // Reset to first page when items change
  useEffect(() => {
    setCurrentPage(1);
  }, [allItems.length]);

  const loadStock = async () => {
    setLoading(true);
    try {
      console.log('[Frontend] Loading stock...');
      const response = await getStock();
      console.log('[Frontend] Stock response:', response);
      
      if (response.ok && response.stock) {
        setAllItems(response.stock.data);
        setStockItems(response.stock.data);
        console.log('[Frontend] Loaded', response.stock.data.length, 'items');
      } else if (response.error?.includes('unauthorized') || response.error?.includes('authentication') || (response as any).needsLogin) {
        // Session expired, redirect to login
        console.error('[Frontend] Authentication failed, redirecting to login');
        router.replace('/login');
      } else {
        console.error('[Frontend] Failed to load stock:', response.error);
      }
    } catch (error) {
      console.error('Failed to load stock:', error);
      // Check if it's a network error that might indicate session expiration
      if (error instanceof Error && (error.message.includes('401') || error.message.includes('unauthorized'))) {
        console.error('[Frontend] Network authentication error, redirecting to login');
        router.replace('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setAllItems(stockItems);
      return;
    }
    
    setLoading(true);
    try {
      const response = await searchStock(searchQuery);
      if (response.ok && response.results) {
        setAllItems(response.results);
      } else if (response.error?.includes('unauthorized') || response.error?.includes('authentication')) {
        router.replace('/login');
      }
    } catch (error) {
      console.error('Search failed:', error);
      if (error instanceof Error && error.message.includes('401')) {
        router.replace('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (code: string) => {
    if (!confirm(`Delete item with code: ${code}?`)) return;
    
    try {
      const response = await deleteItem(code);
      if (response.ok) {
        loadStock();
      } else if (response.error?.includes('unauthorized') || response.error?.includes('authentication')) {
        router.replace('/login');
      } else {
        alert(response.error || 'Failed to delete item');
      }
    } catch (error) {
      console.error('Delete failed:', error);
      if (error instanceof Error && error.message.includes('401')) {
        router.replace('/login');
      } else {
        alert('Failed to delete item');
      }
    }
  };

  const handleEdit = (item: StockItem) => {
    setEditingItem(item);
    setShowModal(true);
  };

  const handleAddNew = () => {
    setEditingItem(null);
    setShowModal(true);
  };

  const handleSaveItem = async (formData: StockItem) => {
    try {
      const response = await upsertItem(formData);
      if (response.ok) {
        loadStock();
        alert(editingItem ? 'Item updated successfully' : 'Item added successfully');
      } else if (response.error?.includes('unauthorized') || response.error?.includes('authentication')) {
        router.replace('/login');
        throw new Error('Session expired');
      } else {
        alert(response.error || 'Failed to save item');
        throw new Error(response.error || 'Failed to save item');
      }
    } catch (error) {
      console.error('Save failed:', error);
      if (error instanceof Error && error.message.includes('401')) {
        router.replace('/login');
      }
      throw error;
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const fileName = selectedFile.name.toLowerCase();
      if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls') && !fileName.endsWith('.csv')) {
        alert('Please select an Excel file (.xlsx, .xls) or CSV file (.csv)');
        return;
      }
      if (selectedFile.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setResult(null);

    try {
      const response = await importStockExcel(file);
      setResult(response);
      
      if (response.ok) {
        setFile(null);
        // Reset file input
        const fileInput = document.getElementById('file-input') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else if (response.error?.includes('unauthorized') || response.error?.includes('authentication')) {
        router.replace('/login');
      }
    } catch (error) {
      console.error('Upload error:', error);
      if (error instanceof Error && error.message.includes('401')) {
        router.replace('/login');
      } else {
        setResult({
          ok: false,
          message: 'Failed to upload file',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Product Stock Management</h1>
          <p className="text-gray-600 mt-2">
            Upload Excel inventory or manage individual items
          </p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab('upload')}
                className={`px-6 py-4 font-medium transition ${
                  activeTab === 'upload'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <FileSpreadsheet className="w-5 h-5 inline mr-2" />
                Excel Upload
              </button>
              <button
                onClick={() => setActiveTab('manage')}
                className={`px-6 py-4 font-medium transition ${
                  activeTab === 'manage'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Package className="w-5 h-5 inline mr-2" />
                Manage Items
              </button>
            </div>
          </div>
        </div>

        {/* Excel Upload Tab */}
        {activeTab === 'upload' && (
          <div>
            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
              <h2 className="text-lg font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                File Format Requirements
              </h2>
              <ul className="space-y-2 text-sm text-blue-800">
                <li>• <strong>Supported formats</strong>: Excel (.xlsx) or CSV (.csv)</li>
                <li>• <strong>NAME</strong>: Product name (required)</li>
                <li>• <strong>QTE</strong>: Quantity/stock level (required)</li>
                <li>• <strong>SALES</strong>: Price (required)</li>
                <li>• <strong>CODE</strong>: Product code/SKU (required)</li>
                <li>• <strong>DESCRIPTION</strong>: Product description (optional)</li>
              </ul>
              <div className="mt-4 text-sm text-blue-700">
                <strong>Limits:</strong> Max 5MB file size, 10,000 rows
              </div>
            </div>

            {/* Upload Card */}
            <div className="bg-white rounded-lg shadow-md p-8">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                <FileSpreadsheet className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                
                <input
                  id="file-input"
                  type="file"
                  accept=".xlsx,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                
                <label
                  htmlFor="file-input"
                  className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition"
                >
                  <Upload className="w-5 h-5 inline mr-2" />
                  Select Excel File
                </label>

                {file && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-600">Selected file:</p>
                    <p className="font-medium text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {(file.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                )}
              </div>

              {file && (
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition font-medium"
                  >
                    {uploading ? (
                      <>
                        <span className="inline-block animate-spin mr-2">⏳</span>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5 inline mr-2" />
                        Upload & Import
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Result */}
            {result && (
              <div className={`mt-6 rounded-lg p-6 ${
                result.ok 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-start gap-3">
                  {result.ok ? (
                    <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
                  )}
                  
                  <div className="flex-1">
                    <h3 className={`font-semibold text-lg ${
                      result.ok ? 'text-green-900' : 'text-red-900'
                    }`}>
                      {result.message}
                    </h3>

                    {result.ok && (
                      <div className="mt-3 space-y-1 text-sm text-green-800">
                        <p>✓ Items imported: {result.itemsImported}</p>
                        <p>✓ Rows parsed: {result.rowsParsed}</p>
                        {result.rowsSkipped! > 0 && (
                          <p>⚠ Rows skipped: {result.rowsSkipped}</p>
                        )}
                        {result.backupKey && result.backupKey !== 'none' && (
                          <p className="text-xs text-green-700 mt-2">
                            Backup created: {result.backupKey}
                          </p>
                        )}
                      </div>
                    )}

                    {!result.ok && result.errors && result.errors.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-medium text-red-800 mb-2">Errors:</p>
                        <ul className="space-y-1 text-sm text-red-700">
                          {result.errors.map((error, idx) => (
                            <li key={idx}>• {error}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {!result.ok && result.error && (
                      <p className="mt-2 text-sm text-red-700">{result.error}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Download Template Link */}
            <div className="mt-8 text-center">
              <p className="text-sm text-gray-600">
                Need a template?{' '}
                <a
                  href="/supplier/stock/template"
                  className="text-blue-600 hover:underline font-medium"
                  download
                >
                  Download CSV Template
                </a>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                (Can be opened and edited in Excel)
              </p>
            </div>
          </div>
        )}

        {/* Manage Items Tab */}
        {activeTab === 'manage' && (
          <div>
            {/* Search and Add */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="flex gap-4 mb-4">
                <div className="flex-1 flex gap-2">
                  <input
                    type="text"
                    placeholder="Search by name, code, or description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleSearch}
                    disabled={loading}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition"
                  >
                    <Search className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      loadStock();
                    }}
                    disabled={loading}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 transition"
                    title="Refresh all items"
                  >
                    ↻
                  </button>
                </div>
                <button
                  onClick={handleAddNew}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Add Item
                </button>
              </div>
              
              {/* Stock count info */}
              {allItems.length > 0 && (
                <div className="text-sm text-gray-600">
                  {searchQuery ? (
                    <>Showing {allItems.length} results for "{searchQuery}"</>
                  ) : (
                    <>Total items: {allItems.length}</>
                  )}
                </div>
              )}
            </div>

            {/* Stock Items Table */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              {loading ? (
                <div className="p-12 text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="mt-4 text-gray-600">Loading stock...</p>
                </div>
              ) : allItems.length === 0 ? (
                <div className="p-12 text-center">
                  <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No stock items found</p>
                  <button
                    onClick={handleAddNew}
                    className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    Add Your First Item
                  </button>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Code
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Quantity
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Price
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {paginatedItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {item.item_key_words}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              <div className="max-w-xs truncate" title={item.item_commercial_name}>
                                {item.item_commercial_name}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {item.item_packet}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {item.item_emballage}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleEdit(item)}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded transition"
                                  title="Edit"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(item.item_key_words)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded transition"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div className="px-6 py-4 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        Showing {startIndex + 1} to {Math.min(endIndex, allItems.length)} of {allItems.length} items
                      </div>
                      <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Item Modal */}
            <ItemModal
              isOpen={showModal}
              onClose={() => setShowModal(false)}
              item={editingItem}
              onSave={handleSaveItem}
            />
          </div>
        )}
      </div>
    </div>
  );
}
