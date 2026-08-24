"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { useTranslation } from "@/hooks/use-translation"
import type { TranslationKey } from "@/lib/translations"
import type { MohErxDrugLineDTO } from "@/lib/erx/moh-erx-types"

export type PharmacyErxResultProps = {
  loading: boolean
  errorCode: string | null
  patientDisplayName: string | null
  drugs: MohErxDrugLineDTO[] | null
}

const ERROR_KEY_BY_CODE: Record<string, TranslationKey> = {
  ERX_NOT_FOUND: "categoryBrowseErxEmpty",
  ERX_CODE_REQUIRED: "categoryBrowseErxEmpty",
  ERX_IDENTITY_MISMATCH: "categoryBrowseErxMismatch",
  ERX_NOT_CONFIGURED: "categoryBrowseErxNotConfigured",
  ERX_RATE_LIMITED: "categoryBrowseErxRateLimited",
}

function DrugField({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <p className="text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{label}:</span> {value}
    </p>
  )
}

export function PharmacyErxResult({ loading, errorCode, patientDisplayName, drugs }: PharmacyErxResultProps) {
  const { t } = useTranslation()

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-6 text-center inline-flex items-center justify-center gap-2 w-full">
        <Spinner /> {t("categoryBrowseErxLoading" as TranslationKey)}
      </p>
    )
  }

  if (errorCode) {
    const key = ERROR_KEY_BY_CODE[errorCode] || "categoryBrowseErxUpstreamError"
    return (
      <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-6 text-center">
        {t(key as TranslationKey)}
      </p>
    )
  }

  if (!drugs) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("categoryBrowseErxResultTitle" as TranslationKey)}</CardTitle>
        <CardDescription>
          {t("categoryBrowseErxResultPatientLine" as TranslationKey, { name: patientDisplayName || "" })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {drugs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("categoryBrowseErxResultEmpty" as TranslationKey)}</p>
        ) : (
          <ul className="space-y-4">
            {drugs.map((drug) => (
              <li key={drug.id} className="border-b pb-3 last:border-b-0 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{drug.name}</p>
                  {drug.quantityValue != null && (
                    <Badge variant="secondary">
                      {drug.quantityValue} {drug.quantityUnit || ""}
                    </Badge>
                  )}
                </div>
                <DrugField label={t("categoryBrowseErxDrugDosage" as TranslationKey)} value={drug.dosageText} />
                <DrugField label={t("categoryBrowseErxDrugRoute" as TranslationKey)} value={drug.route} />
                <DrugField
                  label={t("categoryBrowseErxDrugFrequency" as TranslationKey)}
                  value={drug.frequencyText}
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
