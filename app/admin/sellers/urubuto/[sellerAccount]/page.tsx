"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, Copy, Download, Loader2, Mail, RefreshCw } from "lucide-react"
import { postAdminApi, postAdminUrubutoMerchantDocumentDownload } from "@/lib/admin-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { EligibilityChecklist } from "@/components/urubuto/eligibility-checklist"
import { UrubutoPipelineBadge } from "@/components/urubuto/pipeline-badge"
import type { PipelineStage, UrubutoBreakdown, UrubutoChecklistItem } from "@/lib/urubuto-pipeline"
import { DOC_TYPE_LABELS } from "@/lib/urubuto-pipeline"
import {
  formatUrubutoAuditPayloadLines,
  formatUrubutoAuditTitle,
  type UrubutoAuditEvent,
} from "@/lib/urubuto-audit"

interface UrubutoMerchantJson {
  id: number
  displayName: string
  sellerPayerCode: string
  urubutoMerchantCode: string
  urubutoServiceCode: string
  status: string
  applicationChannel?: string
}

interface UrubutoOnboardingJson {
  onboardingApproved: boolean
  remoteOnboarded: boolean | null
  remoteCheckedAt: string
  sellerSubmittedAt?: string
  submittedToUrubutoAt?: string
  submittedToUrubutoBy?: string
  internalNote?: string
}

interface UrubutoDocRow {
  documentId: number
  docType: string
  originalFilename: string
  verified: boolean
  verifiedBy: string
  verifiedAt: string
  uploadedAt: string
  rejectionReason?: string
}

