"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuthStore, type UserRole } from "@/lib/auth-store"
import Image from "next/image"
import { FileSpreadsheet, ArrowLeft } from "lucide-react"
import { RWANDA_DISTRICTS } from "@/lib/constants"

const BUSINESS_CATEGORIES = [
  "Pharmacy", "Liquor Store", "Boutique", "Bar/Restaurant", "Supermarket", "Coffee Shop", "Pizzeria", "Electronics",
]

// --- LOGGING UTILITY ---
const log = (tag: string, msg: string, data?: any) => {
  const timestamp = new Date().toISOString().split("T")[1].slice(0, 8)
  if (data !== undefined) console.log(`[${timestamp}] [${tag}] ${msg}`, data)
  else console.log(`[${timestamp}] [${tag}] ${msg}`)
}

export default function RegisterPage() {
  const router = useRouter()
  const login = useAuthStore((state) => state.login)
  const [role, setRole] = useState<UserRole>("customer")
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    location: "",
    businessName: "",
    businessCategory: "",
  })
  const [loading, setLoading] = useState(false)
  const [excelFile, setExcelFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const rid = crypto.randomUUID()
    log("REGISTER", `START [RID ${rid}]`)
    log("REGISTER", `Role: ${role}`)

    try {
      const [firstName, ...rest] = formData.name.split(" ")
      const lastName = rest.join(" ")

      const payload = {
        email: formData.email,
        password: formData.password,
        firstName,
        lastName,
        tel: formData.phone,
        location: formData.location,
        role: role === "supplier" ? "SELLER" : "BUYER",
      }

      log("REGISTER", "Sending to /api/auth/register", payload)

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const json = await res.json().catch(async () => {
        const text = await res.text()
        throw new Error(`Bad JSON: ${text.substring(0, 200)}`)
      })

      if (!res.ok || !json?.ok) throw new Error(json?.error || "Registration failed")

      const newUser = {
        id: json.user.email,
        email: json.user.email,
        name: formData.name,
        role,
        phone: formData.phone,
        location: formData.location,
        ishyigaAccount: json.ishyiga,
        ...(role === "supplier" && {
          businessName: formData.businessName,
          businessCategory: formData.businessCategory,
        }),
      }

      login(newUser)
      router.push(role === "supplier" ? "/supplier/dashboard" : "/")
    } catch (err: any) {
      setError(err?.message || "Network error")
    } finally {
      setLoading(false)
      log("REGISTER", "END")
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && /\.(xlsx|xls|csv)$/i.test(file.name)) {
      setExcelFile(file)
      log("REGISTER", `File selected: ${file.name}`)
    }
  }

  const downloadTemplate = () => {
    const link = document.createElement("a")
    link.href = "/templates/product-upload-template.xlsx"
    link.download = "product-upload-template.xlsx"
    link.click()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Back to Home Button */}
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
        </Link>

        <Card className="w-full">
          <CardHeader className="space-y-4 text-center">
            <div className="flex justify-center">
              <Image
                src="/images/ishyiga-logo.png"
                alt="Ishyiga Software"
                width={200}
                height={60}
                className="h-12 w-auto"
              />
            </div>
            <CardTitle className="text-2xl">Create Account</CardTitle>
            <CardDescription>Join ihute.rw marketplace today</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Role selection */}
              <div className="space-y-3">
                <Label>I am a</Label>
                <RadioGroup
                  value={role}
                  onValueChange={(value) => setRole(value as UserRole)}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="customer" id="customer" />
                    <Label htmlFor="customer" className="cursor-pointer">
                      Customer (Buy products)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="supplier" id="supplier" />
                    <Label htmlFor="supplier" className="cursor-pointer">
                      Supplier (Sell products)
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Common fields */}
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+250788123456"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Select
                  value={formData.location}
                  onValueChange={(value) => setFormData({ ...formData, location: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your district" />
                  </SelectTrigger>
                  <SelectContent>
                    {RWANDA_DISTRICTS.map((dist) => (
                      <SelectItem key={dist} value={dist}>
                        {dist}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Supplier-specific fields */}
              {role === "supplier" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="businessName">Business Name</Label>
                    <Input
                      id="businessName"
                      placeholder="My Store"
                      value={formData.businessName}
                      onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="businessCategory">Business Category</Label>
                    <Select
                      value={formData.businessCategory}
                      onValueChange={(value) => setFormData({ ...formData, businessCategory: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {BUSINESS_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Upload Products (Optional)</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={downloadTemplate}
                        className="h-auto p-0 text-xs text-primary hover:underline"
                      >
                        <FileSpreadsheet className="mr-1 h-3 w-3" />
                        Download Template
                      </Button>
                    </div>
                    <Input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileChange}
                      className="cursor-pointer"
                    />
                    {excelFile && (
                      <p className="mt-2 text-xs text-green-600">
                        <FileSpreadsheet className="mr-1 inline h-3 w-3" />
                        {excelFile.name}
                      </p>
                    )}
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Create a password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating account..." : "Create Account"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login" className="text-primary hover:underline font-medium">
                  Sign in
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
