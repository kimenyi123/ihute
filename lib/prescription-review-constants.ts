/** Pharmacy drug buckets for Rx pharmacist review and checkout (not grocery POS). */
export const DRUG_FAMILLES = [
  "GENERIC HUMAN DRUGS",
  "SPEC HUMAN DRUGS",
  "SPECIFIC HUMAN DRUGS",
  "DRUGS",
  "DRUG",
  "VACCINE",
  "HORMONS",
  "HORMONE",
  "HORMONES",
  "ANTI-CANCER",
  "PSE",
  "PGE",
  "PGA",
  "PSA",
] as const

/** SQL fragment: POS famille or niki category_id is a pharmacy drug category. */
export function pharmacyCategorySql(familleExpr: string, categoryExpr: string): string {
  const col = (e: string) => {
    const x = `UPPER(TRIM(COALESCE(${e}, '')))`
    const quoted = DRUG_FAMILLES.map((f) => `'${f.replace(/'/g, "''")}'`).join(", ")
    return `(${x} IN (${quoted}) OR ${x} LIKE 'GENERIC HUMAN DRUG%' OR ${x} LIKE 'SPEC HUMAN DRUG%' OR ${x} LIKE 'SPECIFIC HUMAN DRUG%' OR ${x} LIKE 'DRUGS %' OR ${x} LIKE 'DRUGS>>%')`
  }
  return `(${col(familleExpr)} OR ${col(categoryExpr)})`
}
