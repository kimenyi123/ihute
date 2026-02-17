"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileSpreadsheet,
  Download,
  Upload,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { downloadTemplate, importExcel, B2BApiError } from "@/lib/b2bApi";

export default function B2BBulkPage() {
  const router = useRouter();
  const { user, isAuthenticated, hasHydrated } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ draftOrderId: number; batchId: string } | null>(null);

  useEffect(() => {
    // CRITICAL: Wait for auth store to rehydrate from localStorage
    if (!hasHydrated) {
      return; // Don't check auth yet - store is still loading
    }

    console.log("Auth check:", { isAuthenticated, user, userRole: user?.role });
    if (!isAuthenticated || (user?.role as string) !== "supplier") {
      console.log("Redirecting to login - auth failed");
      router.push("/login");
      return;
    }

    // Periodic session check every 30 seconds
    const interval = setInterval(() => {
      const { isAuthenticated: currentAuth, user: currentUser } = useAuthStore.getState();
      if (!currentAuth || (currentUser?.role as string) !== "supplier") {
        console.log("Session expired - redirecting to login");
        router.push("/login");
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [hasHydrated, isAuthenticated, user?.role, router]);

  const handleDownloadTemplate = async () => {
    try {
      const blob = await downloadTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `b2b_template_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      // Show success popup
      alert("✅ Template downloaded successfully!");
    } catch (err: any) {
      console.error("Download template error:", err);
      if (err instanceof B2BApiError && err.status === 401) {
        router.push("/login");
        return;
      }
      setError("❌ Failed to download template. Please try again.");
      // Show failure popup
      alert("❌ Download failed: " + (err.message || "Please try again."));
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
      ];

      if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls)$/i)) {
        setError("Please select a valid Excel file (.xlsx or .xls)");
        return;
      }

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        setError("File size must be less than 5MB");
        return;
      }

      setSelectedFile(file);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Please select a file first");
      alert("❌ Please select a file first");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const result = await importExcel(selectedFile);
      setSuccess({
        draftOrderId: result.draftOrderId,
        batchId: result.batchId,
      });

      // Show success popup
      alert(`✅ Excel uploaded successfully! ${result.rowsImported || 0} items imported. Redirecting to review...`);

      // Redirect to draft review page after a short delay
      setTimeout(() => {
        router.push(`/supplier/b2b/draft/${result.draftOrderId}`);
      }, 2000);

    } catch (err: any) {
      console.error("Upload error:", err);
      if (err instanceof B2BApiError) {
        if (err.status === 401) {
          router.push("/login");
          return;
        }
        setError(err.message);
        alert(`❌ Upload failed: ${err.message}`);
      } else {
        setError("Upload failed. Please try again.");
        alert("❌ Upload failed. Please try again.");
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const files = event.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      const syntheticEvent = {
        target: { files: [file] }
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileSelect(syntheticEvent);
    }
  };

  if (success) {
    console.log("[REDIRECT DEBUG] Success state:", success);
    console.log("[REDIRECT DEBUG] Will redirect to:", `/supplier/b2b/draft/${success.draftOrderId}`);

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Excel Imported Successfully!
            </h2>
            <p className="text-slate-600 mb-4">
              Items imported and ready for review
            </p>
            <p className="text-sm text-slate-500 mb-4">
              Redirecting to draft review page...
            </p>

            {/* Manual redirect button */}
            <Button
              onClick={() => router.push(`/supplier/b2b/draft/${success.draftOrderId}`)}
              className="w-full"
            >
              Go to Draft Review
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b shadow-sm mb-6">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/supplier/b2b">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to B2B
              </Button>
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">
            Bulk Excel Upload / Kurangura byinshi
          </h1>
          <p className="text-slate-600 mt-2">
            Upload your shopping list and we'll match suppliers automatically
          </p>
        </div>
      </div>

      <div className="container mx-auto px-6 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Download Template */}
          <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Download className="h-6 w-6 text-blue-600" />
                Step 1: Download Template
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 mb-4">
                Start with our Excel template to ensure your data is formatted correctly.
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-blue-900 mb-2">Required Columns:</h4>
                <ul className="space-y-1 text-sm text-blue-800">
                  <li>• <strong>NAME</strong> - Item name (required)</li>
                  <li>• <strong>QTE</strong> - Quantity needed (required)</li>
                  <li>• <strong>CODE</strong> - Item code (optional)</li>
                  <li>• <strong>KEYWORDS</strong> - Search terms (optional)</li>
                </ul>
              </div>

              <Button
                onClick={handleDownloadTemplate}
                className="w-full gap-2"
                variant="outline"
              >
                <Download className="h-4 w-4" />
                Download Excel Template
              </Button>
            </CardContent>
          </Card>

          {/* Upload File */}
          <Card className="bg-gradient-to-br from-green-50 to-white border-green-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Upload className="h-6 w-6 text-green-600" />
                Step 2: Upload File
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 mb-4">
                Upload your completed Excel file with up to 500 items.
              </p>

              {/* File Drop Zone */}
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${selectedFile
                  ? 'border-green-400 bg-green-50'
                  : 'border-slate-300 hover:border-slate-400'
                  }`}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-slate-400" />

                {selectedFile ? (
                  <div>
                    <p className="font-semibold text-slate-900 mb-2">
                      {selectedFile.name}
                    </p>
                    <p className="text-sm text-slate-600">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      variant="outline"
                      size="sm"
                      className="mt-3"
                    >
                      Choose Different File
                    </Button>
                  </div>
                ) : (
                  <div>
                    <p className="text-slate-600 mb-4">
                      Drag and drop your Excel file here, or click to browse
                    </p>
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      variant="outline"
                    >
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Select Excel File
                    </Button>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* Error Display */}
              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-800">
                    <AlertCircle className="h-4 w-4" />
                    <span className="font-medium">Upload Error</span>
                  </div>
                  <p className="text-red-700 text-sm mt-1">{error}</p>
                </div>
              )}

              {/* Upload Button */}
              {selectedFile && (
                <Button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="w-full mt-4 gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading and Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Upload and Create Draft
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Instructions */}
        <Card className="mt-8 bg-slate-50 border-slate-200">
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
              <div>
                <div className="font-semibold text-slate-900 mb-2">1. Download Template</div>
                <p className="text-slate-600">
                  Get the pre-formatted Excel file with the correct columns and sample data.
                </p>
              </div>
              <div>
                <div className="font-semibold text-slate-900 mb-2">2. Fill Your List</div>
                <p className="text-slate-600">
                  Add your items, quantities, and optional codes. Save as .xlsx or .xls.
                </p>
              </div>
              <div>
                <div className="font-semibold text-slate-900 mb-2">3. Upload & Review</div>
                <p className="text-slate-600">
                  Upload your file. We'll match suppliers and create a draft for your review.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
