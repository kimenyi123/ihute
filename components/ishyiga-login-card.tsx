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
import { loginWithCredentialsResult, type ApiLoginOK } from "@/lib/auth-login-client"
import type { User } from "@/lib/auth-store"
import { cn } from "@/lib/utils"

const defaultCardClass =
  "w-full rounded-2xl border border-[#dbe7f3] bg-white shadow-[0_8px_18px_rgba(24,151,224,.08)]"
/** Main ihute sign-in: full-width navy, strong radius (matches marketing login reference). */
const btnPrimaryNavy =
  "w-full rounded-[10px] bg-[#1a4a7a] hover:bg-[#153d68] active:bg-[#123a5c] text-white border-0 h-12 px-4 text-base font-semibold shadow-[0_2px_8px_rgba(26,74,122,.25)]"
const btnGrandmaGradient =
  "w-full rounded-xl bg-gradient-to-r from-[#1897e0] via-[#30acef] to-[#127fc0] hover:from-[#1589cc] hover:via-[#229fe6] hover:to-[#0f6ba3] text-white shadow-[0_4px_12px_rgba(24,151,224,.35)] border-0 h-11 font-semibold"

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
  /** Link label under the form (e.g. “Register as seller” when `registerHref` points to seller signup). */
  registerLinkText?: string
  forgotHref?: string
  showLogo?: boolean
  className?: string
  loginMode?: "phoneOnly" | "emailOnly" | "phoneOrEmail"
  uiVariant?: "ihute" | "grandma"
  /** When set, overrides the default tie between `uiVariant` and submit button look. */
  primaryButtonStyle?: "navy" | "gradient"
  onSuccess: (user: User) => void | Promise<void>
  /** Java returned `mustChangePassword` — caller shows set-password UI (e.g. `/login` dialog). */
  onMustChangePassword?: (payload: ApiLoginOK, password: string) => void | Promise<void>
}

export function IshyigaLoginCard({
  title = "Welcome back",
  description = "Sign in with your email",
  submitLabel = "Sign in",
  defaultPhone,
  defaultPhoneOrEmail,
  registerHref = "/register/buyer",
  registerLinkText,
  forgotHref = "/forgot-password",
  showLogo = true,
  className,
  loginMode = "phoneOrEmail",
  uiVariant = "ihute",
  primaryButtonStyle,
  onSuccess,
  onMustChangePassword,
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

  const isGrandmaUi = uiVariant === "grandma"
  const isPhoneOnly = loginMode === "phoneOnly"
  const isEmailOnly = loginMode === "emailOnly"
  const isIhuteEmailUi = isEmailOnly || (loginMode === "phoneOrEmail" && uiVariant === "ihute" && !isPhoneOnly)
  const loginFieldLabel = isPhoneOnly ? "Phone number" : isIhuteEmailUi ? "Email" : "Phone number or email"
  const loginFieldPlaceholder = isPhoneOnly
    ? "e.g. 0788123456"
    : isIhuteEmailUi
      ? "Email address"
      : "e.g. 0788123456 or name@example.com"
  const loginFieldType = isPhoneOnly ? "tel" : isIhuteEmailUi ? "email" : "text"
  const loginFieldInputMode: React.HTMLAttributes<HTMLInputElement>["inputMode"] = isPhoneOnly
    ? "tel"
    : isIhuteEmailUi
      ? "email"
      : "text"
  const loginFieldAutoComplete = isPhoneOnly ? "tel" : isIhuteEmailUi ? "email" : "username"
  const cardThemeClass = isGrandmaUi
    ? "w-full rounded-2xl border border-[#dbe7f3] bg-white shadow-[0_8px_18px_rgba(24,151,224,.08)]"
    : defaultCardClass
  const resolvedPrimaryButton =
    primaryButtonStyle ?? (isGrandmaUi ? "gradient" : "navy")
  const submitBtnClass = resolvedPrimaryButton === "gradient" ? btnGrandmaGradient : btnPrimaryNavy

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const id = phone.trim()
      if (loginMode === "phoneOnly") {
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
      }
      if (loginMode === "emailOnly") {
        if (!id.includes("@")) {
          setError("Sign in with the email address you used when registering.")
          setLoading(false)
          return
        }
      }
      const channel = isEmailOnly ? "email" : isPhoneOnly ? "phone" : "auto"
      const result = await loginWithCredentialsResult(id, password, channel)
      if (result.outcome === "must_change") {
        if (onMustChangePassword) {
          await onMustChangePassword(result.payload, password)
        } else {
          setError("This account must set a new password. Open ihute on a browser and sign in again.")
        }
      } else {
        await onSuccess(result.user)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Network error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className={cn(cardThemeClass, className)}>
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
              {loginFieldLabel}
            </Label>
            <Input
              id="ishyiga-login-phone"
              type={loginFieldType}
              inputMode={loginFieldInputMode}
              autoComplete={loginFieldAutoComplete}
              placeholder={loginFieldPlaceholder}
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
          <Button type="submit" className={submitBtnClass} disabled={loading}>
            {loading ? "Signing in…" : submitLabel}
          </Button>
        </form>
        <div className="mt-6 space-y-2 text-center">
          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href={registerHref} className="font-medium text-[#1897e0] hover:underline">
              {registerLinkText ?? "Register here"}
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
