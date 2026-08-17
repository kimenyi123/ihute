/** Seller UrubutoPay transaction report helpers */

export type UrubutoPaymentRow = {
  id: number
  transactionId?: string
  internalTransactionId?: string
  /** IHUTE / Urubuto initiation id (same as transactionId for checkout). */
  slipNumber?: string
  /** MoMo FT Id / Urubuto channel ref (from SMS after payment). */
  channelTransactionRef?: string
  /** Shorter second numeric ref when SMS/Urubuto has telco + settlement ids. */
  alternateChannelRef?: string
  clientReference?: string
  payerCode?: string
  payerNames?: string
  amount?: number
  currency?: string
  paymentMethod?: string
  status?: string
  createdAt?: string
  completedAt?: string
  orderId?: number
  orderPaymentName?: string
  orderPaymentStatus?: string
  orderBuyerName?: string
}

export type UrubutoPaymentSummary = {
  totalCount: number
  walletCount: number
  cardCount: number
  pendingCount: number
  completedCount: number
  completedAmountRwf: number
}

export type UrubutoPaymentsQuery = {
  account: string
  limit?: number
  offset?: number
  method?: "WALLET" | "CARD" | "all"
  status?: "PENDING" | "COMPLETED" | "FAILED" | "all"
  dateFrom?: string
  dateTo?: string
  search?: string
}

export type UrubutoPaymentsResponse = {
  ok: boolean
  payments: UrubutoPaymentRow[]
  summary?: UrubutoPaymentSummary
  filteredTotal?: number
  limit?: number
  offset?: number
  error?: string
}

export function formatUrubutoPaymentMethod(method?: string): { label: string; tone: "momo" | "card" | "unknown" } {
  const m = (method ?? "").toUpperCase()
  if (m === "WALLET") return { label: "MoMo wallet", tone: "momo" }
  if (m === "CARD") return { label: "Card", tone: "card" }
  return { label: method || "—", tone: "unknown" }
}

/** Display status from Urubuto ledger (IHUTE order is updated when Urubuto settles). */
export function resolveEffectiveUrubutoPaymentStatus(urubutoStatus?: string): string {
  return (urubutoStatus ?? "").trim().toUpperCase()
}

/** Drop bogus telco ref extracted from inside IHUTE-1779112897667-6552. */
export function sanitizeAlternateChannelRef(
  ihuteRef?: string,
  channelRef?: string,
  alternate?: string,
): string | undefined {
  const alt = (alternate ?? "").trim()
  if (!alt) return undefined
  const ch = (channelRef ?? "").trim()
  const ih = (ihuteRef ?? "").trim()
  if (alt === ch) return undefined
  if (ih && ih.includes(alt)) return undefined
  if (ch && (ch.includes(alt) || alt.includes(ch))) return undefined
  return alt
}

export type UrubutoReferenceDisplay = {
  ihuteRef: string
  momoFtId?: string
  telcoRef?: string
  slip?: string
  urubutoInternal?: string
  cartRef?: string
}

export type UrubutoPaymentTimestamps = {
  primaryLabel: string
  primaryAt?: Date
  secondaryLabel?: string
  secondaryAt?: Date
}

function parsePaymentInstant(value?: string): Date | undefined {
  if (!value?.trim()) return undefined
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? undefined : d
}

/** Paid-at first; avoid showing ledger recorded time before payment time. */
export function buildUrubutoPaymentTimestamps(
  row: UrubutoPaymentRow,
  displayStatus?: string,
): UrubutoPaymentTimestamps {
  const status = (displayStatus ?? row.status ?? "").trim().toUpperCase()
  const created = parsePaymentInstant(row.createdAt)
  const completed = parsePaymentInstant(row.completedAt)

  if (status === "COMPLETED" && completed) {
    const out: UrubutoPaymentTimestamps = { primaryLabel: "Paid at", primaryAt: completed }
    if (!created) return out
    const diffMs = created.getTime() - completed.getTime()
    if (Math.abs(diffMs) < 120_000) return out
    if (created.getTime() < completed.getTime()) {
      out.secondaryLabel = "Initiated"
      out.secondaryAt = created
    } else {
      out.secondaryLabel = "Recorded"
      out.secondaryAt = created
    }
    return out
  }

  const primaryAt = created ?? completed
  const primaryLabel =
    status === "FAILED" || status === "CANCELLED"
      ? "Attempted"
      : status === "PENDING" || status === "INITIATED"
        ? "Started"
        : "When"
  return { primaryLabel, primaryAt }
}

