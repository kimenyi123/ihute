/**
 * eRx Market shared types — steps 3–5 of the MoH eRx patient flow
 * (candidates → RFQ/quotes/pay → track & rate). Extends the existing order
 * concepts; see migrations/2026-08-28-erx-market-v4.sql for the SQL shape.
 */

/** One prescription line as carried through the RFQ (from MohErxDrugLineDTO). */
export type ErxRfqItem = {
  name: string
  qty: number
  /** Market average unit price (RWF); mock-derived until pharmacy quotes land. */
  avgUnit: number
  doseText?: string
}

/** Candidate pharmacy card (step 3). Metrics per spec: stars, stockAcc 1..5, lastSyncMin. */
export type ErxCandidatePharmacy = {
  id: string
  name: string
  zone: string
  lat: number
  lng: number
  distKm: number
  /** Patient stars, rolling 90d. */
  stars: number
  /** ihute stock accuracy bucket 1..5 (confirmed vs shown available, rolling 30d). */
  stockAcc: number
  /** Minutes since last POS stock heartbeat ("aheruka kugaragara"). */
  lastSyncMin: number
  /** Price factor vs market average, used for the estimated total on the card. */
  priceFactor: number
}

export type ErxQuoteStatus = "CALLING" | "FULL" | "PARTIAL" | "DECLINED" | "STOPPED"

export type ErxQuoteLine = {
  name: string
  /** Quantity the prescription needs. */
  need: number
  /** Quantity the pharmacy confirms (may be < need on PARTIAL). */
  qty: number
  unit: number
  price: number
}

export type ErxQuote = {
  pharmacyId: string
  pharmacyName: string
  zone: string
  distKm: number
  stars: number
  status: ErxQuoteStatus
  lines: ErxQuoteLine[]
  /** Goods total before discount (sum of line prices). */
  goods: number
  deliveryFee: number
  etaMin: number
  discountPct: number
}

export type ErxRiderVehicle = "moto" | "bike"

export type ErxRiderOffer = {
  id: string
  rider: string
  vehicle: ErxRiderVehicle
  fee: number
  etaMin: number
}

export type ErxDeliveryMode = "pharmacy" | "pickup" | "rider"

export type ErxOrderStatus =
  | "CALLING"
  | "QUOTED"
  | "PAID"
  | "DELIVERED"
  | "RATED"

export type ErxResponderNotice = {
  pharmacyId: string
  pharmacyName: string
  chosen: boolean
}

export type ErxRating = {
  pharmacyStars: number
  riderStars: number
  createdAt: string
}

/** Full order snapshot returned by GET /api/erx/orders/{id}/quotes (poll). */
export type ErxOrderSnapshot = {
  id: string
  type: "ERX_RFQ" | "ERX_ORDER"
  erxCode: string
  status: ErxOrderStatus
  items: ErxRfqItem[]
  quotes: ErxQuote[]
  stillCalling: boolean
  chosenPharmacyId: string | null
  riderOffers: ErxRiderOffer[]
  delivery: { mode: ErxDeliveryMode; fee: number; riderId: string | null } | null
  momoRef: string | null
  invoiceNo: string | null
  paidAtLabel: string | null
  /** eRx HOLD auto-release deadline (4h after pay). */
  holdExpiresAt: string | null
  /** 0 Paid → 1 Pulled to POS → 2 VSDC invoice → 3 In transit/awaiting pickup → 4 delivered. */
  trackStage: number
  responders: ErxResponderNotice[]
  deliveredAt: string | null
  rating: ErxRating | null
}
