"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/auth-store"
import { useProductStore } from "@/lib/product-store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Upload, Download } from "lucide-react"
import Link from "next/link"

export default function BulkUploadPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const addProduct = useProductStore((state) => state.addProduct)
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (!file) return

    setLoading(true)

    // Simulate CSV parsing and product upload
    // In production, you would parse the CSV and add products
    setTimeout(() => {
      // Mock data - in production, parse CSV file
      const mockProducts = [
        { name: "Paracetamol 500mg", category: "Pharmacy", price: 500, unit: "piece", stock: 100 },
        { name: "Ibuprofen 400mg", category: "Pharmacy", price: 800, unit: "piece", stock: 150 },
        { name: "Vitamin C", category: "Pharmacy", price: 1200, unit: "bottle", stock: 50 },
      ]

      mockProducts.forEach((product) => {
        addProduct({
          ...product,
          supplierId: user!.id,
          supplierName: user!.businessName || user!.name,
          supplierLocation: user!.location,
        })
      })

      setLoading(false)
      router.push("/supplier/dashboard")
    }, 2000)
  }

  const downloadTemplate = () => {
    // Create CSV template
    const csvContent =
      "name,category,price,unit,stock,description\nParacetamol 500mg,Pharmacy,500,piece,100,Pain relief medication\n"
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "product-template.csv"
    a.click()
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Link href="/supplier/dashboard">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>Bulk Upload Products</CardTitle>
            <CardDescription>Upload multiple products using a CSV file</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">Step 1: Download Template</h3>
                <Button variant="outline" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Download CSV Template
                </Button>
              </div>

              <div>
                <h3 className="font-medium mb-2">Step 2: Fill in Your Products</h3>
                <p className="text-sm text-muted-foreground">
                  Open the template in Excel or Google Sheets and add your products. Make sure to follow the format.
                </p>
              </div>

              <div>
                <h3 className="font-medium mb-2">Step 3: Upload File</h3>
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" id="file-upload" />
                  <label htmlFor="file-upload">
                    <Button variant="outline" asChild>
                      <span>Choose CSV File</span>
                    </Button>
                  </label>
                  {file && <p className="mt-4 text-sm text-muted-foreground">Selected: {file.name}</p>}
                </div>
              </div>
            </div>

            <Button onClick={handleUpload} disabled={!file || loading} className="w-full">
              {loading ? "Uploading..." : "Upload Products"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
