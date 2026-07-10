"use client"

import { getSessionId } from "@/lib/interaction-tracker"
import { useAuthStore } from "@/lib/auth-store"
import { isAdminUser } from "@/lib/auth-login-client"
import { installMonitoredFetch } from "@/lib/monitored-fetch"

export type ActivityActorType = "anonymous" | "buyer" | "supplier" | "admin" | "system" | "pos"

export interface ActivityEventPayload {
  eventId?: string
  createdAt?: string
  environment?: string
  source: string
  stage: string
  status: string
  actor?: {
    type?: ActivityActorType
    sessionId?: string
    userId?: string
    ishyigaAccount?: string
    role?: string
    displayName?: string
  }
  context?: {
    path?: string
    referrer?: string
    userAgent?: string
    warContext?: string
  }
  entity?: {
    type?: string
    id?: string
    name?: string
  }
  metadata?: Record<string, unknown>
  durationMs?: number
  message?: string
}

const MAX_BATCH = 20
const FLUSH_MS = 5000

let queue: ActivityEventPayload[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
let sessionStarted = false

function detectEnvironment(): string {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "").toLowerCase()
  if (site.includes("beta.") || site.includes("localhost")) return "beta"
  return "prod"
}

function detectWarContext(): string {
  const api = (process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE || "").trim()
  if (!api) return ""
  try {
    const u = new URL(api)
    return u.pathname.replace(/\/+$/, "") || ""
  } catch {
    return ""
  }
}

function basePath(): string {
  return (process.env.NEXT_PUBLIC_BASE_PATH || "").trim().replace(/\/+$/, "")
}

function apiUrl(path: string): string {
  const bp = basePath()
  return `${bp}${path.startsWith("/") ? path : `/${path}`}`
}

function actorFromAuth(): ActivityEventPayload["actor"] {
  const user = useAuthStore.getState().user
  const sessionId = getSessionId()
  if (!user) {
    return { type: "anonymous", sessionId }
  }
  const dbRole = String(user.dbRole ?? "").toUpperCase()
  const role = user.role || "customer"
  let type: ActivityActorType = "buyer"
  if (isAdminUser(user)) {
    type = "admin"
  } else if (role === "supplier" || dbRole === "SELLER") {
    type = "supplier"
  }
  return {
    type,
    sessionId,
    userId: user.email || undefined,
    ishyigaAccount: user.ishyigaAccount || undefined,
    role: dbRole || role,
    displayName: user.businessName || user.name || undefined,
  }
}

function enqueue(event: ActivityEventPayload) {
  if (typeof window === "undefined") return
  queue.push({
    ...event,
    createdAt: event.createdAt || new Date().toISOString(),
    environment: event.environment || detectEnvironment(),
    source: event.source || "frontend",
    context: {
      path: window.location.pathname,
      referrer: document.referrer || undefined,
      userAgent: navigator.userAgent,
      warContext: detectWarContext(),
      ...event.context,
    },
    actor: event.actor || actorFromAuth(),
  })
  if (queue.length >= MAX_BATCH) {
    void flushActivityQueue()
    return
  }
  scheduleFlush()
}

function scheduleFlush() {
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    void flushActivityQueue()
  }, FLUSH_MS)
}

export async function flushActivityQueue(): Promise<void> {
  if (typeof window === "undefined" || queue.length === 0) return
  const batch = queue.splice(0, MAX_BATCH)
  try {
    const res = await fetch(apiUrl("/api/activity/events"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    })
    if (res.status === 429) {
      // Rate limited — drop batch silently (do not re-queue).
      return
    }
    if (!res.ok) {
      queue.unshift(...batch)
    }
  } catch {
    queue.unshift(...batch)
  }
}

export function trackSessionStart() {
  if (sessionStarted) return
  sessionStarted = true
  installMonitoredFetch()
  enqueue({
    source: "frontend",
    stage: "session_start",
    status: "success",
    message: "Session started",
  })
}

