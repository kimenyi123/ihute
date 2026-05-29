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
import { useLanguageStore, type Language } from "@/lib/language-store"
import { ArrowLeft, Bell, ChevronDown, FileText, Loader2, RefreshCw, Upload } from "lucide-react"

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

const URUBUTO_UI: Record<Language, {
  signInPrompt: string
  backToDashboard: string
  activeSubtitle: string
  inactiveSubtitle: string
  paymentSettings: string
  refreshStatus: string
  testEnvironment: string
  markRead: string
  updatesTitle: (count: number) => string
  updatesFallback: string
  newUpdates: string
  loading: string
  startTitle: string
  startDescription: (account: string) => string
  startApplication: string
  applicationStarted: string
  registrationFailed: string
  submitFailed: string
  submittedForReview: string
  documentUploaded: string
  uploadFailed: string
  status: string
  documentsTitle: string
  missingDoc: string
  verified: string
  uploadedUnderReview: string
  rejected: string
  upload: string
  replace: string
  uploading: string
  submitTitle: string
  submitDescription: string
  submitForReview: string
  compliance: string
  missing: string
  uploaded: string
  wizard: Record<string, { title: string; description: string }>
  missingReadState: string
  couldNotMarkRead: string
}> = {
  en: {
    signInPrompt: "Sign in as a supplier to manage UrubutoPay.",
    backToDashboard: "Back to dashboard",
    activeSubtitle: "MoMo and card payments are active at checkout.",
    inactiveSubtitle: "Accept MoMo and card from customers — fast, secure payments powered by UrubutoPay on IHUTE.",
    paymentSettings: "Payment settings",
    refreshStatus: "Refresh status",
    testEnvironment: "Test environment",
    markRead: "Mark read",
    updatesTitle: (count) => `${count} Urubuto update${count === 1 ? "" : "s"}`,
    updatesFallback: "Document review or activation update",
    newUpdates: "New updates",
    loading: "Loading...",
    startTitle: "Start your application",
    startDescription: (account) => `Register once using your seller payer code ${account}.`,
    startApplication: "Start application",
    applicationStarted: "Application started.",
    registrationFailed: "Registration failed",
    submitFailed: "Submit failed",
    submittedForReview: "Submitted for review. We will notify you when UrubutoPay is live.",
    documentUploaded: "Document uploaded.",
    uploadFailed: "Upload failed",
    status: "Status",
    documentsTitle: "Documents (3 required)",
    missingDoc: "Missing — pdf, jpg, or png",
    verified: "Verified",
    uploadedUnderReview: "Uploaded — under review",
    rejected: "Rejected",
    upload: "Upload",
    replace: "Replace",
    uploading: "Uploading...",
    submitTitle: "Submit for review",
    submitDescription: "Send your file to IHUTE ops for Urubuto activation.",
    submitForReview: "Submit for review",
    compliance: "Application & compliance",
    missing: "Missing",
    uploaded: "Uploaded",
    wizard: {
      register: { title: "Apply", description: "Register for UrubutoPay" },
      documents: { title: "Documents", description: "Upload KYC (3 files)" },
      review: { title: "Review", description: "IHUTE & Urubuto activation" },
      live: { title: "Go live", description: "Accept MoMo & card" },
    },
    missingReadState:
      "Read state did not save on the server. Run kaos/docs/migration_notification_urubuto_read.sql (add is_read), redeploy Kaos, then try again.",
    couldNotMarkRead: "Could not mark notifications as read",
  },
  rw: {
    signInPrompt: "Injira nka supplier kugira ngo ucunge UrubutoPay.",
    backToDashboard: "Subira kuri dashboard",
    activeSubtitle: "Kwishyura na MoMo na card birakora muri checkout.",
    inactiveSubtitle: "Emera MoMo na card z'abakiriya — ubwishyu bwihuse kandi butekanye bwa UrubutoPay kuri IHUTE.",
    paymentSettings: "Igenamiterere ry'ubwishyu",
    refreshStatus: "Vugurura imiterere",
    testEnvironment: "Aho kugeragereza",
    markRead: "Shyira ko byasomwe",
    updatesTitle: (count) => `Amakuru ${count} ya Urubuto`,
    updatesFallback: "Amakuru ku isuzuma ry'inyandiko cyangwa gufungura serivisi",
    newUpdates: "Amakuru mashya",
    loading: "Birimo gutangira...",
    startTitle: "Tangira ubusabe bwawe",
    startDescription: (account) => `Iyandikishe rimwe ukoresheje kode ya supplier ${account}.`,
    startApplication: "Tangira ubusabe",
    applicationStarted: "Ubusabe bwatangiye.",
    registrationFailed: "Kwiyandikisha byanze",
    submitFailed: "Kohereza byanze",
    submittedForReview: "Byoherejwe gusuzumwa. Tuzakumenyesha UrubutoPay nitangira gukora.",
    documentUploaded: "Inyandiko yoherejwe.",
    uploadFailed: "Kohereza byanze",
    status: "Imiterere",
    documentsTitle: "Inyandiko (3 zisabwa)",
    missingDoc: "Irabura — pdf, jpg, cyangwa png",
    verified: "Yemejwe",
    uploadedUnderReview: "Yoherejwe — irimo gusuzumwa",
    rejected: "Yanzwe",
    upload: "Ohereza",
    replace: "Hindura",
    uploading: "Birimo kohereza...",
    submitTitle: "Ohereza gusuzumwa",
    submitDescription: "Ohereza dosiye yawe kuri IHUTE ops kugira ngo Urubuto ikorwe.",
    submitForReview: "Ohereza gusuzumwa",
    compliance: "Ubusabe n'ibisabwa",
    missing: "Irabura",
    uploaded: "Yoherejwe",
    wizard: {
      register: { title: "Saba", description: "Iyandikishe kuri UrubutoPay" },
      documents: { title: "Inyandiko", description: "Ohereza KYC (dosiye 3)" },
      review: { title: "Isuzuma", description: "Gufungura na IHUTE & Urubuto" },
      live: { title: "Tangira", description: "Emera MoMo na card" },
    },
    missingReadState:
      "Kubika ko byasomwe ntibyagenze neza kuri server. Koresha kaos/docs/migration_notification_urubuto_read.sql (ongeramo is_read), wongere ushyireho Kaos, hanyuma wongere ugerageze.",
    couldNotMarkRead: "Gushyiraho ko byasomwe byanze",
  },
  fr: {
    signInPrompt: "Connectez-vous comme fournisseur pour gérer UrubutoPay.",
    backToDashboard: "Retour au tableau de bord",
    activeSubtitle: "Les paiements MoMo et carte sont actifs au paiement.",
    inactiveSubtitle: "Acceptez MoMo et les cartes des clients — paiements rapides et sécurisés avec UrubutoPay sur IHUTE.",
    paymentSettings: "Paramètres de paiement",
    refreshStatus: "Actualiser le statut",
    testEnvironment: "Environnement de test",
    markRead: "Marquer comme lu",
    updatesTitle: (count) => `${count} mise${count === 1 ? "" : "s"} à jour Urubuto`,
    updatesFallback: "Mise à jour de l'examen des documents ou de l'activation",
    newUpdates: "Nouvelles mises à jour",
    loading: "Chargement...",
    startTitle: "Démarrer votre demande",
    startDescription: (account) => `Inscrivez-vous une seule fois avec votre code fournisseur ${account}.`,
    startApplication: "Démarrer la demande",
    applicationStarted: "Demande démarrée.",
    registrationFailed: "Échec de l'inscription",
    submitFailed: "Échec de l'envoi",
    submittedForReview: "Envoyé pour examen. Nous vous informerons lorsque UrubutoPay sera actif.",
    documentUploaded: "Document envoyé.",
    uploadFailed: "Échec du téléversement",
    status: "Statut",
    documentsTitle: "Documents (3 requis)",
    missingDoc: "Manquant — pdf, jpg ou png",
    verified: "Vérifié",
    uploadedUnderReview: "Envoyé — en cours d'examen",
    rejected: "Rejeté",
    upload: "Téléverser",
    replace: "Remplacer",
    uploading: "Téléversement...",
    submitTitle: "Envoyer pour examen",
    submitDescription: "Envoyez votre dossier aux opérations IHUTE pour l'activation Urubuto.",
    submitForReview: "Envoyer pour examen",
    compliance: "Demande et conformité",
    missing: "Manquant",
    uploaded: "Envoyé",
    wizard: {
      register: { title: "Demande", description: "Inscription à UrubutoPay" },
      documents: { title: "Documents", description: "Téléverser KYC (3 fichiers)" },
      review: { title: "Examen", description: "Activation IHUTE & Urubuto" },
      live: { title: "Activer", description: "Accepter MoMo et carte" },
    },
    missingReadState:
      "L'état de lecture n'a pas été enregistré sur le serveur. Exécutez kaos/docs/migration_notification_urubuto_read.sql (ajouter is_read), redéployez Kaos, puis réessayez.",
    couldNotMarkRead: "Impossible de marquer les notifications comme lues",
  },
}

