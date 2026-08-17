/**
 * Heuristic classifier for likely prescription-only drugs.
 * NOT regulator-certified — flags candidates for pharmacist confirmation.
 * Source of truth remains niki_items.requires_prescription (manual/admin override).
 */

export type PrescriptionClassifyInput = {
  niki_code?: string | null
  item_inn?: string | null
  item_commercial_name?: string | null
  item_name?: string | null
  name?: string | null
}

export type PrescriptionClassifyResult = {
  likely: boolean
  reason: string | null
  matchedKeyword: string | null
}

/** Keyword → short reason (checked against INN + commercial name). */
export const PRESCRIPTION_CLASS_KEYWORDS: ReadonlyArray<{ keyword: string; reason: string }> = [
  // antibiotics
  { keyword: "amoxicillin", reason: "antibiotic" },
  { keyword: "amox", reason: "antibiotic" },
  { keyword: "clavulan", reason: "antibiotic" },
  { keyword: "ciprofloxacin", reason: "antibiotic" },
  { keyword: "azithromycin", reason: "antibiotic" },
  { keyword: "metronidazole", reason: "antibiotic" },
  { keyword: "ceftriaxone", reason: "antibiotic" },
  { keyword: "doxycycline", reason: "antibiotic" },
  // antihypertensives
  { keyword: "perindopril", reason: "antihypertensive" },
  { keyword: "amlodipine", reason: "antihypertensive" },
  { keyword: "losartan", reason: "antihypertensive" },
  { keyword: "enalapril", reason: "antihypertensive" },
  { keyword: "nifedipine", reason: "antihypertensive" },
  { keyword: "atenolol", reason: "antihypertensive" },
  // psychotropics
  { keyword: "amitriptyline", reason: "psychotropic" },
  { keyword: "sertraline", reason: "psychotropic" },
  { keyword: "fluoxetine", reason: "psychotropic" },
  { keyword: "diazepam", reason: "psychotropic" },
  { keyword: "clonazepam", reason: "psychotropic" },
  // oncology
  { keyword: "bevacizumab", reason: "oncology" },
  { keyword: "pomalidomide", reason: "oncology" },
  { keyword: "methotrexate", reason: "oncology" },
  { keyword: "cyclophosphamide", reason: "oncology" },
  // controlled / potent NSAIDs
  { keyword: "ketorolac", reason: "prescription NSAID" },
  { keyword: "diclofenac", reason: "prescription NSAID" },
  // hormones / uterotonics
  { keyword: "ergometrine", reason: "uterotonic" },
  { keyword: "misoprostol", reason: "uterotonic" },
  { keyword: "oxytocin", reason: "uterotonic" },
  // vaccines
  { keyword: "vaccin", reason: "vaccine" },
  { keyword: "vaccine", reason: "vaccine" },
  { keyword: "engerix", reason: "vaccine" },
  // prescription eye drops / mydriatics
  { keyword: "mydriatic", reason: "prescription eye drop" },
  { keyword: "tropicamide", reason: "prescription eye drop" },
]

/**
 * Returns whether the item looks like a prescription-only drug from name/INN keywords.
 * Does NOT auto-set DB flags — use for import review queues only.
 */
export function isLikelyPrescriptionDrug(
  item: PrescriptionClassifyInput,
): PrescriptionClassifyResult {
  const blob = [
    item.item_inn,
    item.item_commercial_name,
    item.item_name,
    item.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  if (!blob.trim()) {
    return { likely: false, reason: null, matchedKeyword: null }
  }

  for (const { keyword, reason } of PRESCRIPTION_CLASS_KEYWORDS) {
    if (blob.includes(keyword.toLowerCase())) {
      return { likely: true, reason, matchedKeyword: keyword }
    }
  }
  return { likely: false, reason: null, matchedKeyword: null }
}

/** Seed list from pharmacy audit (niki_code → reason). */
export const PRESCRIPTION_SEED_BY_NIKI: Readonly<Record<string, string>> = {
  ACIACEP00026: "seed:antihypertensive ACE inhibitor",
  ACIAMCA00028: "seed:antihypertensive CCB",
  ACIAMOX00044: "seed:antibiotic amox/clav",
  ACIBACI00008: "seed:antibiotic eye drop",
  ACIDICL00051: "seed:prescription NSAID diclofenac",
  ACIDICL00056: "seed:prescription NSAID diclofenac",
  ACIENDT00049: "seed:antibiotic amox/clav",
  ACIERGO00002: "seed:uterotonic",
  ACIGOOD00047: "seed:antibiotic amox/clav",
  ACIHAPP00048: "seed:antibiotic amox/clav",
  ACIKETO00053: "seed:potent NSAID ketorolac",
  ACIMYDR00009: "seed:mydriatic clinical",
  ACIPASI00046: "seed:antibiotic amox/clav",
  ACIVACC00016: "seed:vaccine",
  ALCAMIT00251: "seed:psychotropic antidepressant",
  ANTBEVA00001: "seed:oncology biologic",
  ANTPOMA00002: "seed:oncology restricted",
  BODMEBE00034: "seed:pharmacist review anthelmintic",
}
