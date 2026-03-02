"use client"

import type { FavoriteItem } from "./favorites-store"

export type FavoriteSupplierGroup = {
  supplierId: string
  supplierName: string
  supplierLocation?: string
  supplierDistanceKm?: number
  supplierRating?: number
  supplierBadge?: string
  deliveryEtaMin?: number
  items: FavoriteItem[]
}

export function flattenFavoriteGroups(groups: FavoriteSupplierGroup[]): FavoriteItem[] {
  return (groups || []).flatMap((group) =>
    (group.items || []).map((item) => ({
      ...item,
      supplierId: item.supplierId || group.supplierId,
      supplierName: item.supplierName || group.supplierName,
      supplierLocation: item.supplierLocation || group.supplierLocation,
      supplierDistanceKm: item.supplierDistanceKm ?? group.supplierDistanceKm,
      supplierRating: item.supplierRating ?? group.supplierRating,
      supplierBadge: item.supplierBadge || group.supplierBadge,
      deliveryEtaMin: item.deliveryEtaMin ?? group.deliveryEtaMin,
    }))
  )
}

export async function fetchFavorites(): Promise<FavoriteSupplierGroup[]> {
  const res = await fetch("/api/favorites", { method: "GET", credentials: "include" })
  if (!res.ok) throw new Error(`Failed to load favorites (${res.status})`)
  const json = await res.json()
  if (!json?.ok) throw new Error(json?.error || "Failed to load favorites")
  return json.suppliers || []
}

export async function addFavoriteApi(input: {
  productId: string
  supplierId: string
  clientPrice?: number
}) {
  const res = await fetch("/api/favorites/add", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const json = await res.json()
  if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to add favorite")
  return json
}

export async function removeFavoriteApi(input: { productId: string; supplierId: string }) {
  const query = new URLSearchParams(input).toString()
  const res = await fetch(`/api/favorites/remove?${query}`, {
    method: "DELETE",
    credentials: "include",
  })
  const json = await res.json()
  if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to remove favorite")
  return json
}

export async function mergeFavoritesApi(items: Array<{
  productId: string
  supplierId: string
  addedAt?: string
  lastSeenPrice?: number
}>) {
  if (!items || items.length === 0) return { ok: true, merged: 0 }
  const res = await fetch("/api/favorites/merge", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  })
  const json = await res.json()
  if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to merge favorites")
  return json
}

export async function saveFavoriteEmailPrefs(input: {
  enabled: boolean
  quietHoursStart?: string | null
  quietHoursEnd?: string | null
}) {
  const res = await fetch("/api/favorites/email-prefs", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const json = await res.json()
  if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to save preferences")
  return json
}

export async function getFavoriteEmailPrefs() {
  const res = await fetch("/api/favorites/email-prefs", {
    method: "GET",
    credentials: "include",
  })
  const json = await res.json()
  if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to load preferences")
  return json
}

export async function trackFavoriteEvent(input: {
  eventType: string
  productId?: string
  supplierId?: string
  meta?: Record<string, any>
}) {
  const res = await fetch("/api/favorites/event", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const json = await res.json()
  if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to record event")
  return json
}
