"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ArrowLeft, Loader2 } from "lucide-react"
import { PasswordInputWithToggle } from "@/components/password-input-with-toggle"
import { cn } from "@/lib/utils"

const cardClass =
  "rounded-2xl border-[#dbe7f3] bg-white shadow-[0_8px_18px_rgba(24,151,224,.08)]"
const btnPrimary =
  "w-full bg-gradient-to-r from-[#1897e0] to-[#127fc0] hover:from-[#1589cc] hover:to-[#0f6ba3] text-white shadow-[0_4px_12px_rgba(24,151,224,.25)] border-0"
const btnDialogPrimary =
  "bg-gradient-to-r from-[#1897e0] to-[#127fc0] hover:from-[#1589cc] hover:to-[#0f6ba3] text-white border-0"

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [phone, setPhone] = useState("")
  const [streetNumber, setStreetNumber] = useState("")
  const [pwdOpen, setPwdOpen] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const openPasswordDialog = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!phone.trim() || !streetNumber.trim()) {
      setError("Enter your phone and the street number or street name you used when registering.")
      return
    }
    setPwdOpen(true)
  }

  const submitReset = async () => {
    setError(null)
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tel: phone.trim(),
          streetNumber: streetNumber.trim(),
          newPassword,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        message?: string
      }
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Could not update password")
      }
      setPwdOpen(false)
      setDone(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#eef4fb] text-[#17324d]">
      <div className="mx-auto max-w-[430px] min-h-screen bg-gradient-to-b from-[#f7fbff] to-[#eef4fb] pb-28">
        <header className="sticky top-0 z-30 bg-gradient-to-r from-[#1897e0] via-[#30acef] to-[#127fc0] text-white shadow-[0_8px_20px_rgba(0,0,0,.1)]">
          <div className="flex items-center gap-2 px-3 py-3.5">
            <Link
              href="/login"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white/15 text-lg text-white hover:bg-white/25"
              aria-label="Back"
            >
              ←
            </Link>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-white/35 bg-white">
                <Image src="/images/ishyiga-logo.png" alt="" width={34} height={34} className="object-contain" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-lg font-bold leading-tight">Forgot password</div>
                <div className="truncate text-xs text-white/90">Phone + street, then new password</div>
              </div>
            </div>
          </div>
        </header>

        <div className="space-y-4 px-3 pt-4">
          <Link href="/login" className="inline-flex items-center gap-2 text-sm font-medium text-[#1897e0] hover:underline">
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>

          <Card className={cardClass}>
            <CardHeader className="space-y-2">
              <CardTitle className="text-xl text-[#17324d]">Reset your password</CardTitle>
              <CardDescription className="text-[#6f8399]">
                Use the phone you registered with and the street line from your address (same as at signup).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {done ? (
                <div className="space-y-4 text-center">
                  <p className="text-sm text-[#6f8399]">
                    Your password was updated. You can sign in with your phone number.
                  </p>
                  <Button className={btnPrimary} onClick={() => router.push("/login")}>
                    Go to sign in
                  </Button>
                </div>
              ) : (
                <form onSubmit={openPasswordDialog} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-[#17324d]">
                      Phone number
                    </Label>
                    <Input
                      id="phone"
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
                    <Label htmlFor="street" className="text-[#17324d]">
                      Street number or street name
                    </Label>
                    <Input
                      id="street"
                      type="text"
                      autoComplete="street-address"
                      placeholder="Same as on registration (e.g. KN 45 St)"
                      value={streetNumber}
                      onChange={(e) => setStreetNumber(e.target.value)}
                      className="border-[#dbe7f3] bg-white"
                      required
                    />
                    <p className="text-xs text-[#6f8399]">
                      Must match part of the address we store (including your street field at signup).
                    </p>
                  </div>
                  {error && !pwdOpen && <p className="text-sm text-red-600">{error}</p>}
                  <Button type="submit" className={btnPrimary}>
                    Continue to new password
                  </Button>
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

      <Dialog
        open={pwdOpen}
        onOpenChange={(o) => {
          setPwdOpen(o)
          if (o) setError(null)
        }}
      >
        <DialogContent
          className={cn(
            "sm:max-w-md rounded-2xl border-[#dbe7f3] bg-white p-6 text-[#17324d]",
            "shadow-[0_8px_24px_rgba(24,151,224,.15)]"
          )}
        >
          <DialogHeader>
            <DialogTitle className="text-xl text-[#17324d]">Set new password</DialogTitle>
            <DialogDescription className="text-[#6f8399]">Choose a new password for your account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="np" className="text-[#17324d]">
                New password
              </Label>
              <PasswordInputWithToggle
                id="np"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="border-[#dbe7f3]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="npc" className="text-[#17324d]">
                Confirm password
              </Label>
              <PasswordInputWithToggle
                id="npc"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="border-[#dbe7f3]"
              />
            </div>
            {error && pwdOpen && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="border-[#dbe7f3] bg-white"
              onClick={() => setPwdOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" className={btnDialogPrimary} onClick={submitReset} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save password"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
