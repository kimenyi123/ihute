"use client"

import type React from "react"
import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PasswordInputWithToggle } from "@/components/password-input-with-toggle"
import { loginWithCredentials } from "@/lib/auth-login-client"
import type { User } from "@/lib/auth-store"
import { cn } from "@/lib/utils"

const defaultCardClass =
  "w-full rounded-2xl border border-[#dbe7f3] bg-white shadow-[0_8px_18px_rgba(24,151,224,.08)]"
const btnPrimary =
  "w-full rounded-xl bg-gradient-to-r from-[#1897e0] to-[#127fc0] hover:from-[#1589cc] hover:to-[#0f6ba3] text-white shadow-[0_4px_12px_rgba(24,151,224,.25)] border-0 h-11 font-semibold"

/** Digits only count; Rwanda mobile typically 9–12 digits with or without country code. */
function isValidPhoneLogin(raw: string): boolean {
  const t = raw.trim()
  if (!t || t.includes("@")) return false
  const digits = t.replace(/\D/g, "")
  return digits.length >= 9 && digits.length <= 15
}

export type IshyigaLoginCardProps = {
  title?: string
  description?: string
  submitLabel?: string
  /** When this string changes (e.g. sheet opens), phone field resets to it and password clears */
  defaultPhone?: string
  /** @deprecated Use `defaultPhone` */
  defaultPhoneOrEmail?: string
  registerHref?: string
  forgotHref?: string
  showLogo?: boolean
  className?: string
  onSuccess: (user: User) => void | Promise<void>
}

export function IshyigaLoginCard({
  title = "Welcome back",
  description = "Sign in with your phone number",
  submitLabel = "Sign in",
  defaultPhone,
  defaultPhoneOrEmail,
  registerHref = "/register/buyer",
  forgotHref = "/forgot-password",
  showLogo = true,
  className,
  onSuccess,
}: IshyigaLoginCardProps) {
  const initialPhone = defaultPhone ?? defaultPhoneOrEmail ?? ""
  const [phone, setPhone] = useState(initialPhone)
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setPhone(defaultPhone ?? defaultPhoneOrEmail ?? "")
    setPassword("")
    setError(null)
  }, [defaultPhone, defaultPhoneOrEmail])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const id = phone.trim()
      if (id.includes("@")) {
        setError("Sign in with your phone number only, not email.")
        setLoading(false)
        return
      }
      if (!isValidPhoneLogin(id)) {
        setError("Enter a valid phone number (e.g. 0788123456).")
        setLoading(false)
        return
      }
      const user = await loginWithCredentials(id, password)
      await onSuccess(user)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Network error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className={cn(defaultCardClass, className)}>
      <CardHeader className="space-y-4 text-center">
        {showLogo ? (
          <div className="flex justify-center">
            <Image
              src="/images/ishyiga-logo.png"
              alt="Ishyiga Software"
              width={200}
              height={60}
              className="h-12 w-auto"
            />
          </div>
        ) : null}
        <CardTitle className="text-2xl text-[#17324d]">{title}</CardTitle>
        <CardDescription className="text-[#6f8399]">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ishyiga-login-phone" className="text-[#17324d]">
              Phone number
            </Label>
            <Input
              id="ishyiga-login-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="e.g. 0788123456"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="border-[#dbe7f3] bg-white"
              required
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="ishyiga-login-password">Password</Label>
              <Link href={forgotHref} className="text-xs font-medium text-[#1897e0] hover:underline">
                Forgot?
              </Link>
            </div>
            <PasswordInputWithToggle
              id="ishyiga-login-password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className={btnPrimary} disabled={loading}>
            {loading ? "Signing in…" : submitLabel}
          </Button>
        </form>
        <div className="mt-6 space-y-2 text-center">
          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href={registerHref} className="font-medium text-[#1897e0] hover:underline">
              Register here
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
