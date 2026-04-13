"use client"

import { useEffect, useState, type FormEvent } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuthStore } from "@/lib/auth-store"
import { loginWithCredentials, userCanAccessSellerSpace } from "@/lib/auth-login-client"
import { GRANDMA_OUTBOUND, GRANDMA_PATHS } from "@/lib/grandma-urls"

type Props = {
  redirectTo?: string
  defaultPhoneOrEmail?: string
}

/**
 * Ihute seller sign-in (warm palette). Styling hooks: `.grandma-login` classes.
 */
export function GrandmaLoginForm({ redirectTo = GRANDMA_PATHS.appRoot, defaultPhoneOrEmail = "" }: Props) {
  const router = useRouter()
  const authLogin = useAuthStore((s) => s.login)
  const [phoneOrEmail, setPhoneOrEmail] = useState(defaultPhoneOrEmail)
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setPhoneOrEmail(defaultPhoneOrEmail)
    setPassword("")
    setError(null)
  }, [defaultPhoneOrEmail])

  const registerHref = `${GRANDMA_OUTBOUND.registerSeller}?from=ihute&redirect=${encodeURIComponent(GRANDMA_PATHS.login)}`

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const user = await loginWithCredentials(phoneOrEmail.trim(), password)
      if (!userCanAccessSellerSpace(user)) {
        setError("Use a seller account to open this space.")
        return
      }
      authLogin(user)
      if (typeof window !== "undefined") {
        window.localStorage.setItem("grandma:mode", "seller")
      }
      const safe =
        redirectTo.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : GRANDMA_PATHS.appRoot
      router.push(safe)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign-in failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grandma-login rounded-2xl border border-[#e8dfd0] bg-white p-8 shadow-sm">
      <div className="mb-6 text-center">
        <div className="flex justify-center">
          <Image src="/images/ishyiga-logo.png" alt="Ishyiga" width={180} height={54} className="h-11 w-auto" />
        </div>
        <h1 className="grandma-login-title mt-5 text-xl font-bold tracking-tight text-[#2c2620]">
          Seller sign-in
        </h1>
        <p className="grandma-login-sub mt-2 text-sm leading-snug text-[#6b5e52]">Ishyiga Ihute — your shop</p>
      </div>

      <form onSubmit={onSubmit} className="grandma-login-form space-y-4">
        <div className="space-y-2">
          <Label htmlFor="grandma-login-id" className="text-[#3d342c]">
            Phone or email
          </Label>
          <Input
            id="grandma-login-id"
            type="text"
            autoComplete="username"
            placeholder="0788123456 or your seller email"
            value={phoneOrEmail}
            onChange={(e) => setPhoneOrEmail(e.target.value)}
            required
            className="grandma-login-input border-[#ddd4c4] bg-[#fdfcfa] text-[#2c2620] placeholder:text-[#9a8f84]"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="grandma-login-pw" className="text-[#3d342c]">
              Password
            </Label>
            <Link
              href={GRANDMA_OUTBOUND.forgotPassword}
              className="grandma-login-link text-xs font-medium text-[#8b6914] hover:underline"
            >
              Forgot?
            </Link>
          </div>
          <Input
            id="grandma-login-pw"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="grandma-login-input border-[#ddd4c4] bg-[#fdfcfa] text-[#2c2620]"
          />
        </div>
        {error ? (
          <p className="grandma-login-error text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        <Button
          type="submit"
          disabled={loading}
          className="grandma-login-submit h-11 w-full rounded-xl bg-[#4a5d3f] font-semibold text-white hover:bg-[#3d4f35] disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Enter shop space"}
        </Button>
      </form>

      <p className="grandma-login-footer mt-6 text-center text-sm text-[#6b5e52]">
        New shop?{" "}
        <Link href={registerHref} className="font-medium text-[#8b6914] hover:underline">
          Register / list your shop
        </Link>
      </p>
    </div>
  )
}
