/**
 * eRx Market order store — server-side state for RFQ orders, quotes, rider
 * offers, payment and ratings (steps 3–5 of the eRx patient flow).
 *
 * Phase 1: in-memory (globalThis singleton, survives dev hot-reload) with the
 * mock quote simulator behind NEXT_PUBLIC_ERX_MOCK=1. Quote/rider arrival is
 * TIME-BASED (materialized lazily on read), so polling works without timers.
 *
 * Real mode rides the existing ihute pending-orders channel that Ishyiga POS
 * already polls (see erx-pos-channel.ts): order lines are inserted with
 * type=ERX_RFQ and the pharmacy confirm/decline/partial from POS becomes the
 * quote. Until the Kaos side accepts ERX_RFQ, that path is a logged stub and
 * quotes only arrive in mock mode (documented in README-erx.md).
 */

import type {
  ErxCandidatePharmacy,
  ErxDeliveryMode,
  ErxOrderSnapshot,
  ErxQuote,
  ErxQuoteLine,
  ErxRfqItem,
  ErxRiderOffer,
  ErxRating,
  ErxResponderNotice,
} from "./erx-market-types"

const RIDER_NAMES = ["Eric", "Patrick", "Divine", "Aline"]
const HOLD_MS = 4 * 60 * 60 * 1000
const ORDER_TTL_MS = 24 * 60 * 60 * 1000
/** Mock POS→track auto-advance cadence (spec demo: 1.8s per stage). */
const TRACK_STAGE_MS = 1800

type QuoteRec = {
  pharmacy: ErxCandidatePharmacy
  /** When the simulated pharmacy answers (mock). Real mode: set by POS callback. */
  readyAtMs: number
  outcome: "FULL" | "PARTIAL" | "DECLINED"
  stopped: boolean
  lines: ErxQuoteLine[]
  goods: number
  deliveryFee: number
  etaMin: number
  discountPct: number
}

type RiderOfferRec = ErxRiderOffer & { arriveAtMs: number }

type OrderRec = {
  id: string
  erxCode: string
  items: ErxRfqItem[]
  createdAtMs: number
  mock: boolean
  quotes: QuoteRec[]
  stoppedAtMs: number | null
  chosenPharmacyId: string | null
  chosenAtMs: number | null
  riderOffers: RiderOfferRec[]
  paidAtMs: number | null
  momoRef: string | null
  invoiceNo: string | null
  delivery: { mode: ErxDeliveryMode; fee: number; riderId: string | null } | null
  responders: ErxResponderNotice[]
  deliveredAtMs: number | null
  rating: ErxRating | null
}

const globalStore = globalThis as unknown as { __erxOrders?: Map<string, OrderRec> }
function orders(): Map<string, OrderRec> {
  if (!globalStore.__erxOrders) globalStore.__erxOrders = new Map()
  return globalStore.__erxOrders
}

