"use client"

import type React from "react"
import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"
import { useAuthStore } from "@/lib/auth-store"
import type { User, UserRole } from "@/lib/auth-store"

// --- LOGGING UTILITY (fully disabled to avoid leaking sensitive info) ---
const isLoginDebugEnabled = false
const log = (tag: string, msg: string, data?: any) => {
  if (!isLoginDebugEnabled) return
  const timestamp = new Date().toISOString().split("T")[1].slice(0, 8)
  if (data !== undefined) {
    console.log(`[${timestamp}] [${tag}] ${msg}`, data)
  } else {
    console.log(`[${timestamp}] [${tag}] ${msg}`)
  }
}

type ApiLoginOK = {
  ok: true
  role: "BUYER" | "SELLER" | "ADMIN" | "DRIVER" | "FINANCIER"
  ishyiga: string
  dbRole?: string
  dualPharmacyRetail?: boolean
  pharmacySector?: boolean
  user: { email: string; firstName: string; lastName: string; tel: string; location: string; owner: string }
}

function toUserRoleFromAuth(auth: Pick<ApiLoginOK, "role" | "dualPharmacyRetail">): UserRole {
  const dbRole = auth.role?.toUpperCase()
  if (dbRole === "ADMIN") return "admin"
  if (auth.dualPharmacyRetail) return "supplier"
  if (dbRole === "SELLER") return "supplier"
  return "customer"
}

function normalizeToStoreUser(payload: ApiLoginOK): User {
  const u = (payload as any).user ?? {}
  const email = String(u.email ?? (payload as any).email ?? "").trim()
  if (!email) {
    throw new Error("Login succeeded but profile data is incomplete. Check Java user-auth JSON (user.email).")
  }
  return {
    id: email,
    email,
    name:
      [u.firstName, u.lastName].filter(Boolean).join(" ") ||
      String(u.owner ?? "").trim() ||
      email,
    role: toUserRoleFromAuth(payload),
    dbRole: payload.dbRole,
    dualPharmacyRetail: !!payload.dualPharmacyRetail,
    pharmacySector: !!payload.pharmacySector,
    phone: String(u.tel ?? "").trim(),
    location: String(u.location ?? "").trim(),
    ishyigaAccount: payload.ishyiga || undefined,
    businessName: u.owner ? String(u.owner).trim() : undefined,
  }
}

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams?.get("redirect")
  const login = useAuthStore((s) => s.login)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const rid = crypto.randomUUID()
    log("LOGIN", `START [RID ${rid}]`)
    log("LOGIN", `Email: "${email}" (length=${email.length})`)
    log("LOGIN", `Password length: ${password.length}`)

    try {
      log("LOGIN", `Sending to /api/auth/login`)

      const emailTrimmed = email.trim()
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailTrimmed, password }),
      })

      log("LOGIN", `HTTP Status: ${res.status}`)

      const json = await res.json().catch(async () => {
        const text = await res.text()
        log("LOGIN", `ERROR parsing JSON:`, text.substring(0, 300))
        throw new Error("Bad JSON from auth server")
      })

      log("LOGIN", `Response:`, json)

      if (!res.ok || !json?.ok) {
        throw new Error("Invalid credentials")
      }

      const user: User = normalizeToStoreUser(json as ApiLoginOK)
      log("LOGIN", `User normalized:`, user)

      login(user)

      // If they came from a link (e.g. "View my orders" QR), send them back after login
      const decoded = redirectTo ? decodeURIComponent(redirectTo) : ""
      const safeRedirect = decoded.startsWith("/") && !decoded.startsWith("//")
      if (safeRedirect && decoded.length > 0) {
        router.push(decoded)
        return
      }

      // Otherwise redirect based on role
      if (user.role === "admin") {
        router.push("/admin/dashboard")
      } else if (user.role === "supplier") {
        router.push("/supplier/dashboard")
      } else {
        router.push("/")
      }
    } catch (err: any) {
      const errorMsg = err?.message || "Network error"
      log("LOGIN", `ERROR: ${errorMsg}`)
      setError(errorMsg)
    } finally {
      setLoading(false)
      log("LOGIN", `END`)
    }
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
              <Image src="/images/ishyiga-logo.png" alt="Ishyiga Software" width={200} height={60} className="h-12 w-auto" />
            </div>
            <CardTitle className="text-2xl">Welcome Back</CardTitle>
            <CardDescription>Sign in to your account to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
            <div className="mt-6 text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Don&apos;t have an account? <Link href="/register" className="text-primary hover:underline font-medium">Register here</Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}