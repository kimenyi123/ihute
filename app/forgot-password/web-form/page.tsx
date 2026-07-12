"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

/** ihute.rw / web: email reset link → /reset-password?token=… */
export default function WebForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    const trimmed = email.trim()
    if (!trimmed) {
      setError("Enter the email address you used when registering.")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmed,
          publicSiteUrl: typeof window !== "undefined" ? window.location.origin : undefined,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        message?: string
      }
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "Could not send reset email")
      }
      setSent(true)
      setMessage(
        json?.message ||
          "If an account exists for that email, you will receive reset instructions shortly."
      )
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md space-y-4">
        <Link href="/login">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
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
            <CardTitle className="text-2xl">Forgot password</CardTitle>
            <CardDescription>
              Enter your account email. We will send a link to set a new password (valid for 24 hours).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="space-y-4 text-center">
                <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md p-3">
                  {message}
                </p>
                <Button asChild className="w-full">
                  <Link href="/login">Back to sign in</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    "Send reset link"
                  )}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Already have a reset link?{" "}
                  <Link href="/reset-password" className="text-[#1897e0] hover:underline font-medium">
                    Set new password
                  </Link>
                </p>
              </form>
            )}

            <div className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs font-medium text-[#1897e0]">
              <Link href="/register/buyer" className="hover:underline">
                Register
              </Link>
              <Link href="/login" className="hover:underline">
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
