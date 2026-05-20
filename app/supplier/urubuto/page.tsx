"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useAuthStore } from "@/lib/auth-store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EligibilityChecklist } from "@/components/urubuto/eligibility-checklist"
import { UrubutoLiveBadge, UrubutoPipelineBadge } from "@/components/urubuto/pipeline-badge"
import {
  DOC_TYPE_LABELS,
  WIZARD_STEPS,
  wizardStepIndex,
  type PipelineStage,
  type UrubutoBreakdown,
  type UrubutoChecklistItem,
} from "@/lib/urubuto-pipeline"
import { UrubutoTransactionReport } from "@/components/urubuto/transaction-report"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { ArrowLeft, Bell, ChevronDown, FileText, Loader2, Upload } from "lucide-react"

type UrubutoNotification = {
  id: number
  action?: string
  message: string
  isRead?: boolean
  createdAt?: string
}

const DOC_TYPES = [
  "CERTIFICATE_INCORPORATION",
  "REPRESENTATIVE_ID",
  "SIGNED_MERCHANT_FORM",
] as const

export default function SupplierUrubutoPage() {
  const { user, isAuthenticated, hasHydrated } = useAuthStore()
  const account = user?.ishyigaAccount?.trim() ?? ""

  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingType, setUploadingType] = useState<string | null>(null)
  const [merchant, setMerchant] = useState<Record<string, unknown> | null>(null)
  const [docs, setDocs] = useState<{ doc_type: string; verified?: boolean; rejection_reason?: string }[]>([])
  const [breakdown, setBreakdown] = useState<UrubutoBreakdown | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<UrubutoNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [onboardingOpen, setOnboardingOpen] = useState(false)
  const refresh = useCallback(async (): Promise<number> => {
    if (!account) return 0
    setLoading(true)
    try {
      const [mRes, eRes, dRes, nRes] = await Promise.all([
        fetch(`/api/supplier/urubuto/merchant?account=${encodeURIComponent(account)}`),
        fetch(`/api/supplier/urubuto/eligibility?account=${encodeURIComponent(account)}`),
        fetch(`/api/supplier/urubuto/documents?account=${encodeURIComponent(account)}`),
        fetch(`/api/supplier/urubuto/notifications?account=${encodeURIComponent(account)}`),
      ])
      const m = await mRes.json()
      const e = await eRes.json()
      const d = await dRes.json()
      const n = await nRes.json()
      setMerchant(m.merchant ?? null)
      setDocs(d.documents ?? [])
      setBreakdown({
        pipelineStage: (e.pipelineStage as PipelineStage) || "not_started",
        eligible: !!e.eligible,
        nextAction: e.nextAction || "",
        sellerMessage: e.sellerMessage || e.message || "",
        checklist: (e.checklist as UrubutoChecklistItem[]) || [],
        verifiedDocCount: e.verifiedDocCount,
        uploadedDocCount: e.uploadedDocCount,
      })
      const list = (n.notifications as UrubutoNotification[]) ?? []
      setNotifications(list)
      const unread = list.filter((x) => !x.isRead).length
      setUnreadCount(unread)
      return unread
    } finally {
      setLoading(false)
    }
  }, [account])

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated || !account) return
    void refresh()
    const id = setInterval(() => void refresh(), 45000)
    return () => clearInterval(id)
  }, [hasHydrated, isAuthenticated, account, refresh])

  const register = async () => {
    setRegistering(true)
    setNotice(null)
    try {
      const res = await fetch("/api/supplier/urubuto/merchant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account, display_name: user?.name || account, application_channel: "IHUTE" }),
      })
      const data = await res.json()
      if (!data.ok && !data.merchant) {
        setNotice(data.message || data.error || "Registration failed")
        return
      }
      setNotice("Application started.")
      await refresh()
    } catch {
      setNotice("Registration failed")
    } finally {
      setRegistering(false)
    }
  }

  const submitForReview = async () => {
    setSubmitting(true)
    setNotice(null)
    try {
      const res = await fetch("/api/supplier/urubuto/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account }),
      })
      const data = await res.json()
      if (!data.ok) {
        setNotice(data.message || data.error || "Submit failed")
        return
      }
      setNotice("Submitted for review. We will notify you when UrubutoPay is live.")
      await refresh()
    } catch {
      setNotice("Submit failed")
    } finally {
      setSubmitting(false)
    }
  }

  const markNotificationsRead = async () => {
    const idsToMark = notifications.filter((n) => !n.isRead).map((n) => n.id)
    try {
      const res = await fetch("/api/supplier/urubuto/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account, notificationIds: idsToMark }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.ok === false) {
        setNotice(data.message || data.error || "Could not mark notifications as read")
        return
      }
      const rowsUpdated = Number(data.rowsUpdated ?? 0)
      const stillUnread = await refresh()
      if (stillUnread > 0 && rowsUpdated === 0 && idsToMark.length > 0) {
        setNotice(
          "Read state did not save on the server. Run kaos/docs/migration_notification_urubuto_read.sql (add is_read), redeploy Kaos, then try again.",
        )
        return
      }
      setNotice(null)
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("ihute-urubuto-notifications-read"))
      }
    } catch {
      setNotice("Could not mark notifications as read")
    }
  }

  const unreadNotifications = notifications.filter((n) => !n.isRead)
  const bannerUnread = unreadNotifications.length

  const uploadDoc = async (docType: string, file: File) => {
    setUploadingType(docType)
    setNotice(null)
    try {
      const fd = new FormData()
      fd.append("account", account)
      fd.append("doc_type", docType)
      fd.append("file", file)
      const res = await fetch("/api/supplier/urubuto/onboarding-documents", { method: "POST", body: fd })
      const data = await res.json()
      if (data.status !== 200 && !data.ok) {
        setNotice(data.message || "Upload failed")
        return
      }
      setNotice("Document uploaded.")
      await refresh()
    } catch {
      setNotice("Upload failed")
    } finally {
      setUploadingType(null)
    }
  }

  if (!hasHydrated) return null
  if (!isAuthenticated || !account) {
    return (
      <div className="p-6">
        <p className="text-gray-600">Sign in as a supplier to manage UrubutoPay.</p>
      </div>
    )
  }

  const stage = breakdown?.pipelineStage ?? (merchant ? "applied" : "not_started")
  const step = wizardStepIndex(stage)
  const eligible = breakdown?.eligible ?? false

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50/80 to-gray-50 p-3 md:p-5 lg:p-6">
      <div className={cn("mx-auto space-y-4", eligible ? "max-w-6xl" : "max-w-6xl")}>
        <Link href="/supplier/dashboard" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>

        <div className="rounded-xl border border-violet-200 bg-white p-4 shadow-sm md:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-xl font-semibold text-gray-900 md:text-2xl">UrubutoPay</h1>
                {eligible ? (
                  <UrubutoLiveBadge eligible />
                ) : (
                  <UrubutoPipelineBadge stage={stage} />
                )}
              </div>
              <p className="mt-1 max-w-3xl text-sm text-gray-600">
                {eligible
                  ? "MoMo and card payments are active at checkout."
                  : "Accept MoMo and card from customers — fast, secure payments powered by UrubutoPay on IHUTE."}
              </p>
            </div>
            {eligible && (
              <Link href="/supplier/settings/location" className="text-sm text-violet-700 underline sm:mt-1">
                Payment settings
              </Link>
            )}
          </div>
          {process.env.NEXT_PUBLIC_TRADING_BETA === "true" && (
            <p className="mt-2 text-xs font-medium text-amber-800 bg-amber-50 inline-block px-2 py-1 rounded">
              Test environment
            </p>
          )}
        </div>

        {!eligible && (
        <ol className="grid grid-cols-4 gap-1.5">
          {WIZARD_STEPS.map((s, i) => (
            <li
              key={s.id}
              className={`rounded-lg border px-2 py-1.5 text-center text-[11px] md:px-3 md:text-xs ${
                i <= step ? "border-violet-400 bg-violet-50 text-violet-900" : "border-gray-200 bg-white text-gray-500"
              }`}
            >
              <div className="font-semibold leading-tight">{s.title}</div>
              <div className="mt-0.5 hidden leading-tight md:block">{s.description}</div>
            </li>
          ))}
        </ol>
        )}

        {notice && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">{notice}</div>
        )}

        {bannerUnread > 0 && (
          <div className="rounded-lg border border-violet-300 bg-violet-50 px-4 py-3 text-sm text-violet-950 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-start gap-2">
              <Bell className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">
                  {bannerUnread} Urubuto update{bannerUnread === 1 ? "" : "s"}
                </p>
                <p className="text-xs text-violet-800 mt-0.5">
                  {unreadNotifications[0]?.message || "Document review or activation update"}
                </p>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => void markNotificationsRead()}>
              Mark read
            </Button>
          </div>
        )}

        {unreadNotifications.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4" />
                New updates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {unreadNotifications.slice(0, 8).map((n) => (
                <div
                  key={n.id}
                  className={`rounded-md border px-3 py-2 text-sm ${
                    n.isRead ? "border-gray-200 bg-white text-gray-700" : "border-violet-200 bg-violet-50/80 text-violet-950"
                  }`}
                >
                  <p>{n.message}</p>
                  {n.createdAt && (
                    <p className="text-xs text-gray-500 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
          </div>
        ) : (
          <>
            {!merchant && (
              <Card>
                <CardHeader>
                  <CardTitle>Start your application</CardTitle>
                  <CardDescription>Register once using your seller payer code {account}.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => void register()} disabled={registering}>
                    {registering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Start application
                  </Button>
                </CardContent>
              </Card>
            )}

            {merchant && (
              <>
                {!eligible && (
                  <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                    <div className="space-y-4">
                      <Card>
                        <CardHeader className="px-4 py-3">
                          <CardTitle className="text-base">Status</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 px-4 pb-4">
                          <p className="text-sm text-gray-800">{breakdown?.sellerMessage}</p>
                          <EligibilityChecklist items={breakdown?.checklist ?? []} />
                        </CardContent>
                      </Card>

                      {(breakdown?.uploadedDocCount ?? 0) >= 3 && (
                        <Card>
                          <CardHeader className="px-4 py-3">
                            <CardTitle className="text-base">Submit for review</CardTitle>
                            <CardDescription>Send your file to IHUTE ops for Urubuto activation.</CardDescription>
                          </CardHeader>
                          <CardContent className="px-4 pb-4">
                            <Button onClick={() => void submitForReview()} disabled={submitting} className="w-full sm:w-auto">
                              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                              Submit for review
                            </Button>
                          </CardContent>
                        </Card>
                      )}
                    </div>

                    <Card>
                      <CardHeader className="px-4 py-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Documents (3 required)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 px-4 pb-4">
                        {DOC_TYPES.map((dt) => {
                          const existing = docs.find((d) => d.doc_type === dt)
                          const labels = DOC_TYPE_LABELS[dt]
                          return (
                            <div
                              key={dt}
                              className="rounded-lg border border-gray-200 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <p className="font-medium text-gray-900">{labels?.en ?? dt}</p>
                                <p className="text-xs text-gray-500">{labels?.rw}</p>
                                {existing ? (
                                  <p className="text-xs mt-1 text-gray-600">
                                    {existing.verified ? "✓ Verified" : "Uploaded — under review"}
                                    {existing.rejection_reason && (
                                      <span className="block text-red-700">Rejected: {existing.rejection_reason}</span>
                                    )}
                                  </p>
                                ) : (
                                  <p className="text-xs mt-1 text-amber-700">Missing — pdf, jpg, or png</p>
                                )}
                              </div>
                              <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md bg-violet-600 px-3 py-2 text-sm text-white hover:bg-violet-700 sm:w-28">
                                <Upload className="h-4 w-4" />
                                {uploadingType === dt ? "Uploading…" : existing ? "Replace" : "Upload"}
                                <input
                                  type="file"
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  className="hidden"
                                  disabled={uploadingType !== null}
                                  onChange={(e) => {
                                    const f = e.target.files?.[0]
                                    if (f) void uploadDoc(dt, f)
                                    e.target.value = ""
                                  }}
                                />
                              </label>
                            </div>
                          )
                        })}
                      </CardContent>
                    </Card>
                  </div>
                )}

                {eligible && <UrubutoTransactionReport account={account} key="tx-report" />}

                {eligible && (
                  <Collapsible open={onboardingOpen} onOpenChange={setOnboardingOpen}>
                    <Card>
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-2 px-6 py-4 text-left hover:bg-gray-50/80"
                        >
                          <span className="text-sm font-medium text-gray-700">Application &amp; compliance</span>
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 text-gray-500 transition-transform",
                              onboardingOpen && "rotate-180",
                            )}
                          />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="pt-0 space-y-4 border-t">
                          <EligibilityChecklist items={breakdown?.checklist ?? []} />
                          <div className="space-y-3">
                            {DOC_TYPES.map((dt) => {
                              const existing = docs.find((d) => d.doc_type === dt)
                              const labels = DOC_TYPE_LABELS[dt]
                              return (
                                <div
                                  key={dt}
                                  className="rounded-lg border border-gray-200 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm"
                                >
                                  <div>
                                    <p className="font-medium">{labels?.en ?? dt}</p>
                                    <p className="text-xs text-gray-500">
                                      {existing?.verified ? "Verified" : existing ? "Uploaded" : "Missing"}
                                    </p>
                                  </div>
                                  <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-gray-50">
                                    <Upload className="h-3 w-3" />
                                    Replace
                                    <input
                                      type="file"
                                      accept=".pdf,.jpg,.jpeg,.png"
                                      className="hidden"
                                      disabled={uploadingType !== null}
                                      onChange={(e) => {
                                        const f = e.target.files?.[0]
                                        if (f) void uploadDoc(dt, f)
                                        e.target.value = ""
                                      }}
                                    />
                                  </label>
                                </div>
                              )
                            })}
                          </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
