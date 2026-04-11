// Types for the self-ordering kiosk module

// Option/modifier metadata for kiosk customisation (sizes, spice, toppings, etc.)
export interface KioskModifierOption {
  id: string
  label: string
  priceDelta: number
}

export interface KioskModifierGroup {
  id: string
  name: string
  type: "single" | "multiple"
  options: KioskModifierOption[]
}

// Matches fetchSuggestions product JSON response (plus optional kiosk option fields)
export interface KioskMenuItem {
  item_code: string
  item_commercial_name: string
  item_name?: string
  selling_price: number
  unit: string
  image_url?: string
  supplier_account: string
  supplier_name: string
  supplier_location?: string
  // Optional seller payment/contact metadata (from shop-with-me / account_signup).
  momo?: string
  sellerPhone?: string
  search_priority?: number // >= 2 means "Main Ingredient" badge
  contains_ingredient?: string // truthy → "Contains X" badge
  category?: string
  sector?: string
  item_department?: string  // for category tab grouping
  keywords?: string
  item_emballage?: string | number

  // Optional option groups coming from backend JSON (sizes/modifiers/toppings)
  sizes?: KioskModifierGroup[]
  modifiers?: KioskModifierGroup[]
  toppings?: KioskModifierGroup[]
}

export type KioskCategory = "BAR" | "RESTRO" | "COFFEE_SHOP"

export interface KioskTableInfo {
  tableNumber?: string
  customerName?: string
  orderType: "dine-in" | "takeaway"
}

export interface KioskCartItem {
  item_code: string
  name: string
  price: number
  unit: string
  quantity: number
  image_url?: string
  supplier_account: string
  supplier_name: string
}

// Matches Kaos order creation payload (post_orders / KioskController)
export interface KioskOrderPayload {
  buyer_account?: string
  table_number?: string
  customer_name?: string
  order_type: "dine-in" | "takeaway"
  payment_method: "CASH" | "CARD" | "MOMO"
  kiosk_category: KioskCategory
  items: KioskOrderLine[]
  total_amount: number
  currency?: string
  location_id?: string
}

export interface KioskOrderLine {
  item_code: string
  item_name: string
  quantity: number
  unit: string
  unit_price: number
  line_total: number
  seller_account: string
  /** Package/packet multiplier for persistence on order lines. */
  item_emballage?: string
}

// Kaos native statuses mapped to kiosk states
export type KaosOrderStatus =
  | "ORDER"
  | "INVOICE"
  | "PICKED"
  | "DELIVERED"
  | "CANCEL"
export type KioskOrderStatus =
  | "waiting"
  | "in_kitchen"
  | "ready"
  | "completed"
  | "cancelled"

export const KAOS_TO_KIOSK_STATUS: Record<KaosOrderStatus, KioskOrderStatus> = {
  ORDER: "waiting",
  INVOICE: "in_kitchen",
  PICKED: "ready",
  DELIVERED: "completed",
  CANCEL: "cancelled",
}

// Kitchen dashboard order card
export interface KioskLiveOrder {
  order_id: string
  order_number: string
  table_number?: string
  customer_name?: string
  status: KioskOrderStatus
  kiosk_category: KioskCategory
  /** When listing by bar/kitchen lane (mixed orders): drink vs food subset */
  lane?: "bar" | "kitchen"
  items: KioskOrderLine[]
  /** Subtotal for this lane when split; see full_order_total */
  total_amount: number
  /** Full order total when lane split differs from total_amount */
  full_order_total?: number
  created_at: string
  updated_at: string
}

export interface KioskSearchResponse {
  items: KioskMenuItem[]
  total: number
  query?: string
  category?: KioskCategory
}

