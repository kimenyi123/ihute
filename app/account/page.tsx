"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, User, Save } from "lucide-react"
import { useAuthStore, type User } from "@/lib/auth-store"

export default function AccountPage() {
  const router = useRouter()
  const { user, isAuthenticated, hasHydrated, updateUser } = useAuthStore()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
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
            setForm((prev) => ({
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
  }, [hasHydrated, isAuthenticated, user, router])

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

  return (
    <div className="container max-w-2xl py-8 px-4">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5" />
            <CardTitle>My profile</CardTitle>
          </div>
          {!editing ? (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Edit profile
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-1" />
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <CardDescription>View and edit your account details.</CardDescription>

          {message && (
            <div
              className={`rounded-lg px-3 py-2 text-sm ${
                message.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                readOnly={!editing}
                className={!editing ? "bg-muted" : ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email ?? ""}
                readOnly
                className="bg-muted"
                title="Email cannot be changed here"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={form.phone ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                readOnly={!editing}
                className={!editing ? "bg-muted" : ""}
                placeholder="e.g. 0781234567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={form.location ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                readOnly={!editing}
                className={!editing ? "bg-muted" : ""}
                placeholder="e.g. Kigali"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="momo">MoMo code</Label>
              <Input
                id="momo"
                value={form.momo ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, momo: e.target.value }))}
                readOnly={!editing}
                className={!editing ? "bg-muted" : ""}
                placeholder="e.g. 0781234567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                value={form.currency ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                readOnly={!editing}
                className={!editing ? "bg-muted" : ""}
                placeholder="e.g. RWF, USD"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nickname">Nickname</Label>
            <Input
              id="nickname"
              value={form.nickname ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, nickname: e.target.value }))}
              readOnly={!editing}
              className={!editing ? "bg-muted" : ""}
              placeholder="e.g. for Shop with Me URL"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              rows={3}
              value={form.description ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              readOnly={!editing}
              className={`flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${!editing ? "bg-muted" : ""}`}
              placeholder="Profile or business description"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ishyigaAccount">Ishyiga account</Label>
              <Input
                id="ishyigaAccount"
                value={form.ishyigaAccount ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, ishyigaAccount: e.target.value }))}
                readOnly={!editing}
                className={!editing ? "bg-muted" : ""}
                placeholder="e.g. ALG00001234"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner">Owner / Business contact</Label>
              <Input
                id="owner"
                value={form.owner ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}
                readOnly={!editing}
                className={!editing ? "bg-muted" : ""}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="businessName">Business name</Label>
              <Input
                id="businessName"
                value={form.businessName ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
                readOnly={!editing}
                className={!editing ? "bg-muted" : ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessCategory">Business category</Label>
              <Input
                id="businessCategory"
                value={form.businessCategory ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, businessCategory: e.target.value }))}
                readOnly={!editing}
                className={!editing ? "bg-muted" : ""}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground pt-2">
            Role: <span className="font-medium capitalize">{user.role}</span>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
