export function formatPaymentMethod(method: string | null | undefined): string {
  if (!method) return "Unknown"
  
  const map: Record<string, string> = {
    // Cash on Delivery
    "PAY_ON_DELIVERY": "Cash on Delivery",
    "COD": "Cash on Delivery",
    
    // Mobile Money - NEW VALUES ✅
    "PAID_MTN_MOMO": "Mobile Money (MTN MoMo)",
    "PAID_MOMO": "Mobile Money",
    "MTN_MOMO": "Mobile Money (MTN)",
    "MOMO": "Mobile Money (MTN/Airtel)",
    "AIRTEL_MONEY": "Airtel Money",
    
    // Card - NEW VALUE ✅
    "PAID_CARD": "Card Payment",
    "CARD": "Card Payment",
    "DEBIT_CARD": "Debit Card",
    "CREDIT_CARD": "Credit Card",
    
    // Other
    "PREPAID": "Prepaid",
    "BANK_TRANSFER": "Bank Transfer",
    "UNKNOWN": "Unknown Payment Method"
  }
  
  const normalized = method.toUpperCase().trim()
  return map[normalized] || method
}

export function getPaymentMethodIcon(method: string): string {
  const m = method.toUpperCase()
  if (m.includes("MOMO") || m.includes("MOBILE")) return "💳"
  if (m.includes("CARD")) return "💳"
  if (m.includes("DELIVERY") || m.includes("COD")) return "🚚"
  if (m.includes("BANK")) return "🏦"
  return "💰"
}