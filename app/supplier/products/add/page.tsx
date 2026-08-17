'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react';
import { 
  importStockExcel, 
  ImportResult
} from '@/lib/supplierStockApi';
import { useAuthStore } from '@/lib/auth-store';
import { useLanguageStore, type Language } from '@/lib/language-store';

const STOCK_UPLOAD_UI: Record<Language, {
  alertExcelFile: string;
  alertFileSize: string;
  alertNoAccount: string;
  pageTitle: string;
  pageSubtitle: string;
  bulkUploadTitle: string;
  bulkUploadDesc: string;
  fileFormatTitle: string;
  supportedFormats: string;
  generalFormat: string;
  limits: string;
  selectExcelFile: string;
  selectedFile: string;
  uploadImport: string;
  importing: string;
  parsingNote: string;
  failedUpload: string;
  viewStock: string;
  backupCreated: string;
  errors: string;
  itemsAdded: string;
  itemsUpdated: string;
  rowsParsed: string;
  rowsSkipped: string;
  needTemplate: string;
  downloadCsv: string;
  csvNote: string;
}> = {
  en: {
    alertExcelFile: "Please select an Excel file (.xlsx, .xls) or CSV file (.csv)",
    alertFileSize: "File size must be less than 5MB",
    alertNoAccount: "No account found. Please log in again.",
    pageTitle: "Product Stock Management",
    pageSubtitle: "Upload Excel inventory or manage individual items",
    bulkUploadTitle: "Bulk Excel Upload",
    bulkUploadDesc: "Upload multiple products at once using Excel or CSV files",
    fileFormatTitle: "File Format Requirements",
    supportedFormats: "Supported formats",
    generalFormat: "General format",
    limits: "Max 5MB file size, 10,000 rows",
    selectExcelFile: "Select Excel File",
    selectedFile: "Selected file:",
    uploadImport: "Upload & Import",
    importing: "Importing…",
    parsingNote: "Parsing file and saving to your stock (database + search). Large menus (500+ items) may take 1–3 minutes — keep this tab open.",
    failedUpload: "Failed to upload file",
    viewStock: "View your stock on the dashboard →",
    backupCreated: "Backup created",
    errors: "Errors:",
    itemsAdded: "Items added",
    itemsUpdated: "Items updated",
    rowsParsed: "Rows parsed",
    rowsSkipped: "Rows skipped (invalid)",
    needTemplate: "Need a template?",
    downloadCsv: "Download general format (CSV)",
    csvNote: "CSV — can be opened in Excel. Optional columns can be left empty.",
  },
  rw: {
    alertExcelFile: "Hitamo dosiye ya Excel (.xlsx, .xls) cyangwa CSV (.csv)",
    alertFileSize: "Ingano ya dosiye igomba kuba munsi ya 5MB",
    alertNoAccount: "Nta konti yabonetse. Ongera winjire.",
    pageTitle: "Gucunga Sitoki y'Ibicuruzwa",
    pageSubtitle: "Ohereza sitoki ya Excel cyangwa ucunge ibicuruzwa ku giti cyabyo",
    bulkUploadTitle: "Ohereza Excel Byinshi Icyarimwe",
    bulkUploadDesc: "Ohereza ibicuruzwa byinshi icyarimwe ukoresheje Excel cyangwa CSV",
    fileFormatTitle: "Ibisabwa ku Bwoko bwa Dosiye",
    supportedFormats: "Ubwoko bwemewe",
    generalFormat: "Imiterere rusange",
    limits: "Ntarengwa: 5MB, imirongo 10,000",
    selectExcelFile: "Hitamo Dosiye ya Excel",
    selectedFile: "Dosiye yahiswemo:",
    uploadImport: "Ohereza & Injiza",
    importing: "Birinjizwa…",
    parsingNote: "Dosiye irasomwa kandi ibikwa muri sitoki yawe. Menyu nini (500+) ishobora gufata iminota 1–3 — sigara kuri iyi paji.",
    failedUpload: "Kohereza dosiye byanze",
    viewStock: "Reba sitoki yawe kuri dashboard →",
    backupCreated: "Kopi y'umutekano yakozwe",
    errors: "Amakosa:",
    itemsAdded: "Ibicuruzwa byongeywe",
    itemsUpdated: "Ibicuruzwa byavuguruwe",
    rowsParsed: "Imirongo yasomwe",
    rowsSkipped: "Imirongo yasimbukiwe (itari nziza)",
    needTemplate: "Ukeneye umugereka?",
    downloadCsv: "Kuramo imiterere rusange (CSV)",
    csvNote: "CSV — ishobora gufungurwa muri Excel. Koloni zidakenewe zishobora gusigara ubusa.",
  },
  fr: {
    alertExcelFile: "Veuillez sélectionner un fichier Excel (.xlsx, .xls) ou CSV (.csv)",
    alertFileSize: "La taille du fichier doit être inférieure à 5 Mo",
    alertNoAccount: "Aucun compte trouvé. Veuillez vous reconnecter.",
    pageTitle: "Gestion du stock produits",
    pageSubtitle: "Importez un inventaire Excel ou gérez les articles individuellement",
    bulkUploadTitle: "Import Excel en masse",
    bulkUploadDesc: "Importez plusieurs produits à la fois via des fichiers Excel ou CSV",
    fileFormatTitle: "Exigences de format de fichier",
    supportedFormats: "Formats pris en charge",
    generalFormat: "Format général",
    limits: "Taille max 5 Mo, 10 000 lignes",
    selectExcelFile: "Sélectionner un fichier Excel",
    selectedFile: "Fichier sélectionné :",
    uploadImport: "Importer",
    importing: "Importation…",
    parsingNote: "Analyse et enregistrement dans votre stock (base de données + recherche). Les menus volumineux (500+ articles) peuvent prendre 1 à 3 minutes — gardez cet onglet ouvert.",
    failedUpload: "Échec du téléversement",
    viewStock: "Voir votre stock sur le tableau de bord →",
    backupCreated: "Sauvegarde créée",
    errors: "Erreurs :",
    itemsAdded: "Articles ajoutés",
    itemsUpdated: "Articles mis à jour",
    rowsParsed: "Lignes analysées",
    rowsSkipped: "Lignes ignorées (invalides)",
    needTemplate: "Besoin d'un modèle ?",
    downloadCsv: "Télécharger le format général (CSV)",
    csvNote: "CSV — peut être ouvert dans Excel. Les colonnes optionnelles peuvent être laissées vides.",
  },
};

