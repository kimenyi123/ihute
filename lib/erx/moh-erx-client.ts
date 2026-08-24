/**
 * Server-side client for the Ministry of Health eRx FHIR API
 * (`GET {baseUrl}/MedicationRequest/$list-medicationrequests?groupIdentifier=...`).
 * Basic Auth; response is a FHIR `Parameters` resource wrapping a search-set
 * `Bundle` of MedicationRequest + Patient resources sharing one groupIdentifier.
 */

import { normalizePhoneDigitsForAuth } from "@/lib/rwanda-phone"
import { normalizeNationalId } from "@/lib/erx/national-id"
import type { MohErxConfig } from "@/lib/erx/moh-erx-config"
import type {
  FhirBundle,
  FhirCodeableConcept,
  FhirMedicationRequestResource,
  FhirParameters,
  FhirPatientResource,
  MohErxDrugLineDTO,
  MohErxLookupError,
  MohErxLookupResult,
  MohErxPatient,
} from "@/lib/erx/moh-erx-types"

type FetchResult =
  | { ok: true; value: MohErxLookupResult }
  | { ok: false; error: MohErxLookupError }

function buildLookupUrl(code: string, cfg: MohErxConfig): string {
  const qs = new URLSearchParams({
    groupIdentifier: code,
    page: "1",
    size: "20",
    status: "active",
  })
  return `${cfg.baseUrl}/MedicationRequest/$list-medicationrequests?${qs.toString()}`
}

function isPatientResource(resource: unknown): resource is FhirPatientResource {
  return !!resource && typeof resource === "object" && (resource as { resourceType?: string }).resourceType === "Patient"
}

function isMedicationRequestResource(resource: unknown): resource is FhirMedicationRequestResource {
  return (
    !!resource &&
    typeof resource === "object" &&
    (resource as { resourceType?: string }).resourceType === "MedicationRequest"
  )
}

function extractPatient(resource: FhirPatientResource): MohErxPatient {
  const name = resource.name?.[0]
  const fullName = [...(name?.given ?? []), name?.family].filter(Boolean).join(" ").trim()
  const phoneDigits = normalizePhoneDigitsForAuth(resource.telecom?.[0]?.value ?? "")
  const nationalIdDigits = normalizeNationalId(
    resource.identifier?.find((i) => i.system === "NID")?.value ?? "",
  )
  return { fullName, phoneDigits, nationalIdDigits }
}

function extractRouteText(route: string | FhirCodeableConcept | undefined): string | undefined {
  if (!route) return undefined
  if (typeof route === "string") return route
  return route.text || route.coding?.[0]?.display
}

function extractDrugLine(resource: FhirMedicationRequestResource, index: number): MohErxDrugLineDTO {
  const dosage = resource.dosageInstruction?.[0]
  const repeat = dosage?.timing?.repeat
  const frequencyText =
    repeat?.frequency && repeat?.period && repeat?.periodUnit
      ? `${repeat.frequency}x / ${repeat.period}${repeat.periodUnit}`
      : undefined

  return {
    id: resource.id || `erx-drug-${index}`,
    name:
      resource.medicationCodeableConcept?.text ||
      resource.medicationCodeableConcept?.coding?.[0]?.display ||
      "Unknown medication",
    dosageText: dosage?.text,
    quantityValue: resource.dispenseRequest?.quantity?.value,
    quantityUnit: resource.dispenseRequest?.quantity?.unit,
    route: extractRouteText(dosage?.route),
    frequencyText,
    prescriber: resource.requester?.display,
    authoredOn: resource.authoredOn,
    insurance: resource.insurance?.[0]?.display,
  }
}

export async function fetchMohErxByCode(code: string, cfg: MohErxConfig): Promise<FetchResult> {
  const url = buildLookupUrl(code, cfg)
  const basicAuth = Buffer.from(`${cfg.username}:${cfg.password}`).toString("base64")

  let res: Response
  try {
    res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        Accept: "application/fhir+json, application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(cfg.timeoutMs),
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return { ok: false, error: { kind: "network", message } }
  }

  let rawText: string
  try {
    rawText = await res.text()
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return { ok: false, error: { kind: "network", message } }
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(`[moh-erx-client] MOH response (HTTP ${res.status}) for code=${code}:`, rawText)
  }

  let parsed: unknown
  try {
    parsed = rawText ? JSON.parse(rawText) : null
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return { ok: false, error: { kind: "parse", message } }
  }

  const asRecord = parsed as { resourceType?: string } | null

  if (asRecord?.resourceType === "OperationOutcome") {
    const outcome = parsed as { issue?: Array<{ diagnostics?: string; details?: { text?: string } }> }
    const message =
      outcome.issue?.[0]?.diagnostics || outcome.issue?.[0]?.details?.text || "Unknown MOH eRx error"
    return { ok: false, error: { kind: "operation_outcome", message } }
  }

  if (!res.ok) {
    return { ok: false, error: { kind: "network", message: `MOH eRx returned HTTP ${res.status}` } }
  }

  const parameters = parsed as FhirParameters | null
  const bundle = parameters?.parameter?.find((p) => p.name === "bundle")?.resource as FhirBundle | undefined
  if (!bundle) {
    return { ok: false, error: { kind: "parse", message: "No bundle parameter in MOH response" } }
  }

  let patient: MohErxPatient = { fullName: "", phoneDigits: "", nationalIdDigits: "" }
  const drugs: MohErxDrugLineDTO[] = []
  let patientFound = false

  const entries = bundle.entry ?? []
  for (let i = 0; i < entries.length; i++) {
    const resource = entries[i]?.resource
    if (!resource) continue
    if (!patientFound && isPatientResource(resource)) {
      patient = extractPatient(resource)
      patientFound = true
      continue
    }
    if (isMedicationRequestResource(resource)) {
      drugs.push(extractDrugLine(resource, i))
    }
  }

  if (drugs.length === 0) {
    return { ok: false, error: { kind: "not_found" } }
  }

  return { ok: true, value: { code, patient, drugs } }
}
