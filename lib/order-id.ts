/** Normalize order ids so 3631 and "3631.0" match. */
export function orderIdKey(id: string): string {
  const digits = String(id).replace(/\D/g, "")
  return digits || String(id).trim()
}
