/**
 * Saved delivery addresses (localStorage). IHUTE: one-click select at checkout.
 */
const STORAGE_KEY = "ihute_saved_addresses"
const MAX_ADDRESSES = 10

export type SavedAddress = {
  id: string
  label: string
  address: string
  phone?: string
  createdAt: number
}

function load(): SavedAddress[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter(isValid) : []
  } catch {
    return []
  }
}

function isValid(a: unknown): a is SavedAddress {
  return (
    typeof a === "object" &&
    a !== null &&
    typeof (a as SavedAddress).id === "string" &&
    typeof (a as SavedAddress).label === "string" &&
    typeof (a as SavedAddress).address === "string"
  )
}

export function getSavedAddresses(): SavedAddress[] {
  return load().slice(0, MAX_ADDRESSES)
}

export function saveAddress(addr: Omit<SavedAddress, "id" | "createdAt">): SavedAddress[] {
  const list = load()
  const newAddr: SavedAddress = {
    ...addr,
    id: `addr_${Date.now()}`,
    createdAt: Date.now(),
  }
  const next = [newAddr, ...list.filter((a) => a.address.trim() !== addr.address.trim())].slice(0, MAX_ADDRESSES)
  if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}

export function deleteSavedAddress(id: string): SavedAddress[] {
  const next = load().filter((a) => a.id !== id)
  if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}
