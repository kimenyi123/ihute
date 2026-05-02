'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle, 
  XCircle, 
  AlertCircle
} from 'lucide-react';
import { 
  importStockExcel, 
  ImportResult
} from '@/lib/supplierStockApi';
import { useAuthStore } from '@/lib/auth-store';

export default function SupplierStockUploadPage() {
  const router = useRouter();
  const { isAuthenticated, checkSession } = useAuthStore();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  // Session expiration check - check on mount and periodically
  useEffect(() => {
    // Initial check
    if (!checkSession()) {
      router.replace('/login');
      return;
    }

    // Periodic check every 30 seconds
    const interval = setInterval(() => {
      if (!checkSession()) {
        router.replace('/login');
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [checkSession, router]);

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

    const { user } = useAuthStore.getState();
    if (!user?.ishyigaAccount) {
      alert('No account found. Please log in again.');
      return;
    }

    setUploading(true);
    setResult(null);

    try {
      const response = await importStockExcel(file, user.ishyigaAccount);
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
    <div className="min-h-0 bg-gray-50 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Product Stock Management</h1>
          <p className="text-gray-600 mt-2">
            Upload Excel inventory or manage individual items
          </p>
        </div>

        {/* Header - Excel Upload Only */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="border-b border-gray-200">
            <div className="px-4 sm:px-6 py-4">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <FileSpreadsheet className="w-6 h-6 text-blue-600" />
                Bulk Excel Upload
              </h2>
              <p className="text-gray-600 mt-1">
                Upload multiple products at once using Excel or CSV files
              </p>
            </div>
          </div>
        </div>

        {/* Excel Upload Section */}
        <div>
            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
              <h2 className="text-lg font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                File Format Requirements
              </h2>
              <ul className="space-y-2 text-sm text-blue-800">
                <li>• <strong>Supported formats</strong>: Excel (.xlsx) or CSV (.csv)</li>
                <li>• <strong>General format</strong>: CATEGORY, SUBCATEGORY, ITEM, QTE, PRICE (RWF), COST PRICE, FRENCH, KINYARWANDA, IMAGE LINK, KEYWORDS — required: ITEM, QTE, PRICE; others can be left empty</li>
              </ul>
              <div className="mt-4 text-sm text-blue-700">
                <strong>Limits:</strong> Max 5MB file size, 10,000 rows
              </div>
            </div>

            {/* Upload Card */}
            <div className="bg-white rounded-lg shadow-md p-4 sm:p-8">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 sm:p-12 text-center">
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
                        <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" aria-hidden />
                        Importing…
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5 inline mr-2" />
                        Upload & Import
                      </>
                    )}
                  </button>
                {uploading && (
                  <p className="mt-2 text-sm text-gray-500">Parsing file and saving to your catalog. Large files may take a few seconds.</p>
                )}
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
                        {(result.itemsImported ?? 0) > 0 && (
                          <p>✓ Items added: {result.itemsImported}</p>
                        )}
                        {(result.itemsUpdated ?? 0) > 0 && (
                          <p>✓ Items updated: {result.itemsUpdated}</p>
                        )}
                        <p>✓ Rows parsed: {result.rowsParsed}</p>
                        {(result.rowsSkipped ?? 0) > 0 && (
                          <>
                            <p className="text-amber-700">⚠ Rows skipped (invalid): {result.rowsSkipped}</p>
                            {result.rowsSkippedNote && (
                              <p className="text-xs text-amber-600 mt-0.5">{result.rowsSkippedNote}</p>
                            )}
                          </>
                        )}
                        {result.backupKey && result.backupKey !== 'none' && (
                          <p className="text-xs text-green-700 mt-2">
                            Backup created
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
            <div className="mt-8 text-center space-y-2">
              <p className="text-sm text-gray-600">
                Need a template?{' '}
                <a href="/supplier/stock/template" className="text-blue-600 hover:underline font-medium" download>
                  Download general format (CSV)
                </a>
              </p>
              <p className="text-xs text-gray-500">
                CSV — can be opened in Excel. Optional columns can be left empty.
              </p>
            </div>
          </div>

        {/* 
        COMMENTED OUT - Manage Items Tab
        This functionality is now handled on the main dashboard at /supplier/dashboard
        All the manage items functionality including search, pagination, add/edit/delete
        has been moved to the dashboard for a unified stock management experience.
        */}
      </div>
    </div>
  );
}
