/** Business block — mirrors the Excel / InsertSuppliers-style fields */

export type DeliveryPrefSeller = "delivery" | "pickup" | "both"

export type ShopBusinessDraft = {
  companyName: string
  /** Login email — stored in account_seller */
  email: string
  password: string
  /** Tax ID — must be unique when provided */
  tin: string
  phone: string
  momoCode: string
  ownerName: string
  /** Shop category — e.g. liquor store, supermarket */
  category: string
  deliveryPref: DeliveryPrefSeller
  /** Province id: kigali | eastern | northern | southern | western */
  province: string
  /** Rwanda district (akarere) */
  district: string
  /** NEP geographic Sector (umurenge) */
  locationSector: string
  /** NEP Cellule (akagari) */
  cellule: string
  /** NEP Village (umudugudu) */
  village: string
  /** Street name, building, etc. */
  street: string
  /** Optional public shop nickname for Shop With Me (lowercase, a-z 0-9 -) */
  shopNickname: string
  /** Optional image data URL (base64) for shop logo */
  logoDataUrl: string | null
  /**
   * Optional seller / shop account (e.g. SELLER_ISHYIGA_ACCOUNT) when known.
   * Used when persisting stock rows; can also be set via ONBOARDING_SELLER_ACCOUNT env.
   */
  sellerAccount?: string
}

/** Picked from NIKI / global search (fetchSuggestions) */
export type CatalogPick = {
  id: string
  nikiCode: string
  name: string
  famille?: string
  refSellingPrice?: number
  /** Resolved product image URL when available */
  image?: string
  /** S7/S8: user-added line without catalog match — temp Niki flow on submit */
  isCustom?: boolean
}

/** Final line for stock — matches seller_add_stock–style columns conceptually */
export type ShopLineDraft = CatalogPick & {
  quantity: number
  /** Profit per unit (Ikiranguzo), default 0 */
  profitRwf: number
  /** Sale price (Igiciro) RWF */
  salePrice: number
  descriptionKeywords: string
}
