// lib/payment-utils.ts

/**
 * Payment method name mappings for display purposes
 */
export const PAYMENT_METHOD_NAMES: Record<string, string> = {
  // Cash on Delivery
  "PAY_ON_DELIVERY": "Cash on Delivery",
  "COD": "Cash on Delivery",
  
  // Mobile Money - Standardized names
  "PAID_MTN_MOMO": "Pay with MoMo",
  "PAID_MOMO": "Pay with MoMo",
  "PAID_URUBUTO": "UrubutoPay",
  "PAID_URUBUTO_PAY": "UrubutoPay", 
  "MTN_MOMO": "Pay with MoMo",
  "MOMO": "Pay with MoMo",
  "AIRTEL_MONEY": "Airtel Money",
  
  // Card Payments - Standardized names
  "PAID_CARD": "Card Payment",
  "CARD": "Card Payment",
  "DEBIT_CARD": "Debit Card",
  "CREDIT_CARD": "Credit Card",
  
  // Other
  "PREPAID": "Prepaid",
  "BANK_TRANSFER": "Bank Transfer",
  "UNKNOWN": "Unknown Payment Method"
}

/**
 * Formats a payment method string into a human-readable display name
 * @param method - The payment method code (e.g., "PAID_MTN_MOMO", "PAY_ON_DELIVERY")
 * @returns Formatted payment method name
 */
export function formatPaymentMethod(method: string | null | undefined): string {
  if (!method) return "Unknown"
  
  const normalized = method.toUpperCase().trim()
  
  // ✅ FIX: Check for partial matches for dynamic payment IDs
  if (normalized.startsWith("COD_")) {
    return "Cash on Delivery"
  }
  if (normalized.startsWith("MOMO_")) {
    return "Pay with MoMo"
  }
  if (normalized.startsWith("CARD_")) {
    return "Card Payment"
  }
  if (normalized.startsWith("URUBUTO") || normalized.includes("URUBUTO")) {
    return "UrubutoPay"
  }
  
  // Exact match
  return PAYMENT_METHOD_NAMES[normalized] || method
}

/** Supplier / buyer order detail: payment row label (respects PAYMENT_NAME, not generic MoMo). */
export function formatSupplierOrderPaymentDisplay(
  paymentName?: string | null,
  paymentStatus?: string | null,
): { status: string; displayName: string; isPaid: boolean } {
  const name = (paymentName ?? "").trim()
  const normalized = name.toUpperCase()
  const status = (paymentStatus ?? "").toLowerCase()
  const isPaid = status === "paid"
  const baseLabel = formatPaymentMethod(name)

  if (normalized.includes("URUBUTO")) {
    return {
      status: isPaid ? "paid" : "pending",
      displayName: isPaid ? "Paid via UrubutoPay" : "Awaiting UrubutoPay",
      isPaid,
    }
  }

  if (isPaid) {
    if (normalized.includes("AIRTEL")) {
      return { status: "paid", displayName: "Paid via Airtel Money", isPaid: true }
    }
    if (normalized.includes("MOMO") || normalized.includes("MTN")) {
      return { status: "paid", displayName: "Paid via MoMo", isPaid: true }
    }
    if (normalized.includes("CARD") || normalized.includes("CREDIT") || normalized.includes("DEBIT")) {
      return { status: "paid", displayName: "Paid via Card", isPaid: true }
    }
    if (normalized.includes("DELIVERY") || normalized.includes("COD")) {
      return { status: "paid", displayName: "Paid on delivery", isPaid: true }
    }
    return { status: "paid", displayName: `Paid (${baseLabel})`, isPaid: true }
  }

  if (normalized.includes("MOMO") || normalized.includes("MTN") || normalized.includes("MOBILE")) {
    return { status: status || "processing", displayName: "MoMo payment", isPaid: false }
  }
  if (normalized.includes("AIRTEL")) {
    return { status: status || "processing", displayName: "Airtel Money", isPaid: false }
  }
  if (normalized.includes("PAY_ON_DELIVERY") || normalized.includes("COD")) {
    return { status: "pending", displayName: "Pay on delivery", isPaid: false }
  }
  if (normalized.includes("CARD")) {
    return { status: status || "processing", displayName: "Card payment", isPaid: false }
  }

  return {
    status: status || "pending",
    displayName: baseLabel,
    isPaid,
  }
}

/**
 * Gets an emoji icon for a payment method
 * @param method - The payment method code
 * @returns Emoji representing the payment method
 */
export function getPaymentMethodIcon(method: string): string {
  const m = method.toUpperCase()
  
  if (m.includes("URUBUTO")) return "💜"
  if (m.includes("MOMO") || m.startsWith("MOMO_")) return "📱"
  if (m.includes("CARD") || m.includes("CREDIT") || m.includes("DEBIT") || m.startsWith("CARD_")) return "💳"
  if (m.includes("DELIVERY") || m.includes("COD") || m.startsWith("COD_")) return "🚚"
  if (m.includes("BANK")) return "🏦"
  if (m.includes("PREPAID")) return "💵"
  
  return "💰"
}

/**
 * Gets a Tailwind CSS color class for a payment method
 * @param method - The payment method code
 * @returns Tailwind color class
 */
export function getPaymentMethodColor(method: string): string {
  const m = method.toUpperCase()
  
  if (m.includes("MOMO") || m.startsWith("MOMO_")) return "text-yellow-600"
  if (m.includes("CARD") || m.startsWith("CARD_")) return "text-blue-600"
  if (m.includes("DELIVERY") || m.includes("COD") || m.startsWith("COD_")) return "text-green-600"
  if (m.includes("BANK")) return "text-purple-600"
  
  return "text-gray-600"
}