export default function UrubutoMerchantApplicationPage() {
  const params = useParams()
  const sellerAccount = decodeURIComponent(String(params.sellerAccount ?? ""))

  const [merchant, setMerchant] = useState<UrubutoMerchantJson | null>(null)
  const [onboarding, setOnboarding] = useState<UrubutoOnboardingJson | null>(null)
  const [documents, setDocuments] = useState<UrubutoDocRow[]>([])
  const [breakdown, setBreakdown] = useState<UrubutoBreakdown | null>(null)
  const [audit, setAudit] = useState<UrubutoAuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resendingEmail, setResendingEmail] = useState(false)
  const [sendingLiveEmail, setSendingLiveEmail] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)

  const [codeInput, setCodeInput] = useState("")
  const [serviceCodeInput, setServiceCodeInput] = useState("")
  const [statusInput, setStatusInput] = useState("PENDING")
  const [onboardingApproved, setOnboardingApproved] = useState(false)
  const [internalNote, setInternalNote] = useState("")
  const [rejectReason, setRejectReason] = useState<Record<number, string>>({})

  const load = useCallback(async () => {
    if (!sellerAccount) return
    setLoading(true)
    setError(null)
    try {
      const res = await postAdminApi({
        action: "getUrubutoMerchantApplicationDetail",
        sellerAccount,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok && !data.error) {
        setError(`Backend error (${res.status})`)
        return
      }
      if (data.ok && data.merchant) {
        const m = data.merchant as UrubutoMerchantJson
        setMerchant(m)
        setOnboarding((data.onboarding as UrubutoOnboardingJson) ?? null)
        setDocuments((data.documents as UrubutoDocRow[]) || [])
        const b = data.breakdown as UrubutoBreakdown
        setBreakdown({
          pipelineStage: (b?.pipelineStage as PipelineStage) || "applied",
          eligible: !!b?.eligible,
          nextAction: b?.nextAction || "",
          sellerMessage: b?.sellerMessage || "",
          checklist: (b?.checklist as UrubutoChecklistItem[]) || [],
        })
        setCodeInput(m.urubutoMerchantCode || "")
        setServiceCodeInput(m.urubutoServiceCode || "")
        setStatusInput(m.status || "PENDING")
        setOnboardingApproved(!!(data.onboarding as UrubutoOnboardingJson)?.onboardingApproved)
        setInternalNote((data.onboarding as UrubutoOnboardingJson)?.internalNote || "")
      } else {
        const hint =
          typeof data.raw === "string" && data.raw
            ? ` — ${data.raw.slice(0, 120)}`
            : typeof data.url === "string" && data.url
              ? ` (${data.url})`
              : ""
        setError((data.error || "Could not load") + hint)
      }
      const auditRes = await postAdminApi({ action: "getUrubutoMerchantAuditLog", sellerAccount, limit: 30 })
      const auditData = await auditRes.json()
      if (auditData.ok && Array.isArray(auditData.audit)) {
        setAudit(auditData.audit)
      }
    } catch {
      setError("Failed to load")
    } finally {
      setLoading(false)
    }
  }, [sellerAccount])

  useEffect(() => {
    void load()
  }, [load])

  const adminAction = async (
    action: string,
    extra: Record<string, string | number> = {},
    successMessage = "Saved",
  ) => {
    setSaving(true)
    setFeedback(null)
    try {
      const res = await postAdminApi({ action, sellerAccount, ...extra })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        alert(data.error || data.message || "Action failed")
        return
      }
      await load()
      setFeedback(data.message || successMessage)
    } catch {
      alert("Action failed")
    } finally {
      setSaving(false)
    }
  }

  const saveMerchant = () =>
    void adminAction("updateUrubutoMerchant", {
      status: statusInput,
      urubutoMerchantCode: codeInput.trim(),
      urubutoServiceCode: serviceCodeInput.trim(),
      onboardingApproved: onboardingApproved ? "true" : "false",
    }, "Merchant saved")

  const resendReviewEmail = async () => {
    setResendingEmail(true)
    setFeedback(null)
    try {
      const res = await postAdminApi({ action: "resendUrubutoReviewEmail", sellerAccount })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        alert(data.error || data.message || "Could not resend review email")
        return
      }
      await load()
      setFeedback(data.message || "Review email resent")
    } catch {
      alert("Could not resend review email")
    } finally {
      setResendingEmail(false)
    }
  }

  const sendLiveEmail = async () => {
    setSendingLiveEmail(true)
    setFeedback(null)
    try {
      const res = await postAdminApi({ action: "sendUrubutoLiveEmail", sellerAccount })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        alert(data.error || data.message || "Could not send seller live email")
        return
      }
      await load()
      setFeedback(data.message || "Seller live email sent")
    } catch {
      alert("Could not send seller live email")
    } finally {
      setSendingLiveEmail(false)
    }
  }

  const copy = (text: string) => {
    void navigator.clipboard.writeText(text)
  }

  const handleDownload = async (documentId: number, suggestedName: string) => {
    setDownloadingId(documentId)
    try {
      const res = await postAdminUrubutoMerchantDocumentDownload({ sellerAccount, documentId })
      const ct = res.headers.get("content-type") || ""
      if (ct.includes("application/json")) {
        const j = (await res.json()) as { error?: string }
        alert(j.error || "Download failed")
        return
      }
      if (!res.ok) {
        alert("Download failed")
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = suggestedName || "document"
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloadingId(null)
    }
  }

  const stage = breakdown?.pipelineStage ?? "applied"
  const hasDownloadableDocument = (doc: UrubutoDocRow) => Boolean(doc.originalFilename?.trim())
  const liveEmailMissing = [
    merchant?.status === "ACTIVE" ? null : "set status to ACTIVE",
    merchant?.urubutoMerchantCode?.trim() ? null : "add merchant code",
    merchant?.urubutoServiceCode?.trim() ? null : "add service code",
    onboarding?.onboardingApproved ? null : "approve IHUTE onboarding",
  ].filter(Boolean) as string[]
  const canSendLiveEmail =
    liveEmailMissing.length === 0

  return (
    <div className="min-h-screen bg-gray-50 p-3 md:p-5 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        <Link
          href="/admin/sellers?tab=urubuto"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={18} />
          UrubutoPay applications
        </Link>

        <div className="flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900 md:text-2xl">Urubuto ops cockpit</h1>
            <UrubutoPipelineBadge stage={stage} />
            {breakdown?.eligible && (
              <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">Eligible</span>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} className="w-full sm:w-auto">
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>

        {loading && <p className="text-gray-600">Loading…</p>}
        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

        {!loading && merchant && (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.65fr)]">
            {/* Left: profile */}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
              <Card>
                <CardHeader className="px-4 py-3">
                  <CardTitle className="text-base">Seller profile</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 px-4 pb-4 text-sm sm:grid-cols-2 xl:grid-cols-1">
                  <div>
                    <span className="text-gray-500">Payer code</span>
                    <div className="flex items-center gap-2 font-mono font-medium break-all">
                      {merchant.sellerPayerCode}
                      <button type="button" onClick={() => copy(merchant.sellerPayerCode)} aria-label="Copy">
                        <Copy className="h-4 w-4 text-gray-400" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">Display name</span>
                    <div>{merchant.displayName || "—"}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Channel</span>
                    <div>{merchant.applicationChannel || "IHUTE"}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Urubuto merchant code</span>
                    <div className="flex items-center gap-2 font-mono break-all">
                      {merchant.urubutoMerchantCode || "—"}
                      {merchant.urubutoMerchantCode && (
                        <button type="button" onClick={() => copy(merchant.urubutoMerchantCode)} aria-label="Copy">
                          <Copy className="h-4 w-4 text-gray-400" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">Urubuto service code</span>
                    <div className="flex items-center gap-2 font-mono break-all">
                      {merchant.urubutoServiceCode || "—"}
                      {merchant.urubutoServiceCode && (
                        <button type="button" onClick={() => copy(merchant.urubutoServiceCode)} aria-label="Copy">
                          <Copy className="h-4 w-4 text-gray-400" />
                        </button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="px-4 py-3">
                  <CardTitle className="text-base">Onboarding progress</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-sm text-gray-700 mb-2">{breakdown?.sellerMessage}</p>
                  <EligibilityChecklist items={breakdown?.checklist ?? []} showFixedBy />
                  <Button
                    className="mt-3 w-full"
                    variant="secondary"
                    size="sm"
                    disabled={saving}
                    onClick={() => void adminAction("rerunUrubutoRemoteCheck", {}, "Remote check refreshed")}
                  >
                    Re-run remote check
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Right: workflow */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="px-4 py-3">
                  <CardTitle className="text-base">Ops actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 px-4 pb-4 text-sm">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-gray-600">Urubuto merchant code</span>
                      <input
                        className="mt-1 w-full rounded border px-2 py-1.5 font-mono"
                        value={codeInput}
                        onChange={(e) => setCodeInput(e.target.value)}
                      />
                    </label>
                    <label className="block">
                      <span className="text-gray-600">Urubuto service code</span>
                      <input
                        className="mt-1 w-full rounded border px-2 py-1.5 font-mono"
                        value={serviceCodeInput}
                        onChange={(e) => setServiceCodeInput(e.target.value)}
                        placeholder="e.g. SERVICE123"
                      />
                    </label>
                    <label className="block">
                      <span className="text-gray-600">Status</span>
                      <select
                        className="mt-1 w-full rounded border px-2 py-1.5"
                        value={statusInput}
                        onChange={(e) => setStatusInput(e.target.value)}
                      >
                        <option value="PENDING">PENDING</option>
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="REJECTED">REJECTED</option>
                      </select>
                    </label>
                  </div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={onboardingApproved}
                      onChange={(e) => setOnboardingApproved(e.target.checked)}
                    />
                    IHUTE onboarding approved
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <Button onClick={() => void saveMerchant()} disabled={saving} className="sm:w-auto">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                      Save merchant
                    </Button>
                    <Button
                      variant="outline"
                      disabled={saving}
                      onClick={() =>
                        void adminAction(
                          "markUrubutoSubmittedToUrubuto",
                          {},
                          "Marked as submitted to Urubuto",
                        )
                      }
                      className="sm:w-auto"
                    >
                      Mark submitted to Urubuto
                    </Button>
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Ops/internal email</p>
                    <p className="mt-1 text-xs text-gray-600">
                      Resends the internal review notification to IHUTE/Urubuto ops. This is not sent to the seller.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={saving || resendingEmail || !onboarding?.sellerSubmittedAt}
                      onClick={() => void resendReviewEmail()}
                      className="mt-2 w-full whitespace-nowrap sm:w-auto"
                      title={!onboarding?.sellerSubmittedAt ? "Available after the seller submits the application for review" : "Resend the ops review email"}
                    >
                      {resendingEmail ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Mail className="h-4 w-4 mr-1" />}
                      Resend ops review email
                    </Button>
                    {!onboarding?.sellerSubmittedAt && (
                      <p className="mt-2 text-xs text-amber-700">Available after the seller submits the application for review.</p>
                    )}
                  </div>

                  <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Seller live email</p>
                    <p className="mt-1 text-xs text-gray-700">
                      Sends the seller a congratulations email when UrubutoPay is fully ready on IHUTE.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={saving || sendingLiveEmail || !canSendLiveEmail}
                      onClick={() => void sendLiveEmail()}
                      className="mt-2 w-full whitespace-nowrap border-violet-300 bg-white text-violet-800 hover:bg-violet-100 sm:w-auto"
                      title={
                        canSendLiveEmail
                          ? "Send the seller their UrubutoPay live confirmation email"
                          : `Live email available after: ${liveEmailMissing.join(", ")}`
                      }
                    >
                      {sendingLiveEmail ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Mail className="h-4 w-4 mr-1" />}
                      Send live email to seller
                    </Button>
                    {!canSendLiveEmail && (
                      <p className="mt-2 text-xs text-amber-800">
                        Live email available after: {liveEmailMissing.join(", ")}.
                      </p>
                    )}
                  </div>
                  {feedback && (
                    <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
                      {feedback}
                    </p>
                  )}
                  {onboarding?.submittedToUrubutoAt && (
                    <p className="text-xs text-gray-500">
                      Submitted to Urubuto: {onboarding.submittedToUrubutoAt}
                      {onboarding.submittedToUrubutoBy ? ` by ${onboarding.submittedToUrubutoBy}` : ""}
                    </p>
                  )}
                  <label className="block">
                    <span className="text-gray-600">Internal note / ticket</span>
                    <textarea
                      className="mt-1 w-full rounded border px-2 py-1.5 min-h-[64px]"
                      value={internalNote}
                      onChange={(e) => setInternalNote(e.target.value)}
                    />
                    <Button
                      className="mt-2"
                      variant="secondary"
                      size="sm"
                      disabled={saving}
                      onClick={() =>
                        void adminAction("saveUrubutoInternalNote", { internalNote }, "Internal note saved")
                      }
                    >
                      Save note
                    </Button>
                  </label>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="px-4 py-3">
                  <CardTitle className="text-base">Documents</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {documents.length === 0 && <p className="text-sm text-gray-600">No documents yet.</p>}
                  <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                    {documents.map((d) => (
                      <div key={d.documentId} className="rounded-lg border bg-white p-3 space-y-3">
                        <div className="min-w-0">
                          <p className="font-medium leading-snug">{DOC_TYPE_LABELS[d.docType]?.en ?? d.docType}</p>
                          <p className="mt-0.5 break-all text-xs text-gray-500">{d.originalFilename}</p>
                          <p className="text-xs mt-1">
                            {d.verified ? (
                              <span className="text-green-700">Verified by {d.verifiedBy || "—"}</span>
                            ) : (
                              <span className="text-amber-700">Not verified</span>
                            )}
                          </p>
                          {d.rejectionReason && (
                            <p className="text-xs text-red-700">Rejected: {d.rejectionReason}</p>
                          )}
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className={
                              hasDownloadableDocument(d)
                                ? "w-full min-w-0 whitespace-nowrap border-green-300 bg-green-50 text-green-800 hover:bg-green-100 hover:text-green-900"
                                : "w-full min-w-0 whitespace-nowrap"
                            }
                            disabled={downloadingId === d.documentId}
                            onClick={() => void handleDownload(d.documentId, d.originalFilename)}
                          >
                            <Download className="mr-1.5 h-4 w-4 shrink-0" />
                            <span>Download</span>
                          </Button>
                          <Button
                            size="sm"
                            className="w-full min-w-0 whitespace-nowrap"
                            disabled={saving}
                            onClick={() =>
                              void adminAction("verifyUrubutoMerchantDocument", {
                                documentId: d.documentId,
                              })
                            }
                          >
                            Verify
                          </Button>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                          <input
                            className="min-h-9 w-full min-w-0 rounded border px-2 py-1.5 text-sm"
                            placeholder="Rejection reason"
                            value={rejectReason[d.documentId] ?? ""}
                            onChange={(e) =>
                              setRejectReason((prev) => ({ ...prev, [d.documentId]: e.target.value }))
                            }
                          />
                          <Button
                            size="sm"
                            variant="destructive"
                            className="w-full whitespace-nowrap sm:w-auto sm:min-w-20"
                            disabled={saving}
                            onClick={() => {
                              const r = rejectReason[d.documentId]?.trim()
                              if (!r) {
                                alert("Enter rejection reason")
                                return
                              }
                              void adminAction("rejectUrubutoMerchantDocument", {
                                documentId: d.documentId,
                                rejectionReason: r,
                              })
                            }}
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="px-4 py-3">
                  <CardTitle className="text-base">Audit history</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {audit.length === 0 ? (
                    <p className="text-sm text-gray-600">No status, code, document, email, or note changes recorded yet.</p>
                  ) : (
                    <ul className="text-xs space-y-2 max-h-48 overflow-y-auto">
                      {audit.map((a, i) => {
                        const payloadLines = formatUrubutoAuditPayloadLines(a.payloadJson)
                        return (
                          <li key={a.id ?? i} className="border-b border-gray-100 pb-2">
                            <div>
                              <span className="font-medium">{formatUrubutoAuditTitle(a.action)}</span>
                              <span className="text-gray-500"> — {a.actorEmail || "system"} — {a.createdAt}</span>
                            </div>
                            {payloadLines.length > 0 && (
                              <ul className="mt-1 space-y-0.5 text-[11px] text-gray-600">
                                {payloadLines.map((line) => (
                                  <li key={line}>{line}</li>
                                ))}
                              </ul>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
