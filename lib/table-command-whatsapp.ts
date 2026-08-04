/** Line item for table-command WhatsApp / invoice grouping */
export type TableCommandLineItem = {
  name: string
  qty: number
  unitPrice: number
  orderedBy?: string | null
  lineId?: number | null
  /** `order_transaction_list.HEURE` — when this line was added (table round time). */
  lineCreatedAt?: number | string | null
}

export function isTableCommandOrder(order: {
  IS_TABLE_COMMAND?: boolean
  TABLE_NAME?: string
  buyerLocation?: string
}): boolean {
  if (order.IS_TABLE_COMMAND) return true
  if (order.TABLE_NAME?.trim()) return true
  return (order.buyerLocation ?? "").toLowerCase().includes("table:")
}

/** One guest name for grouping + display — always UPPERCASE (Gilbert = GILBERT). */
export function normalizeTableCommandPerson(name?: string | null): string {
  const n = (name ?? "").trim()
  return n ? n.toLocaleUpperCase("en-US") : "GUEST"
}

/** Use line ORDERED_BY when set; otherwise fall back to order buyer name (legacy rows). */
export function resolveTableCommandLinePerson(
  lineOrderedBy?: string | null,
  orderBuyerName?: string | null,
): string {
  const line = (lineOrderedBy ?? "").trim()
  if (line && !/^guest$/i.test(line)) {
    return normalizeTableCommandPerson(line)
  }
  const buyer = (orderBuyerName ?? "").trim()
  if (buyer && !/^guest$/i.test(buyer)) {
    return normalizeTableCommandPerson(buyer)
  }
  return normalizeTableCommandPerson(line || buyer)
}

function lineTotalRwf(item: Pick<TableCommandLineItem, "qty" | "unitPrice">): number {
  const qty = Number(item.qty) || 0
  const unit = Number(item.unitPrice) || 0
  return Math.round(qty * unit)
}

function parseLineCreatedAtMs(raw: unknown): number | undefined {
  if (raw == null || raw === "") return undefined
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw < 1e12 ? raw * 1000 : raw
  }
  const d = new Date(String(raw))
  const ms = d.getTime()
  return Number.isFinite(ms) ? ms : undefined
}

function earliestLineTimeMs(items: Array<{ lineCreatedAt?: number | string | null }>): number | undefined {
  const times = items
    .map((item) => parseLineCreatedAtMs(item.lineCreatedAt))
    .filter((t): t is number => t != null)
  return times.length ? Math.min(...times) : undefined
}

/** Compact banner label for when a guest placed a table round. */
export function formatTableRoundTimestamp(value: number | string | undefined | null): string | undefined {
  const ms = parseLineCreatedAtMs(value)
  if (ms == null) return undefined
  const d = new Date(ms)
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d)
  const date = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    ...(d.getFullYear() !== new Date().getFullYear() ? { year: "numeric" as const } : {}),
  }).format(d)
  return `${time} · ${date}`
}

function formatItemLine(item: TableCommandLineItem): string {
  const total = lineTotalRwf(item)
  const label = item.name.replace(/\s+/g, " ").trim()
  const qty = Number(item.qty) || 1
  return `• ${label}\n  Qty ${qty} · ${total.toLocaleString()} RWF`
}

type PersonBatch = { person: string; items: TableCommandLineItem[] }

/**
 * Split items into chronological batches per person.
 * A new batch starts when the same guest orders again after someone else ordered (round 2+).
 * Sorted by ID_LIST ascending — oldest lines first, newest round at the bottom.
 */