/**
 * Gets a background color class for payment method badges
 * @param method - The payment method code
 * @returns Tailwind background color class
 */
export function getPaymentMethodBadgeClass(method: string): string {
  const m = method.toUpperCase()
  
  if (m.includes("MOMO") || m.startsWith("MOMO_")) {
    return "bg-yellow-100 text-yellow-800 border-yellow-200"
  }
  if (m.includes("CARD") || m.startsWith("CARD_")) {
    return "bg-blue-100 text-blue-800 border-blue-200"
  }
  if (m.includes("DELIVERY") || m.includes("COD") || m.startsWith("COD_")) {
    return "bg-green-100 text-green-800 border-green-200"
  }
  if (m.includes("BANK")) {
    return "bg-purple-100 text-purple-800 border-purple-200"
  }
  
  return "bg-gray-100 text-gray-800 border-gray-200"
}

/**
 * Checks if a payment method requires immediate payment
 * @param method - The payment method code
 * @returns true if payment is required upfront
 */
export function requiresImmediatePayment(method: string): boolean {
  const m = method.toUpperCase()
  return m.includes("PAID") || m.includes("MOMO") || m.startsWith("MOMO_") || m.includes("CARD") || m.startsWith("CARD_")
}

/**
 * Checks if a payment method is Cash on Delivery
 * @param method - The payment method code
 * @returns true if method is COD
 */
export function isCashOnDelivery(method: string): boolean {
  const m = method.toUpperCase()
  return m.includes("COD") || m.startsWith("COD_") || m.includes("PAY_ON_DELIVERY") || m.includes("DELIVERY")
}

/**
 * Normalizes a payment method name to a standard backend value
 * @param method - The frontend payment method value
 * @returns Standardized backend payment method name
 */
export function normalizePaymentMethod(method: string): string {
  const m = method.toLowerCase().trim()
  
  if (m === "momo" || m === "mobile_money") return "PAID_MTN_MOMO"
  if (m === "card" || m === "credit_card" || m === "debit_card") return "PAID_CARD"
  if (m === "cod" || m === "cash_on_delivery") return "PAY_ON_DELIVERY"
  
  // Return uppercase version if no match
  return method.toUpperCase()
}

/**
 * Generates a payment ID for a given payment method
 * @param method - The payment method code
 * @returns Generated payment ID
 */
export function generatePaymentId(method: string): string {
  const timestamp = Date.now()
  const m = method.toUpperCase()
  
  if (m.includes("MOMO") || m.includes("MOBILE")) return `MOMO_${timestamp}`
  if (m.includes("CARD")) return `CARD_${timestamp}`
  if (m.includes("COD") || m.includes("DELIVERY")) return `COD_${timestamp}`
  
  return `PAY_${timestamp}`
}

/**
 * Validates if a payment method is supported
 * @param method - The payment method to validate
 * @returns true if the payment method is valid
 */
export function isValidPaymentMethod(method: string): boolean {
  const valid = [
    "PAY_ON_DELIVERY",
    "PAID_MTN_MOMO", 
    "PAID_CARD",
    "MTN_MOMO",
    "MOMO",
    "CARD",
    "COD"
  ]
  
  const normalized = method.toUpperCase().trim()
  
  // ✅ FIX: Also check for dynamic payment IDs
  if (normalized.startsWith("COD_") || normalized.startsWith("MOMO_") || normalized.startsWith("CARD_")) {
    return true
  }
  
  return valid.includes(normalized)
}

/**
 * Gets payment method display info
 * @param method - The payment method code
 * @returns Object with display information
 */
export function getPaymentMethodInfo(method: string) {
  return {
    name: formatPaymentMethod(method),
    icon: getPaymentMethodIcon(method),
    color: getPaymentMethodColor(method),
    badgeClass: getPaymentMethodBadgeClass(method),
    requiresPayment: requiresImmediatePayment(method),
    isCOD: isCashOnDelivery(method)
  }
}
export function mapToUrubutoChannel(internalMethod: string): 'MOMO' | 'CARD' | 'BANK' {
  const method = internalMethod.toUpperCase();

  if (method.includes('MOMO') || method.startsWith('MOMO_')) return 'MOMO';
  if (method.includes('CARD') || method.startsWith('CARD_')) return 'CARD';
  if (method.includes('BANK')) return 'BANK';

  // Default to MOMO for unknown methods that require immediate payment
  return 'MOMO';
}

/**
 * Checks if a payment method is supported by UrubutoPay online payments
 * @param method - The payment method code
 * @returns true if the method supports online payment via UrubutoPay
 */
export function isUrubutoPaySupported(method: string): boolean {
  const m = method.toUpperCase();

  // Only MOMO, CARD, and BANK are supported for online payments
  if (m.includes('MOMO') || m.startsWith('MOMO_') || m.includes('MTN')) return true;
  if (m.includes('CARD') || m.startsWith('CARD_')) return true;
  if (m.includes('BANK')) return true;

  // COD and other methods are not supported for online payment
  return false;
}


/**
 * Standard payment method constants for use in frontend
 */
export const PAYMENT_METHODS = {
  MOMO: "PAID_MTN_MOMO",
  CARD: "PAID_CARD", 
  COD: "PAY_ON_DELIVERY",
  BANK: "BANK_TRANSFER"
} as const

export type PaymentMethodType = typeof PAYMENT_METHODS[keyof typeof PAYMENT_METHODS]