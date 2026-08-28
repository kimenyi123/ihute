/**
 * Kinyarwanda-first unlock error copy for the eRx market flow (spec-aligned).
 */

import type { ErxIdentityMatchField } from "@/lib/erx/erx-identity-match"

const FIELD_RW: Record<ErxIdentityMatchField, string> = {
  phone: "Telefoni",
  names: "Amazina",
  nationalId: "Indangamuntu",
}

export function erxUnlockErrorMessage(
  code: string,
  failedFields?: ErxIdentityMatchField[],
): string {
  if (code === "ERX_UNLOCK_REQUIRED") {
    return "Andika telefoni, amazina, cyangwa indangamuntu — kimwe kirahagije kugira ngo ufungure urwandiko."
  }
  if (code === "ERX_NOT_FOUND") {
    return "Iyi kode ya eRx ntabwo iboneka muri sisitemu ya Minisiteri y'Ubuzima."
  }
  if (code === "ERX_NOT_CONFIGURED") {
    return "MoH eRx ntiyashyizweho kuri iyi seriveri. Hamagara itsinda ry'ihute."
  }
  if (code === "ERX_RATE_LIMITED") {
    return "Wagerageje inshuro nyinshi. Tegereza gato hanyuma ugerageze nanone."
  }
  if (code === "ERX_UPSTREAM_ERROR") {
    return "Ntitwashoboye kuvugana na Minisiteri y'Ubuzima. Gerageza nanone."
  }
  if (code === "ERX_IDENTITY_MISMATCH" && failedFields?.length === 1) {
    const f = failedFields[0]
    if (f === "phone") {
      return "Telefoni washyizemo ntihura n'iyo iri kuri uru rwandiko rw'imiti. Reba ko ari numero y'umurwayi."
    }
    if (f === "names") {
      return "Amazina washyizemo ntahura n'ayo ari kuri uru rwandiko rw'imiti."
    }
    if (f === "nationalId") {
      return "Indangamuntu washyizemo ntihura n'iyo iri kuri uru rwandiko rw'imiti."
    }
  }
  if (code === "ERX_IDENTITY_MISMATCH") {
    return "Telefoni, amazina, cyangwa indangamuntu washyizemo ntibihura n'uru rwandiko rw'imiti."
  }
  return "Ntibyashoboye gufungura urwandiko. Gerageza nanone."
}
