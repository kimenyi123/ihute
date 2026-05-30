"use client"

import { stageMeta, type PipelineStage } from "@/lib/urubuto-pipeline"
import { cn } from "@/lib/utils"
import { useLanguageStore, type Language } from "@/lib/language-store"

const BADGE_UI: Record<Language, { live: string; stages: Partial<Record<PipelineStage, string>> }> = {
  en: {
    live: "Live",
    stages: {
      not_started: "Not started",
      applied: "Applied",
      docs_incomplete: "Documents incomplete",
      under_review: "Under review",
      submitted_to_urubuto: "With Urubuto",
      awaiting_code: "Awaiting merchant code",
      ihute_activation: "Almost live",
      live: "Live",
      live_blocked: "Blocked",
      rejected: "Rejected",
    },
  },
  rw: {
    live: "Irakora",
    stages: {
      not_started: "Ntibiratangira",
      applied: "Byasabwe",
      docs_incomplete: "Inyandiko ntizuzuye",
      under_review: "Birimo gusuzumwa",
      submitted_to_urubuto: "Biri kuri Urubuto",
      awaiting_code: "Hategerejwe merchant code",
      ihute_activation: "Hafi gutangira",
      live: "Irakora",
      live_blocked: "Byafunzwe",
      rejected: "Byanzwe",
    },
  },
  fr: {
    live: "Actif",
    stages: {
      not_started: "Non démarré",
      applied: "Demandé",
      docs_incomplete: "Documents incomplets",
      under_review: "En examen",
      submitted_to_urubuto: "Chez Urubuto",
      awaiting_code: "Code marchand attendu",
      ihute_activation: "Presque actif",
      live: "Actif",
      live_blocked: "Bloqué",
      rejected: "Rejeté",
    },
  },
}

export function UrubutoPipelineBadge({
  stage,
  className,
}: {
  stage: string
  className?: string
}) {
  const language = useLanguageStore((s) => s.language)
  const ui = BADGE_UI[language] ?? BADGE_UI.en
  const meta = stageMeta(stage)
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        meta.color,
        className
      )}
    >
      {ui.stages[stage as PipelineStage] ?? meta.label}
    </span>
  )
}

export function UrubutoLiveBadge({ eligible }: { eligible: boolean }) {
  const language = useLanguageStore((s) => s.language)
  const ui = BADGE_UI[language] ?? BADGE_UI.en
  if (!eligible) return null
  return (
    <span className="inline-flex items-center rounded-full bg-green-600 px-2.5 py-0.5 text-xs font-semibold text-white">
      {ui.live}
    </span>
  )
}