function buildPersonBatches(items: TableCommandLineItem[]): PersonBatch[] {
  const sorted = [...items].sort((a, b) => {
    const idA = Number(a.lineId ?? 0)
    const idB = Number(b.lineId ?? 0)
    if (idA !== idB) return idA - idB
    return a.name.localeCompare(b.name)
  })

  const batches: PersonBatch[] = []
  for (const item of sorted) {
    const person = normalizeTableCommandPerson(item.orderedBy)
    const last = batches[batches.length - 1]
    const lastItem = last?.items[last.items.length - 1]
    const lineId = Number(item.lineId ?? 0)
    const lastLineId = Number(lastItem?.lineId ?? 0)
    const lineMs = parseLineCreatedAtMs(item.lineCreatedAt)
    const lastLineMs = parseLineCreatedAtMs(lastItem?.lineCreatedAt)
    const idGap = lineId > 0 && lastLineId > 0 ? lineId - lastLineId : 0
    const timeGapMs =
      lineMs != null && lastLineMs != null ? Math.abs(lineMs - lastLineMs) : 0
    const newRoundSameGuest =
      last &&
      last.person === person &&
      (idGap > 1 || timeGapMs > 3 * 60 * 1000)

    if (last && last.person === person && !newRoundSameGuest) {
      last.items.push(item)
    } else {
      batches.push({ person, items: [item] })
    }
  }
  return batches
}

/** Order guests by who ordered first at the table. */
function personDisplayOrder(batches: PersonBatch[]): string[] {
  const seen = new Map<string, number>()
  batches.forEach((b, idx) => {
    if (!seen.has(b.person)) seen.set(b.person, idx)
  })
  return [...seen.keys()].sort((a, b) => (seen.get(a) ?? 0) - (seen.get(b) ?? 0))
}

function roundSeparatorLabel(roundNumber: number): string {
  return `— Round ${roundNumber} —`
}

/**
 * WhatsApp body lines grouped by guest, with round separators when they order again.
 */
export function buildTableCommandWhatsAppLines(items: TableCommandLineItem[]): string[] {
  if (!items.length) return []

  const batches = buildPersonBatches(items)
  const persons = personDisplayOrder(batches)
  const out: string[] = []

  for (const person of persons) {
    const rounds = batches.filter((b) => b.person === person)
    out.push(`*Ordered by: ${person}*`)
    rounds.forEach((round, roundIdx) => {
      if (roundIdx > 0) out.push(roundSeparatorLabel(roundIdx + 1))
      for (const item of round.items) {
        out.push(formatItemLine(item))
      }
    })
    out.push("")
  }

  while (out.length > 0 && out[out.length - 1] === "") {
    out.pop()
  }
  return out
}

export function buildTableCommandWhatsAppBlock(items: TableCommandLineItem[]): string {
  return buildTableCommandWhatsAppLines(items).join("\n")
}

export type TableCommandViewLine = {
  name: string
  qty: number
  unitPrice: number
  total: number
  lineId?: number | null
  lineCreatedAt?: number
}

export type TableCommandViewRound = {
  roundNumber: number
  items: TableCommandViewLine[]
  roundStartedAt?: number
}

export type TableCommandViewPerson = {
  person: string
  rounds: TableCommandViewRound[]
}

/** Structured view for supplier dashboard (same grouping as WhatsApp). */
export function buildTableCommandView(items: TableCommandLineItem[]): TableCommandViewPerson[] {
  const batches = buildPersonBatches(items)
  const persons = personDisplayOrder(batches)
  return persons.map((person) => {
    const rounds = batches.filter((b) => b.person === person)
    return {
      person,
      rounds: rounds.map((round, roundIdx) => ({
        roundNumber: roundIdx + 1,
        items: round.items.map((item) => ({
          name: item.name.replace(/\s+/g, " ").trim(),
          qty: Number(item.qty) || 1,
          unitPrice: Number(item.unitPrice) || 0,
          total: lineTotalRwf(item),
          lineId: item.lineId,
          lineCreatedAt: parseLineCreatedAtMs(item.lineCreatedAt),
        })),
        roundStartedAt: earliestLineTimeMs(round.items),
      })),
    }
  })
}

export function formatTableCommandLineLabel(item: Pick<TableCommandViewLine, "name" | "qty" | "total">): string {
  const qty = Number(item.qty) || 1
  return `${item.name}   ×${qty}   ${item.total.toLocaleString()} RWF`
}