export function trackPageView(path: string) {
  const metadata: Record<string, unknown> = {}
  const pathOnly = path.split("?")[0] || path
  const shopMatch = pathOnly.match(/^\/shop-with-me\/([^/?#]+)/i)
  if (shopMatch) {
    try {
      metadata.shopNickname = decodeURIComponent(shopMatch[1]).toLowerCase()
    } catch {
      metadata.shopNickname = String(shopMatch[1]).toLowerCase()
    }
  }
  if (typeof window !== "undefined" && pathOnly.startsWith("/shop-with-me")) {
    try {
      const qs = new URL(path, window.location.origin).searchParams
      if (!metadata.shopNickname) {
        const nick = (qs.get("nickname") || "").trim().toLowerCase()
        if (nick) metadata.shopNickname = nick
      }
      const src = (qs.get("src") || "").trim().toLowerCase()
      if (src === "qr") {
        metadata.acquisitionSource = "qr"
        metadata.fromQr = true
      }
    } catch {
      /* ignore */
    }
  }
  enqueue({
    source: "frontend",
    stage: "page_view",
    status: "success",
    context: { path },
    entity: { type: "page", id: path },
    metadata: Object.keys(metadata).length ? metadata : undefined,
    message: `Page view ${path}`,
  })
}

/** Seller copied or displayed their shop-with-me QR / link (for “most shared QR” admin stats). */
export function trackQrShare(shopNickname: string, opts?: { sellerAccount?: string; table?: string }) {
  const nick = shopNickname.trim().toLowerCase()
  if (!nick) return
  trackEvent("qr_share", {
    entity: { type: "shop", id: nick, name: nick },
    metadata: {
      shopNickname: nick,
      sellerAccount: opts?.sellerAccount,
      table: opts?.table,
      channel: "shop_with_me",
    },
    message: `QR share @${nick}`,
  })
}

/** Buyer opened a shop via QR (`?src=qr`). */
export function trackQrScan(shopNickname: string, opts?: { sellerAccount?: string; table?: string }) {
  const nick = shopNickname.trim().toLowerCase()
  if (!nick) return
  trackEvent("qr_scan", {
    entity: { type: "shop", id: nick, name: nick },
    metadata: {
      shopNickname: nick,
      sellerAccount: opts?.sellerAccount,
      table: opts?.table,
      acquisitionSource: "qr",
      fromQr: true,
    },
    message: `QR scan @${nick}`,
  })
}

export type TrackEventOptions = {
  status?: string
  entity?: { type?: string; id?: string; name?: string }
  metadata?: Record<string, unknown>
  actor?: ActivityEventPayload["actor"]
  context?: ActivityEventPayload["context"]
  message?: string
  durationMs?: number
}

/** Generic activity event (Mongo batch). */
export function trackEvent(stage: string, options: TrackEventOptions = {}) {
  enqueue({
    source: "frontend",
    stage,
    status: options.status || "success",
    entity: options.entity,
    metadata: options.metadata,
    actor: options.actor,
    context: options.context,
    message: options.message,
    durationMs: options.durationMs,
  })
}

export function trackCategoryView(categoryName: string, categoryPath?: string, categoryId?: string) {
  const id = categoryId || categoryName
  void import("./interaction-tracker").then(({ trackCategoryView: trackPersonalization }) => {
    trackPersonalization(id, categoryName)
  })
  trackEvent("category_view", {
    entity: { type: "category", id, name: categoryName },
    context: categoryPath ? { path: categoryPath } : undefined,
    message: categoryName ? `Category ${categoryName}` : `Category ${id}`,
  })
}

export function trackProductViewActivity(
  productId: string,
  productName?: string,
  metadata?: { supplierId?: string; categoryId?: string; price?: number },
) {
  trackEvent("product_view", {
    entity: { type: "product", id: productId, name: productName },
    metadata: metadata as Record<string, unknown> | undefined,
    message: productName ? `Product ${productName}` : `Product ${productId}`,
  })
}

export function trackSearchActivity(query: string, resultsCount?: number, shopNickname?: string) {
  const q = query.trim()
  if (!q) return
  const metadata: Record<string, unknown> = {
    resultsCount: resultsCount ?? undefined,
    queryLength: q.length,
  }
  if (shopNickname?.trim()) metadata.shopNickname = shopNickname.trim()
  trackEvent("search", {
    entity: { type: "search", id: q.slice(0, 120) },
    metadata,
    message: `Search: ${q.slice(0, 80)}${q.length > 80 ? "…" : ""}`,
  })
}

export function trackAddToCartActivity(
  productId: string,
  productName?: string,
  metadata?: { price?: number; quantity?: number; shopNickname?: string; supplierId?: string },
) {
  trackEvent("add_to_cart", {
    entity: { type: "product", id: productId, name: productName },
    metadata: metadata as Record<string, unknown> | undefined,
    message: productName ? `Add to cart: ${productName}` : `Add to cart: ${productId}`,
  })
}

export function trackSupplierView(supplierId: string, supplierName?: string) {
  void import("./interaction-tracker").then(({ trackSupplierView: trackPersonalization }) => {
    trackPersonalization(supplierId, supplierName)
  })
  trackEvent("supplier_view", {
    entity: { type: "supplier", id: supplierId, name: supplierName },
    message: supplierName ? `Supplier ${supplierName}` : `Supplier ${supplierId}`,
  })
}

/** Supplemental page view with explicit path (global ActivityTracker also logs route changes). */
export function trackSupplementalPageView(path?: string) {
  const p =
    path || (typeof window !== "undefined" ? window.location.pathname + window.location.search : "")
  trackEvent("page_view", {
    context: { path: p },
    message: `Page view ${p}`,
  })
}

export function trackAuth(event: "login" | "logout" | "login_failed", email?: string | null) {
  const status = event === "login_failed" ? "failed" : "success"
  enqueue({
    source: "frontend",
    stage: "auth",
    status,
    actor: {
      ...actorFromAuth(),
      userId: email || actorFromAuth()?.userId,
    },
    entity: { type: "user", id: email || "unknown" },
    message:
      event === "login"
        ? "User logged in"
        : event === "logout"
          ? "User logged out"
          : "Login failed",
    metadata: { authEvent: event },
  })
}

export function trackCheckoutStep(step: 1 | 2 | 3, label: "address" | "payment" | "confirm") {
  trackEvent("checkout_step", {
    metadata: { step, label },
    message: `Checkout step ${step}: ${label}`,
  })
}

export function trackCheckoutSubmit(status: "success" | "failed", metadata?: Record<string, unknown>) {
  trackEvent("checkout_submit", { status, metadata })
}

export function trackProfileUpdate(actorType: "supplier" | "buyer" | "admin") {
  trackEvent("profile_update", {
    actor: { ...actorFromAuth(), type: actorType },
    message: "Profile updated",
  })
}

/** Register visibility flush once (call from ActivityTracker mount). */
export function registerActivityFlushOnHide() {
  if (typeof window === "undefined") return () => {}
  const onHide = () => {
    void flushActivityQueue()
  }
  document.addEventListener("visibilitychange", onHide)
  window.addEventListener("pagehide", onHide)
  return () => {
    document.removeEventListener("visibilitychange", onHide)
    window.removeEventListener("pagehide", onHide)
  }
}