/** Compact ID card when only IHUTE (+ optional more) — typical for failed/pending rows. */
export function isCompactUrubutoReferencePanel(
  row: UrubutoPaymentRow,
  displayStatus?: string,
): boolean {
  const refs = buildUrubutoReferenceDisplay(row)
  if (refs.momoFtId || refs.telcoRef || refs.slip) return false
  const status = (displayStatus ?? row.status ?? "").trim().toUpperCase()
  return status === "FAILED" || status === "CANCELLED" || status === "PENDING" || status === "INITIATED"
}

export function buildUrubutoReferenceDisplay(row: UrubutoPaymentRow): UrubutoReferenceDisplay {
  const ihuteRef = (row.transactionId || row.internalTransactionId || "").trim()
  const momoFtId = (row.channelTransactionRef ?? "").trim() || undefined
  const telcoRef = sanitizeAlternateChannelRef(ihuteRef, momoFtId, row.alternateChannelRef)
  const slipRaw = (row.slipNumber ?? "").trim()
  const slip =
    slipRaw && slipRaw !== momoFtId && !/^\d+$/.test(slipRaw) ? slipRaw : undefined
  const internal = (row.internalTransactionId ?? "").trim()
  const urubutoInternal =
    internal && internal !== ihuteRef && internal !== momoFtId ? internal : undefined
  const cart = (row.clientReference ?? "").trim()
  const cartRef = cart && cart !== ihuteRef ? cart : undefined
  return { ihuteRef, momoFtId, telcoRef, slip, urubutoInternal, cartRef }
}

export function formatUrubutoPaymentStatus(status?: string): {
  label: string
  tone: "success" | "pending" | "failed" | "neutral"
} {
  const s = (status ?? "").toUpperCase()
  if (s === "COMPLETED") return { label: "Paid", tone: "success" }
  if (s === "PENDING" || s === "INITIATED") return { label: "Pending", tone: "pending" }
  if (s === "FAILED" || s === "CANCELLED") return { label: s === "CANCELLED" ? "Cancelled" : "Failed", tone: "failed" }
  return { label: status || "—", tone: "neutral" }
}

export async function fetchSupplierUrubutoPayments(
  query: UrubutoPaymentsQuery,
): Promise<UrubutoPaymentsResponse> {
  const params = new URLSearchParams()
  params.set("account", query.account.trim())
  params.set("limit", String(query.limit ?? 50))
  params.set("offset", String(query.offset ?? 0))
  if (query.method && query.method !== "all") params.set("method", query.method)
  if (query.status && query.status !== "all") params.set("status", query.status)
  if (query.dateFrom?.trim()) params.set("dateFrom", query.dateFrom.trim())
  if (query.dateTo?.trim()) params.set("dateTo", query.dateTo.trim())
  if (query.search?.trim()) params.set("search", query.search.trim())

  try {
    const res = await fetch(`/api/supplier/urubuto/payments?${params}`, { cache: "no-store" })
    const data = await res.json().catch(() => ({}))
    const summary = data.summary
    return {
      ok: !!data.ok,
      payments: (data.payments as UrubutoPaymentRow[]) ?? [],
      filteredTotal: data.filteredTotal != null ? Number(data.filteredTotal) : undefined,
      limit: data.limit != null ? Number(data.limit) : undefined,
      offset: data.offset != null ? Number(data.offset) : undefined,
      summary: summary
        ? {
            totalCount: Number(summary.totalCount ?? 0),
            walletCount: Number(summary.walletCount ?? 0),
            cardCount: Number(summary.cardCount ?? 0),
            pendingCount: Number(summary.pendingCount ?? 0),
            completedCount: Number(summary.completedCount ?? 0),
            completedAmountRwf: Number(summary.completedAmountRwf ?? 0),
          }
        : undefined,
      error: data.error || data.message,
    }
  } catch (e: unknown) {
    return {
      ok: false,
      payments: [],
      error: e instanceof Error ? e.message : "Could not load transactions",
    }
  }
}
