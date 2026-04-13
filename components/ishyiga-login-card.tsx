"use client"

import type React from "react"
import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { loginWithCredentials } from "@/lib/auth-login-client"
import type { User } from "@/lib/auth-store"
import { cn } from "@/lib/utils"

const defaultCardClass = "w-full border-blue-100/90 shadow-lg shadow-blue-950/5"
const btnPrimary = "w-full bg-[#17324d] hover:bg-[#1e4260] text-white"

export type IshyigaLoginCardProps = {
  title?: string
  description?: string
  submitLabel?: string
  /** When this string changes (e.g. sheet opens), phone field resets to it and password clears */
  defaultPhoneOrEmail?: string
  registerHref?: string
  forgotHref?: string
  showLogo?: boolean
  className?: string
  onSuccess: (user: User) => void | Promise<void>
}

export function IshyigaLoginCard({
  title = "Welcome back",
  description = "Sign in with your phone number or email",
  submitLabel = "Sign in",
  defaultPhoneOrEmail = "",
  registerHref = "/register",
  forgotHref = "/forgot-password",
  showLogo = true,
  className,
  onSuccess,
}: IshyigaLoginCardProps) {
  const [phoneOrEmail, setPhoneOrEmail] = useState(defaultPhoneOrEmail)
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setPhoneOrEmail(defaultPhoneOrEmail)
    setPassword("")
    setError(null)
  }, [defaultPhoneOrEmail])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const user = await loginWithCredentials(phoneOrEmail.trim(), password)
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
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ishyiga-login-phone">Phone or email</Label>
            <Input
              id="ishyiga-login-phone"
              type="text"
              inputMode="tel"
              autoComplete="username"
              placeholder="e.g. 0788123456 or you@email.com"
              value={phoneOrEmail}
              onChange={(e) => setPhoneOrEmail(e.target.value)}
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
            <Input
              id="ishyiga-login-password"
              type="password"
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