export default function SupplierUrubutoPage() {
  const { user, isAuthenticated, hasHydrated } = useAuthStore()
  const language = useLanguageStore((s) => s.language)
  const ui = URUBUTO_UI[language] ?? URUBUTO_UI.en
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
        setNotice(data.message || data.error || ui.registrationFailed)
        return
      }
      setNotice(ui.applicationStarted)
      await refresh()
    } catch {
      setNotice(ui.registrationFailed)
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
        setNotice(data.message || data.error || ui.submitFailed)
        return
      }
      setNotice(ui.submittedForReview)
      await refresh()
    } catch {
      setNotice(ui.submitFailed)
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
        setNotice(data.message || data.error || ui.couldNotMarkRead)
        return
      }
      const rowsUpdated = Number(data.rowsUpdated ?? 0)
      const stillUnread = await refresh()
      if (stillUnread > 0 && rowsUpdated === 0 && idsToMark.length > 0) {
        setNotice(ui.missingReadState)
        return
      }
      setNotice(null)
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("ihute-urubuto-notifications-read"))
      }
    } catch {
      setNotice(ui.couldNotMarkRead)
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
        setNotice(data.message || ui.uploadFailed)
        return
      }
      setNotice(ui.documentUploaded)
      await refresh()
    } catch {
      setNotice(ui.uploadFailed)
    } finally {
      setUploadingType(null)
    }
  }

  if (!hasHydrated) return null
  if (!isAuthenticated || !account) {
    return (
      <div className="p-6">
        <p className="text-gray-600">{ui.signInPrompt}</p>
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
          {ui.backToDashboard}
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
                  ? ui.activeSubtitle
                  : ui.inactiveSubtitle}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void refresh()}
                disabled={loading}
                className="border-violet-200 text-violet-700 hover:bg-violet-50 hover:text-violet-900"
              >
                {loading ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1.5 h-4 w-4" />
                )}
                {ui.refreshStatus}
              </Button>
              {eligible && (
                <Link href="/supplier/settings/location" className="text-sm text-violet-700 underline">
                  {ui.paymentSettings}
                </Link>
              )}
            </div>
          </div>
          {process.env.NEXT_PUBLIC_TRADING_BETA === "true" && (
            <p className="mt-2 text-xs font-medium text-amber-800 bg-amber-50 inline-block px-2 py-1 rounded">
              {ui.testEnvironment}
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
              <div className="font-semibold leading-tight">{ui.wizard[s.id]?.title ?? s.title}</div>
              <div className="mt-0.5 hidden leading-tight md:block">{ui.wizard[s.id]?.description ?? s.description}</div>
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
                  {ui.updatesTitle(bannerUnread)}
                </p>
                <p className="text-xs text-violet-800 mt-0.5">
                  {unreadNotifications[0]?.message || ui.updatesFallback}
                </p>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => void markNotificationsRead()}>
              {ui.markRead}
            </Button>
          </div>
        )}

        {unreadNotifications.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4" />
                {ui.newUpdates}
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
                  <CardTitle>{ui.startTitle}</CardTitle>
                  <CardDescription>{ui.startDescription(account)}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => void register()} disabled={registering}>
                    {registering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {ui.startApplication}
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
                          <CardTitle className="text-base">{ui.status}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 px-4 pb-4">
                          <p className="text-sm text-gray-800">{breakdown?.sellerMessage}</p>
                          <EligibilityChecklist items={breakdown?.checklist ?? []} />
                        </CardContent>
                      </Card>

                      {(breakdown?.uploadedDocCount ?? 0) >= 3 && (
                        <Card>
                          <CardHeader className="px-4 py-3">
                            <CardTitle className="text-base">{ui.submitTitle}</CardTitle>
                            <CardDescription>{ui.submitDescription}</CardDescription>
                          </CardHeader>
                          <CardContent className="px-4 pb-4">
                            <Button onClick={() => void submitForReview()} disabled={submitting} className="w-full sm:w-auto">
                              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                              {ui.submitForReview}
                            </Button>
                          </CardContent>
                        </Card>
                      )}
                    </div>

                    <Card>
                      <CardHeader className="px-4 py-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          {ui.documentsTitle}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 px-4 pb-4">
                        {DOC_TYPES.map((dt) => {
                          const existing = docs.find((d) => d.doc_type === dt)
                          const labels = DOC_TYPE_LABELS[dt]
                          const label = labels?.[language] || labels?.en || dt
                          return (
                            <div
                              key={dt}
                              className="rounded-lg border border-gray-200 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <p className="font-medium text-gray-900">{label}</p>
                                {labels?.rw && language !== "rw" ? <p className="text-xs text-gray-500">{labels.rw}</p> : null}
                                {existing ? (
                                  <p className="text-xs mt-1 text-gray-600">
                                    {existing.verified ? `✓ ${ui.verified}` : ui.uploadedUnderReview}
                                    {existing.rejection_reason && (
                                      <span className="block text-red-700">{ui.rejected}: {existing.rejection_reason}</span>
                                    )}
                                  </p>
                                ) : (
                                  <p className="text-xs mt-1 text-amber-700">{ui.missingDoc}</p>
                                )}
                              </div>
                              <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md bg-violet-600 px-3 py-2 text-sm text-white hover:bg-violet-700 sm:w-28">
                                <Upload className="h-4 w-4" />
                                {uploadingType === dt ? ui.uploading : existing ? ui.replace : ui.upload}
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
                          <span className="text-sm font-medium text-gray-700">{ui.compliance}</span>
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
                              const label = labels?.[language] || labels?.en || dt
                              return (
                                <div
                                  key={dt}
                                  className="rounded-lg border border-gray-200 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm"
                                >
                                  <div>
                                    <p className="font-medium">{label}</p>
                                    <p className="text-xs text-gray-500">
                                      {existing?.verified ? ui.verified : existing ? ui.uploaded : ui.missing}
                                    </p>
                                  </div>
                                  <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-gray-50">
                                    <Upload className="h-3 w-3" />
                                    {ui.replace}
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