export default function SupplierStockUploadPage() {
  const router = useRouter();
  const { isAuthenticated, checkSession } = useAuthStore();
  const language = useLanguageStore((s) => s.language);
  const ui = STOCK_UPLOAD_UI[language] ?? STOCK_UPLOAD_UI.en;
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const resultAnchorRef = useRef<HTMLDivElement | null>(null);

  const scrollToResults = () => {
    requestAnimationFrame(() => {
      resultAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const goToDashboardStock = (count: number) => {
    router.push(`/supplier/dashboard?stockImport=1&count=${encodeURIComponent(String(count))}`);
  };

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

  useEffect(() => {
    return () => {
      uploadAbortRef.current?.abort();
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const fileName = selectedFile.name.toLowerCase();
      if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls') && !fileName.endsWith('.csv')) {
        alert(ui.alertExcelFile);
        return;
      }
      if (selectedFile.size > 5 * 1024 * 1024) {
        alert(ui.alertFileSize);
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
      alert(ui.alertNoAccount);
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
          message: ui.failedUpload,
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
          <h1 className="text-3xl font-bold text-gray-900">{ui.pageTitle}</h1>
          <p className="text-gray-600 mt-2">
            {ui.pageSubtitle}
          </p>
        </div>

        {/* Header - Excel Upload Only */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="border-b border-gray-200">
            <div className="px-4 sm:px-6 py-4">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <FileSpreadsheet className="w-6 h-6 text-blue-600" />
                {ui.bulkUploadTitle}
              </h2>
              <p className="text-gray-600 mt-1">
                {ui.bulkUploadDesc}
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
                {ui.fileFormatTitle}
              </h2>
              <ul className="space-y-2 text-sm text-blue-800">
                <li>• <strong>{ui.supportedFormats}</strong>: Excel (.xlsx) or CSV (.csv)</li>
                <li>• <strong>{ui.generalFormat}</strong>: CATEGORY, SUBCATEGORY, ITEM, QTE, PRICE (RWF), COST PRICE, FRENCH, KINYARWANDA, IMAGE LINK, KEYWORDS — required: ITEM, QTE, PRICE</li>
              </ul>
              <div className="mt-4 text-sm text-blue-700">
                <strong>Limits:</strong> {ui.limits}
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
                  {ui.selectExcelFile}
                </label>

                {file && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-600">{ui.selectedFile}</p>
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
                        {ui.importing}
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5 inline mr-2" />
                        {ui.uploadImport}
                      </>
                    )}
                  </button>
                {uploading && (
                  <p className="mt-2 text-sm text-gray-500">
                    {ui.parsingNote}
                  </p>
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
                          <p>✓ {ui.itemsAdded}: {result.itemsImported}</p>
                        )}
                        {(result.itemsUpdated ?? 0) > 0 && (
                          <p>✓ {ui.itemsUpdated}: {result.itemsUpdated}</p>
                        )}
                        <p>✓ {ui.rowsParsed}: {result.rowsParsed}</p>
                        {(result.rowsSkipped ?? 0) > 0 && (
                          <>
                            <p className="text-amber-700">⚠ {ui.rowsSkipped}: {result.rowsSkipped}</p>
                            {result.rowsSkippedNote && (
                              <p className="text-xs text-amber-600 mt-0.5">{result.rowsSkippedNote}</p>
                            )}
                          </>
                        )}
                        {result.backupKey && result.backupKey !== 'none' && (
                          <p className="text-xs text-green-700 mt-2">
                            {ui.backupCreated}
                          </p>
                        )}
                        <p className="mt-3">
                          <a
                            href="/supplier/dashboard"
                            className="font-semibold text-green-900 underline underline-offset-2"
                          >
                            {ui.viewStock}
                          </a>
                        </p>
                      </div>
                    )}

                    {!result.ok && result.errors && result.errors.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-medium text-red-800 mb-2">{ui.errors}</p>
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
                {ui.needTemplate}{' '}
                <a href="/supplier/stock/template" className="text-blue-600 hover:underline font-medium" download>
                  {ui.downloadCsv}
                </a>
              </p>
              <p className="text-xs text-gray-500">
                {ui.csvNote}
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
