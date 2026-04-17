"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/auth-store"
import { useAuthPersistHydrated } from "@/lib/use-auth-persist-hydrated"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload, FileSpreadsheet, Loader2 } from "lucide-react"
import Link from "next/link"

const DATA_TYPES = [
  { value: "sales", label: "Sales", description: "Invoice Date, Sales Value, VAT, Supplier ID, Business ID" },
  { value: "purchase", label: "Purchase", description: "Supplier TIN, Name, Receipt Date, Amount, VAT, Business Owner ID" },
  { value: "financial", label: "Financial", description: "TransDate, JournalId, Debit, Credit, Balance, Business ID" },
  { value: "supplier", label: "Supplier", description: "Phone, Name, Location, Aggr, TIN, Email" },
] as const

type DataType = (typeof DATA_TYPES)[number]["value"]

export default function UmusadaExcelUploadPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()
  const authHydrated = useAuthPersistHydrated()
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [dataType, setDataType] = useState<DataType>("sales")
  const [result, setResult] = useState<{ ok: boolean; message?: string; sent?: number; errors?: string[]; error?: string } | null>(null)

  useEffect(() => {
    if (!authHydrated) return
    if (!isAuthenticated) {
      router.push("/login")
    }
  }, [authHydrated, isAuthenticated, router])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0]
      const ext = f.name.toLowerCase().slice(-5)
      if (!ext.endsWith(".xlsx") && !ext.endsWith(".xls")) {
        setResult({ ok: false, error: "Please select an Excel file (.xlsx or .xls)" })
        return
      }
      setFile(f)
      setResult(null)
    }
  }

  const handleUpload = async () => {
    if (!file) return
    setLoading(true)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("dataType", dataType)
      const res = await fetch("/api/umusada/send-excel", {
        method: "POST",
        body: formData,
      })
      const data = await res.json().catch(() => ({}))
      if (data.ok) {
        setResult({
          ok: true,
          message: data.message || `Sent ${data.sent} ${dataType} record(s) to Umusada.`,
          sent: data.sent,
          errors: data.errors,
        })
      } else {
        const serverError = data.error || data.message || (typeof data.hint === "string" ? data.hint : null)
        const statusHint = !res.ok ? ` (${res.status})` : ""
        setResult({
          ok: false,
          error: serverError
            ? `${serverError}${statusHint}`
            : `Upload failed${statusHint}. Check the server or try again.`,
        })
      }
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : "Network error" })
    } finally {
      setLoading(false)
    }
  }

  if (!authHydrated) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Header />
        <main className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-600">
          <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
          <p className="text-sm">Checking session…</p>
        </main>
        <Footer />
      </div>
    )
  }

  if (!isAuthenticated) return null

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />

      <main className="flex-1 container mx-auto px-6 py-8 max-w-2xl">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Umusada Excel Upload</h1>
        <p className="text-slate-600 mb-6">
          Upload Excel files to send Sales, Purchase, Financial, or Supplier data to Umusada.
        </p>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
              Select Data Type & File
            </CardTitle>
            <CardDescription>
              Choose the data type and select your Excel file (.xlsx).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-medium mb-2">Step 1: Select Data Type</h3>
              <select
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={dataType}
                onChange={(e) => setDataType(e.target.value as DataType)}
              >
                {DATA_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <p className="text-sm text-muted-foreground mt-1">
                {DATA_TYPES.find((t) => t.value === dataType)?.description}
              </p>
            </div>

            <div>
              <h3 className="font-medium mb-2">Step 2: Choose Excel File</h3>
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload">
                  <Button variant="outline" asChild>
                    <span>Choose Excel File (.xlsx)</span>
                  </Button>
                </label>
                {file && (
                  <p className="mt-4 text-sm text-muted-foreground">Selected: {file.name}</p>
                )}
              </div>
            </div>

            {result && (
              <div
                className={`rounded-lg p-4 ${
                  result.ok ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"
                }`}
              >
                {result.ok ? (
                  <>
                    <p className="font-medium">{result.message}</p>
                    {result.errors && result.errors.length > 0 && (
                      <p className="text-sm mt-2">Some errors: {result.errors.join("; ")}</p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="font-medium">Upload failed</p>
                    <p className="text-sm mt-1 break-words">{result.error}</p>
                  </>
                )}
              </div>
            )}

            <Button
              onClick={handleUpload}
              disabled={!file || loading}
              className="w-full"
            >
              {loading ? "Sending to Umusada..." : "Upload & Send to Umusada"}
            </Button>
          </CardContent>
        </Card>

        <Button variant="ghost" className="mt-6" asChild>
          <Link href="/buyer/dashboard">← Back to Dashboard</Link>
        </Button>
      </main>

      <Footer />
    </div>
  )
}
