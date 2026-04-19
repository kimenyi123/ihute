"use client"

import { useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  Bike,
  CalendarDays,
  FileCheck,
  KeyRound,
  Loader2,
  MapPin,
  Package,
  Phone,
  ShieldCheck,
  UserCircle,
  Wallet,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { useLanguageStore } from "@/lib/language-store"
import { LanguageSelector } from "@/components/language-selector"
import { pickLang, SELLER_UI } from "@/lib/seller-register-i18n"
import { getShopPublicUrl } from "@/lib/shop-public-url"
import {
  initialRiderFormState,
  riderFormCanSave,
  type RiderFormState,
} from "@/lib/rider-register-form-state"
import { cn } from "@/lib/utils"

const cardClass =
  "rounded-2xl border-[#dbe7f3] bg-white shadow-[0_8px_18px_rgba(24,151,224,.08)]"

const triggerClass =
  "items-center rounded-xl border border-[#dbe7f3] bg-[#f7fbff]/90 px-4 py-3.5 text-left text-base font-semibold text-[#17324d] hover:bg-[#eef4fb] hover:no-underline data-[state=open]:border-[#1897e0] data-[state=open]:bg-white"

function SectionTrigger({ icon: Icon, label }: { icon: typeof UserCircle; label: string }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-3">
      <Icon className="h-5 w-5 shrink-0 text-[#1897e0]" strokeWidth={1.75} aria-hidden />
      <span className="leading-snug">{label}</span>
    </span>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold leading-snug text-[#17324d]">{label}</Label>
      {children}
    </div>
  )
}

function TextIn({
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <Input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="border-[#dbe7f3]"
    />
  )
}

function FileIn({ name, onPick }: { name: string; onPick: (fileName: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="file"
        accept="image/*,.pdf"
        className="border-[#dbe7f3] text-sm"
        onChange={(e) => onPick(e.target.files?.[0]?.name ?? "")}
      />
      {name ? <span className="text-xs text-[#6f8399]">{name}</span> : null}
    </div>
  )
}

export function RiderRegisterForm() {
  const lang = useLanguageStore((s) => s.language)
  const [form, setForm] = useState<RiderFormState>(initialRiderFormState)
  const [loading, setLoading] = useState(false)

  const patch = <K extends keyof RiderFormState>(key: K, value: RiderFormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const canSave = useMemo(() => riderFormCanSave(form), [form])

  const onSave = () => {
    if (!canSave) return
    setLoading(true)
    setTimeout(() => setLoading(false), 400)
  }

  return (
    <div className="min-h-screen bg-[#eef4fb] text-[#17324d]">
      <div className="mx-auto max-w-[520px] min-h-screen bg-gradient-to-b from-[#f7fbff] to-[#eef4fb] pb-32">
        <header className="sticky top-0 z-30 bg-gradient-to-r from-[#1897e0] via-[#30acef] to-[#127fc0] text-white shadow-[0_8px_20px_rgba(0,0,0,.1)]">
          <div className="flex items-center gap-2 px-3 py-3.5">
            <Link
              href={getShopPublicUrl()}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white/15 text-lg text-white hover:bg-white/25"
              aria-label={pickLang(SELLER_UI.back, lang)}
            >
              ←
            </Link>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-white/35 bg-white">
                <Image src="/images/ishyiga-logo.png" alt="" width={34} height={34} className="object-contain" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-lg font-bold leading-tight">Ishyiga Ihute</div>
                <div className="truncate text-xs text-white/90">Rider registration</div>
              </div>
            </div>
            <div className="shrink-0 [&_button]:border-white/40 [&_button]:text-white [&_button]:hover:bg-white/15">
              <LanguageSelector />
            </div>
          </div>
        </header>

        <div className="space-y-4 px-3 pt-4">
          <Card className={cardClass}>
            <CardHeader className="pb-2">
              <CardTitle className="text-[#17324d]">Rider profile</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="space-y-2">
                <AccordionItem value="identity" className="rounded-xl border-0">
                  <AccordionTrigger className={triggerClass}>
                    <SectionTrigger icon={UserCircle} label="Identity & legal person" />
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 px-1 pt-2 sm:grid sm:grid-cols-2 sm:gap-x-3 sm:gap-y-3">
                    <Row label="Legal full name (as on ID)">
                      <TextIn value={form.legalFullName} onChange={(v) => patch("legalFullName", v)} />
                    </Row>
                    <Row label="Preferred display name">
                      <TextIn value={form.preferredDisplayName} onChange={(v) => patch("preferredDisplayName", v)} />
                    </Row>
                    <Row label="Date of birth">
                      <TextIn type="date" value={form.dateOfBirth} onChange={(v) => patch("dateOfBirth", v)} />
                    </Row>
                    <Row label="Gender">
                      <Select value={form.gender || undefined} onValueChange={(v) => patch("gender", v)}>
                        <SelectTrigger className="border-[#dbe7f3]">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                          <SelectItem value="prefer_not">Prefer not to say</SelectItem>
                        </SelectContent>
                      </Select>
                    </Row>
                    <Row label="Nationality">
                      <TextIn value={form.nationality} onChange={(v) => patch("nationality", v)} />
                    </Row>
                    <Row label="National ID number">
                      <TextIn value={form.nationalIdNumber} onChange={(v) => patch("nationalIdNumber", v)} />
                    </Row>
                    <Row label="ID document type">
                      <Select value={form.idDocumentType || undefined} onValueChange={(v) => patch("idDocumentType", v)}>
                        <SelectTrigger className="border-[#dbe7f3]">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="national_id">National ID</SelectItem>
                          <SelectItem value="passport">Passport</SelectItem>
                          <SelectItem value="refugee">Refugee ID</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </Row>
                    <Row label="ID issue date">
                      <TextIn type="date" value={form.idIssueDate} onChange={(v) => patch("idIssueDate", v)} />
                    </Row>
                    <Row label="ID expiry date">
                      <TextIn type="date" value={form.idExpiryDate} onChange={(v) => patch("idExpiryDate", v)} />
                    </Row>
                    <Row label="ID photo (front)">
                      <FileIn name={form.idPhotoFrontName} onPick={(n) => patch("idPhotoFrontName", n)} />
                    </Row>
                    <Row label="ID photo (back)">
                      <FileIn name={form.idPhotoBackName} onPick={(n) => patch("idPhotoBackName", n)} />
                    </Row>
                    <Row label="Selfie (liveness / KYC)">
                      <FileIn name={form.selfiePhotoName} onPick={(n) => patch("selfiePhotoName", n)} />
                    </Row>
                    <Row label="Marital status (optional)">
                      <TextIn value={form.maritalStatus} onChange={(v) => patch("maritalStatus", v)} />
                    </Row>
                    <div className="sm:col-span-2 space-y-2">
                      <Label className="text-xs font-semibold text-[#17324d]">Languages spoken</Label>
                      <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={form.langKinyarwanda}
                            onCheckedChange={(c) => patch("langKinyarwanda", c === true)}
                          />
                          Kinyarwanda
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={form.langEnglish}
                            onCheckedChange={(c) => patch("langEnglish", c === true)}
                          />
                          English
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox checked={form.langFrench} onCheckedChange={(c) => patch("langFrench", c === true)} />
                          French
                        </label>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="contact" className="rounded-xl border-0">
                  <AccordionTrigger className={triggerClass}>
                    <SectionTrigger icon={Phone} label="Contact & emergency" />
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 px-1 pt-2 sm:grid sm:grid-cols-2 sm:gap-x-3 sm:gap-y-3">
                    <Row label="Primary mobile number">
                      <TextIn value={form.primaryMobile} onChange={(v) => patch("primaryMobile", v)} />
                    </Row>
                    <Row label="Secondary mobile (optional)">
                      <TextIn value={form.secondaryMobile} onChange={(v) => patch("secondaryMobile", v)} />
                    </Row>
                    <Row label="WhatsApp number (optional)">
                      <TextIn value={form.whatsappNumber} onChange={(v) => patch("whatsappNumber", v)} />
                    </Row>
                    <Row label="Email">
                      <TextIn type="email" value={form.email} onChange={(v) => patch("email", v)} />
                    </Row>
                    <Row label="Emergency contact name">
                      <TextIn value={form.emergencyContactName} onChange={(v) => patch("emergencyContactName", v)} />
                    </Row>
                    <Row label="Relationship">
                      <TextIn value={form.emergencyRelationship} onChange={(v) => patch("emergencyRelationship", v)} />
                    </Row>
                    <Row label="Emergency phone">
                      <TextIn value={form.emergencyPhone} onChange={(v) => patch("emergencyPhone", v)} />
                    </Row>
                    <Row label="Emergency contact address (optional)">
                      <Textarea
                        value={form.emergencyAddress}
                        onChange={(e) => patch("emergencyAddress", e.target.value)}
                        className="min-h-[72px] border-[#dbe7f3]"
                      />
                    </Row>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="account" className="rounded-xl border-0">
                  <AccordionTrigger className={triggerClass}>
                    <SectionTrigger icon={KeyRound} label="Account & security" />
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 px-1 pt-2 sm:grid sm:grid-cols-2 sm:gap-x-3 sm:gap-y-3">
                    <Row label="Password">
                      <TextIn type="password" value={form.password} onChange={(v) => patch("password", v)} />
                    </Row>
                    <Row label="PIN (optional, in-app quick actions)">
                      <TextIn value={form.pinOptional} onChange={(v) => patch("pinOptional", v)} />
                    </Row>
                    <Row label="Two-factor preference">
                      <Select value={form.twoFactorPreference || undefined} onValueChange={(v) => patch("twoFactorPreference", v)}>
                        <SelectTrigger className="border-[#dbe7f3]">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sms">SMS</SelectItem>
                          <SelectItem value="app">Authenticator app</SelectItem>
                          <SelectItem value="none">None</SelectItem>
                        </SelectContent>
                      </Select>
                    </Row>
                    <Row label="Recovery email">
                      <TextIn type="email" value={form.recoveryEmail} onChange={(v) => patch("recoveryEmail", v)} />
                    </Row>
                    <Row label="Recovery phone">
                      <TextIn value={form.recoveryPhone} onChange={(v) => patch("recoveryPhone", v)} />
                    </Row>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="address" className="rounded-xl border-0">
                  <AccordionTrigger className={triggerClass}>
                    <SectionTrigger icon={MapPin} label="Address & geography" />
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 px-1 pt-2 sm:grid sm:grid-cols-2 sm:gap-x-3 sm:gap-y-3">
                    <Row label="Province">
                      <TextIn value={form.residentialProvince} onChange={(v) => patch("residentialProvince", v)} />
                    </Row>
                    <Row label="District">
                      <TextIn value={form.residentialDistrict} onChange={(v) => patch("residentialDistrict", v)} />
                    </Row>
                    <Row label="Sector">
                      <TextIn value={form.residentialSector} onChange={(v) => patch("residentialSector", v)} />
                    </Row>
                    <Row label="Cell">
                      <TextIn value={form.residentialCell} onChange={(v) => patch("residentialCell", v)} />
                    </Row>
                    <Row label="Village">
                      <TextIn value={form.residentialVillage} onChange={(v) => patch("residentialVillage", v)} />
                    </Row>
                    <Row label="Street / details">
                      <TextIn value={form.residentialStreet} onChange={(v) => patch("residentialStreet", v)} />
                    </Row>
                    <Row label="Landmark">
                      <TextIn value={form.residentialLandmark} onChange={(v) => patch("residentialLandmark", v)} />
                    </Row>
                    <div className="flex items-center gap-2 sm:col-span-2">
                      <Checkbox
                        checked={form.mailingSameAsResidential}
                        onCheckedChange={(c) => patch("mailingSameAsResidential", c === true)}
                        id="mail-same"
                      />
                      <Label htmlFor="mail-same" className="text-sm font-normal">
                        Mailing address same as residential
                      </Label>
                    </div>
                    <Row label="Mailing address (if different)">
                      <Textarea
                        value={form.mailingAddress}
                        onChange={(e) => patch("mailingAddress", e.target.value)}
                        className="min-h-[72px] border-[#dbe7f3]"
                      />
                    </Row>
                    <Row label="GPS latitude">
                      <TextIn value={form.gpsLat} onChange={(v) => patch("gpsLat", v)} placeholder="e.g. -1.94" />
                    </Row>
                    <Row label="GPS longitude">
                      <TextIn value={form.gpsLng} onChange={(v) => patch("gpsLng", v)} placeholder="e.g. 30.06" />
                    </Row>
                    <Row label="Map pin label">
                      <TextIn value={form.mapPinLabel} onChange={(v) => patch("mapPinLabel", v)} />
                    </Row>
                    <Row label="Districts / zones you accept (text or list)">
                      <Textarea
                        value={form.deliveryZones}
                        onChange={(e) => patch("deliveryZones", e.target.value)}
                        className="min-h-[80px] border-[#dbe7f3]"
                      />
                    </Row>
                    <Row label="Areas you refuse (optional)">
                      <Textarea
                        value={form.areasRefuse}
                        onChange={(e) => patch("areasRefuse", e.target.value)}
                        className="min-h-[80px] border-[#dbe7f3]"
                      />
                    </Row>
                    <Row label="Willing to cross district / province">
                      <Select value={form.crossDistrictWilling || undefined} onValueChange={(v) => patch("crossDistrictWilling", v)}>
                        <SelectTrigger className="border-[#dbe7f3]">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes">Yes</SelectItem>
                          <SelectItem value="no">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </Row>
                    <Row label="If yes, which (optional)">
                      <TextIn value={form.crossDistrictWhich} onChange={(v) => patch("crossDistrictWhich", v)} />
                    </Row>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="vehicle" className="rounded-xl border-0">
                  <AccordionTrigger className={triggerClass}>
                    <SectionTrigger icon={Bike} label="Vehicle & equipment" />
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 px-1 pt-2 sm:grid sm:grid-cols-2 sm:gap-x-3 sm:gap-y-3">
                    <Row label="Delivery mode">
                      <Select value={form.deliveryMode || undefined} onValueChange={(v) => patch("deliveryMode", v)}>
                        <SelectTrigger className="border-[#dbe7f3]">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="foot">On foot</SelectItem>
                          <SelectItem value="bicycle">Bicycle</SelectItem>
                          <SelectItem value="motorcycle">Motorcycle</SelectItem>
                          <SelectItem value="car">Car</SelectItem>
                        </SelectContent>
                      </Select>
                    </Row>
                    <Row label="Vehicle category">
                      <TextIn value={form.vehicleCategory} onChange={(v) => patch("vehicleCategory", v)} />
                    </Row>
                    <Row label="Make">
                      <TextIn value={form.vehicleMake} onChange={(v) => patch("vehicleMake", v)} />
                    </Row>
                    <Row label="Model">
                      <TextIn value={form.vehicleModel} onChange={(v) => patch("vehicleModel", v)} />
                    </Row>
                    <Row label="Year">
                      <TextIn value={form.vehicleYear} onChange={(v) => patch("vehicleYear", v)} />
                    </Row>
                    <Row label="Color">
                      <TextIn value={form.vehicleColor} onChange={(v) => patch("vehicleColor", v)} />
                    </Row>
                    <Row label="Registration / plate number">
                      <TextIn value={form.plateNumber} onChange={(v) => patch("plateNumber", v)} />
                    </Row>
                    <Row label="Vehicle ID / registration doc number">
                      <TextIn value={form.vehicleRegDocNumber} onChange={(v) => patch("vehicleRegDocNumber", v)} />
                    </Row>
                    <Row label="Registration expiry">
                      <TextIn type="date" value={form.vehicleRegExpiry} onChange={(v) => patch("vehicleRegExpiry", v)} />
                    </Row>
                    <Row label="Vehicle photo (front)">
                      <FileIn name={form.vehiclePhotoFrontName} onPick={(n) => patch("vehiclePhotoFrontName", n)} />
                    </Row>
                    <Row label="Vehicle photo (side)">
                      <FileIn name={form.vehiclePhotoSideName} onPick={(n) => patch("vehiclePhotoSideName", n)} />
                    </Row>
                    <Row label="Plate close-up">
                      <FileIn name={form.vehiclePhotoPlateName} onPick={(n) => patch("vehiclePhotoPlateName", n)} />
                    </Row>
                    <Row label="Engine capacity (cc)">
                      <TextIn value={form.engineCc} onChange={(v) => patch("engineCc", v)} />
                    </Row>
                    <Row label="Fuel type">
                      <TextIn value={form.fuelType} onChange={(v) => patch("fuelType", v)} />
                    </Row>
                    <Row label="Helmet owned (yes/no)">
                      <TextIn value={form.helmetOwned} onChange={(v) => patch("helmetOwned", v)} />
                    </Row>
                    <Row label="Helmet photo (if required)">
                      <FileIn name={form.helmetPhotoName} onPick={(n) => patch("helmetPhotoName", n)} />
                    </Row>
                    <Row label="Reflective vest / branding">
                      <TextIn value={form.reflectiveVest} onChange={(v) => patch("reflectiveVest", v)} />
                    </Row>
                    <Row label="Phone mount">
                      <TextIn value={form.phoneMount} onChange={(v) => patch("phoneMount", v)} />
                    </Row>
                    <Row label="Thermal bag / cooler">
                      <TextIn value={form.thermalBag} onChange={(v) => patch("thermalBag", v)} />
                    </Row>
                    <Row label="Odometer (optional)">
                      <TextIn value={form.odometer} onChange={(v) => patch("odometer", v)} />
                    </Row>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="licenses" className="rounded-xl border-0">
                  <AccordionTrigger className={triggerClass}>
                    <SectionTrigger icon={FileCheck} label="Licenses & permits" />
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 px-1 pt-2 sm:grid sm:grid-cols-2 sm:gap-x-3 sm:gap-y-3">
                    <Row label="Driving license number">
                      <TextIn value={form.drivingLicenseNumber} onChange={(v) => patch("drivingLicenseNumber", v)} />
                    </Row>
                    <Row label="License class">
                      <TextIn value={form.drivingLicenseClass} onChange={(v) => patch("drivingLicenseClass", v)} />
                    </Row>
                    <Row label="License issue date">
                      <TextIn
                        type="date"
                        value={form.drivingLicenseIssue}
                        onChange={(v) => patch("drivingLicenseIssue", v)}
                      />
                    </Row>
                    <Row label="License expiry">
                      <TextIn
                        type="date"
                        value={form.drivingLicenseExpiry}
                        onChange={(v) => patch("drivingLicenseExpiry", v)}
                      />
                    </Row>
                    <Row label="License photo (front)">
                      <FileIn name={form.licensePhotoFrontName} onPick={(n) => patch("licensePhotoFrontName", n)} />
                    </Row>
                    <Row label="License photo (back)">
                      <FileIn name={form.licensePhotoBackName} onPick={(n) => patch("licensePhotoBackName", n)} />
                    </Row>
                    <Row label="Motorbike taxi / commercial permit">
                      <TextIn value={form.motoTaxiPermit} onChange={(v) => patch("motoTaxiPermit", v)} />
                    </Row>
                    <Row label="Municipal / sector permit number">
                      <TextIn value={form.municipalPermitNumber} onChange={(v) => patch("municipalPermitNumber", v)} />
                    </Row>
                    <Row label="Insurance provider">
                      <TextIn value={form.insuranceProvider} onChange={(v) => patch("insuranceProvider", v)} />
                    </Row>
                    <Row label="Insurance policy number">
                      <TextIn value={form.insurancePolicyNumber} onChange={(v) => patch("insurancePolicyNumber", v)} />
                    </Row>
                    <Row label="Coverage type">
                      <TextIn value={form.insuranceCoverageType} onChange={(v) => patch("insuranceCoverageType", v)} />
                    </Row>
                    <Row label="Insurance expiry">
                      <TextIn type="date" value={form.insuranceExpiry} onChange={(v) => patch("insuranceExpiry", v)} />
                    </Row>
                    <Row label="Insurance document upload">
                      <FileIn name={form.insuranceDocName} onPick={(n) => patch("insuranceDocName", n)} />
                    </Row>
                    <Row label="Roadworthiness / inspection sticker">
                      <TextIn value={form.roadworthinessSticker} onChange={(v) => patch("roadworthinessSticker", v)} />
                    </Row>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="financial" className="rounded-xl border-0">
                  <AccordionTrigger className={triggerClass}>
                    <SectionTrigger icon={Wallet} label="Financial & payouts" />
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 px-1 pt-2 sm:grid sm:grid-cols-2 sm:gap-x-3 sm:gap-y-3">
                    <Row label="Preferred payout method">
                      <Select value={form.payoutMethod || undefined} onValueChange={(v) => patch("payoutMethod", v)}>
                        <SelectTrigger className="border-[#dbe7f3]">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="momo">MTN MoMo</SelectItem>
                          <SelectItem value="airtel">Airtel Money</SelectItem>
                          <SelectItem value="bank">Bank</SelectItem>
                          <SelectItem value="cash">Cash settlement</SelectItem>
                        </SelectContent>
                      </Select>
                    </Row>
                    <Row label="MTN MoMo number">
                      <TextIn value={form.mtnMomo} onChange={(v) => patch("mtnMomo", v)} />
                    </Row>
                    <Row label="Name on MoMo account">
                      <TextIn value={form.mtnMomoNameOnAccount} onChange={(v) => patch("mtnMomoNameOnAccount", v)} />
                    </Row>
                    <Row label="Airtel Money number">
                      <TextIn value={form.airtelMoney} onChange={(v) => patch("airtelMoney", v)} />
                    </Row>
                    <Row label="Bank name">
                      <TextIn value={form.bankName} onChange={(v) => patch("bankName", v)} />
                    </Row>
                    <Row label="Branch">
                      <TextIn value={form.bankBranch} onChange={(v) => patch("bankBranch", v)} />
                    </Row>
                    <Row label="Account name">
                      <TextIn value={form.bankAccountName} onChange={(v) => patch("bankAccountName", v)} />
                    </Row>
                    <Row label="Account number">
                      <TextIn value={form.bankAccountNumber} onChange={(v) => patch("bankAccountNumber", v)} />
                    </Row>
                    <Row label="IBAN / SWIFT (if cross-border)">
                      <TextIn value={form.bankIbanSwift} onChange={(v) => patch("bankIbanSwift", v)} />
                    </Row>
                    <Row label="Mobile money registered name (reconciliation)">
                      <TextIn
                        value={form.mobileMoneyRegisteredName}
                        onChange={(v) => patch("mobileMoneyRegisteredName", v)}
                      />
                    </Row>
                    <Row label="Tax ID / TIN">
                      <TextIn value={form.taxIdTin} onChange={(v) => patch("taxIdTin", v)} />
                    </Row>
                    <Row label="Withholding / VAT status">
                      <TextIn value={form.withholdingVatStatus} onChange={(v) => patch("withholdingVatStatus", v)} />
                    </Row>
                    <Row label="Currency preference">
                      <TextIn value={form.currencyPreference} onChange={(v) => patch("currencyPreference", v)} />
                    </Row>
                    <Row label="Payout frequency">
                      <Select value={form.payoutFrequency || undefined} onValueChange={(v) => patch("payoutFrequency", v)}>
                        <SelectTrigger className="border-[#dbe7f3]">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </Row>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="work" className="rounded-xl border-0">
                  <AccordionTrigger className={triggerClass}>
                    <SectionTrigger icon={CalendarDays} label="Work & availability" />
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 px-1 pt-2 sm:grid sm:grid-cols-2 sm:gap-x-3 sm:gap-y-3">
                    <Row label="Availability type">
                      <Select value={form.availabilityType || undefined} onValueChange={(v) => patch("availabilityType", v)}>
                        <SelectTrigger className="border-[#dbe7f3]">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full">Full-time</SelectItem>
                          <SelectItem value="part">Part-time</SelectItem>
                          <SelectItem value="occasional">Occasional</SelectItem>
                        </SelectContent>
                      </Select>
                    </Row>
                    <div className="sm:col-span-2 space-y-2">
                      <Label className="text-xs font-semibold text-[#17324d]">Typical working days</Label>
                      <div className="flex flex-wrap gap-3">
                        {(
                          [
                            ["workMon", "Mon"],
                            ["workTue", "Tue"],
                            ["workWed", "Wed"],
                            ["workThu", "Thu"],
                            ["workFri", "Fri"],
                            ["workSat", "Sat"],
                            ["workSun", "Sun"],
                          ] as const
                        ).map(([key, lab]) => (
                          <label key={key} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={form[key]}
                              onCheckedChange={(c) => patch(key, c === true)}
                            />
                            {lab}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="sm:col-span-2 space-y-2">
                      <Label className="text-xs font-semibold text-[#17324d]">Typical time windows</Label>
                      <div className="flex flex-wrap gap-3">
                        {(
                          [
                            ["timeMorning", "Morning"],
                            ["timeLunch", "Lunch"],
                            ["timeEvening", "Evening"],
                            ["timeNight", "Night"],
                          ] as const
                        ).map(([key, lab]) => (
                          <label key={key} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={form[key]}
                              onCheckedChange={(c) => patch(key, c === true)}
                            />
                            {lab}
                          </label>
                        ))}
                      </div>
                    </div>
                    <Row label="Max hours / day (optional)">
                      <TextIn value={form.maxHoursPerDay} onChange={(v) => patch("maxHoursPerDay", v)} />
                    </Row>
                    <Row label="Max hours / week (optional)">
                      <TextIn value={form.maxHoursPerWeek} onChange={(v) => patch("maxHoursPerWeek", v)} />
                    </Row>
                    <Row label="Notice period before first trip (minutes)">
                      <TextIn value={form.noticePeriodMinutes} onChange={(v) => patch("noticePeriodMinutes", v)} />
                    </Row>
                    <Row label="Willing to work holidays">
                      <TextIn value={form.willingHolidays} onChange={(v) => patch("willingHolidays", v)} />
                    </Row>
                    <div className="sm:col-span-2">
                      <Row label="Shift notes (free text)">
                        <Textarea
                          value={form.shiftNotes}
                          onChange={(e) => patch("shiftNotes", e.target.value)}
                          className="min-h-[80px] border-[#dbe7f3]"
                        />
                      </Row>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="capacity" className="rounded-xl border-0">
                  <AccordionTrigger className={triggerClass}>
                    <SectionTrigger icon={Package} label="Capacity & service rules" />
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 px-1 pt-2 sm:grid sm:grid-cols-2 sm:gap-x-3 sm:gap-y-3">
                    <Row label="Max concurrent orders">
                      <TextIn value={form.maxConcurrentOrders} onChange={(v) => patch("maxConcurrentOrders", v)} />
                    </Row>
                    <Row label="Max distance per trip (km)">
                      <TextIn value={form.maxDistanceKm} onChange={(v) => patch("maxDistanceKm", v)} />
                    </Row>
                    <Row label="Max radius from base (km)">
                      <TextIn value={form.maxRadiusKm} onChange={(v) => patch("maxRadiusKm", v)} />
                    </Row>
                    <Row label="Max weight (kg)">
                      <TextIn value={form.maxWeightKg} onChange={(v) => patch("maxWeightKg", v)} />
                    </Row>
                    <Row label="Max volume (describe)">
                      <TextIn value={form.maxVolume} onChange={(v) => patch("maxVolume", v)} />
                    </Row>
                    <Row label="Cash on delivery willing (yes/no)">
                      <TextIn value={form.cashOnDeliveryWilling} onChange={(v) => patch("cashOnDeliveryWilling", v)} />
                    </Row>
                    <Row label="COD limit (optional)">
                      <TextIn value={form.cashOnDeliveryLimit} onChange={(v) => patch("cashOnDeliveryLimit", v)} />
                    </Row>
                    <Row label="Cold chain / pharma willing">
                      <TextIn value={form.coldChainPharma} onChange={(v) => patch("coldChainPharma", v)} />
                    </Row>
                    <Row label="Cold chain training done">
                      <TextIn value={form.coldChainTraining} onChange={(v) => patch("coldChainTraining", v)} />
                    </Row>
                    <Row label="Large cash handling willing">
                      <TextIn value={form.largeCashHandling} onChange={(v) => patch("largeCashHandling", v)} />
                    </Row>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="compliance" className="rounded-xl border-0">
                  <AccordionTrigger className={triggerClass}>
                    <SectionTrigger icon={ShieldCheck} label="Compliance, safety, background" />
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 px-1 pt-2 sm:grid sm:grid-cols-2 sm:gap-x-3 sm:gap-y-3">
                    <Row label="Background check consent (yes/no)">
                      <TextIn
                        value={form.backgroundCheckConsent}
                        onChange={(v) => patch("backgroundCheckConsent", v)}
                      />
                    </Row>
                    <Row label="Consent date">
                      <TextIn
                        type="date"
                        value={form.backgroundCheckConsentDate}
                        onChange={(v) => patch("backgroundCheckConsentDate", v)}
                      />
                    </Row>
                    <Row label="Background check status">
                      <TextIn value={form.backgroundCheckStatus} onChange={(v) => patch("backgroundCheckStatus", v)} />
                    </Row>
                    <Row label="Background check reference ID">
                      <TextIn value={form.backgroundCheckRefId} onChange={(v) => patch("backgroundCheckRefId", v)} />
                    </Row>
                    <Row label="Background check expiry">
                      <TextIn
                        type="date"
                        value={form.backgroundCheckExpiry}
                        onChange={(v) => patch("backgroundCheckExpiry", v)}
                      />
                    </Row>
                    <Row label="Road safety training completed">
                      <TextIn value={form.roadSafetyTraining} onChange={(v) => patch("roadSafetyTraining", v)} />
                    </Row>
                    <Row label="Road safety certificate upload">
                      <FileIn
                        name={form.roadSafetyCertificateName}
                        onPick={(n) => patch("roadSafetyCertificateName", n)}
                      />
                    </Row>
                    <Row label="Food hygiene / delivery training">
                      <TextIn value={form.foodHygieneTraining} onChange={(v) => patch("foodHygieneTraining", v)} />
                    </Row>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          <div className="sticky bottom-0 z-20 border-t border-[#dbe7f3] bg-[#eef4fb]/95 px-1 py-3 backdrop-blur-sm">
            <Button
              type="button"
              disabled={!canSave || loading}
              onClick={onSave}
              className={cn(
                "w-full bg-gradient-to-r from-[#1897e0] to-[#127fc0] text-white shadow-[0_10px_20px_rgba(24,151,224,.22)]",
                !canSave && "opacity-50"
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save registration"
              )}
            </Button>
            {!canSave && (
              <p className="mt-2 text-center text-xs text-[#6f8399]">
                Save stays off until we wire the required-field rule (next step).
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
