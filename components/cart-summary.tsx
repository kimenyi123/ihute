// app/(wherever)/CartSummary.tsx
"use client"

import dynamic from "next/dynamic"
import { useMemo, useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/auth-store"
import { useCartStore, type CartItem } from "@/lib/cart-store"
import { trackClick } from "@/lib/interaction-tracker"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { formatPaymentMethod } from "@/lib/payment-utils"
import { useToast } from "@/components/ui/use-toast"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog"
import { Copy, PhoneCall, CheckCircle2, RotateCcw, MessageCircle, Truck, CreditCard, Wallet, Beer, Users, Lock, Tag, MapPin, Link2 } from "lucide-react"
import { isBarOrRestaurant } from "@/lib/constants"
import { useTableCommandStore, getOrCreateGuestName } from "@/lib/table-command-store"
import { GUEST_POOL_EMAIL, getGuestBuyerAccount, ensureGuestPoolBuyerAccount } from "@/lib/guest-checkout"
import { getSavedAddresses, saveAddress, type SavedAddress } from "@/lib/saved-addresses"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TableCommandDialog } from "@/components/table-command-dialog"
import { TableCommandShareModal } from "@/components/table-command-share-modal"
import { CartSuggestionsPopup } from "@/components/cart-suggestions-popup"
import { orderErrorMessageWithProductNames } from "@/lib/order-error-display"
import { flushCartToServer } from "@/lib/flush-cart-server"
import {
  fetchSellerUrubutoEligibility,
  fetchCheckoutUrubutoStatus,
  initiateCheckoutUrubutoPay,
  URUBUTO_CHECKOUT_CARD_TYPE,
} from "@/lib/checkout-urubuto"
import { isValidUrubutoMtnOrAirtel, normalizeUrubutoPhone, urubutoPhoneHint } from "@/lib/urubuto-phone"
import { isUrubutoCheckoutPreviewForSeller } from "@/lib/urubuto-checkout-preview"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

const QRCode = dynamic(() => import("react-qr-code"), { ssr: false })
const CUR = "RWF"
import { buildMoMoUssd } from "@/lib/momo-ussd"
import { parseErxFromNotes } from "@/lib/erx-prescription"
import { itemEmballageDisplaySuffix } from "@/lib/cart-display-utils"

// ---------- helpers ----------
function formatErxLinesForShare(it: CartItem): string[] {
  const erx = it.erx ?? parseErxFromNotes(it.notes ?? undefined)
  if (!erx) return []
  const out: string[] = []
  out.push(`📋 ${erx.measurement} · ${erx.every}`)
  if (erx.toBeTakenDays) out.push(`   Duration: ${erx.toBeTakenDays} days`)
  if (erx.quantityOnce) out.push(`   Per dose: ${erx.quantityOnce}`)
  out.push(`   ${erx.route} · Refill: ${erx.refill}`)
  if (erx.instructionNotes?.trim()) {
    const n = erx.instructionNotes.trim()
    out.push(`   Note: ${n.length > 140 ? `${n.slice(0, 137)}…` : n}`)
  }
  return out
}

/** Readable multi-line text for wa.me/?text= (newlines → %0A). */
function buildWhatsAppCartShareText(
  g: { supplierName: string; supplierLocation?: string; items: CartItem[]; subtotal: number },
  link: string
): string {
  const shop = g.supplierName || "Shop"
  const loc = g.supplierLocation?.trim()
  const lines: string[] = [
    "🛒 *IHUTE — shared cart*",
    "",
    loc ? `*${shop}*` + `\n📍 _${loc}_` : `*${shop}*`,
    "",
    "───────────────",
  ]
  g.items.forEach((it, idx) => {
    const name = stripTrailingPriceParen(it.name || "Product")
    const q = Math.max(1, it.qty || 1)
    const unit = Math.round(it.price || 0)
    const lineTotal = unit * q
    lines.push("")
    lines.push(`*${idx + 1}. ${name}*`)
    lines.push(`   ${q} × ${unit.toLocaleString()} ${CUR} = *${lineTotal.toLocaleString()} ${CUR}*`)
    const rx = formatErxLinesForShare(it)
    if (rx.length) lines.push(...rx)
  })
  lines.push(
    "",
    "───────────────",
    "",
    `💰 *Total:* ${Math.round(g.subtotal).toLocaleString()} ${CUR}`,
    "",
    "🔗 *Open in browser to pay:*",
    link,
    "",
    "_If the link is long, tap it once to open your cart on IHUTE._"
  )
  return lines.join("\n")
}
function normalizePhone(raw?: string | null): string {
  const v = (raw || "").replace(/\s|-/g, "")
  if (!v) return ""
  if (v.startsWith("+250") || v.startsWith("+258")) return v
  if (v.startsWith("250")) return "+" + v
  if (v.startsWith("00250")) return "+250" + v.slice(5)
  if (/^0?7\d{8}$/.test(v)) return "+250" + v.replace(/^0/, "")
  return v.startsWith("+25") ? v : "+25" + v
}
function fmt(n: unknown): string {
  if (n == null || n === "") return ""
  const v = typeof n === "number" ? n : Number(String(n).replace(/[^\d.-]/g, ""))
  return isNaN(v) ? String(n) : v.toLocaleString("en")
}
function ensureCur(v: unknown): string {
  if (v == null || v === "") return ""
  const s = String(v)
  return /(RWF|Frw|RF)\b/i.test(s) ? s : `${fmt(s)} ${CUR}`
}
function stripTrailingPriceParen(name: string): string {
  return String(name).replace(/\s*\((?:\d[\d.,\s]*)(?:RWF|Frw|RF)\)\s*$/i, "").trim()
}
function formatPaidAt(v: unknown): string {
  if (v == null) return ""
  return formatPaymentMethod(String(v))
}
type WhatsItem = [name: string, qty: string | number, amount: string | number]
function buildWhatsAppMessageStyled(args: {
  shop?: string; location?: string; orderId?: string | number | null;
  items: WhatsItem[]; total: number; discount: number; paid: number;
  paidAt?: string; reference?: string; myPhone?: string; link?: string;
}) {
  const { shop, location, orderId, items, total, discount, paid, paidAt, reference, myPhone, link } = args
  const padRight = (s: string, w: number) => (s.length >= w ? s : s + " ".repeat(w - s.length))
  const padLeft  = (s: string, w: number) => (s.length >= w ? s : " ".repeat(w - s.length) + s)
  const trunc    = (s: string, w: number) => (s.length > w ? s.slice(0, w - 1) + "…" : s)
  const NAME_W = 44, QTY_W = 5, AMT_W = 14
  const header = padRight("Product name", NAME_W) + padLeft("Qty", QTY_W) + padLeft("Amount", AMT_W)
  const sep    = "-".repeat(NAME_W + QTY_W + AMT_W)
  const lines  = (items || []).map(([name, qty, amount]) => {
    const nm = padRight(trunc(String(name ?? "").replace(/\s+/g, " ").trim(), NAME_W), NAME_W)
    const qt = padLeft(String(qty ?? ""), QTY_W)
    const amt= padLeft(ensureCur(amount ?? ""), AMT_W)
    return nm + qt + amt
  })
  return [
    "Order", "", `Shop: ${shop ?? ""}`, `Location: ${location ?? ""}`,
    orderId ? `Order ID: ${orderId}` : "", "", "```", header, sep, ...lines, "```", "",
    `Total: ${ensureCur(total)}`, `Discount: ${ensureCur(discount)}`, `Paid: ${ensureCur(paid)}`, "",
    `Paid at: ${formatPaidAt(paidAt)}`, `Message: ${reference || "-"}`, `My phone: ${myPhone || ""}`, "",
    link ? `Follow: ${link}` : "",
  ].filter(Boolean).join("\n")
}
function waHrefFor(phone: string, text: string) {
  const p = phone.replace(/^\+/, "")
  const encoded = encodeURIComponent(text)
  return `https://wa.me/${p}?text=${encoded}`
}

function WhatsAppLogo({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M20.52 3.48A11.86 11.86 0 0012.06 0C5.47 0 .1 5.37.1 11.96c0 2.1.55 4.16 1.6 5.99L0 24l6.2-1.63a11.9 11.9 0 005.86 1.49h.01c6.59 0 11.96-5.37 11.96-11.96a11.9 11.9 0 00-3.51-8.42ZM12.07 21.8h-.01a9.82 9.82 0 01-5.01-1.37l-.36-.21-3.68.96.98-3.58-.23-.37a9.82 9.82 0 01-1.5-5.27c0-5.43 4.42-9.85 9.86-9.85 2.63 0 5.1 1.02 6.95 2.89a9.77 9.77 0 012.89 6.96c0 5.43-4.42 9.84-9.89 9.84Zm5.4-7.33c-.29-.14-1.72-.84-1.99-.94-.27-.1-.47-.14-.66.14-.2.29-.76.94-.94 1.13-.17.2-.35.22-.64.07-.29-.14-1.24-.46-2.36-1.47a8.8 8.8 0 01-1.64-2.04c-.17-.29-.02-.44.13-.58.13-.13.29-.35.43-.52.14-.17.2-.29.29-.48.1-.2.05-.37-.02-.52-.08-.14-.66-1.59-.91-2.18-.24-.57-.49-.49-.66-.5h-.57c-.2 0-.52.07-.79.37-.27.29-1.04 1.01-1.04 2.46s1.06 2.86 1.21 3.06c.14.2 2.08 3.18 5.03 4.46.7.3 1.25.48 1.67.61.71.23 1.35.2 1.86.12.56-.09 1.72-.7 1.96-1.38.24-.68.24-1.26.17-1.39-.07-.13-.27-.2-.56-.34Z"
      />
    </svg>
  )
}

