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
import { useAuthStore } from "@/lib/auth-store"
import type { UserRole } from "@/lib/auth-store"
import Image from "next/image"
import { FileSpreadsheet, ArrowLeft, ArrowRight, CheckCircle } from "lucide-react"
import { RWANDA_DISTRICTS } from "@/lib/constants"
import { GPSCapture } from "@/components/gps-capture"

type FormRole = "buyer" | "seller"

const BUSINESS_SECTORS = [
  "pharmacy", "liquor store", "boutique", "bar/restaurant",
  "supermarket", "coffee shop", "pizzeria", "electronics",
]

const DELIVERY_MODES = [
  { value: "delivery", label: "Delivery (we deliver to customers)" },
  { value: "pickup",   label: "Pickup only (customers come to us)" },
  { value: "both",     label: "Both delivery & pickup" },
]

const log = (tag: string, msg: string, data?: any) => {
  const timestamp = new Date().toISOString().split("T")[1].slice(0, 8)
  if (data !== undefined) console.log(`[${timestamp}] [${tag}] ${msg}`, data)
  else console.log(`[${timestamp}] [${tag}] ${msg}`)
}

export default function RegisterPage() {
  const router = useRouter()
  const login = useAuthStore((state) => state.login)
  const [role, setRole] = useState<FormRole>("buyer")
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({
    // shared
    name: "", email: "", phone: "", password: "", location: "",
    // seller-specific
    companyName: "",
    sector: "",
    tin: "",
    deliveryMode: "",
    momoCode: "",
    // GPS
    latitude:    null as number | null,
    longitude:   null as number | null,
    gpsAccuracy: null as number | null,
  })
  const [loading, setLoading] = useState(false)
  const [excelFile, setExcelFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showPendingModal, setShowPendingModal] = useState(false)

  const totalSteps = role === "seller" ? 3 : 2

  const set = (field: string, value: any) =>
    setFormData(prev => ({ ...prev, [field]: value }))

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const rid = crypto.randomUUID()
    log("REGISTER", `START [RID ${rid}] role=${role}`)

    try {
      const [firstName, ...rest] = formData.name.trim().split(" ")
      const lastName = rest.join(" ")

      const payload: any = {
        email: formData.email,
        password: formData.password,
        firstName,
        lastName,
        tel: formData.phone,
        location: formData.location,
        role: role === "seller" ? "SELLER" : "BUYER",
      }

      if (role === "seller") {
        // seller-specific fields the InsertSuppliers servlet needs
        payload.companyName  = formData.companyName
        payload.sector       = formData.sector
        payload.tin          = formData.tin
        payload.deliveryMode = formData.deliveryMode
        payload.momoCode     = formData.momoCode
        if (formData.latitude  != null) payload.latitude    = formData.latitude
        if (formData.longitude != null) payload.longitude   = formData.longitude
        if (formData.gpsAccuracy != null) payload.gpsAccuracy = formData.gpsAccuracy
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

      if (role === "seller") {
        setShowPendingModal(true)
      } else {
        const storeRole: UserRole = "customer"
        const newUser = {
          id: json.user.email,
          email: json.user.email,
          name: formData.name,
          role: storeRole,
          phone: formData.phone,
          location: formData.location,
          ishyigaAccount: json.ishyiga,
        }
        login(newUser)
        router.push("/")
      }
    } catch (err: any) {
      setError(err?.message || "Network error")
    } finally {
      setLoading(false)
      log("REGISTER", "END")
    }
  }

  // ── Step validation ───────────────────────────────────────────────────────
  const handleNext = () => {
    if (currentStep === 1) {
      if (!formData.name || !formData.email || !formData.phone || !formData.password || !formData.location) {
        setError("Please fill in all fields"); return
      }
    }
    if (currentStep === 2 && role === "seller") {
      if (!formData.companyName || !formData.sector || !formData.tin || !formData.deliveryMode) {
        setError("Please fill in all required business fields"); return
      }
    }
    setError(null)
    setCurrentStep(prev => Math.min(prev + 1, totalSteps))
  }

  const handleBack = () => { setError(null); setCurrentStep(prev => Math.max(prev - 1, 1)) }

  const handleLocationSet = (lat: number, lng: number, accuracy: number) => {
    setFormData(prev => ({ ...prev, latitude: lat, longitude: lng, gpsAccuracy: accuracy }))
  }

  const downloadTemplate = () => {
    const a = document.createElement("a")
    a.href = "/templates/product-upload-template.xlsx"
    a.download = "product-upload-template.xlsx"
    a.click()
  }

  // ── Step indicator ────────────────────────────────────────────────────────
  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-6 gap-2">
      {Array.from({ length: totalSteps }).map((_, idx) => (
        <div key={idx} className="flex items-center">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2
            ${idx + 1 < currentStep  ? "bg-blue-600 border-blue-600 text-white" :
              idx + 1 === currentStep ? "border-blue-600 text-blue-600" :
                                        "border-gray-300 text-gray-400"}`}>
            {idx + 1 < currentStep ? <CheckCircle className="h-4 w-4" /> : idx + 1}
          </div>
          {idx < totalSteps - 1 && (
            <div className={`w-12 h-0.5 mx-2 ${idx + 1 < currentStep ? "bg-blue-600" : "bg-gray-300"}`} />
          )}
        </div>
      ))}
    </div>
  )

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-2xl space-y-4">
        <Link href="/"><Button variant="ghost" size="sm" className="gap-2"><ArrowLeft className="h-4 w-4" />Back to Home</Button></Link>

        <Card className="w-full">
          <CardHeader className="space-y-4 text-center">
            <div className="flex justify-center">
              <Image src="/images/ishyiga-logo.png" alt="Ishyiga Software" width={200} height={60} className="h-12 w-auto" />
            </div>
            <CardTitle className="text-2xl">Create Account</CardTitle>
            <CardDescription>Join ihute.rw marketplace today</CardDescription>
          </CardHeader>

          <CardContent>
            {renderStepIndicator()}

            <form id="registration-form" onSubmit={handleSubmit} className="space-y-4">

              {/* ── Step 1: Personal info (shared) ── */}
              {currentStep === 1 && (
                <>
                  <div className="space-y-3">
                    <Label>I am a</Label>
                    <RadioGroup value={role} onValueChange={(v) => setRole(v as FormRole)}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="buyer"  id="buyer"  />
                        <Label htmlFor="buyer"  className="cursor-pointer">Customer (Buy products)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="seller" id="seller" />
                        <Label htmlFor="seller" className="cursor-pointer">Supplier (Sell products)</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" placeholder="John Doe" value={formData.name}
                      onChange={(e) => set("name", e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="your@email.com" value={formData.email}
                      onChange={(e) => set("email", e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input id="phone" type="tel" placeholder="+250788123456" value={formData.phone}
                      onChange={(e) => set("phone", e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Select value={formData.location} onValueChange={(v) => set("location", v)}>
                      <SelectTrigger><SelectValue placeholder="Select your district" /></SelectTrigger>
                      <SelectContent>
                        {RWANDA_DISTRICTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" placeholder="Create a password" value={formData.password}
                      onChange={(e) => set("password", e.target.value)} required />
                  </div>
                </>
              )}

              {/* ── Step 2 (Seller): Business details → InsertSuppliers fields ── */}
              {currentStep === 2 && role === "seller" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Business / Company Name <span className="text-destructive">*</span></Label>
                    <Input id="companyName" placeholder="e.g. Kigali Pharma Ltd" value={formData.companyName}
                      onChange={(e) => set("companyName", e.target.value)} required />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sector">Business Sector <span className="text-destructive">*</span></Label>
                    <Select value={formData.sector} onValueChange={(v) => set("sector", v)}>
                      <SelectTrigger><SelectValue placeholder="Select sector" /></SelectTrigger>
                      <SelectContent>
                        {BUSINESS_SECTORS.map((s) => (
                          <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tin">TIN Number <span className="text-destructive">*</span></Label>
                    <Input id="tin" placeholder="e.g. 102345678" value={formData.tin}
                      onChange={(e) => set("tin", e.target.value)} required />
                    <p className="text-xs text-muted-foreground">Your Rwanda Revenue Authority TIN</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="deliveryMode">Delivery Mode <span className="text-destructive">*</span></Label>
                    <Select value={formData.deliveryMode} onValueChange={(v) => set("deliveryMode", v)}>
                      <SelectTrigger><SelectValue placeholder="How do you deliver?" /></SelectTrigger>
                      <SelectContent>
                        {DELIVERY_MODES.map((d) => (
                          <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="momoCode">MoMo Pay Code <span className="text-muted-foreground text-xs">(optional)</span></Label>
                    <Input id="momoCode" placeholder="e.g. *182*8*1*123456#" value={formData.momoCode}
                      onChange={(e) => set("momoCode", e.target.value)} />
                    <p className="text-xs text-muted-foreground">Your MTN Mobile Money merchant code</p>
                  </div>

                  {/* Optional product upload */}
                  <div className="space-y-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Upload Product Catalogue <span className="text-muted-foreground">(optional)</span></Label>
                      <Button type="button" variant="ghost" size="sm" onClick={downloadTemplate}
                        className="h-auto p-0 text-xs text-primary hover:underline">
                        <FileSpreadsheet className="mr-1 h-3 w-3" />Download Template
                      </Button>
                    </div>
                    <Input type="file" accept=".xlsx,.xls,.csv"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f && /\.(xlsx|xls|csv)$/i.test(f.name)) setExcelFile(f)
                      }} className="cursor-pointer" />
                    {excelFile && (
                      <p className="text-xs text-green-600">
                        <FileSpreadsheet className="mr-1 inline h-3 w-3" />{excelFile.name}
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* ── Step 3 (Seller): GPS  |  Step 2 (Buyer): Confirm ── */}
              {((currentStep === 3 && role === "seller") || (currentStep === 2 && role === "buyer")) && (
                role === "seller" ? (
                  <div className="space-y-4">
                    <div className="text-center space-y-2">
                      <h3 className="text-lg font-semibold">Set Your Business Location</h3>
                      <p className="text-sm text-gray-600">Help customers find you by pinning your exact address</p>
                    </div>
                    <GPSCapture onLocationSet={handleLocationSet}
                      initialLat={formData.latitude ?? undefined}
                      initialLng={formData.longitude ?? undefined} />
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Ready to Create Your Account</h3>
                    <p className="text-sm text-gray-600">Click below to complete your registration</p>
                  </div>
                )
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}

              {/* Navigation */}
              <div className="flex gap-3">
                {currentStep > 1 && (
                  <Button type="button" onClick={handleBack} variant="outline" className="flex-1">
                    <ArrowLeft className="h-4 w-4 mr-2" />Back
                  </Button>
                )}
                {currentStep < totalSteps && (
                  <Button type="button" onClick={handleNext} className="flex-1">
                    Next<ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
                {currentStep === totalSteps && (role === "buyer" || (role === "seller" && formData.latitude)) && (
                  <Button type="submit" className="flex-1" disabled={loading}>
                    {loading ? "Creating account..." : "Create Account"}
                  </Button>
                )}
              </div>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login" className="text-primary hover:underline font-medium">Sign in</Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Seller pending modal */}
      {showPendingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-yellow-600" />
              </div>
              <CardTitle className="text-2xl">Application Submitted!</CardTitle>
              <CardDescription className="text-base">Your seller application is under review</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                <p className="text-sm text-blue-900 font-medium">📋 What happens next?</p>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>Our admin team will review your application</li>
                  <li>We'll verify your business details and TIN</li>
                  <li>You'll receive an email once approved</li>
                  <li>Approval typically takes 24–48 hours</li>
                </ul>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-1">
                <p className="text-sm font-medium text-gray-900">📧 Application Details:</p>
                <p className="text-sm text-gray-600">Email: {formData.email}</p>
                <p className="text-sm text-gray-600">Business: {formData.companyName}</p>
                <p className="text-sm text-gray-600">Sector: {formData.sector}</p>
                <p className="text-sm text-gray-600">TIN: {formData.tin}</p>
              </div>
              <Button onClick={() => router.push("/login")} className="w-full">Go to Login</Button>
              <p className="text-xs text-center text-gray-500">You'll be able to log in once your account is approved</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
