"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuthStore } from "@/lib/auth-store"
import type { User, UserRole } from "@/lib/auth-store"

// --- LOGGING UTILITY ---
const log = (tag: string, msg: string, data?: any) => {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 8)
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
  user: { email: string; firstName: string; lastName: string; tel: string; location: string; owner: string }
}

function toUserRole(r?: string): UserRole {
  return r?.toUpperCase() === "SELLER" ? "supplier" : "customer"
}

function normalizeToStoreUser(payload: ApiLoginOK): User {
  return {
    id: payload.user.email,
    email: payload.user.email,
    name: [payload.user.firstName, payload.user.lastName].filter(Boolean).join(" ") || payload.user.owner || payload.user.email,
    role: toUserRole(payload.role),
    phone: payload.user.tel || "",
    location: payload.user.location || "",
    ishyigaAccount: payload.ishyiga || undefined,
    businessName: payload.user.owner || undefined,
  }
}

export default function LoginPage() {
  const router = useRouter()
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
      
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      log("LOGIN", `HTTP Status: ${res.status}`)

      const json = await res.json().catch(async () => {
        const text = await res.text()
        log("LOGIN", `ERROR parsing JSON:`, text.substring(0, 300))
        throw new Error("Bad JSON from auth server")
      })

      log("LOGIN", `Response:`, json)

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `Login failed (${res.status})`)
      }

      const user: User = normalizeToStoreUser(json as ApiLoginOK)
      log("LOGIN", `User normalized:`, user)

      login(user)
      router.push(user.role === "supplier" ? "/supplier/dashboard" : "/")
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
      <Card className="w-full max-w-md">
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
  )
}