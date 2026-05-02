"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, User as UserIcon, Save, Store, ImagePlus } from "lucide-react"
import { useAuthStore, type User } from "@/lib/auth-store"

export default function AccountPage() {
  const router = useRouter()
  const { user, isAuthenticated, hasHydrated, updateUser } = useAuthStore()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [shopImageUrl, setShopImageUrl] = useState("")
  const [shopImageFile, setShopImageFile] = useState<File | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [form, setForm] = useState<Partial<User>>({
    name: "",
    email: "",
    phone: "",
    location: "",
    businessName: "",
    businessCategory: "",
    ishyigaAccount: "",
    owner: "",
    momo: "",
    currency: "",
    description: "",
    nickname: "",
  })

  // Profile page is for seller (supplier) accounts only
  useEffect(() => {
    if (!hasHydrated) return
    if (!isAuthenticated || !user) {
      router.replace("/login?redirectTo=/account")
      return
    }
    if (user.role !== "supplier") {
      router.replace("/")
      return
    }
    setForm({
      name: user.name ?? "",
      email: user.email ?? "",
      phone: user.phone ?? "",
      location: user.location ?? "",
      businessName: user.businessName ?? "",
      businessCategory: user.businessCategory ?? "",
      ishyigaAccount: user.ishyigaAccount ?? "",
      owner: user.owner ?? "",
      momo: user.momo ?? "",
      currency: user.currency ?? "",
      description: user.description ?? "",
      nickname: user.nickname ?? "",
    })

    const params = new URLSearchParams()
    if (user.email) params.set("email", user.email)
    if (user.ishyigaAccount) params.set("account", user.ishyigaAccount)
    if (params.toString()) {
      fetch(`/api/account/profile?${params.toString()}`)
        .then((res) => res.json())
        .then((data) => {
          if (data?.ok && data.profile) {
            const p = data.profile
            setForm((prev: Partial<User>) => ({
              ...prev,
              name: p.name ?? prev.name,
              email: p.email ?? prev.email,
              phone: p.phone ?? prev.phone,
              location: p.location ?? prev.location,
              momo: p.momo ?? prev.momo,
              currency: p.currency ?? prev.currency,
              description: p.description ?? prev.description,
              nickname: p.nickname ?? prev.nickname,
              ishyigaAccount: p.ishyigaAccount ?? prev.ishyigaAccount,
              owner: p.owner ?? prev.owner,
              businessName: p.businessName ?? prev.businessName,
              businessCategory: p.businessCategory ?? prev.businessCategory,
            }))
          }
        })
        .catch(() => {})
    }
    if (user.ishyigaAccount) {
      fetch(`/api/images/overrides?scope=shop&account=${encodeURIComponent(user.ishyigaAccount)}`, { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => {
          if (data?.ok && typeof data.imageUrl === "string") {
            setShopImageUrl(data.imageUrl)
          }
        })
        .catch(() => {})
    }
  }, [hasHydrated, isAuthenticated, user, router])

  const handleShopImageUpload = async () => {
    if (!user?.ishyigaAccount || !shopImageFile) return
    setUploadingImage(true)
    setMessage(null)
    try {
      const fd = new FormData()
      fd.append("scope", "shop")
      fd.append("account", user.ishyigaAccount)
      fd.append("file", shopImageFile)
      const res = await fetch("/api/images/overrides", {
        method: "POST",
        body: fd,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Shop image upload failed")
      }
      setShopImageUrl(String(data.imageUrl || ""))
      setShopImageFile(null)
      setMessage({ type: "success", text: "Shop profile image updated." })
    } catch (e) {
      setMessage({ type: "error", text: (e as Error).message || "Shop image upload failed." })
    } finally {
      setUploadingImage(false)
    }
  }

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    setMessage(null)
    const updates = {
      name: form.name ?? user.name,
      phone: form.phone ?? user.phone,
      location: form.location ?? user.location,
      businessName: form.businessName ?? user.businessName,
      businessCategory: form.businessCategory ?? user.businessCategory,
      ishyigaAccount: form.ishyigaAccount ?? user.ishyigaAccount,
      owner: form.owner ?? user.owner,
      momo: form.momo ?? user.momo,
      currency: form.currency ?? user.currency,
      description: form.description ?? user.description,
      nickname: form.nickname ?? user.nickname,
    }
    try {
      const res = await fetch("/api/account/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          account: user.ishyigaAccount || undefined,
          ...updates,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data?.ok !== false) {
        updateUser(updates)
        setMessage({ type: "success", text: "Profile updated." })
        setEditing(false)
      } else {
        setMessage({
          type: "error",
          text: data?.error || (res.status === 502 || res.status === 504 ? "Profile backend unavailable. Changes saved locally." : "Update failed."),
        })
        updateUser(updates)
      }
    } catch (e) {
      setMessage({ type: "error", text: (e as Error).message || "Update failed." })
      updateUser(updates)
    } finally {
      setSaving(false)
    }
  }

  if (!hasHydrated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    )
  }

  const displayName = (form.businessName || form.name || "Your shop").trim()
  const categoryLabel = (form.businessCategory || "").trim()

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/80">
      <div className="container max-w-3xl py-8 px-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <Card className="overflow-hidden border-slate-200/80 shadow-md">
          <div className="border-b bg-gradient-to-r from-sky-600 via-sky-500 to-blue-700 px-6 py-8 text-white">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="relative shrink-0">
                  <div className="h-24 w-24 overflow-hidden rounded-2xl border-4 border-white/30 bg-white/10 shadow-lg ring-2 ring-white/20 sm:h-28 sm:w-28">
                    <img
                      src={shopImageUrl || "/img/shops/default.png"}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-white text-sky-700 shadow-md ring-2 ring-sky-100">
                    <Store className="h-4 w-4" aria-hidden />
                  </div>
                </div>
                <div className="min-w-0 pt-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-sky-100/90">Shop profile</p>
                  <h1 className="mt-1 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{displayName}</h1>
                  {form.owner && form.owner !== displayName ? (
                    <p className="mt-1 text-sm text-sky-100/95">{form.owner}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {categoryLabel ? (
                      <span className="inline-flex items-center rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
                        {categoryLabel}
                      </span>
                    ) : null}
                    <span className="inline-flex items-center rounded-full bg-black/15 px-3 py-1 font-mono text-xs">
                      {form.ishyigaAccount || "—"}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-emerald-500/25 px-3 py-1 text-xs font-semibold capitalize">
                      {user.role}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-end">
                {!editing ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="bg-white text-sky-800 hover:bg-sky-50"
                    onClick={() => setEditing(true)}
                  >
                    Edit details
                  </Button>
                ) : (
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <Button variant="ghost" size="sm" className="text-white hover:bg-white/15" onClick={() => setEditing(false)}>
                      Cancel
                    </Button>
                    <Button size="sm" className="bg-white text-sky-800 hover:bg-sky-50" onClick={handleSave} disabled={saving}>
                      <Save className="h-4 w-4 mr-1" />
                      {saving ? "Saving…" : "Save"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <CardHeader className="sr-only">
            <CardTitle className="flex items-center gap-2">
              <UserIcon className="h-5 w-5" aria-hidden />
              My profile
            </CardTitle>
            <CardDescription>View and edit your account details.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-8 px-6 pb-8 pt-6">
            {message ? (
              <div
                role="status"
                className={`rounded-xl border px-4 py-3 text-sm ${
                  message.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-red-200 bg-red-50 text-red-900"
                }`}
              >
                {message.text}
              </div>
            ) : null}

            {/* Shop photo — visual block, upload always available */}
            <section className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="relative mx-auto w-full max-w-[200px] shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-inner aspect-square sm:mx-0 sm:max-w-[140px]">
                  <img
                    src={shopImageUrl || "/img/shops/default.png"}
                    alt="Shop profile"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex items-center gap-2 text-slate-800">
                    <ImagePlus className="h-5 w-5 text-sky-600 shrink-0" aria-hidden />
                    <div>
                      <h2 className="text-base font-semibold">Shop photo</h2>
                      <p className="text-sm text-muted-foreground">
                        This image appears on Grandma for buyers. JPG or PNG, clear logo or storefront works best.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setShopImageFile(e.target.files?.[0] ?? null)}
                      disabled={uploadingImage}
                      className="cursor-pointer border-slate-200 bg-white file:mr-3 file:rounded-md file:border-0 file:bg-sky-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-sky-800 hover:file:bg-sky-100"
                    />
                    <Button
                      type="button"
                      className="shrink-0 bg-sky-600 hover:bg-sky-700"
                      onClick={handleShopImageUpload}
                      disabled={!shopImageFile || uploadingImage}
                    >
                      {uploadingImage ? "Uploading…" : "Upload photo"}
                    </Button>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Contact</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Display name</Label>
                  <Input
                    id="name"
                    value={form.name ?? ""}
                    onChange={(e) => setForm((f: Partial<User>) => ({ ...f, name: e.target.value }))}
                    readOnly={!editing}
                    className={!editing ? "border-transparent bg-slate-50" : ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={form.email ?? ""} readOnly className="border-transparent bg-slate-50" title="Email cannot be changed here" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={form.phone ?? ""}
                    onChange={(e) => setForm((f: Partial<User>) => ({ ...f, phone: e.target.value }))}
                    readOnly={!editing}
                    className={!editing ? "border-transparent bg-slate-50" : ""}
                    placeholder="e.g. 0781234567"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={form.location ?? ""}
                    onChange={(e) => setForm((f: Partial<User>) => ({ ...f, location: e.target.value }))}
                    readOnly={!editing}
                    className={!editing ? "border-transparent bg-slate-50" : ""}
                    placeholder="e.g. Kigali"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Payments</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="momo">MoMo</Label>
                  <Input
                    id="momo"
                    value={form.momo ?? ""}
                    onChange={(e) => setForm((f: Partial<User>) => ({ ...f, momo: e.target.value }))}
                    readOnly={!editing}
                    className={!editing ? "border-transparent bg-slate-50" : ""}
                    placeholder="e.g. 0781234567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Input
                    id="currency"
                    value={form.currency ?? ""}
                    onChange={(e) => setForm((f: Partial<User>) => ({ ...f, currency: e.target.value }))}
                    readOnly={!editing}
                    className={!editing ? "border-transparent bg-slate-50" : ""}
                    placeholder="e.g. RWF"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="nickname">Shop nickname</Label>
                  <Input
                    id="nickname"
                    value={form.nickname ?? ""}
                    onChange={(e) => setForm((f: Partial<User>) => ({ ...f, nickname: e.target.value }))}
                    readOnly={!editing}
                    className={!editing ? "border-transparent bg-slate-50" : ""}
                    placeholder="For Shop with Me links"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">About your shop</h2>
              <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
                <Label htmlFor="description" className="text-muted-foreground">
                  Description
                </Label>
                <textarea
                  id="description"
                  rows={4}
                  value={form.description ?? ""}
                  onChange={(e) => setForm((f: Partial<User>) => ({ ...f, description: e.target.value }))}
                  readOnly={!editing}
                  className={`mt-2 w-full resize-none rounded-lg border-0 bg-transparent px-0 py-0 text-sm leading-relaxed text-slate-800 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 ${!editing ? "text-slate-700" : ""}`}
                  placeholder="Short text buyers see about your shop…"
                />
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Account</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ishyigaAccount">Ishyiga account</Label>
                  <Input
                    id="ishyigaAccount"
                    value={form.ishyigaAccount ?? ""}
                    onChange={(e) => setForm((f: Partial<User>) => ({ ...f, ishyigaAccount: e.target.value }))}
                    readOnly={!editing}
                    className={`font-mono text-sm ${!editing ? "border-transparent bg-slate-50" : ""}`}
                    placeholder="e.g. ALS…"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="owner">Owner / contact</Label>
                  <Input
                    id="owner"
                    value={form.owner ?? ""}
                    onChange={(e) => setForm((f: Partial<User>) => ({ ...f, owner: e.target.value }))}
                    readOnly={!editing}
                    className={!editing ? "border-transparent bg-slate-50" : ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessName">Business name</Label>
                  <Input
                    id="businessName"
                    value={form.businessName ?? ""}
                    onChange={(e) => setForm((f: Partial<User>) => ({ ...f, businessName: e.target.value }))}
                    readOnly={!editing}
                    className={!editing ? "border-transparent bg-slate-50" : ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessCategory">Category</Label>
                  <Input
                    id="businessCategory"
                    value={form.businessCategory ?? ""}
                    onChange={(e) => setForm((f: Partial<User>) => ({ ...f, businessCategory: e.target.value }))}
                    readOnly={!editing}
                    className={!editing ? "border-transparent bg-slate-50" : ""}
                  />
                </div>
              </div>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