/** Clean duplicate table segments (e.g. "Table: ISHYIGA ONE | ISHYIGA ONE"). */
export function normalizeReceiptLocation(raw?: string | null): string {
  const s = (raw ?? "").trim()
  if (!s) return ""

  const tablePrefix = /^table:\s*/i
  if (tablePrefix.test(s)) {
    const after = s.replace(tablePrefix, "").trim()
    const parts = after.split("|").map((p) => p.trim()).filter(Boolean)
    if (parts.length >= 2) {
      const key = parts[0].toLowerCase()
      if (parts.every((p) => p.toLowerCase() === key)) {
        return `Table: ${parts[0]}`
      }
    }
    return parts.length === 1 ? `Table: ${parts[0]}` : `Table: ${after}`
  }

  return s
}

export type OrderReceiptLine = {
  name: string
  qty: number
  total: number
}

export type OrderReceiptGuestRound = {
  roundLabel?: string
  /** e.g. "8:04 pm · 1 Jun" — earliest line time in this round */
  startedAtLabel?: string
  lines: OrderReceiptLine[]
}

export type OrderReceiptGuestGroup = {
  guest: string
  rounds: OrderReceiptGuestRound[]
}

export type OrderReceiptViewModel = {
  shop: string
  location: string
  orderId: string
  momoTxId?: string
  description?: string
  /** Order placed / receipt generated time banner */
  placedAtLabel?: string
  isTableCommand: boolean
  flatItems: OrderReceiptLine[]
  guestGroups: OrderReceiptGuestGroup[]
  subtotal?: number
  logisticsFee?: number
  discount: number
  total: number
  paid: number
  paidAt: string
  reference?: string
  myPhone?: string
  followLink?: string
  placedAt?: string
  logisticsType?: string
  /**
   * Absolute or site-relative public URL of the Rx photo for THIS seller-order only.
   * Only set when PRESCRIPTION_REQUIRED=1 for that order.
   */
  prescriptionImageUrl?: string
}

function formatReceiptMoney(amount: number): string {
  return `${amount.toLocaleString()} RWF`
}

function formatReceiptItemLine(item: OrderReceiptLine): string {
  const qty = Number(item.qty) || 1
  const name = item.name.replace(/\s+/g, " ").trim()
  return `• ${name}\n  Qty ${qty} · ${item.total.toLocaleString()} RWF`
}

function waSection(title: string): string {
  return `*${title}*`
}

function waLabelValue(label: string, value: string): string {
  return `${label}: ${value}`
}

function waMoneyLine(label: string, amount: number): string {
  return `${label}: ${formatReceiptMoney(amount)}`
}

export function buildOrderReceiptViewModel(args: {
  shop: string
  location?: string
  orderId: string | number
  items: TableCommandLineItem[]
  subtotal?: number
  total: number
  discount?: number
  paid: number
  paidAt?: string
  reference?: string
  myPhone?: string
  link?: string
  isTableCommand?: boolean
  momoTxId?: string
  orderDescription?: string
  logisticsFee?: number
  logisticsType?: string
  /** When line ORDERED_BY is blank/GUEST, use this (order buyer name). */
  defaultOrderedBy?: string
  /** Order placed time — raw timestamp or pre-formatted label */
  placedAt?: number | string | null
  /** Rx photo URL for this seller-order only (when PRESCRIPTION_REQUIRED). */
  prescriptionImageUrl?: string | null
}): OrderReceiptViewModel {
  const discount = args.discount ?? 0
  const description = args.orderDescription?.trim()
  const subtotal = Number.isFinite(args.subtotal ?? NaN)
    ? args.subtotal
    : typeof args.logisticsFee === "number"
      ? args.total - args.logisticsFee + discount
      : undefined

  const flatItems: OrderReceiptLine[] = args.items.map((item) => ({
    name: item.name.replace(/\s+/g, " ").trim(),
    qty: Number(item.qty) || 1,
    total: lineTotalRwf(item),
  }))

  const guestGroups: OrderReceiptGuestGroup[] = args.isTableCommand
    ? buildTableCommandView(
        args.items.map((item) => ({
          ...item,
          orderedBy: resolveTableCommandLinePerson(item.orderedBy, args.defaultOrderedBy),
        })),
      ).map((person) => ({
        guest: person.person,
        rounds: person.rounds.map((round, roundIdx) => ({
          roundLabel: roundIdx > 0 ? `Round ${roundIdx + 1}` : undefined,
          startedAtLabel: formatTableRoundTimestamp(round.roundStartedAt),
          lines: round.items.map((line) => ({
            name: line.name,
            qty: line.qty,
            total: line.total,
          })),
        })),
      }))
    : []

  const phone = (args.myPhone ?? "").trim()
  const normalizedPhone = phone && !/^n\/?a$/i.test(phone) ? phone : ""
  const rxUrl = String(args.prescriptionImageUrl ?? "").trim() || undefined

  return {
    shop: args.shop,
    location: normalizeReceiptLocation(args.location),
    orderId: String(args.orderId),
    momoTxId: args.momoTxId?.trim() || undefined,
    description: description || undefined,
    placedAtLabel: formatTableRoundTimestamp(args.placedAt),
    isTableCommand: Boolean(args.isTableCommand),
    flatItems,
    guestGroups,
    subtotal,
    logisticsFee: args.logisticsFee,
    discount,
    total: args.total,
    paid: args.paid,
    paidAt: args.paidAt?.trim() || "Unknown",
    reference: args.reference?.trim() || undefined,
    myPhone: normalizedPhone || undefined,
    followLink: args.link?.trim() || undefined,
    placedAt:
      typeof args.placedAt === "string"
        ? args.placedAt.trim() || undefined
        : formatTableRoundTimestamp(args.placedAt),
    logisticsType: args.logisticsType?.trim() || undefined,
    prescriptionImageUrl: rxUrl,
  }
}

