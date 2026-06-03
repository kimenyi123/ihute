"use client"

import { CheckCircle2, Clock3, XCircle } from "lucide-react"
import type { UrubutoChecklistItem } from "@/lib/urubuto-pipeline"
import { useLanguageStore, type Language } from "@/lib/language-store"
import { cn } from "@/lib/utils"

const CHECKLIST_UI: Record<Language, {
  reason: string
  fixedBy: (value: string) => string
  labels: Record<string, string>
  status: Record<string, string>
  actions: Record<string, string>
}> = {
  en: {
    reason: "Reason",
    fixedBy: (value) => value,
    labels: {},
    status: {
      missing: "Missing",
      pending_review: "Pending review",
      verified: "Verified",
      ready: "Ready to go live",
    },
    actions: {},
  },
  rw: {
    reason: "Impamvu",
    fixedBy: (value) => value,
    labels: {
      "Merchant status ACTIVE": "Imiterere ya merchant: irakora",
      "Urubuto merchant code assigned": "Kode ya merchant ya UrubutoPay yatanzwe",
      "Urubuto service code assigned": "Kode ya service ya UrubutoPay yatanzwe",
      "IHUTE onboarding approved": "Kwemezwa kwa IHUTE onboarding byakozwe",
      "Company registration uploaded": "Icyemezo cy'ubucuruzi cyoherejwe",
      "Company registration verified": "Icyemezo cy'ubucuruzi cyemejwe",
      "Representative ID uploaded": "Indangamuntu y'umuhagarariye yoherejwe",
      "Representative ID verified": "Indangamuntu y'umuhagarariye yemejwe",
      "Signed merchant form uploaded": "Ifishi y'umucuruzi yasinywe yoherejwe",
      "Signed merchant form verified": "Ifishi y'umucuruzi yasinywe yemejwe",
    },
    status: {
      missing: "Irabura",
      pending_review: "Irimo gusuzumwa",
      verified: "Yemejwe",
      ready: "Yiteguye gutangira",
    },
    actions: {
      "Start application": "Tangira ubusabe",
      "Upload document": "Ohereza inyandiko",
      "Upload document first": "Banza wohereze inyandiko",
      "Replace document": "Hindura inyandiko",
      "Review document": "Suzuma inyandiko",
      "Set merchant ACTIVE": "Shyira merchant kuri ACTIVE",
      "Assign merchant code": "Tanga merchant code",
      "Assign service code": "Tanga service code",
      "Approve onboarding": "Emeza onboarding",
      "Re-run remote check": "Ongera usuzume",
      "Contact IHUTE support": "Vugana na support ya IHUTE",
    },
  },
  fr: {
    reason: "Raison",
    fixedBy: (value) => value,
    labels: {
      "Merchant status ACTIVE": "Statut marchand : actif",
      "Urubuto merchant code assigned": "Code marchand UrubutoPay attribué",
      "Urubuto service code assigned": "Code service UrubutoPay attribué",
      "IHUTE onboarding approved": "Intégration IHUTE approuvée",
      "Company registration uploaded": "Certificat d'incorporation téléversé",
      "Company registration verified": "Certificat d'incorporation vérifié",
      "Representative ID uploaded": "Pièce d'identité du représentant téléversée",
      "Representative ID verified": "Pièce d'identité du représentant vérifiée",
      "Signed merchant form uploaded": "Formulaire marchand signé téléversé",
      "Signed merchant form verified": "Formulaire marchand signé vérifié",
    },
    status: {
      missing: "Manquant",
      pending_review: "En examen",
      verified: "Vérifié",
      ready: "Prêt à activer",
    },
    actions: {
      "Start application": "Démarrer la demande",
      "Upload document": "Téléverser le document",
      "Upload document first": "Téléverser d'abord le document",
      "Replace document": "Remplacer le document",
      "Review document": "Examiner le document",
      "Set merchant ACTIVE": "Mettre le marchand ACTIVE",
      "Assign merchant code": "Attribuer le code marchand",
      "Assign service code": "Attribuer le code service",
      "Approve onboarding": "Approuver l'intégration",
      "Re-run remote check": "Relancer la vérification",
      "Contact IHUTE support": "Contacter le support IHUTE",
    },
  },
}

function translateChecklistLabel(label: string, language: Language): string {
  const ui = CHECKLIST_UI[language] ?? CHECKLIST_UI.en
  const direct = ui.labels[label]
  if (direct) return direct

  const statusMatch = label.match(/^Merchant status\s+(.+)$/i)
  if (statusMatch) {
    const status = statusMatch[1]
    if (language === "rw") return `Imiterere ya merchant: ${status}`
    if (language === "fr") return `Statut marchand : ${status}`
  }

  return label
}

function translateActionLabel(label: string | undefined, language: Language): string {
  if (!label) return ""
  const ui = CHECKLIST_UI[language] ?? CHECKLIST_UI.en
  return ui.actions[label] ?? label
}

function ChecklistStatusBadge({ item, language }: { item: UrubutoChecklistItem; language: Language }) {
  const ui = CHECKLIST_UI[language] ?? CHECKLIST_UI.en
  const status = item.status || (item.ok ? "verified" : "missing")
  const label = ui.status[status] ?? status.replace(/_/g, " ")
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
        status === "verified" && "bg-green-100 text-green-800",
        status === "ready" && "bg-emerald-600 text-white",
        status === "pending_review" && "bg-blue-100 text-blue-800",
        status === "missing" && "bg-amber-100 text-amber-900",
      )}
    >
      {label}
    </span>
  )
}

export function EligibilityChecklist({
  items,
  showFixedBy = false,
}: {
  items: UrubutoChecklistItem[]
  showFixedBy?: boolean
}) {
  const language = useLanguageStore((s) => s.language)
  const ui = CHECKLIST_UI[language] ?? CHECKLIST_UI.en

  if (!items?.length) return null
  const ready = items.every((item) => item.ok)
  return (
    <div className="space-y-2">
      {ready && (
        <span className="inline-flex rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white">
          {ui.status.ready}
        </span>
      )}
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.key} className="flex items-start gap-2 rounded-lg border border-gray-100 bg-white/70 p-2 text-sm">
          {item.ok ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
          ) : item.status === "pending_review" ? (
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          ) : (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span className={item.ok ? "text-gray-800" : "text-gray-900 font-medium"}>
                {translateChecklistLabel(item.label, language)}
              </span>
              <ChecklistStatusBadge item={item} language={language} />
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              {showFixedBy && item.fixedBy && (
                <span className="text-xs text-gray-500">({ui.fixedBy(item.fixedBy)})</span>
              )}
              {!item.ok && item.actionLabel && (
                <span className="text-xs font-medium text-violet-700">{translateActionLabel(item.actionLabel, language)}</span>
              )}
            </div>
            {!item.ok && item.rejectionReason && (
              <p className="text-xs text-red-700 mt-0.5">{ui.reason}: {item.rejectionReason}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
    </div>
  )
}