function XLogo({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M18.244 2H21l-6.01 6.87L22.06 22h-5.53l-4.33-5.77L7.16 22H4.4l6.43-7.35L2 2h5.67l3.92 5.23L18.244 2Zm-.97 18h1.53L6.84 3.9H5.2L17.273 20Z"
      />
    </svg>
  )
}

function slugifyShopName(v: string): string {
  const raw = String(v || "").toLowerCase().trim()
  // Keep canonical nickname used by backend routing
  if (raw.includes("pangolin")) return "burrows"
  return raw
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "shop";
}

function encodeSharedItem(args: { name: string; qty: number; price: number; itemCode?: string }): string {
  const cleanedName = String(args.name || "").replace(/[;,]/g, " ").replace(/\s+/g, " ").trim();
  const qty = Math.max(1, Number(args.qty || 1));
  const price = Math.max(0, Math.round(Number(args.price || 0)));
  const code = String(args.itemCode || "").trim();
  // Format: name;qty;price;code (code optional). Parser on shop-with-me supports ; and ,.
  return code ? `${cleanedName};${qty};${price};${code}` : `${cleanedName};${qty};${price}`;
}

// ---------- component ----------
export function CartSummary() {
  return <CartSummaryBody />
}

function CartSummaryBody() {
  const router = useRouter()
  const { isAuthenticated, user } = useAuthStore()
  const { toast } = useToast()
  const getGroupsBySeller = useCartStore((s) => s.getGroupsBySeller)
  const getGrandTotal    = useCartStore((s) => s.getGrandTotal)
  const cartItems        = useCartStore((s) => s.items)
  const removeGroupBySeller = useCartStore((s) => s.removeGroupBySeller)
  const clear            = useCartStore((s) => s.clear)
  const getPaymentStatus = useCartStore((s) => s.getPaymentStatus)
  const setPaymentStatus = useCartStore((s) => s.setPaymentStatus)
  // ✅ Get tableInfo from cart store
  const tableInfo = useCartStore((s) => s.tableInfo)

  const [busy, setBusy] = useState<string | null>(null)
  const [orderIds, setOrderIds] = useState<Record<string, string>>({})
  const [orderPhones, setOrderPhones] = useState<Record<string, string>>({})

  // Payment method selection dialog
  const [paymentMethodOpen, setPaymentMethodOpen] = useState(false)
  const [selectedSeller, setSelectedSeller] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<"momo" | "airtel" | "cod" | "urubuto">("momo")
  const [urubutoEligibleBySeller, setUrubutoEligibleBySeller] = useState<Record<string, boolean>>({})
  const [urubutoOpen, setUrubutoOpen] = useState(false)
  const [urubutoForSeller, setUrubutoForSeller] = useState<string | null>(null)
  const [urubutoPhone, setUrubutoPhone] = useState("")
  const [urubutoChannel, setUrubutoChannel] = useState<"wallet" | "card">("wallet")
  const [urubutoCardUrl, setUrubutoCardUrl] = useState<string | null>(null)

  // Anonymous checkout mode
  const [checkoutMode, setCheckoutMode] = useState<"login" | "anonymous">(isAuthenticated ? "login" : "anonymous")
  const [anonymousPhone, setAnonymousPhone] = useState("")
  const [anonymousName, setAnonymousName] = useState("")

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  const waitForUrubutoCompletion = async (transactionId: string) => {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await wait(attempt === 0 ? 2500 : 3000)
      const status = await fetchCheckoutUrubutoStatus(transactionId)
      const normalized = (status.paymentStatus ?? "").toUpperCase()
      if (normalized === "COMPLETED") return true
      if (normalized === "FAILED" || normalized === "CANCELLED" || normalized === "CANCELED") return false
    }
    return false
  }

  // Table command mode
  const { isInTableCommand, activeSession, leaveTableCommand, lockTableCommand, canCloseTable, closeTableCommand, createTableCommand, updateTableShareData } = useTableCommandStore()

  // ✅ Track if we've pre-filled the name (to avoid overwriting user edits)
  const hasPrefilledName = useRef(false)
  const lastTableSession = useRef<string | null>(null)

  // Pre-fill "Your Name" only for table-command guest flows (supplier must know who ordered).
  // Do not pre-fill from localStorage for plain guest checkout: the payment UI often hides the
  // name field, so a stale saved name would be sent as buyerName without the user seeing it.
  useEffect(() => {
    // Reset prefill flag when table session changes (new table created/joined)
    const currentSessionId = activeSession ? `${activeSession.tableName}-${activeSession.createdAt}` : null
    if (currentSessionId !== lastTableSession.current) {
      hasPrefilledName.current = false
      lastTableSession.current = currentSessionId
    }

    if (!hasPrefilledName.current && checkoutMode === "anonymous" && isInTableCommand()) {
      const guestName = getOrCreateGuestName()
      const tableUserName = activeSession?.userName
      const finalName = tableUserName && tableUserName !== "Guest" ? tableUserName : guestName

      if (finalName && finalName !== "Guest") {
        setAnonymousName(finalName)
        hasPrefilledName.current = true
      }
    }
  }, [checkoutMode, activeSession])

  // Pre-fill from tableInfo only when NOT a table order (e.g. delivery from shop-with-me)
  useEffect(() => {
    if (checkoutMode === "anonymous" && tableInfo && !isInTableCommand()) {
      if (tableInfo.customerName && !anonymousName) {
        setAnonymousName(tableInfo.customerName)
      }
      if (tableInfo.customerAddress && !deliveryLocation) {
        setDeliveryLocation(tableInfo.customerAddress)
      }
    }
  }, [checkoutMode, tableInfo, isInTableCommand])

  const [tableCommandDialogOpen, setTableCommandDialogOpen] = useState(false)
  const [tableCommandSeller, setTableCommandSeller] = useState<{ id: string; name: string } | null>(null)
  const [showCloseTableDialog, setShowCloseTableDialog] = useState(false)
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [shareModalData, setShareModalData] = useState<{
    tableName: string
    tableLocation: string
    shareableLink: string
    qrCodeUrl: string
    shareableToken: string
  } | null>(null)

  // MoMo payment dialog (MTN or Airtel)
  const [momoOpen, setMomoOpen] = useState(false)
  const [momoForSeller, setMomoForSeller] = useState<string | null>(null)
  const [momoPaymentProvider, setMomoPaymentProvider] = useState<"mtn" | "airtel">("mtn")
  const [momoAwaitingProof, setMomoAwaitingProof] = useState(false)
  const [momoProofDraft, setMomoProofDraft] = useState("")
  // From GET /api/account/profile (account_signup): MoMo when missing on cart; TEL as canonical seller phone
  const [supplierMomoFallback, setSupplierMomoFallback] = useState<Record<string, string>>({})
  const [supplierAccountTel, setSupplierAccountTel] = useState<Record<string, string>>({})

  // Cart suggestions popup (before checkout). Skip popup for rest of session once user chose "No thanks" or "Continue to checkout"
  const [suggestionsPopupOpen, setSuggestionsPopupOpen] = useState(false)
  const [pendingCheckoutSupplierId, setPendingCheckoutSupplierId] = useState<string | null>(null)
  const skipSuggestionsSessionKey = "ihute_skip_cart_suggestions"
  const shouldSkipSuggestions = () => typeof window !== "undefined" && sessionStorage.getItem(skipSuggestionsSessionKey) === "1"

  // COD dialog
  const [codOpen, setCodOpen] = useState(false)
  const [codForSeller, setCodForSeller] = useState<string | null>(null)
  const [deliveryLocation, setDeliveryLocation] = useState(user?.location || "")
  const [contactPhone, setContactPhone] = useState(user?.phone || "")
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([])
  const [promoCode, setPromoCode] = useState("")
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; percent: number } | null>(null)
  const [promoError, setPromoError] = useState<string | null>(null)

  const groups = getGroupsBySeller()
  const grandTotal = Math.round(getGrandTotal())

  const clearSubmittedSupplier = async (supplierId: string) => {
    const sid = (supplierId ?? "").toString().trim()
    if (!sid) return
    const remaining = cartItems.filter((x) => ((x.supplierId ?? "").toString().trim() !== sid))
    removeGroupBySeller(sid)
    await flushCartToServer(user?.email ?? "", remaining)
  }

  // Resolve MoMo for a group: from cart items first, then fallback from profile API
  const getMomoForGroup = (g: { supplierId: string; momo?: string | null }) =>
    (g.momo ?? "").trim() || (supplierMomoFallback[g.supplierId] ?? "").trim()

  /** Seller contact: account_signup.TEL (via profile API `phone`), then cart `sellerPhone`; not MoMo. */
  const getSellerContactLine = (g: { supplierId: string; phone?: string | null }) => {
    const fromSignup = (supplierAccountTel[g.supplierId] ?? "").trim()
    const fromCart = (g.phone ?? "").trim()
    const raw = fromSignup || fromCart
    if (!raw) return ""
    const n = normalizePhone(raw)
    return n || raw
  }

  const getSellerTelForOrder = (g: { supplierId: string; phone?: string | null }) =>
    (supplierAccountTel[g.supplierId] ?? "").trim() || (g.phone ?? "").trim() || ""

  // Supplier profile hydration for checkout contact data.
  // Retry a few times so transient backend/network failures do not leave seller phone empty.
  const profileFetchInFlightRef = useRef<Set<string>>(new Set())
  const profileFetchAttemptsRef = useRef<Record<string, number>>({})
  const PROFILE_FETCH_MAX_ATTEMPTS = 3
  const PROFILE_FETCH_RETRY_MS = 1200
  useEffect(() => {
    const fetchSupplierProfile = (account: string) => {
      if (!account) return
      if (profileFetchInFlightRef.current.has(account)) return
      const attempt = profileFetchAttemptsRef.current[account] ?? 0
      if (attempt >= PROFILE_FETCH_MAX_ATTEMPTS) return
      profileFetchInFlightRef.current.add(account)
      profileFetchAttemptsRef.current[account] = attempt + 1

      fetch(`/api/account/profile?account=${encodeURIComponent(account)}`)
        .then((res) => res.json())
        .then((data) => {
          if (!data?.ok || !data?.profile) {
            throw new Error("Profile not available")
          }
          const p = data.profile as { momo?: string; phone?: string }
          const momo = String(p.momo ?? "").trim()
          const tel = String(p.phone ?? "").trim()
          if (momo) setSupplierMomoFallback((prev) => ({ ...prev, [account]: momo }))
          if (tel) {
            setSupplierAccountTel((prev) => ({ ...prev, [account]: tel }))
          } else if ((profileFetchAttemptsRef.current[account] ?? 0) < PROFILE_FETCH_MAX_ATTEMPTS) {
            setTimeout(() => fetchSupplierProfile(account), PROFILE_FETCH_RETRY_MS)
          }
        })
        .catch(() => {
          if ((profileFetchAttemptsRef.current[account] ?? 0) < PROFILE_FETCH_MAX_ATTEMPTS) {
            setTimeout(() => fetchSupplierProfile(account), PROFILE_FETCH_RETRY_MS)
          }
        })
        .finally(() => {
          profileFetchInFlightRef.current.delete(account)
        })
    }

    groups.forEach((g) => {
      const account = (g.supplierId ?? "").trim()
      if (!account) return
      const alreadyHaveTel = Boolean((supplierAccountTel[account] ?? "").trim())
      const alreadyHaveMomo = Boolean((supplierMomoFallback[account] ?? "").trim())
      if (alreadyHaveTel && alreadyHaveMomo) return
      fetchSupplierProfile(account)
    })
  }, [groups, supplierAccountTel, supplierMomoFallback])

  // Prefetch shared guest pool account (ISHYIGA_ACCOUNT) so checkout is fast and order servlet can resolve buyer
  useEffect(() => {
    if (!paymentMethodOpen || checkoutMode !== "anonymous") return
    void ensureGuestPoolBuyerAccount()
  }, [paymentMethodOpen, checkoutMode])

  // UrubutoPay: show only when seller is live (ALG payer code → Urubuto merchant code assigned)
  useEffect(() => {
    if (!paymentMethodOpen || !selectedSeller) return
    const seller = selectedSeller.trim()
    if (!seller || urubutoEligibleBySeller[seller] !== undefined) return
    void fetchSellerUrubutoEligibility(seller).then((r) => {
      setUrubutoEligibleBySeller((prev) => ({ ...prev, [seller]: r.eligible }))
    })
  }, [paymentMethodOpen, selectedSeller])

  const discountPercent = appliedPromo?.percent ?? 0
  const discountAmount = Math.round((grandTotal * discountPercent) / 100)
  const totalAfterDiscount = grandTotal - discountAmount
  const myPhone =
    checkoutMode === "anonymous"
      ? isInTableCommand()
        ? anonymousPhone
        : ""
      : user?.phone || ""

  const applyPromo = async () => {
    const code = promoCode.trim().toUpperCase()
    setPromoError(null)
    if (!code) {
      setAppliedPromo(null)
      return
    }
    try {
      const res = await fetch(`/api/promo/validate?code=${encodeURIComponent(code)}`)
      const data = await res.json().catch(() => ({}))
      const valid = data?.valid === true
      const percent = typeof data?.percent === "number" ? data.percent : undefined
      if (valid && percent != null) {
        setAppliedPromo({ code, percent })
      } else {
        setAppliedPromo(null)
        setPromoError(data?.message || "Invalid or expired code")
      }
    } catch {
      setAppliedPromo(null)
      setPromoError("Could not validate code")
    }
  }

  useEffect(() => {
    if (codOpen) setSavedAddresses(getSavedAddresses())
  }, [codOpen])

  const requireLogin = () => {
    // If anonymous mode, don't require login
    if (checkoutMode === "anonymous") return true
    if (!isAuthenticated) { router.push("/login"); return false }
    return true
  }

  // MoMo payment auto-poll
  async function pollPayment(orderId: string, supplierId: string) {
    const deadline = Date.now() + 60_000
    while (Date.now() < deadline) {
      try {
        const r = await fetch("/api/orders/payment-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
          cache: "no-store",
        })
        const j = await r.json()
        if (j?.ok && j.status === "paid") { setPaymentStatus(supplierId, "paid"); return }
        if (j?.ok && j.status === "failed") { setPaymentStatus(supplierId, "failed"); return }
      } catch {}
      await new Promise(res => setTimeout(res, 2000))
    }
  }

  // WhatsApp prefill per seller
  const sellerWhatsData = useMemo(() => {
    return groups.map((g) => {
      const chosenPhone = orderPhones[g.supplierId] || g.phone || getMomoForGroup(g) || ""
      const phone = normalizePhone(chosenPhone)
      const items: WhatsItem[] = g.items.map((it) => {
        const name = stripTrailingPriceParen(it.name || "Product")
        const qty = it.qty
        const amount = Math.round((it.price || 0) * (it.qty || 0))
        return [name, qty, amount]
      })
      const orderId = orderIds[g.supplierId]
      const hasUssdTarget = Boolean(getMomoForGroup(g))
      const isPaid = getPaymentStatus(g.supplierId) === "paid"
      const message = buildWhatsAppMessageStyled({
        shop: g.supplierName,
        location: g.supplierLocation,
        orderId,
        items,
        total: g.subtotal,
        discount: 0,
        paid: isPaid ? g.subtotal : 0,
        paidAt: isPaid ? "MTN MoMo" : (hasUssdTarget ? "Pending (MoMo)" : "Pay on delivery"),
        reference: orderId ? `ORDER ${orderId}` : undefined,
        myPhone,
        link: orderId ? `${(process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_API_URL || "https://ihute.rw").replace(/\/Trading\/?$/, "")}/orders/${orderId}` : undefined,
      })
      const href = phone ? waHrefFor(phone, message) : ""
      return { supplierId: g.supplierId, phone, message, href }
    })
  }, [groups, orderIds, orderPhones, myPhone, getPaymentStatus])

  const buildGroupShareLink = (g: ReturnType<typeof getGroupsBySeller>[number]) => {
    const shopSlug = slugifyShopName(g.supplierName || g.supplierId || "shop");
    const params = new URLSearchParams();
    params.set("shopname", shopSlug);
    g.items.forEach((it, idx) => {
      const value = encodeSharedItem({
        name: stripTrailingPriceParen(it.name || "Product"),
        qty: it.qty || 1,
        price: it.price || 0,
        itemCode: it.itemCode || it.id,
      });
      params.set(`item${idx + 1}`, value);
    });
    const base = typeof window !== "undefined" ? window.location.origin : "";
    return `${base}/shop-with-me/${encodeURIComponent(shopSlug)}?${params.toString()}`;
  };

  const buildGroupShareText = (g: ReturnType<typeof getGroupsBySeller>[number], link: string) =>
    buildWhatsAppCartShareText(
      {
        supplierName: g.supplierName,
        supplierLocation: g.supplierLocation,
        items: g.items,
        subtotal: g.subtotal,
      },
      link
    );

  if (groups.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">Your cart is empty.</CardContent>
      </Card>
    )
  }

  // Open payment method selection
  const openPaymentMethod = (supplierId: string) => {
    if (!requireLogin()) return
    const g = groups.find(x => x.supplierId === supplierId)
    if (!g) return

    // Bar/resto: from name/location keywords OR from shop-with-me — always show create/join table option (whether already in a table or not)
    const isBar =
      g.isBarResto === true ||
      isBarOrRestaurant(g.supplierName) ||
      isBarOrRestaurant(g.supplierLocation || "")

    if (isBar) {
      setTableCommandSeller({ id: supplierId, name: g.supplierName })
      setTableCommandDialogOpen(true)
      return
    }

    // Otherwise proceed with regular checkout
    const hasUssdTarget = Boolean(getMomoForGroup(g))
    setSelectedSeller(supplierId)
    setUrubutoPhone(
      checkoutMode === "anonymous"
        ? isInTableCommand()
          ? anonymousPhone
          : ""
        : user?.phone || "",
    )
    void fetchSellerUrubutoEligibility(supplierId).then((r) => {
      const preview = isUrubutoCheckoutPreviewForSeller(supplierId)
      const show = r.eligible || preview
      setUrubutoEligibleBySeller((prev) => ({ ...prev, [supplierId]: r.eligible }))
      setPaymentMethod(show ? "urubuto" : hasUssdTarget ? "momo" : "cod")
    })
    setPaymentMethodOpen(true)
  }

  // Handle payment method selection
  const proceedWithPayment = async () => {
    if (!selectedSeller) return

    // If user selected "login" mode, redirect to login
    if (checkoutMode === "login" && !isAuthenticated) {
      router.push("/login")
      return
    }

    if (checkoutMode === "anonymous" && isInTableCommand() && !anonymousName.trim()) {
      alert("Please enter your name so the supplier knows who ordered")
      return
    }

    if (paymentMethod === "cod") {
      setPaymentMethodOpen(false)
      setCodForSeller(selectedSeller)
      setDeliveryLocation(checkoutMode === "anonymous" ? (tableInfo?.customerAddress || "") : user?.location || "")
      setContactPhone(checkoutMode === "anonymous" ? anonymousPhone : user?.phone || "")
      setCodOpen(true)
      setSelectedSeller(null)
    } else if (paymentMethod === "urubuto") {
      setPaymentMethodOpen(false)
      setUrubutoForSeller(selectedSeller)
      setUrubutoOpen(true)
      setSelectedSeller(null)
    } else {
      setPaymentMethodOpen(false)
      setMomoForSeller(selectedSeller)
      setMomoPaymentProvider(paymentMethod === "airtel" ? "airtel" : "mtn")
      setMomoAwaitingProof(false)
      setMomoProofDraft("")
      setMomoOpen(true)
      setSelectedSeller(null)
    }
  }

  // Unified order creator for MoMo & COD
  const placeOrder = async (
    g: ReturnType<typeof getGroupsBySeller>[number],
    opts: {
      paymentName: "PAID_MTN_MOMO" | "PAID_AIRTEL_MOMO" | "PAID_URUBUTO" | "PAY_ON_DELIVERY";
      buyerPhone?: string;
      buyerLocation?: string;
      reference?: string;
      paymentId?: string;
      paymentStatus?: "pending" | "paid";
    }
  ) => {
    if (!requireLogin()) return
    try {
      setBusy(g.supplierId)
      setPaymentStatus(g.supplierId, "pending")

      const items = g.items.map((it) => {
        const code =
          String(it.itemCode ?? "").trim() ||
          String(it.item_key_words ?? "").trim() ||
          String(it.id ?? "").trim()
        return {
          name: it.name,
          qty: it.qty,
          // Send the same line unit price the buyer sees in cart.
          unitPrice: it.price,
          unit: it.unit ?? "",
          itemCode: code,
          ...(it.itemEmballage
            ? { item_emballage: it.itemEmballage, ITEM_EMBALLAGE: it.itemEmballage }
            : {}),
        }
      })

      const paymentId = opts.paymentId || `${opts.paymentName}_${Date.now()}`

      console.log("[cart/order] Placing order:", {
        paymentName: opts.paymentName,
        paymentId,
        supplierId: g.supplierId,
        sellerName: g.supplierName,
        items: items.map((it) => ({ name: it.name, qty: it.qty, NIKI_CODE: it.itemCode, unitPrice: it.unitPrice })),
      })

      // Buyer name: for table orders use user-entered name only (so "Ordered By" shows person, not table name)
      const isOrderingFromOwnShop = Boolean(user?.ishyigaAccount && g.supplierId && user.ishyigaAccount === g.supplierId);
      const resolvedBuyerName = isInTableCommand()
        ? (checkoutMode === "anonymous" ? (anonymousName?.trim() || "Guest") : (user?.name || "Guest"))
        : checkoutMode === "anonymous"
          ? (anonymousName?.trim() || "Guest")
          : (tableInfo?.customerName && String(tableInfo.customerName).trim()) ||
            (isOrderingFromOwnShop ? (tableInfo?.customerName || anonymousName || "Guest") : user?.name) ||
            anonymousName ||
            user?.name ||
            "Guest"

      let guestBuyerAccount = getGuestBuyerAccount()
      if (checkoutMode === "anonymous") {
        guestBuyerAccount = await ensureGuestPoolBuyerAccount()
      }

      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Must match account_signup.EMAIL (guest_pool@ihute.rw) so Java OrdersServlet resolves buyer — not a random guest_* address.
          buyerEmail: checkoutMode === "anonymous" ? GUEST_POOL_EMAIL : user?.email,
          isGuestCheckout: checkoutMode === "anonymous",
          ...(checkoutMode === "anonymous" ? { buyerAccount: guestBuyerAccount } : {}),
          buyerPhone:
            opts.buyerPhone ??
            (checkoutMode === "anonymous"
              ? isInTableCommand()
                ? anonymousPhone
                : ""
              : user?.phone || ""),
          buyerLocation: opts.buyerLocation || (checkoutMode === "anonymous" ? deliveryLocation : user?.location || "NA"),
          buyerName: String(resolvedBuyerName || "").trim() || "Guest",
          sellerAccount: g.supplierId,
          sellerName: g.supplierName,
          sellerPhone: getSellerTelForOrder(g),
          paymentName: opts.paymentName,
          paymentId: paymentId,
          reference: opts.reference || "",
          ...(opts.paymentStatus ? { paymentStatus: opts.paymentStatus } : {}),
          currency: "RWF",
          items,
          // Table command information
          isTableCommand: isInTableCommand(),
          tableName: activeSession?.tableName,
          tableLocation: activeSession?.locationName,
        }),
      })

      const json = await res.json()

      console.log("Order creation response:", json)

      if (res.ok && json?.ok) {
        const orderId = json.orderId ? String(json.orderId) : null
        const sellerTel = json.sellerTel ? String(json.sellerTel) : null

        if (orderId) setOrderIds(m => ({ ...m, [g.supplierId]: orderId }))
        if (sellerTel) setOrderPhones(m => ({ ...m, [g.supplierId]: sellerTel }))
        if (opts.paymentStatus === "paid") {
          setPaymentStatus(g.supplierId, "paid")
        }

        // Track successful purchase for all items in this seller group (best-effort)
        try {
          g.items.forEach(it => {
            trackClick("product", it.id, it.name)
          })
        } catch {
          // ignore tracking errors
        }

        console.log(`✅ Order created with payment method: ${opts.paymentName}`)

        // Handle table command creation with share data
        if (json.tableCommand && json.tableCommand.shareableLink) {
          // If we're not already in a table command session, create one with share data
          if (!isInTableCommand()) {
            createTableCommand(
              json.tableCommand.tableName,
              g.supplierId,
              json.tableCommand.tableLocation,
              checkoutMode === "anonymous" ? anonymousName : user?.name || "Guest",
              checkoutMode === "anonymous" ? GUEST_POOL_EMAIL : user?.email || "",
              {
                shareableLink: json.tableCommand.shareableLink,
                shareableToken: json.tableCommand.shareableToken,
                qrCodeUrl: json.tableCommand.qrCodeUrl,
              }
            )
          } else if (activeSession && activeSession.isCreator) {
            // Update existing session with share data
            updateTableShareData({
              shareableLink: json.tableCommand.shareableLink,
              shareableToken: json.tableCommand.shareableToken,
              qrCodeUrl: json.tableCommand.qrCodeUrl,
            })
          }

          // Show share modal
          setShareModalData({
            tableName: json.tableCommand.tableName,
            tableLocation: json.tableCommand.tableLocation,
            shareableLink: json.tableCommand.shareableLink,
            qrCodeUrl: json.tableCommand.qrCodeUrl,
            shareableToken: json.tableCommand.shareableToken,
          })
          setShareModalOpen(true)
          await clearSubmittedSupplier(g.supplierId)
          return
        }

        if (
          (opts.paymentName === "PAID_MTN_MOMO" ||
            opts.paymentName === "PAID_AIRTEL_MOMO" ||
            opts.paymentName === "PAID_URUBUTO") &&
          orderId
        ) {
          pollPayment(orderId, g.supplierId)
        }

        const currentOrderIsBarTable =
          g.isBarResto === true ||
          isBarOrRestaurant(g.supplierName) ||
          isBarOrRestaurant(g.supplierLocation || "")

        // If a stale table session exists while ordering a non-table seller, leave immediately.
        if (isInTableCommand() && !currentOrderIsBarTable) {
          leaveTableCommand()
          toast({
            title: "Left table session automatically",
            description: "This order is processed as an individual order.",
            duration: 1800,
          })
        }

        // Lock table command if in table mode for bar/resto flow:
        // clear cart but stay on page so user can add more items.
        if (isInTableCommand() && activeSession?.isCreator && currentOrderIsBarTable) {
          await clearSubmittedSupplier(g.supplierId)
          alert(`Order #${orderId} added to table "${activeSession.tableName}". Add more items or send the complete table order.`)
          return
        }

        // Remove only the supplier that was just submitted.
        await clearSubmittedSupplier(g.supplierId)

        // Redirect to order success page with WhatsApp details
        if (orderId) {
          const params = new URLSearchParams({
            orderId,
            sellerName: g.supplierName,
            sellerPhone: sellerTel || "",
            buyerPhone:
              checkoutMode === "anonymous"
                ? isInTableCommand()
                  ? anonymousPhone
                  : ""
                : user?.phone || "",
            total: String(g.subtotal),
            paymentMethod: opts.paymentName
          })
          router.push(`/order-success?${params.toString()}`)
        } else if (checkoutMode === "login" || isAuthenticated) {
          router.push("/orders")
        } else {
          router.push("/")
        }
        router.refresh()
      } else {
        setPaymentStatus(g.supplierId, "failed")
        const errMsg = orderErrorMessageWithProductNames(
          json?.error || "Unknown error",
          g.items,
        )
        const hint =
          typeof json?.hint === "string" && json.hint.trim()
            ? `\n\n${json.hint.trim()}`
            : ""
        const target =
          typeof json?.ordersUrl === "string" && json.ordersUrl.trim()
            ? `\n\nBackend URL: ${json.ordersUrl.trim()}`
            : ""
        toast({
          variant: "destructive",
          title: "Failed to create order",
          description: `${errMsg}${target}${hint}`.trim(),
          duration: 20_000,
        })
      }
    } catch (error) {
      console.error("Order creation error:", error)
      setPaymentStatus(g.supplierId, "failed")
      toast({
        variant: "destructive",
        title: "Failed to create order",
        description: "Please try again. If it keeps failing, check that Tomcat is running and JAVA_BACKEND_BASE matches your port.",
        duration: 12_000,
      })
    } finally {
      setBusy(null)
    }
  }

  const confirmPayment = (g: ReturnType<typeof getGroupsBySeller>[number]) =>
    placeOrder(g, {
      paymentName: "PAID_MTN_MOMO",
      reference: `MOMO_${Date.now()}`,
      paymentId: `MOMO_${Date.now()}`
    })

  const submitCOD = async () => {
    if (!codForSeller) return
    const g = groups.find(x => x.supplierId === codForSeller)
    if (!g) { setCodOpen(false); return }

    // Check if Pangolin's Burrows - use table/location instead of delivery input
    const isPangolins = g.supplierName?.toUpperCase().includes("PANGOLIN")
    const location = isPangolins
      ? (isInTableCommand() ? `Table: ${activeSession?.tableName}` : g.supplierLocation || "In-person pickup")
      : deliveryLocation

    await placeOrder(g, {
      paymentName: "PAY_ON_DELIVERY",
      buyerPhone: contactPhone,
      buyerLocation: location,
      reference: `COD_${Date.now()}`,
      paymentId: `COD_${Date.now()}`,
      paymentStatus: "pending",
    })

    setCodOpen(false)
    setCodForSeller(null)
  }

  const confirmMoMoPayment = async () => {
    if (!momoForSeller) return
    const g = groups.find(x => x.supplierId === momoForSeller)
    if (!g) {
      setMomoOpen(false)
      setMomoAwaitingProof(false)
      setMomoProofDraft("")
      return
    }

    if (!momoAwaitingProof) {
      setMomoAwaitingProof(true)
      return
    }

    const proof = momoProofDraft.trim()
    if (!proof) {
      alert("Please enter your MoMo transaction reference or proof of payment (as shown on your receipt).")
      return
    }

    await placeOrder(g, {
      paymentName: momoPaymentProvider === "airtel" ? "PAID_AIRTEL_MOMO" : "PAID_MTN_MOMO",
      reference: proof,
      paymentId: proof,
    })
    setMomoOpen(false)
    setMomoForSeller(null)
    setMomoAwaitingProof(false)
    setMomoProofDraft("")
  }

  const resetUrubutoDialog = () => {
    setUrubutoForSeller(null)
    setUrubutoChannel("wallet")
    setUrubutoCardUrl(null)
  }

  const confirmUrubutoPayment = async () => {
    if (!urubutoForSeller) return
    const g = groups.find((x) => x.supplierId === urubutoForSeller)
    if (!g) {
      setUrubutoOpen(false)
      resetUrubutoDialog()
      return
    }
    const previewOnly =
      isUrubutoCheckoutPreviewForSeller(g.supplierId) && !urubutoEligibleBySeller[g.supplierId]
    if (previewOnly) {
      alert(
        "UI preview only: this seller is not live on UrubutoPay yet. In admin, set status ACTIVE, Urubuto merchant code, and verify KYC — or remove NEXT_PUBLIC_URUBUTO_CHECKOUT_PREVIEW.",
      )
      return
    }

    const isCard = urubutoChannel === "card"
    const phone = normalizeUrubutoPhone(urubutoPhone.trim())
    if (!isCard && !phone) {
      alert("Enter your MoMo number (MTN or Airtel).")
      return
    }
    if (!isCard && !isValidUrubutoMtnOrAirtel(phone)) {
      alert(urubutoPhoneHint())
      return
    }

    const payerNames =
      checkoutMode === "anonymous"
        ? anonymousName.trim() || "Guest"
        : user?.name || "Customer"
    const payerEmail = checkoutMode === "anonymous" ? GUEST_POOL_EMAIL : user?.email || ""
    const payerCode =
      checkoutMode === "anonymous" ? undefined : user?.ishyigaAccount?.trim() || undefined
    const cartId = `IHUTE-CART-${g.supplierId}-${Date.now()}`

    setBusy(g.supplierId)
    try {
      const pay = await initiateCheckoutUrubutoPay({
        sellerAccount: g.supplierId,
        amount: g.subtotal,
        paymentMethod: isCard ? "CARD" : "WALLET",
        phone_number: isCard ? undefined : phone,
        card_type_to_be_used: isCard ? URUBUTO_CHECKOUT_CARD_TYPE : undefined,
        payer_names: payerNames,
        payer_email: payerEmail,
        payerCode,
        cartId,
        clientReference: cartId,
      })
      const txnId = pay.transactionId?.trim()
      const cardUrl = pay.cardProcessingUrl?.trim()
      if (!pay.ok || (!txnId && !cardUrl)) {
        alert(pay.error || "Could not start UrubutoPay. Try another method or contact the seller.")
        return
      }

      if (isCard && cardUrl) {
        window.open(cardUrl, "_blank", "noopener,noreferrer")
        setUrubutoCardUrl(cardUrl)
      }

      const reference = txnId || `URUBUTO-CARD-${Date.now()}`
      let paymentCompleted = false
      if (!isCard && txnId) {
        toast({
          title: "Payment request sent",
          description: "Approve the MoMo prompt on your phone. We are checking the payment now.",
          duration: 3500,
        })
        paymentCompleted = await waitForUrubutoCompletion(txnId)
      }
      await placeOrder(g, {
        paymentName: "PAID_URUBUTO",
        reference,
        paymentId: reference,
        buyerPhone: phone || undefined,
        paymentStatus: paymentCompleted ? "paid" : "pending",
      })
      setUrubutoOpen(false)
      resetUrubutoDialog()
      toast({
        title: paymentCompleted ? "Payment successful" : isCard ? "Card payment started" : "Order placed, payment pending",
        description: paymentCompleted
          ? "Your UrubutoPay payment was received successfully."
          : isCard
            ? "Complete the payment in the secure Urubuto tab."
            : "If you already approved the MoMo prompt, the seller dashboard will refresh shortly.",
        duration: 6000,
      })
    } finally {
      setBusy(null)
    }
  }

  const renderContent = () => (
    <div className="cart-summary-root">
      <div className="space-y-4">
        {groups.map((g) => {
          const status = getPaymentStatus(g.supplierId)
          const wa = sellerWhatsData.find(x => x.supplierId === g.supplierId)

          const momoTarget = getMomoForGroup(g)
          const hasUssdTarget = momoTarget.length > 0
          const unmark = () => setPaymentStatus(g.supplierId, "unpaid")

          return (
            <Card key={g.supplierId} className="border-2">
              <CardHeader className="pb-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <CardTitle className="text-base flex-1 min-w-0 break-words">
                  {g.supplierName}
                  {g.supplierLocation ? (
                    <span className="text-muted-foreground font-normal block sm:inline"> — {g.supplierLocation}</span>
                  ) : null}
                </CardTitle>
                {status === "paid" && (
                  <Badge variant="secondary" className="gap-1 text-green-700 border-green-200">
                    <CheckCircle2 className="h-4 w-4" /> Paid
                  </Badge>
                )}
                {status === "pending" && <Badge variant="secondary">Pending</Badge>}
                {status === "failed"  && <Badge variant="destructive">Failed</Badge>}
                {status === "unpaid"  && <Badge variant="outline">Unpaid</Badge>}
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span>Items</span>
                  <span className="font-medium text-right whitespace-nowrap">
                    {g.items.reduce((n, it) => n + it.qty, 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span>Subtotal</span>
                  <span className="font-semibold text-right whitespace-nowrap">{g.subtotal.toLocaleString()} RWF</span>
                </div>
                <Separator />

                {/* Primary checkout: if user already dismissed suggestions this session, go straight to payment */}
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => {
                    setPendingCheckoutSupplierId(g.supplierId)
                    if (shouldSkipSuggestions()) {
                      openPaymentMethod(g.supplierId)
                    } else {
                      setSuggestionsPopupOpen(true)
                    }
                  }}
                  disabled={busy === g.supplierId}
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Proceed to Checkout
                </Button>

                {/* Share this cart: copy link / WhatsApp / X */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={async () => {
                      const link = buildGroupShareLink(g);
                      try {
                        await navigator.clipboard.writeText(link);
                        alert("Cart link copied");
                      } catch {
                        alert(link);
                      }
                    }}
                  >
                    <Link2 className="h-4 w-4 mr-2" />
                    Copy link
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      const link = buildGroupShareLink(g);
                      const text = buildGroupShareText(g, link);
                      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
                    }}
                  >
                    <WhatsAppLogo className="h-4 w-4 mr-2" />
                    WhatsApp
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      const link = buildGroupShareLink(g);
                      const text = buildGroupShareText(g, link);
                      window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank");
                    }}
                  >
                    <XLogo className="h-4 w-4 mr-2" />
                    X
                  </Button>
                </div>

                {status === "paid" && (
                  <Button variant="outline" className="w-full" onClick={unmark}>
                    <RotateCcw className="h-4 w-4 mr-2" /> Unmark paid
                  </Button>
                )}

                {/* WhatsApp actions */}
                {(status === "paid" || status === "pending") && (
                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <Button
                      className="flex-1 bg-[#25D366] hover:bg-[#20b05a]"
                      asChild
                      disabled={!wa?.phone}
                      title={wa?.phone ? `Send order via WhatsApp to ${wa.phone}` : "No seller WhatsApp number"}
                    >
                      <a href={wa?.href || "#"} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="h-4 w-4 mr-2" /> Send WhatsApp
                      </a>
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={async () => { try { await navigator.clipboard.writeText(wa?.message || "") } catch {} }}
                      title="Copy WhatsApp message"
                    >
                      <MessageCircle className="h-4 w-4 mr-2" /> Copy message
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}

        {/* Promo code */}
        {/*<Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="h-4 w-4" /> Promo code
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex gap-2">
              <Input
                value={promoCode}
                onChange={(e) => { setPromoCode(e.target.value); setPromoError(null) }}
                placeholder="Enter promo code"
                className="flex-1"
              />
              <Button variant="secondary" onClick={() => applyPromo()}>Apply</Button>
            </div>
            {appliedPromo && (
              <p className="text-sm text-green-600">{appliedPromo.percent}% off applied</p>
            )}
            {promoError && <p className="text-sm text-destructive">{promoError}</p>}
          </CardContent>
        </Card>
*/}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Grand Total</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {discountAmount > 0 && (
              <>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{grandTotal.toLocaleString()} RWF</span>
                </div>
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount ({appliedPromo?.percent}%)</span>
                  <span>-{discountAmount.toLocaleString()} RWF</span>
                </div>
              </>
            )}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
              <div className="text-base sm:text-lg font-bold break-words">{totalAfterDiscount.toLocaleString()} RWF</div>
              <Button variant="outline" onClick={clear} className="w-full sm:w-auto">Clear Cart</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Smart cart suggestions: show when user clicks Proceed to Checkout, then continue to payment */}
      <CartSuggestionsPopup
        open={suggestionsPopupOpen}
        onOpenChange={setSuggestionsPopupOpen}
        cartItems={groups.flatMap((g) =>
          g.items.map((i) => ({
            product_id: i.id ?? i.itemCode,
            name: i.name,
            quantity: i.qty,
            supplier_id: (i.supplierId ?? g.supplierId)?.toString().trim() || "",
            supplier_name: g.supplierName,
          }))
        )}
        onContinue={() => {
          const id = pendingCheckoutSupplierId
          setPendingCheckoutSupplierId(null)
          setSuggestionsPopupOpen(false)
          if (typeof window !== "undefined") sessionStorage.setItem(skipSuggestionsSessionKey, "1")
          if (id) openPaymentMethod(id)
        }}
      />

      {/* ✅ UPDATED: Payment method selection dialog with customer info pre-filled; scrollable on small viewports */}
      <Dialog open={paymentMethodOpen} onOpenChange={setPaymentMethodOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0">
          <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-2">
            <DialogTitle>Choose Payment Method</DialogTitle>
            <DialogDescription>Select how you'd like to pay for this order</DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4">
          {/* ✅ Customer Info Banner (from shop-with-me) */}
          {tableInfo && tableInfo.customerName && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Delivery Info</p>
                  <p className="text-xs text-muted-foreground">
                    {tableInfo.customerName} - {tableInfo.customerAddress}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ✅ Table Info Banner */}
          {isInTableCommand() && activeSession && (
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Table Order</p>
                  <p className="text-xs text-muted-foreground">
                    {activeSession.locationName} - Table {activeSession.tableName}
                  </p>
                </div>
              </div>
              {/* Close table: visible for creator when table is SENT so all orders are merged/final */}
              {activeSession.status === "SENT" && canCloseTable() && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 border-orange-300 text-orange-700 hover:bg-orange-50 hover:text-orange-800"
                  onClick={() => setShowCloseTableDialog(true)}
                >
                  <Lock className="h-4 w-4" />
                  Close table (merge all orders — no one can add more)
                </Button>
              )}
            </div>
          )}

          {/* Checkout Mode Selection */}
          {!isAuthenticated && (
            <div className="space-y-3 pb-4 border-b">
              <Label className="text-sm font-medium">Checkout as:</Label>
              <RadioGroup
                value={checkoutMode}
                onValueChange={(v) => {
                  const mode = v as "login" | "anonymous"
                  setCheckoutMode(mode)
                  // Plain guest checkout does not show a name field; clear any stale prefill so we
                  // do not submit another user's saved guest name as buyerName.
                  if (mode === "anonymous" && !isInTableCommand()) {
                    setAnonymousName("")
                    hasPrefilledName.current = false
                  }
                }}
              >
                <div
                  className="flex items-center space-x-3 border rounded-lg p-3 cursor-pointer hover:bg-accent"
                  onClick={() => {
                    setCheckoutMode("login")
                  }}
                >
                  <RadioGroupItem value="login" id="checkout-login" />
                  <Label htmlFor="checkout-login" className="cursor-pointer flex-1">
                    <div className="font-medium">Sign in to checkout</div>
                    <div className="text-xs text-muted-foreground">Track your orders easily</div>
                  </Label>
                </div>
                <div
                  className="flex items-center space-x-3 border rounded-lg p-3 cursor-pointer hover:bg-accent"
                  onClick={() => {
                    setCheckoutMode("anonymous")
                    if (!isInTableCommand()) {
                      setAnonymousName("")
                      hasPrefilledName.current = false
                    }
                  }}
                >
                  <RadioGroupItem value="anonymous" id="checkout-anonymous" />
                  <Label htmlFor="checkout-anonymous" className="cursor-pointer flex-1">
                    <div className="font-medium">Continue as guest</div>
                    <div className="text-xs text-muted-foreground">No account needed</div>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Guest: table orders still need a name for "Ordered By"; otherwise show seller phone for tracking */}
          {checkoutMode === "anonymous" && (
            <div className="space-y-3 pb-4 border-b">
              {isInTableCommand() ? (
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Your Name *</Label>
                  <Input
                    value={anonymousName}
                    onChange={(e) => setAnonymousName(e.target.value)}
                    placeholder="e.g., John, Alice"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter your name so the supplier knows who ordered (table is already shown above).
                  </p>
                </div>
              ) : (
                selectedSeller &&
                (() => {
                  const g = groups.find((x) => x.supplierId === selectedSeller)
                  if (!g) return null
                  const sellerTel = getSellerContactLine(g)
                  return (
                    <div className="rounded-xl border border-emerald-200/90 bg-gradient-to-br from-emerald-50 via-white to-slate-50 p-4 shadow-sm ring-1 ring-emerald-100/60">
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 shadow-inner">
                          <PhoneCall className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1 space-y-2">
                          <p className="text-sm font-semibold tracking-tight text-emerald-950">Track your order</p>
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            Use the seller&apos;s phone number below. Call or WhatsApp this number to check status and follow up on your order.
                          </p>
                          <div className="rounded-lg border border-emerald-100 bg-white/90 px-3 py-2.5 shadow-sm">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700/90">
                              Seller phone
                            </p>
                            <p className="break-all font-mono text-base font-semibold text-slate-900">
                              {sellerTel || "Not on file — contact the shop"}
                            </p>
                          </div>
                        </div>
                      </div>
                      <p className="mt-3 border-t border-emerald-100/80 pt-3 text-xs text-muted-foreground">
                        After payment, enter your MoMo proof in the next step so we can match your payment to this order.
                      </p>
                    </div>
                  )
                })()
              )}
            </div>
          )}

          {/* Payment method selection */}
          <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as "momo" | "airtel" | "cod" | "urubuto")}>
            <div className="space-y-3">
              {selectedSeller && (() => {
                const g = groups.find(x => x.supplierId === selectedSeller)
                const hasUssdTarget = g ? Boolean(getMomoForGroup(g)) : false
                const urubutoPreview = isUrubutoCheckoutPreviewForSeller(selectedSeller)
                const urubutoLive = urubutoEligibleBySeller[selectedSeller] === true || urubutoPreview

                return (
                  <>
                    {urubutoLive && (
                      <div
                        className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-accent border-violet-300 bg-violet-50/50"
                        onClick={() => setPaymentMethod("urubuto")}
                      >
                        <RadioGroupItem value="urubuto" id="urubuto" />
                        <Label htmlFor="urubuto" className="flex items-center gap-2 cursor-pointer flex-1">
                          <CreditCard className="h-5 w-5 text-violet-700" />
                          <div>
                            <div className="font-medium flex items-center gap-2 flex-wrap">
                              UrubutoPay
                              {/*
                              {urubutoPreview && !urubutoEligibleBySeller[selectedSeller] && (
                                <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-800">
                                  UI preview
                                </Badge>
                              )}
                              */}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              MoMo wallet or card via Urubuto — payment goes to this shop
                            </div>
                          </div>
                        </Label>
                      </div>
                    )}

                    <div
                      className={`flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-accent ${!hasUssdTarget ? 'opacity-50' : ''}`}
                      onClick={() => hasUssdTarget && setPaymentMethod("momo")}
                    >
                      <RadioGroupItem value="momo" id="momo" disabled={!hasUssdTarget} />
                      <Label htmlFor="momo" className={`flex items-center gap-2 flex-1 ${hasUssdTarget ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                        <Wallet className="h-5 w-5 text-yellow-600" />
                        <div>
                          <div className="font-medium">MTN Mobile Money</div>
                          <div className="text-sm text-muted-foreground">
                            {hasUssdTarget ? 'Pay instantly with MTN MoMo' : 'Not available for this seller'}
                          </div>
                        </div>
                      </Label>
                    </div>

                    <div
                      className={`flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-accent ${!hasUssdTarget ? 'opacity-50' : ''}`}
                      onClick={() => hasUssdTarget && setPaymentMethod("airtel")}
                    >
                      <RadioGroupItem value="airtel" id="airtel" disabled={!hasUssdTarget} />
                      <Label htmlFor="airtel" className={`flex items-center gap-2 flex-1 ${hasUssdTarget ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                        <Wallet className="h-5 w-5 text-red-600" />
                        <div>
                          <div className="font-medium">Airtel Money</div>
                          <div className="text-sm text-muted-foreground">
                            {hasUssdTarget ? 'Pay with Airtel Money' : 'Not available for this seller'}
                          </div>
                        </div>
                      </Label>
                    </div>

                    <div className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-accent" onClick={() => setPaymentMethod("cod")}>
                      <RadioGroupItem value="cod" id="cod" />
                      <Label htmlFor="cod" className="flex items-center gap-2 cursor-pointer flex-1">
                        <Truck className="h-5 w-5 text-blue-600" />
                        <div>
                          <div className="font-medium">
                            {isInTableCommand() ? "Pay at Table" : "Cash on Delivery"}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {isInTableCommand() ? "Pay when order arrives at your table" : "Pay when you receive your order"}
                          </div>
                        </div>
                      </Label>
                    </div>
                  </>
                )
              })()}
            </div>
          </RadioGroup>

          </div>

          <DialogFooter className="flex-shrink-0 gap-2 border-t bg-background px-6 py-4">
            <Button variant="outline" onClick={() => setPaymentMethodOpen(false)}>Cancel</Button>
            <Button onClick={proceedWithPayment}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* COD dialog */}
      <Dialog open={codOpen} onOpenChange={setCodOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {(() => {
                const g = codForSeller ? groups.find(x => x.supplierId === codForSeller) : null
                const isPangolins = g?.supplierName?.toUpperCase().includes("PANGOLIN")
                return isPangolins ? "Confirm Order" : "Review Order & Delivery Details"
              })()}
            </DialogTitle>
            <DialogDescription>
              {(() => {
                const g = codForSeller ? groups.find(x => x.supplierId === codForSeller) : null
                const isPangolins = g?.supplierName?.toUpperCase().includes("PANGOLIN")
                return isPangolins
                  ? "Review your order details and confirm."
                  : "Review your order and provide delivery details. Pay when you receive your order."
              })()}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Customer Information */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground">CUSTOMER INFORMATION</h4>
              {checkoutMode === "anonymous" && (
                <>
                  <div className="flex justify-between text-sm gap-2">
                    <span className="text-muted-foreground shrink-0">Name:</span>
                    <span className="font-medium text-right">
                      {isInTableCommand() ? anonymousName || "—" : "Guest"}
                    </span>
                  </div>
                  {!isInTableCommand() && codForSeller && (() => {
                    const g = groups.find((x) => x.supplierId === codForSeller)
                    const tel = g ? getSellerContactLine(g) : ""
                    return (
                      <>
                        <div className="flex justify-between text-sm gap-2">
                          <span className="text-muted-foreground shrink-0">Seller phone:</span>
                          <span className="font-medium text-right break-all">{tel || "—"}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Use this number to track your order.
                        </p>
                      </>
                    )
                  })()}
                  {isInTableCommand() && (
                    <div className="flex justify-between text-sm gap-2">
                      <span className="text-muted-foreground shrink-0">Phone:</span>
                      <span className="font-medium text-right break-all">{anonymousPhone || "—"}</span>
                    </div>
                  )}
                </>
              )}
              {isAuthenticated && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Name:</span>
                    <span className="font-medium">{user?.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Phone:</span>
                    <span className="font-medium">{user?.phone}</span>
                  </div>
                </>
              )}
              {isInTableCommand() && activeSession && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Table:</span>
                  <span className="font-medium font-mono">{activeSession.tableName}</span>
                </div>
              )}
            </div>

            {/* Order Items - ALWAYS SHOW FOR ALL SELLERS */}
            {codForSeller && (() => {
              const g = groups.find(x => x.supplierId === codForSeller)
              if (!g) return null

              return (
                <div className="border rounded-lg">
                  <div className="bg-slate-50 border-b p-3">
                    <h4 className="font-medium text-sm">ORDER ITEMS</h4>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {g.items.map((item, index) => {
                      const unitLine = itemEmballageDisplaySuffix(
                        item.itemEmballage ?? item.unit ?? item.selectedUnit,
                      )
                      return (
                      <div key={index} className="flex justify-between items-center p-3 border-b last:border-b-0">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{item.name}</div>
                          {unitLine && (
                            <div className="text-xs text-muted-foreground">Unit: {unitLine}</div>
                          )}
                          {(() => {
                            const erx = (item as CartItem).erx ?? parseErxFromNotes(item.notes ?? undefined)
                            if (!erx) return null
                            return (
                              <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                                <div className="font-medium text-foreground">Prescription</div>
                                <div>Measurement: {erx.measurement} · Every: {erx.every}</div>
                                {erx.toBeTakenDays ? <div>Duration (days): {erx.toBeTakenDays}</div> : null}
                                {erx.quantityOnce ? <div>Qty (once): {erx.quantityOnce}</div> : null}
                                <div>Route: {erx.route} · Refill: {erx.refill}</div>
                                {erx.instructionNotes ? <div>Instructions: {erx.instructionNotes}</div> : null}
                              </div>
                            )
                          })()}
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-sm text-muted-foreground">
                            {item.qty} × {item.price?.toLocaleString()} {CUR}
                          </div>
                          <div className="font-medium text-sm w-20 text-right">
                            {((item.price || 0) * (item.qty || 0)).toLocaleString()} {CUR}
                          </div>
                        </div>
                      </div>
                      )
                    })}
                  </div>
                  <div className="bg-slate-50 border-t p-3">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Total:</span>
                      <span className="font-bold text-lg">{g.subtotal.toLocaleString()} {CUR}</span>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Delivery location - only for non-Pangolins AND non-table-command orders */}
            {(() => {
              const g = codForSeller ? groups.find(x => x.supplierId === codForSeller) : null
              const isPangolins = g?.supplierName?.toUpperCase().includes("PANGOLIN")

              // Show delivery location for non-Pangolins AND when not in table command mode
              if (!isPangolins && !isInTableCommand()) {
                return (
                  <div className="space-y-3">
                    {savedAddresses.length > 0 && (
                      <div className="space-y-1">
                        <label className="text-sm font-medium flex items-center gap-1">
                          <MapPin className="h-4 w-4" /> Saved addresses
                        </label>
                        <Select
                          value=""
                          onValueChange={(id) => {
                            const addr = savedAddresses.find((a) => a.id === id)
                            if (addr) {
                              setDeliveryLocation(addr.address)
                              if (addr.phone) setContactPhone(addr.phone)
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a saved address" />
                          </SelectTrigger>
                          <SelectContent>
                            {savedAddresses.map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.label} — {a.address}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Delivery location *</label>
                      <Input
                        value={deliveryLocation}
                        onChange={(e) => setDeliveryLocation(e.target.value)}
                        placeholder="e.g., Kigali, Kacyiru, Plot 12"
                        className={tableInfo?.customerAddress ? "bg-muted" : ""}
                      />
                      {tableInfo?.customerAddress && (
                        <p className="text-xs text-muted-foreground">
                          Pre-filled from shop information
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">
                        {checkoutMode === "anonymous" ? "Delivery contact phone (optional)" : "Contact phone"}
                      </label>
                      <Input
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        placeholder="+2507…"
                      />
                      {checkoutMode === "anonymous" && (
                        <p className="text-xs text-muted-foreground">
                          So the rider can reach you. Tracking stays on the seller number above.
                        </p>
                      )}
                    </div>
                    {deliveryLocation.trim() && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const label = `Address ${savedAddresses.length + 1}`
                          setSavedAddresses(saveAddress({ label, address: deliveryLocation.trim(), phone: contactPhone.trim() || undefined }))
                        }}
                      >
                        <MapPin className="h-4 w-4 mr-1" /> Save this address
                      </Button>
                    )}
                  </div>
                )
              }
            })()}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCodOpen(false)}>Cancel</Button>
            <Button
              onClick={submitCOD}
              disabled={(() => {
                const g = codForSeller ? groups.find(x => x.supplierId === codForSeller) : null
                const isPangolins = g?.supplierName?.toUpperCase().includes("PANGOLIN")
                // Require delivery location only for non-Pangolins AND when not in table command
                return !isPangolins && !isInTableCommand() && !deliveryLocation
              })()}
            >
              <Truck className="h-4 w-4 mr-2" />
              Place order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* UrubutoPay checkout dialog */}
      <Dialog
        open={urubutoOpen}
        onOpenChange={(open) => {
          setUrubutoOpen(open)
          if (!open) resetUrubutoDialog()
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pay with UrubutoPay</DialogTitle>
            <DialogDescription>
              {urubutoChannel === "card"
                ? "You will open a secure card page to complete payment for this shop."
                : "Approve the MoMo prompt on your phone. Payment is collected for the seller via their Urubuto merchant account."}
            </DialogDescription>
          </DialogHeader>
          {urubutoForSeller && (() => {
            const g = groups.find((x) => x.supplierId === urubutoForSeller)
            if (!g) return null
            const normalizedPhone = normalizeUrubutoPhone(urubutoPhone)
            return (
              <div className="space-y-4">
                <div className="rounded-lg border border-violet-200 bg-violet-50/80 p-3 text-sm">
                  <p className="font-medium text-violet-950">{g.supplierName}</p>
                  <p className="text-muted-foreground mt-1">
                    Amount: <strong>{g.subtotal.toLocaleString()} RWF</strong>
                  </p>
                </div>
                <RadioGroup
                  value={urubutoChannel}
                  onValueChange={(v) => {
                    setUrubutoChannel(v as "wallet" | "card")
                    setUrubutoCardUrl(null)
                  }}
                  className="grid grid-cols-2 gap-2"
                >
                  <div
                    className={`flex items-center gap-2 rounded-lg border p-3 cursor-pointer ${urubutoChannel === "wallet" ? "border-violet-500 bg-violet-50" : "border-border"}`}
                    onClick={() => setUrubutoChannel("wallet")}
                  >
                    <RadioGroupItem value="wallet" id="urubuto-wallet" />
                    <Label htmlFor="urubuto-wallet" className="cursor-pointer flex items-center gap-1.5 text-sm font-medium">
                      <Wallet className="h-4 w-4 text-yellow-600" />
                      MoMo wallet
                    </Label>
                  </div>
                  <div
                    className={`flex items-center gap-2 rounded-lg border p-3 cursor-pointer ${urubutoChannel === "card" ? "border-violet-500 bg-violet-50" : "border-border"}`}
                    onClick={() => setUrubutoChannel("card")}
                  >
                    <RadioGroupItem value="card" id="urubuto-card-channel" />
                    <Label htmlFor="urubuto-card-channel" className="cursor-pointer flex items-center gap-1.5 text-sm font-medium">
                      <CreditCard className="h-4 w-4 text-blue-600" />
                      Card
                    </Label>
                  </div>
                </RadioGroup>
                {urubutoChannel === "wallet" ? (
                  <div className="space-y-2">
                    <Label htmlFor="urubuto-phone">Your MoMo number</Label>
                    <Input
                      id="urubuto-phone"
                      value={urubutoPhone}
                      onChange={(e) => setUrubutoPhone(e.target.value)}
                      onBlur={() => {
                        const normalized = normalizeUrubutoPhone(urubutoPhone)
                        if (normalized) setUrubutoPhone(normalized)
                      }}
                      placeholder="0788123456 or +250788123456"
                      inputMode="tel"
                    />
                    <p className="text-xs text-muted-foreground">
                      {urubutoPhoneHint()}. We will format it as 2507… for UrubutoPay.
                      {normalizedPhone && normalizedPhone !== urubutoPhone.replace(/\s/g, "") ? (
                        <span className="block text-violet-700">Will send to: {normalizedPhone}</span>
                      ) : null}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-blue-200 bg-blue-50/80 p-3 text-sm text-blue-900 space-y-2">
                      <p className="font-medium flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        Secure card payment
                      </p>
                      <p className="text-blue-800/90 text-xs leading-relaxed">
                        After you continue, a new tab opens for Urubuto&apos;s card checkout. Complete payment there, then return here — your order is placed automatically.
                      </p>
                      <div className="rounded-md border border-blue-200 bg-white px-3 py-2 text-xs text-slate-600">
                        Card type: BK Arena prepaid card (Urubuto secure checkout)
                      </div>
                    </div>
                    {urubutoCardUrl && (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full border-blue-300 text-blue-800"
                        onClick={() => window.open(urubutoCardUrl, "_blank", "noopener,noreferrer")}
                      >
                        Open card payment page again
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )
          })()}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setUrubutoOpen(false); resetUrubutoDialog() }}>
              Cancel
            </Button>
            <Button
              className="bg-violet-700 hover:bg-violet-800"
              onClick={() => void confirmUrubutoPayment()}
              disabled={busy === urubutoForSeller}
            >
              {busy === urubutoForSeller
                ? "Processing…"
                : urubutoChannel === "card"
                  ? "Continue to card payment"
                  : "Send payment request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MoMo payment dialog */}
      <Dialog
        open={momoOpen}
        onOpenChange={(open) => {
          setMomoOpen(open)
          if (!open) {
            setMomoForSeller(null)
            setMomoAwaitingProof(false)
            setMomoProofDraft("")
          }
        }}
      >
        <DialogContent className="max-w-md max-h-[min(90vh,720px)] flex flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>
              {momoPaymentProvider === "airtel" ? "Pay with Airtel Money" : "Pay with MTN Mobile Money"}
            </DialogTitle>
            <DialogDescription>Complete payment to confirm your order</DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4">
            {momoForSeller && (() => {
              const g = groups.find(x => x.supplierId === momoForSeller)
              if (!g) return null

              const momoTarget = getMomoForGroup(g)
              const hasUssdTarget = momoTarget.length > 0
              const payload = buildMoMoUssd(momoTarget, g.subtotal)
              const telHref = `tel:${encodeURIComponent(payload)}`
              const sellerLine = getSellerContactLine(g)

              return (
                <div className="space-y-4">
                  <div className="rounded-xl bg-gradient-to-br from-amber-50 to-yellow-50/80 border border-amber-200/90 p-4 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-muted-foreground">Amount to pay</span>
                      <span className="font-bold text-lg tabular-nums">{g.subtotal.toLocaleString()} RWF</span>
                    </div>
                    <div className="flex items-start justify-between gap-2 text-sm">
                      <span className="text-muted-foreground shrink-0">Seller</span>
                      <span className="font-semibold text-right leading-snug">{g.supplierName}</span>
                    </div>
                    <div className="rounded-lg border border-amber-100 bg-white/70 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-900/70">Seller phone (tracking)</p>
                      <p className="font-mono text-sm font-semibold text-slate-900 break-all">
                        {sellerLine || "—"}
                      </p>
                      {checkoutMode === "anonymous" && !isInTableCommand() && (
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                          Guest checkout: use this number to follow up or track your order with the seller.
                        </p>
                      )}
                    </div>
                  </div>

                  {hasUssdTarget && (
                    <>
                      <div className="text-center space-y-2">
                        <p className="text-sm font-medium">Scan QR code with your phone camera</p>
                        <div className="bg-white p-4 rounded-xl inline-block border-2 shadow-inner">
                          <QRCode value={payload} size={200} />
                        </div>
                        <p className="text-xs font-semibold text-slate-800">USSD code (dial on your phone):</p>
                        <p className="font-mono text-sm bg-white border rounded-lg px-2 py-1.5 break-all select-all" title="Copy or dial">
                          {payload}
                        </p>
                        <p className="text-xs text-muted-foreground">Or tap &quot;Dial now&quot; below to open your dialer with this code.</p>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(momoTarget)
                              alert(`Copied: ${momoTarget}`)
                            } catch {}
                          }}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copy number
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1"
                          asChild
                        >
                          <a href={telHref}>
                            <PhoneCall className="h-4 w-4 mr-2" />
                            Dial now
                          </a>
                        </Button>
                      </div>
                    </>
                  )}

                  {!hasUssdTarget && (
                    <div className="text-center p-6 bg-muted/80 rounded-xl border border-dashed">
                      <p className="text-sm text-muted-foreground">
                        No MoMo code available for this seller. Please contact them using the seller phone above.
                      </p>
                    </div>
                  )}

                  <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                    <p className="text-xs text-blue-950 leading-relaxed">
                      <strong>Note:</strong>{" "}
                      {momoAwaitingProof
                        ? "Enter the transaction reference from your MoMo SMS or receipt, then place your order."
                        : "After you pay, tap “I’ve paid” and enter your proof of payment so we can match it to your order."}
                    </p>
                  </div>

                  {momoAwaitingProof && (
                    <div className="rounded-xl border-2 border-emerald-200/90 bg-gradient-to-b from-emerald-50/90 to-white p-4 space-y-2 shadow-sm ring-1 ring-emerald-100/80">
                      <Label htmlFor="momo-proof" className="text-sm font-semibold text-emerald-950">
                        Proof of payment
                      </Label>
                      <Textarea
                        id="momo-proof"
                        value={momoProofDraft}
                        onChange={(e) => setMomoProofDraft(e.target.value)}
                        placeholder="e.g. MTN transaction ID, reference, or receipt number"
                        rows={3}
                        className="resize-none font-mono text-sm min-h-[88px] border-emerald-200 focus-visible:ring-emerald-500"
                      />
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        This reference is stored with your order so the seller can verify your MoMo transfer.
                      </p>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>

          <DialogFooter className="flex-shrink-0 gap-2 border-t bg-background px-6 py-4 flex flex-row flex-wrap items-center justify-end">
            {momoAwaitingProof && (
              <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground mr-auto"
                onClick={() => {
                  setMomoAwaitingProof(false)
                  setMomoProofDraft("")
                }}
              >
                Back
              </Button>
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setMomoOpen(false)
                  setMomoForSeller(null)
                  setMomoAwaitingProof(false)
                  setMomoProofDraft("")
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={confirmMoMoPayment}
                disabled={busy === momoForSeller}
                className="bg-green-600 hover:bg-green-700 min-w-[8.5rem]"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {busy === momoForSeller
                  ? "Processing…"
                  : momoAwaitingProof
                    ? "Place order"
                    : "I’ve paid"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Table Command Dialog */}
      {tableCommandSeller && (
        <TableCommandDialog
          open={tableCommandDialogOpen}
          onOpenChange={(open) => {
            setTableCommandDialogOpen(open)
            // If dialog closed after creating/joining table, proceed to payment method
            if (!open && isInTableCommand() && tableCommandSeller) {
              const g = groups.find(x => x.supplierId === tableCommandSeller.id)
              if (g) {
                const hasUssdTarget = Boolean(getMomoForGroup(g))
                setSelectedSeller(tableCommandSeller.id)
                setPaymentMethod(hasUssdTarget ? "momo" : "cod")
                setPaymentMethodOpen(true)
              }
            }
          }}
          onIndividualOrder={() => {
            // User chose individual ordering -> immediately leave any active table session.
            if (isInTableCommand()) {
              leaveTableCommand()
              toast({
                title: "Table session ended",
                description: "You are now ordering as an individual user.",
                duration: 1800,
              })
            }
            // User chose individual ordering - proceed with regular checkout flow
            if (tableCommandSeller) {
              const g = groups.find(x => x.supplierId === tableCommandSeller.id)
              if (g) {
                const hasUssdTarget = Boolean(getMomoForGroup(g))
                setSelectedSeller(tableCommandSeller.id)
                setPaymentMethod(hasUssdTarget ? "momo" : "cod")
                setPaymentMethodOpen(true)
              }
            }
          }}
          locationId={tableCommandSeller.id}
          locationName={tableCommandSeller.name}
          initialTableName={(tableInfo?.customerAddress || tableInfo?.tableNumber || "").trim()}
          initialUserName={(tableInfo?.customerName || "").trim()}
        />
      )}

      {/* Table Command Share Modal */}
      <TableCommandShareModal
        open={shareModalOpen}
        onOpenChange={setShareModalOpen}
        data={shareModalData}
      />

      {/* Close Table Dialog */}
      <AlertDialog open={showCloseTableDialog} onOpenChange={setShowCloseTableDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-orange-600" />
              Close Table Command?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Table &quot;{activeSession?.tableName}&quot; — closing merges and finalizes all orders.
              <div className="mt-3 space-y-2">
                <p className="font-medium text-foreground">Do you want to close this table?</p>
                <ul className="text-sm space-y-1 ml-4 list-disc">
                  <li><strong>Close Table:</strong> No one can add more items. All orders are merged and the table is finished.</li>
                  <li><strong>Keep Open:</strong> You or others can still add items and send another order.</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Open</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                closeTableCommand()
                setShowCloseTableDialog(false)
              }}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Close Table
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
  return renderContent()
}