export function buildOrderWhatsAppMessageFromViewModel(vm: OrderReceiptViewModel): string {
  const lines: string[] = []

  lines.push(waSection("ORDER RECEIPT"), "")
  if (vm.placedAt) {
    lines.push(vm.placedAt, "")
  }

  lines.push(waSection("Order details"), "")
  lines.push(waLabelValue("Shop", vm.shop))
  if (vm.location) {
    const isTable = vm.location.startsWith("Table:")
    const value = isTable ? vm.location.replace(/^Table:\s*/i, "").trim() : vm.location
    lines.push(waLabelValue(isTable ? "Table" : "Location", value))
  }
  lines.push(waLabelValue("Order ID", vm.orderId))
  if (vm.momoTxId) lines.push(waLabelValue("MoMo TxId", vm.momoTxId))
  if (vm.description) lines.push(waLabelValue("Order note", vm.description))

  lines.push("", waSection("Items"), "")

  if (vm.isTableCommand && vm.guestGroups.length > 0) {
    for (const group of vm.guestGroups) {
      lines.push(waSection(`Ordered by: ${group.guest}`))
      for (const round of group.rounds) {
        if (round.roundLabel) lines.push(`— ${round.roundLabel} —`)
        if (round.startedAtLabel) lines.push(`_${round.startedAtLabel}_`)
        for (const item of round.lines) {
          lines.push(formatReceiptItemLine(item))
        }
      }
      lines.push("")
    }
  } else {
    for (const item of vm.flatItems) {
      lines.push(formatReceiptItemLine(item))
      lines.push("")
    }
  }

  lines.push(waSection("Summary"), "")
  if (typeof vm.subtotal === "number") lines.push(waMoneyLine("Subtotal", vm.subtotal))
  if (vm.logisticsType) lines.push(waLabelValue("Logistics", vm.logisticsType))
  if (typeof vm.logisticsFee === "number") lines.push(waMoneyLine("Logistics fee", vm.logisticsFee))
  lines.push(waMoneyLine("Discount", vm.discount))
  lines.push(`*Total: ${formatReceiptMoney(vm.total)}*`)
  lines.push(waMoneyLine("Paid", vm.paid))
  lines.push("")
  lines.push(waLabelValue("Paid at", vm.paidAt))
  if (vm.reference) lines.push(waLabelValue("Message", vm.reference))
  if (vm.myPhone) lines.push(waLabelValue("My phone", vm.myPhone))

  if (vm.prescriptionImageUrl) {
    lines.push("", waSection("Prescription"), vm.prescriptionImageUrl)
  }

  if (vm.followLink) {
    lines.push("", waSection("Track order"), vm.followLink)
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()
}

export function buildOrderWhatsAppMessage(args: {
  shop: string
  location?: string
  orderId: string | number
  items: TableCommandLineItem[]
  subtotal?: number
  total: number
  discount?: number
  paid: number
  paidAt?: string
  reference?: string
  myPhone?: string
  link?: string
  isTableCommand?: boolean
  momoTxId?: string
  orderDescription?: string
  logisticsType?: string
  logisticsFee?: number
  placedAt?: string
  /** Rx photo URL for this seller-order only. */
  prescriptionImageUrl?: string | null
}): string {
  return buildOrderWhatsAppMessageFromViewModel(buildOrderReceiptViewModel(args))
}

/** Make Rx path absolute for WhatsApp (sellers open the link outside the app). */
export function publicSiteBaseUrl(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_PUBLIC_BASE_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_SHOP_URL,
  ]
  for (const raw of candidates) {
    const v = String(raw || "").trim()
    if (!v) continue
    if (isLocalDevHost(v)) continue
    // Trading API URL is not a public web origin for /uploads or /track-order
    if (/\/Trading\/?$/i.test(v) || /:8080\b/.test(v)) continue
    return v.replace(/\/Trading\/?$/i, "").replace(/\/$/, "")
  }
  return "https://ihute.rw"
}

