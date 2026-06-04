/** Shared UrubutoPay onboarding pipeline (admin + seller). */

export const PIPELINE_STAGES = {
  not_started: { label: "Not started", color: "bg-gray-100 text-gray-800" },
  applied: { label: "Applied", color: "bg-slate-100 text-slate-800" },
  docs_incomplete: { label: "Documents incomplete", color: "bg-amber-100 text-amber-900" },
  under_review: { label: "Under review", color: "bg-blue-100 text-blue-900" },
  submitted_to_urubuto: { label: "With Urubuto", color: "bg-indigo-100 text-indigo-900" },
  awaiting_code: { label: "Awaiting merchant code", color: "bg-violet-100 text-violet-900" },
  ihute_activation: { label: "Almost live", color: "bg-cyan-100 text-cyan-900" },
  live: { label: "Live", color: "bg-green-100 text-green-900" },
  live_blocked: { label: "Blocked", color: "bg-red-100 text-red-900" },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800" },
} as const

export type PipelineStage = keyof typeof PIPELINE_STAGES

export interface UrubutoChecklistItem {
  key: string
  ok: boolean
  label: string
  fixedBy?: string
  rejectionReason?: string
  status?: "missing" | "pending_review" | "verified" | "ready" | string
  actionLabel?: string
  actionTarget?: string
}

export interface UrubutoBreakdown {
  pipelineStage: PipelineStage
  eligible: boolean
  nextAction: string
  sellerMessage: string
  checklist: UrubutoChecklistItem[]
  verifiedDocCount?: number
  uploadedDocCount?: number
}

export const DOC_TYPE_LABELS: Record<string, { en: string; rw?: string; fr?: string }> = {
  CERTIFICATE_INCORPORATION: {
    en: "Company registration",
    rw: "Icyemezo cy'ubucuruzi",
    fr: "Certificat d'incorporation",
  },
  REPRESENTATIVE_ID: {
    en: "Representative ID",
    rw: "Indangamuntu y'umuhagarariye",
    fr: "Pièce d'identité du représentant",
  },
  SIGNED_MERCHANT_FORM: {
    en: "Signed merchant form",
    rw: "Ifishi yemejwe",
    fr: "Formulaire marchand signé",
  },
}

export function stageMeta(stage: string) {
  return PIPELINE_STAGES[stage as PipelineStage] ?? PIPELINE_STAGES.applied
}

export function wizardStepIndex(stage: PipelineStage): number {
  switch (stage) {
    case "not_started":
      return 0
    case "applied":
    case "docs_incomplete":
      return 1
    case "under_review":
    case "submitted_to_urubuto":
    case "awaiting_code":
    case "ihute_activation":
      return 2
    case "live":
    case "live_blocked":
    case "rejected":
      return 3
    default:
      return 0
  }
}

export const WIZARD_STEPS = [
  { id: "register", title: "Apply", description: "Register for UrubutoPay" },
  { id: "documents", title: "Documents", description: "Upload KYC (3 files)" },
  { id: "review", title: "Review", description: "IHUTE & Urubuto activation" },
  { id: "live", title: "Go live", description: "Accept MoMo & card" },
]