function prune() {
  const now = Date.now()
  for (const [id, o] of orders()) {
    if (now - o.createdAtMs > ORDER_TTL_MS) orders().delete(id)
  }
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

/** Random FULL/PARTIAL/DECLINED per spec (55/25/20), closest forced FULL if all declined. */
function buildMockQuotes(
  pharmacies: ErxCandidatePharmacy[],
  items: ErxRfqItem[],
  createdAtMs: number,
): QuoteRec[] {
  const recs: QuoteRec[] = pharmacies.map((p) => {
    const r = Math.random()
    const outcome: QuoteRec["outcome"] = r < 0.55 ? "FULL" : r < 0.8 ? "PARTIAL" : "DECLINED"
    return {
      pharmacy: p,
      readyAtMs: createdAtMs + rand(1200, 5500),
      outcome,
      stopped: false,
      lines: [],
      goods: 0,
      deliveryFee: 0,
      etaMin: 0,
      discountPct: 0,
    }
  })
  if (recs.length && !recs.some((q) => q.outcome !== "DECLINED")) recs[0].outcome = "FULL"

  for (const q of recs) {
    if (q.outcome === "DECLINED") continue
    const partial = q.outcome === "PARTIAL"
    q.lines = items.map((it, ix) => {
      const qty = partial && ix === 0 ? Math.round(it.qty * 0.6) : it.qty
      const unit = Math.round(it.avgUnit * q.pharmacy.priceFactor * rand(0.96, 1.04))
      return { name: it.name, need: it.qty, qty, unit, price: unit * qty }
    })
    q.goods = q.lines.reduce((s, l) => s + l.price, 0)
    q.deliveryFee = 1000 + Math.round((q.pharmacy.distKm * 180) / 50) * 50
    q.etaMin = 30 + Math.round(q.pharmacy.distKm * 4)
    q.discountPct = [0, 3, 5][Math.floor(Math.random() * 3)]
  }
  return recs
}

export function createRfqOrder(input: {
  erxCode: string
  items: ErxRfqItem[]
  pharmacies: ErxCandidatePharmacy[]
  mock: boolean
}): OrderRec {
  prune()
  const id = "IH-" + Math.floor(100000 + Math.random() * 900000)
  const createdAtMs = Date.now()
  const rec: OrderRec = {
    id,
    erxCode: input.erxCode,
    items: input.items,
    createdAtMs,
    mock: input.mock,
    quotes: input.mock ? buildMockQuotes(input.pharmacies, input.items, createdAtMs) : [],
    stoppedAtMs: null,
    chosenPharmacyId: null,
    chosenAtMs: null,
    riderOffers: [],
    paidAtMs: null,
    momoRef: null,
    invoiceNo: null,
    delivery: null,
    responders: [],
    deliveredAtMs: null,
    rating: null,
  }
  if (!input.mock) {
    // Real mode: quotes arrive from Ishyiga POS via the pending-orders channel.
    // Pharmacies stay CALLING until the POS write-back is wired (see erx-pos-channel.ts).
    rec.quotes = input.pharmacies.map((p) => ({
      pharmacy: p,
      readyAtMs: Number.MAX_SAFE_INTEGER,
      outcome: "DECLINED",
      stopped: false,
      lines: [],
      goods: 0,
      deliveryFee: 0,
      etaMin: 0,
      discountPct: 0,
    }))
  }
  orders().set(id, rec)
  return rec
}

export function getOrder(id: string): OrderRec | null {
  return orders().get(id) || null
}

/** Cancels pending RFQs only; quotes already received stay valid. */
export function stopCalling(id: string): OrderRec | null {
  const o = orders().get(id)
  if (!o) return null
  if (!o.stoppedAtMs) o.stoppedAtMs = Date.now()
  return o
}

export function chooseQuote(id: string, pharmacyId: string): OrderRec | null {
  const o = orders().get(id)
  if (!o) return null
  o.chosenPharmacyId = pharmacyId
  if (!o.chosenAtMs) {
    o.chosenAtMs = Date.now()
    if (o.mock) {
      // Seller Central rider marketplace: 0–2 offers arriving async (spec).
      const n = Math.floor(Math.random() * 3)
      for (let i = 0; i < n; i++) {
        const vehicle = Math.random() < 0.65 ? "moto" : "bike"
        o.riderOffers.push({
          id: "r" + i,
          rider: RIDER_NAMES[Math.floor(Math.random() * RIDER_NAMES.length)],
          vehicle,
          fee: (vehicle === "bike" ? 800 : 1200) + Math.floor(Math.random() * 14) * 100,
          etaMin: (vehicle === "bike" ? 25 : 15) + Math.floor(Math.random() * 26),
          arriveAtMs: o.chosenAtMs + 1200 + i * 1800,
        })
      }
    }
    // TODO(real): subscribe to Seller Central rider offers for this order.
  }
  return o
}

export function payOrder(
  id: string,
  input: { momoRef: string; delivery: { mode: ErxDeliveryMode; fee: number; riderId: string | null } },
): OrderRec | null {
  const o = orders().get(id)
  if (!o) return null
  if (o.paidAtMs) return o
  const now = Date.now()
  o.paidAtMs = now
  o.momoRef = input.momoRef
  o.invoiceNo = "INV-VALG01-" + Math.floor(10000 + Math.random() * 89999)
  o.delivery = input.delivery
  // Notify EVERY pharmacy that replied: chosen serves, others release reservation.
  o.responders = o.quotes
    .filter((q) => isQuoteReady(q, o, now) && q.outcome !== "DECLINED" && !isQuoteStopped(q, o))
    .map((q) => ({
      pharmacyId: q.pharmacy.id,
      pharmacyName: q.pharmacy.name,
      chosen: q.pharmacy.id === o.chosenPharmacyId,
    }))
  return o
}

export function markDelivered(id: string): OrderRec | null {
  const o = orders().get(id)
  if (!o) return null
  if (!o.deliveredAtMs) o.deliveredAtMs = Date.now()
  return o
}

export function rateOrder(id: string, pharmacyStars: number, riderStars: number): OrderRec | null {
  const o = orders().get(id)
  if (!o) return null
  o.rating = {
    pharmacyStars,
    riderStars,
    createdAt: new Date().toISOString(),
  }
  return o
}

function isQuoteReady(q: QuoteRec, o: OrderRec, now: number): boolean {
  if (q.stopped) return true
  if (o.stoppedAtMs && q.readyAtMs > o.stoppedAtMs) return true // became STOPPED
  return now >= q.readyAtMs
}

function isQuoteStopped(q: QuoteRec, o: OrderRec): boolean {
  return Boolean(o.stoppedAtMs && q.readyAtMs > o.stoppedAtMs)
}

function toQuote(q: QuoteRec, o: OrderRec, now: number): ErxQuote {
  const stopped = isQuoteStopped(q, o)
  const ready = isQuoteReady(q, o, now)
  const status = stopped ? "STOPPED" : !ready ? "CALLING" : q.outcome
  return {
    pharmacyId: q.pharmacy.id,
    pharmacyName: q.pharmacy.name,
    zone: q.pharmacy.zone,
    distKm: q.pharmacy.distKm,
    stars: q.pharmacy.stars,
    status,
    lines: status === "FULL" || status === "PARTIAL" ? q.lines : [],
    goods: q.goods,
    deliveryFee: q.deliveryFee,
    etaMin: q.etaMin,
    discountPct: q.discountPct,
  }
}

export function snapshotOrder(id: string): ErxOrderSnapshot | null {
  const o = orders().get(id)
  if (!o) return null
  const now = Date.now()
  const quotes = o.quotes.map((q) => toQuote(q, o, now))
  const stillCalling = quotes.some((q) => q.status === "CALLING")

  // Auto-advance Paid → POS → VSDC → in transit, STOPPING at stage 3 (spec).
  let trackStage = 0
  if (o.paidAtMs) {
    trackStage = Math.min(3, Math.floor((now - o.paidAtMs) / TRACK_STAGE_MS))
    // TODO(real): stages 1–2 should come from Ishyiga POS events (pulled to POS,
    // VSDC invoice issued) instead of the mock cadence.
  }
  if (o.deliveredAtMs) trackStage = 4

  const status = o.rating
    ? "RATED"
    : o.deliveredAtMs
      ? "DELIVERED"
      : o.paidAtMs
        ? "PAID"
        : quotes.some((q) => q.status === "FULL" || q.status === "PARTIAL")
          ? "QUOTED"
          : "CALLING"

  return {
    id: o.id,
    type: o.paidAtMs ? "ERX_ORDER" : "ERX_RFQ",
    erxCode: o.erxCode,
    status,
    items: o.items,
    quotes,
    stillCalling,
    chosenPharmacyId: o.chosenPharmacyId,
    riderOffers: o.riderOffers
      .filter((r) => (o.paidAtMs ? r.arriveAtMs <= o.paidAtMs : r.arriveAtMs <= now))
      .map(({ arriveAtMs: _arriveAtMs, ...offer }) => offer),
    delivery: o.delivery,
    momoRef: o.momoRef,
    invoiceNo: o.invoiceNo,
    paidAtLabel: o.paidAtMs
      ? new Date(o.paidAtMs).toTimeString().slice(0, 5)
      : null,
    holdExpiresAt: o.paidAtMs ? new Date(o.paidAtMs + HOLD_MS).toISOString() : null,
    trackStage,
    responders: o.responders,
    deliveredAt: o.deliveredAtMs ? new Date(o.deliveredAtMs).toISOString() : null,
    rating: o.rating,
  }
}