function isLocalDevHost(urlOrHost: string): boolean {
  const s = String(urlOrHost || "").toLowerCase()
  return (
    s.includes("localhost") ||
    s.includes("127.0.0.1") ||
    s.includes("0.0.0.0") ||
    s.includes("[::1]")
  )
}

/**
 * Absolute URL for WhatsApp / SMS / external clients.
 * Rewrites localhost absolute URLs (common when NEXT_PUBLIC_SITE_URL is local) to the public site base.
 */
export function absolutePublicAssetUrl(pathOrUrl: string | null | undefined): string | undefined {
  const raw = String(pathOrUrl ?? "").trim()
  if (!raw) return undefined
  const base = publicSiteBaseUrl()

  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw)
      if (isLocalDevHost(u.hostname) || isLocalDevHost(u.origin)) {
        return `${base}${u.pathname}${u.search}${u.hash}`
      }
      return raw
    } catch {
      return raw
    }
  }

  return `${base}${raw.startsWith("/") ? "" : "/"}${raw}`
}

/**
 * Rx photo for WhatsApp / receipt — include whenever a URL exists.
 * Do not gate on PRESCRIPTION_REQUIRED alone: checkout may upload via name-hint
 * while DB flag is still 0, and the image URL is still stored on the order.
 */
export function resolveOrderPrescriptionPublicUrl(
  orderLike: Record<string, unknown> | null | undefined,
  fallbackUrl?: string | null,
): string | undefined {
  const raw = String(
    orderLike?.PRESCRIPTION_IMAGE_URL ??
      orderLike?.prescriptionImageUrl ??
      orderLike?.prescription_image_url ??
      fallbackUrl ??
      "",
  ).trim()
  return absolutePublicAssetUrl(raw)
}

/**
 * Prefer BANK_TRANSACTION_ID, then real gateway/MoMo ids on PAYMENT_ID.
 * Filters synthetic placeholders (MOMO_*, COD_*, …).
 */
export function resolveMomoTxIdForReceipt(order: {
  BANK_TRANSACTION_ID?: string | null
  bankTransactionId?: string | null
  PAYMENT_ID?: string | null
  paymentId?: string | null
  REFERENCE?: string | null
  reference?: string | null
} | null | undefined, fallback?: string | null): string | undefined {
  const candidates = [
    fallback,
    order?.BANK_TRANSACTION_ID,
    order?.bankTransactionId,
    order?.PAYMENT_ID,
    order?.paymentId,
    order?.REFERENCE,
    order?.reference,
  ]
  for (const raw of candidates) {
    const tx = String(raw ?? "").trim()
    if (!tx) continue
    if (/^(MOMO_|AIRTEL_|COD_|URUBUTO-PENDING|PAY_|ORDER\s)/i.test(tx)) continue
    return tx
  }
  return undefined
}
