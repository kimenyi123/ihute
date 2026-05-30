"use client"

import { CheckCircle2, XCircle } from "lucide-react"
import type { UrubutoChecklistItem } from "@/lib/urubuto-pipeline"
import { useLanguageStore, type Language } from "@/lib/language-store"

const CHECKLIST_UI: Record<Language, {
  reason: string
  fixedBy: (value: string) => string
  labels: Record<string, string>
}> = {
  en: {
    reason: "Reason",
    fixedBy: (value) => value,
    labels: {},
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
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.key} className="flex items-start gap-2 text-sm">
          {item.ok ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
          ) : (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          )}
          <div>
            <span className={item.ok ? "text-gray-800" : "text-gray-900 font-medium"}>
              {translateChecklistLabel(item.label, language)}
            </span>
            {showFixedBy && item.fixedBy && (
              <span className="ml-2 text-xs text-gray-500">({ui.fixedBy(item.fixedBy)})</span>
            )}
            {!item.ok && item.rejectionReason && (
              <p className="text-xs text-red-700 mt-0.5">{ui.reason}: {item.rejectionReason}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
