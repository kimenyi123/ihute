/** Line item for table-command WhatsApp / invoice grouping */
export type TableCommandLineItem = {
  name: string
  qty: number
  unitPrice: number
  orderedBy?: string | null
  lineId?: number | null
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

function lineTotalRwf(item: Pick<TableCommandLineItem, "qty" | "unitPrice">): number {
  const qty = Number(item.qty) || 0
  const unit = Number(item.unitPrice) || 0
  return Math.round(qty * unit)
}

function formatItemLine(item: TableCommandLineItem): string {
  const total = lineTotalRwf(item)
  const label = item.name.replace(/\s+/g, " ").trim()
  const qty = Number(item.qty) || 1
  return `${label} ${qty} ${total.toLocaleString()}`
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
    if (last && last.person === person) {
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
    out.push(person)
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
}

export type TableCommandViewRound = {
  roundNumber: number
  items: TableCommandViewLine[]
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
        })),
      })),
    }
  })
}

export function formatTableCommandLineLabel(item: Pick<TableCommandViewLine, "name" | "qty" | "total">): string {
  return `${item.name} ${item.qty} ${item.total.toLocaleString()}`
}

export function buildOrderWhatsAppMessage(args: {
  shop: string
  location?: string
  orderId: string | number
  items: TableCommandLineItem[]
  total: number
  discount?: number
  paid: number
  paidAt?: string
  reference?: string
  myPhone?: string
  link?: string
  isTableCommand?: boolean
  momoTxId?: string
}): string {
  const formatCurrency = (amount: number) => `${amount.toLocaleString()} RWF`
  const discount = args.discount ?? 0

  let itemsSection: string
  if (args.isTableCommand) {
    itemsSection = buildTableCommandWhatsAppBlock(
      args.items.map((item) => ({
        ...item,
        orderedBy: normalizeTableCommandPerson(item.orderedBy),
      })),
    )
  } else {
    const padRight = (s: string, w: number) => (s.length >= w ? s : s + " ".repeat(w - s.length))
    const padLeft = (s: string, w: number) => (s.length >= w ? s : " ".repeat(w - s.length) + s)
    const trunc = (s: string, w: number) => (s.length > w ? s.slice(0, w - 1) + "…" : s)
    const NAME_W = 44
    const QTY_W = 5
    const AMT_W = 14
    const header = padRight("Product name", NAME_W) + padLeft("Qty", QTY_W) + padLeft("Amount", AMT_W)
    const sep = "-".repeat(NAME_W + QTY_W + AMT_W)
    const lines = args.items.map((item) => {
      const nm = padRight(trunc(item.name.replace(/\s+/g, " ").trim(), NAME_W), NAME_W)
      const qt = padLeft(String(item.qty), QTY_W)
      const amt = padLeft(formatCurrency(lineTotalRwf(item)), AMT_W)
      return nm + qt + amt
    })
    itemsSection = ["```", header, sep, ...lines, "```"].join("\n")
  }

  const parts = [
    "Order",
    "",
    `Shop: ${args.shop}`,
    args.location?.trim() ? `Location: ${args.location.trim()}` : "",
    `Order ID: ${args.orderId}`,
    args.momoTxId ? `MoMo TxId: ${args.momoTxId}` : "",
    "",
    itemsSection,
    "",
    `Total: ${formatCurrency(args.total)}`,
    `Discount: ${formatCurrency(discount)}`,
    `Paid: ${formatCurrency(args.paid)}`,
    "",
    `Paid at: ${args.paidAt ?? ""}`,
    `Message: ${args.reference || "-"}`,
    `My phone: ${args.myPhone || ""}`,
    "",
    args.link ? `Follow: ${args.link}` : "",
  ]

  // Keep intentional blank lines; only drop null/undefined (not empty strings).
  return parts.filter((line) => line != null).join("\n")
}
