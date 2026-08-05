"use client"

import type React from "react"
import { useState, useEffect } from "react"
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

type FormRole = "buyer" | "seller" | "rider"

export type RegisterAccountFormProps = {
  /** Default role when the form loads */
  initialRole?: FormRole
  /** Hide buyer/seller/rider switch (used when role is fixed by the page) */
  hideRolePicker?: boolean
  pageTitle?: string
  pageDescription?: string
  /** "Back" link target */
  backHref?: string
}

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

export function RegisterAccountForm({
  initialRole = "buyer",
  hideRolePicker = false,
  pageTitle,
  pageDescription,
  backHref = "/",
}: RegisterAccountFormProps) {
  const router = useRouter()
  const login = useAuthStore((state) => state.login)
  const [role, setRole] = useState<FormRole>(initialRole)
  const [currentStep, setCurrentStep] = useState(1)

  useEffect(() => {
    setRole(initialRole)
    setCurrentStep(1)
  }, [initialRole])
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
  const [fieldErrors, setFieldErrors] = useState<Record<string,string | undefined>>({})
  const [showPendingModal, setShowPendingModal] = useState(false)
  const [sellerRegisterMeta, setSellerRegisterMeta] = useState<{
    temporaryPasswordEmailed?: boolean
    usedTemporaryPassword?: boolean
    temporaryPasswordMessage?: string | null
  } | null>(null)

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
      if ((role === "buyer" || role === "rider") && !formData.password.trim()) {
        throw new Error("Please choose a password")
      }

      const [firstName, ...rest] = formData.name.trim().split(" ")
      const lastName = rest.join(" ")

      const digits = formData.phone.replace(/\D/g, "")
      const syntheticSellerEmail = digits ? `${digits}@phone-register.ihute.local` : ""
      // Normalize phone for server: accept +2507XXXXXXXX, 2507XXXXXXXX, or 07XXXXXXXX
      const normalizedForServer = ((): string | null => {
        const d = digits
        if (!d) return null
        if (d.length === 12 && d.startsWith("250") && (d[3] === "7" || d[3] === "8")) return d
        if (d.length === 9 && (d.startsWith("7") || d.startsWith("8"))) return "250" + d
        if (d.length === 10 && d.startsWith("0") && (d[1] === "7" || d[1] === "8")) return "250" + d.slice(1)
        return null
      })()

      if (!normalizedForServer) {
        throw new Error("Invalid phone number — use +2507XXXXXXXX or 07XXXXXXXX format")
      }

      const payload: any = {
        email: role === "seller" ? syntheticSellerEmail || formData.email : formData.email,
        password: formData.password,
        firstName,
        lastName,
        tel: normalizedForServer,
        location: formData.location,
        role: role === "seller" ? "SELLER" : role === "rider" ? "DRIVER" : "BUYER",
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

      if (!res.ok || !json?.ok) {
        const msg = json?.error || "Registration failed"
        const detail = json?.rawPreview ? ` Server response: ${json.rawPreview}` : ""
        throw new Error(msg + detail)
      }

      if (role === "seller") {
        setSellerRegisterMeta({
          temporaryPasswordEmailed: json.temporaryPasswordEmailed === true,
          usedTemporaryPassword: json.usedTemporaryPassword === true,
          temporaryPasswordMessage: json.temporaryPasswordMessage ?? null,
        })
        setShowPendingModal(true)
      } else {
        const storeRole: UserRole = json?.dualPharmacyRetail ? "supplier" : "customer"
        const newUser = {
          id: json.user.email,
          email: json.user.email,
          name: formData.name,
          role: storeRole,
          phone: formData.phone,
          location: formData.location,
          ishyigaAccount: json.ishyiga,
          dbRole: json?.dbRole ?? json?.role ?? (role === "rider" ? "DRIVER" : undefined),
          dualPharmacyRetail: !!json?.dualPharmacyRetail,
          pharmacySector: !!json?.pharmacySector,
        }
        login(newUser)
        router.push(role === "rider" ? "/login" : "/")
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
      const errs: Record<string,string> = {}
      if (!formData.name) errs.name = "Required"
      if (!formData.phone) errs.phone = "Required"
      // phone digits check
      const pd = formData.phone.replace(/\D/g, "")
      const okPhone = (pd.length === 12 && pd.startsWith("250") && (pd[3] === "7" || pd[3] === "8")) ||
        (pd.length === 9 && (pd.startsWith("7") || pd.startsWith("8"))) ||
        (pd.length === 10 && pd.startsWith("0") && (pd[1] === "7" || pd[1] === "8"))
      if (!okPhone) errs.phone = "Invalid phone — use +2507XXXXXXXX or 07XXXXXXXX"
      if (!formData.location) errs.location = "Required"
      if (role !== "seller" && !formData.email) errs.email = "Required"
      if ((role === "buyer" || role === "rider") && !formData.password.trim()) errs.password = "Choose a password"
      if (Object.keys(errs).length > 0) {
        setFieldErrors(errs)
        setError("Please fix the fields marked in red")
        return
      }
      setFieldErrors({})
    }
    if (currentStep === 2 && role === "seller") {
      const errs: Record<string,string> = {}
      if (!formData.companyName) errs.companyName = "Required"
      if (!formData.sector) errs.sector = "Required"
      if (!formData.deliveryMode) errs.deliveryMode = "Required"
      if (!formData.tin || !formData.tin.trim()) errs.tin = "Required"
      if (Object.keys(errs).length > 0) {
        setFieldErrors(errs)
        setError("Please fill in all required business fields")
        return
      }
      setFieldErrors({})
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/50 to-slate-100 p-4">
      <div className="w-full max-w-2xl space-y-4">
        <Link href={backHref}><Button variant="ghost" size="sm" className="gap-2 text-[#17324d]"><ArrowLeft className="h-4 w-4" />Back</Button></Link>

        <Card className="w-full border-blue-100/90 shadow-lg shadow-blue-950/5">
          <CardHeader className="space-y-4 text-center">
            <div className="flex justify-center">
              <Image src="/images/ishyiga-logo.png" alt="Ishyiga Software" width={200} height={60} className="h-12 w-auto" />
            </div>
            <CardTitle className="text-2xl text-[#17324d]">{pageTitle ?? "Create Account"}</CardTitle>
            <CardDescription>{pageDescription ?? "Join ihute.rw marketplace today"}</CardDescription>
          </CardHeader>

          <CardContent>
            {renderStepIndicator()}

            <form id="registration-form" onSubmit={handleSubmit} className="space-y-4">

              {/* ── Step 1: Personal info (shared) ── */}
              {currentStep === 1 && (
                <>
                  {!hideRolePicker && (
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
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="rider" id="rider" />
                        <Label htmlFor="rider" className="cursor-pointer">Rider (Deliver orders)</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" placeholder="John Doe" value={formData.name}
                      onChange={(e) => { set("name", e.target.value); setFieldErrors(prev => ({ ...prev, name: undefined })) }}
                      aria-invalid={fieldErrors.name ? "true" : undefined} required />
                    {fieldErrors.name && <p className="text-sm text-destructive mt-1">{fieldErrors.name}</p>}
                  </div>
                  {role !== "seller" && (
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="your@email.com" value={formData.email}
                      onChange={(e) => set("email", e.target.value)} required />
                  </div>
                  )}
                  {role === "seller" && (
                  <p className="text-sm text-muted-foreground rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2">
                    Seller accounts use your <strong>phone number</strong> as the sign-in ID (no email required).
                  </p>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input id="phone" type="tel" placeholder="+250788123456" value={formData.phone}
                      onChange={(e) => { set("phone", e.target.value); setFieldErrors(prev => ({ ...prev, phone: undefined })) }}
                      aria-invalid={fieldErrors.phone ? "true" : undefined}
                      className={fieldErrors.phone ? "aria-invalid:ring-destructive/40 aria-invalid:border-destructive" : ""}
                      required />
                    {fieldErrors.phone && <p className="text-sm text-destructive mt-1">{fieldErrors.phone}</p>}
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
                    {role === "seller" && (
                      <p className="text-xs text-muted-foreground">
                        Optional for suppliers: leave blank and a temporary password will be emailed to you (after the server is configured for outbound mail).
                      </p>
                    )}
                    <Input
                      id="password"
                      type="password"
                      placeholder={role === "seller" ? "Create a password, or leave blank for email" : "Create a password"}
                      value={formData.password}
                      onChange={(e) => { set("password", e.target.value); setFieldErrors(prev => ({ ...prev, password: undefined })) }}
                      required={role === "buyer" || role === "rider"}
                      autoComplete="new-password"
                    />
                    {fieldErrors.password && <p className="text-sm text-destructive mt-1">{fieldErrors.password}</p>}
                  </div>
                </>
              )}

              {/* ── Step 2 (Seller): Business details → InsertSuppliers fields ── */}
              {currentStep === 2 && role === "seller" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Business / Company Name <span className="text-destructive">*</span></Label>
                    <Input id="companyName" placeholder="e.g. Kigali Pharma Ltd" value={formData.companyName}
                      onChange={(e) => { set("companyName", e.target.value); setFieldErrors(prev => ({ ...prev, companyName: undefined })) }}
                      aria-invalid={fieldErrors.companyName ? "true" : undefined} required />
                    {fieldErrors.companyName && <p className="text-sm text-destructive mt-1">{fieldErrors.companyName}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sector">Business Sector <span className="text-destructive">*</span></Label>
                    <Select value={formData.sector} onValueChange={(v) => { set("sector", v); setFieldErrors(prev => ({ ...prev, sector: undefined })) }}>
                      <SelectTrigger><SelectValue placeholder="Select sector" /></SelectTrigger>
                      <SelectContent>
                        {BUSINESS_SECTORS.map((s) => (
                          <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="deliveryMode">Delivery Mode <span className="text-destructive">*</span></Label>
                    <Select value={formData.deliveryMode} onValueChange={(v) => { set("deliveryMode", v); setFieldErrors(prev => ({ ...prev, deliveryMode: undefined })) }}>
                      <SelectTrigger><SelectValue placeholder="How do you deliver?" /></SelectTrigger>
                      <SelectContent>
                        {DELIVERY_MODES.map((d) => (
                          <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tin">TIN (Tax ID) <span className="text-destructive">*</span></Label>
                    <Input
                      id="tin"
                      placeholder="e.g. 123456789"
                      value={formData.tin}
                      onChange={(e) => { set("tin", e.target.value); setFieldErrors(prev => ({ ...prev, tin: undefined })) }}
                      required
                    />
                    {fieldErrors.tin && <p className="text-sm text-destructive mt-1">{fieldErrors.tin}</p>}
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
              {((currentStep === 3 && role === "seller") || (currentStep === 2 && (role === "buyer" || role === "rider"))) && (
                role === "seller" ? (
                  <div className="space-y-4">
                    <div className="text-center space-y-2">
                      <h3 className="text-lg font-semibold">Set Your Business Location</h3>
                      <p className="text-sm text-gray-600">Help customers find you by pinning your exact address</p>
                    </div>
                    <GPSCapture onLocationSet={handleLocationSet}
                      initialLat={formData.latitude ?? undefined}
                      initialLng={formData.longitude ?? undefined}
                      fallbackDistrict={formData.location} />
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
                {currentStep === totalSteps && (role === "buyer" || role === "rider" || (role === "seller" && formData.latitude)) && (
                  <Button type="submit" className="flex-1 bg-[#17324d] hover:bg-[#1e4260]" disabled={loading}>
                    {loading ? "Creating account..." : "Create Account"}
                  </Button>
                )}
              </div>
            </form>

            <div className="mt-6 text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login" className="text-[#1897e0] hover:underline font-medium">Sign in</Link>
              </p>
              <p className="text-sm">
                <Link href="/forgot-password" className="text-[#1897e0] hover:underline font-medium">
                  Forgot password?
                </Link>
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
                  {sellerRegisterMeta?.temporaryPasswordMessage && (
                    <li className={sellerRegisterMeta.temporaryPasswordEmailed ? undefined : "text-amber-800"}>
                      {sellerRegisterMeta.temporaryPasswordMessage}
                    </li>
                  )}
                  <li>Our admin team will review your application</li>
                  <li>We&apos;ll verify your business details</li>
                  <li>You'll receive updates by email when applicable</li>
                  <li>Approval typically takes 24–48 hours</li>
                </ul>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-1">
                <p className="text-sm font-medium text-gray-900">📧 Application Details:</p>
                <p className="text-sm text-gray-600">Phone: {formData.phone}</p>
                <p className="text-sm text-gray-600">Business: {formData.companyName}</p>
                <p className="text-sm text-gray-600">Sector: {formData.sector}</p>
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
