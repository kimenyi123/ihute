/**
 * Matches the phone/names/national-ID entered on the "Fungura eRx" form against
 * the patient record MOH returned for an eRx code. A bare code never unlocks —
 * at least one identity field must be provided, and every field provided must match.
 */

import { normalizePhoneDigitsForAuth } from "@/lib/rwanda-phone"
import { normalizeNationalId } from "@/lib/erx/national-id"
import type { MohErxPatient } from "@/lib/erx/moh-erx-types"

export type ErxUnlockKey = {
  phone: string
  names: string
  nationalId: string
}

export type ErxIdentityMatchField = "phone" | "names" | "nationalId"

export type ErxIdentityMatchResult = {
  unlocked: boolean
  matchedFields: ErxIdentityMatchField[]
  providedFields: ErxIdentityMatchField[]
  /** Fields the patient provided but that did not match the MoH record. */
  failedFields: ErxIdentityMatchField[]
}

function normalizeNameForMatch(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
}

function namesMatch(providedNames: string, patientFullName: string): boolean {
  const provided = normalizeNameForMatch(providedNames)
  const patient = normalizeNameForMatch(patientFullName)
  if (!provided || !patient) return false
  const tokens = provided.split(" ").filter(Boolean)
  return tokens.length > 0 && tokens.every((token) => patient.includes(token))
}

export function matchErxIdentity(unlock: ErxUnlockKey, patient: MohErxPatient): ErxIdentityMatchResult {
  const phone = unlock.phone.trim()
  const names = unlock.names.trim()
  const nationalId = unlock.nationalId.trim()

  const providedFields: ErxIdentityMatchField[] = []
  if (phone) providedFields.push("phone")
  if (names) providedFields.push("names")
  if (nationalId) providedFields.push("nationalId")

  const matchedFields: ErxIdentityMatchField[] = []
  if (phone && normalizePhoneDigitsForAuth(phone) === patient.phoneDigits && patient.phoneDigits) {
    matchedFields.push("phone")
  }
  if (nationalId && normalizeNationalId(nationalId) === patient.nationalIdDigits && patient.nationalIdDigits) {
    matchedFields.push("nationalId")
  }
  if (names && namesMatch(names, patient.fullName)) {
    matchedFields.push("names")
  }

  const failedFields = providedFields.filter((f) => !matchedFields.includes(f))
  const unlocked = providedFields.length > 0 && failedFields.length === 0

  return { unlocked, matchedFields, providedFields, failedFields }
}
