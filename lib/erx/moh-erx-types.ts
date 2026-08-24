/**
 * Ministry of Health eRx — FHIR raw shapes (loosely typed) and the clean DTOs
 * derived from them. Modeled on the real `$list-medicationrequests` response
 * (a `Parameters` resource wrapping a search-set `Bundle` of MedicationRequest
 * + Patient resources sharing one `groupIdentifier`, the eRx code).
 */

export type FhirCoding = {
  system?: string
  code?: string
  display?: string
}

export type FhirCodeableConcept = {
  coding?: FhirCoding[]
  text?: string
}

export type FhirIdentifier = {
  system?: string
  value?: string
}

export type FhirHumanName = {
  family?: string
  given?: string[]
}

export type FhirContactPoint = {
  value?: string
}

export type FhirReference = {
  reference?: string
  display?: string
}

export type FhirMedicationRequestResource = {
  resourceType: "MedicationRequest"
  id?: string
  status?: string
  intent?: string
  medicationCodeableConcept?: FhirCodeableConcept
  subject?: FhirReference
  groupIdentifier?: { system?: string; value?: string }
  dosageInstruction?: Array<{
    text?: string
    route?: string | FhirCodeableConcept
    timing?: { repeat?: { frequency?: number; period?: number; periodUnit?: string } }
    doseAndRate?: Array<{ doseQuantity?: { value?: number } }>
  }>
  dispenseRequest?: { quantity?: { value?: number; unit?: string } }
  authoredOn?: string
  requester?: FhirReference
  insurance?: FhirReference[]
}

export type FhirPatientResource = {
  resourceType: "Patient"
  id?: string
  identifier?: FhirIdentifier[]
  name?: FhirHumanName[]
  telecom?: FhirContactPoint[]
  gender?: string
  birthDate?: string
}

export type FhirBundleEntry = {
  fullUrl?: string
  resource?: FhirMedicationRequestResource | FhirPatientResource | { resourceType: string }
}

export type FhirBundle = {
  resourceType?: "Bundle"
  type?: string
  total?: number
  entry?: FhirBundleEntry[]
}

export type FhirParameter = {
  name?: string
  resource?: FhirBundle
  valueBoolean?: boolean
  valueInteger?: number
}

export type FhirParameters = {
  resourceType?: "Parameters"
  parameter?: FhirParameter[]
}

export type FhirOperationOutcome = {
  resourceType?: "OperationOutcome"
  issue?: Array<{ severity?: string; diagnostics?: string; details?: { text?: string } }>
}

/** Patient identity fields relevant to phone/name/national-ID matching — never the full FHIR record. */
export type MohErxPatient = {
  fullName: string
  phoneDigits: string
  nationalIdDigits: string
}

export type MohErxDrugLineDTO = {
  id: string
  name: string
  dosageText?: string
  quantityValue?: number
  quantityUnit?: string
  route?: string
  frequencyText?: string
  prescriber?: string
  authoredOn?: string
  insurance?: string
}

export type MohErxLookupResult = {
  code: string
  patient: MohErxPatient
  drugs: MohErxDrugLineDTO[]
}

export type MohErxLookupError =
  | { kind: "not_found" }
  | { kind: "operation_outcome"; message: string }
  | { kind: "network"; message: string }
  | { kind: "parse"; message: string }
