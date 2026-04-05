// app/(wherever)/CartSummary.tsx
"use client"

import dynamic from "next/dynamic"
import { useMemo, useState, useEffect, useRef } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuthStore } from "@/lib/auth-store"
import { useCartStore, type CartItem, type SellerGroup } from "@/lib/cart-store"
import { trackClick } from "@/lib/interaction-tracker"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { formatPaymentMethod } from "@/lib/payment-utils"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog"
import { Copy, PhoneCall, CheckCircle2, RotateCcw, MessageCircle, Truck, CreditCard, Wallet, Beer, Users, Lock, Tag, MapPin, Link2 } from "lucide-react"
import { isBarOrRestaurant } from "@/lib/constants"
import { useTableCommandStore } from "@/lib/table-command-store"
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
import { resolveMtnMoMoUssd, formatSellerMomoAccountLine } from "@/lib/momo-ussd"
import { parseErxFromNotes } from "@/lib/erx-prescription"

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
  let v = (raw || "").replace(/\s|-/g, "")
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

/** Saved locally for repeat guest buyers (YouTube-style: same device, no account). */
const GUEST_CHECKOUT_STORAGE_KEY = "ihute_guest_checkout_v1"

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
  const pathname = usePathname()
  const { isAuthenticated, user } = useAuthStore()
  const getGroupsBySeller = useCartStore((s) => s.getGroupsBySeller)
  const getGrandTotal    = useCartStore((s) => s.getGrandTotal)
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
  const [paymentMethod, setPaymentMethod] = useState<"momo" | "airtel" | "cod">("momo")

  /** Guest orders: contact only (no account). Logged-in users use profile. */
  const [anonymousPhone, setAnonymousPhone] = useState("")
  const [anonymousName, setAnonymousName] = useState("")
  const [rememberGuestContact, setRememberGuestContact] = useState(true)

  // Table command mode
  const { isInTableCommand, activeSession, lockTableCommand, canCloseTable, closeTableCommand, createTableCommand, updateTableShareData } = useTableCommandStore()

  // Do NOT pre-fill "Your Name" for table orders — table name is already shown in "Table Order - ... - Table X".
  // User must enter their own name so supplier sees who ordered (not the table name as buyer).

  // Pre-fill from tableInfo only when NOT a table order (e.g. delivery from shop-with-me)
  useEffect(() => {
    if (!isAuthenticated && tableInfo && !isInTableCommand()) {
      if (tableInfo.customerName) {
        setAnonymousName((n) => n || String(tableInfo.customerName || "").trim())
      }
      if (tableInfo.customerAddress) {
        setDeliveryLocation((d) => d || String(tableInfo.customerAddress || "").trim())
      }
    }
  }, [isAuthenticated, tableInfo, isInTableCommand])

  // Restore last guest contact on this device (optional; user can clear via checkbox)
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = localStorage.getItem(GUEST_CHECKOUT_STORAGE_KEY)
      if (!raw) return
      const j = JSON.parse(raw) as { name?: string; phone?: string }
      setAnonymousName((prev) => prev || (typeof j.name === "string" ? j.name : ""))
      setAnonymousPhone((prev) => prev || (typeof j.phone === "string" ? j.phone : ""))
    } catch {
      /* ignore */
    }
  }, [])

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
  // Fallback: fetch supplier MoMo from profile when cart items don't have it (e.g. Burrows has momo in account_signup)
  const [supplierMomoFallback, setSupplierMomoFallback] = useState<Record<string, string>>({})
  const [supplierMomoCodeFallback, setSupplierMomoCodeFallback] = useState<Record<string, string>>({})

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

  /**
   * Backend `/api/account/profile?account=` expects Ishyiga account (e.g. `burrows`).
   * Cart lines often carry a display name ("Burrows") or slug instead — map known shops so we still load momo + momoCode.
   */
  const supplierProfileLookupAccount = (g: SellerGroup): string => {
    const explicit = (g.supplierProfileAccount ?? "").trim()
    if (explicit) return explicit
    const sid = (g.supplierId ?? "").trim()
    const sidLower = sid.toLowerCase()
    const name = (g.supplierName ?? "").toLowerCase()
    const looksLikeBurrows =
      name.includes("pangolin") ||
      name.includes("burrows") ||
      sidLower === "burrows" ||
      sidLower === "rs_burrows"
    if (looksLikeBurrows) return "burrows"
    return sid
  }

  // Resolve MoMo for a group: cart line first, but prefer API when cart is masked and profile has a full number
  const getMomoForGroup = (g: SellerGroup) => {
    const fromCart = (g.momo ?? "").trim()
    const fromApi = (supplierMomoFallback[supplierProfileLookupAccount(g)] ?? "").trim()
    if (fromApi && fromCart.includes("*") && !fromApi.includes("*")) return fromApi
    return fromCart || fromApi
  }

  const getMomoCodeForGroup = (g: SellerGroup) =>
    (g.momoCode ?? "").trim() || (supplierMomoCodeFallback[supplierProfileLookupAccount(g)] ?? "").trim()

  const groupHasDialableMtnUssd = (g: SellerGroup) =>
    Boolean(
      resolveMtnMoMoUssd(getMomoForGroup(g), Math.max(1, g.subtotal), getMomoCodeForGroup(g) || null)?.ussd
    )

  const groupHasMoMoPayInfo = (g: SellerGroup) =>
    Boolean(getMomoForGroup(g) || getMomoCodeForGroup(g))

  // Fetch supplier profile once per account (momo + optional MoMo Pay merchant code)
  const requestedMomoRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    groups.forEach((g) => {
      const account = supplierProfileLookupAccount(g)
      if (!account) return
      if (requestedMomoRef.current.has(account)) return
      requestedMomoRef.current.add(account)
      fetch(`/api/account/profile?account=${encodeURIComponent(account)}`)
        .then((res) => res.json())
        .then((data) => {
          if (!data?.ok || !data?.profile) return
          const momo = data.profile.momo ? String(data.profile.momo).trim() : ""
          const momoCode = data.profile.momoCode ? String(data.profile.momoCode).trim() : ""
          if (momo) setSupplierMomoFallback((prev) => ({ ...prev, [account]: momo }))
          if (momoCode) setSupplierMomoCodeFallback((prev) => ({ ...prev, [account]: momoCode }))
        })
        .catch(() => {})
    })
  }, [groups])
  const discountPercent = appliedPromo?.percent ?? 0
  const discountAmount = Math.round((grandTotal * discountPercent) / 100)
  const totalAfterDiscount = grandTotal - discountAmount
  const myPhone = !isAuthenticated ? anonymousPhone : (user?.phone || "")

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
      const hasMoMoInfo = groupHasMoMoPayInfo(g)
      const isPaid = getPaymentStatus(g.supplierId) === "paid"
      const message = buildWhatsAppMessageStyled({
        shop: g.supplierName,
        location: g.supplierLocation,
        orderId,
        items,
        total: g.subtotal,
        discount: 0,
        paid: isPaid ? g.subtotal : 0,
        paidAt: isPaid ? "MTN MoMo" : (hasMoMoInfo ? "Pending (MoMo)" : "Pay on delivery"),
        reference: orderId ? `ORDER ${orderId}` : undefined,
        myPhone,
        link: orderId ? `${(process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_API_URL || "https://ihute.rw").replace(/\/Trading\/?$/, "")}/orders/${orderId}` : undefined,
      })
      const href = phone ? waHrefFor(phone, message) : ""
      return { supplierId: g.supplierId, phone, message, href }
    })
  }, [groups, orderIds, orderPhones, myPhone, getPaymentStatus, supplierMomoFallback, supplierMomoCodeFallback])

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
    const hasDialableMomo = groupHasDialableMtnUssd(g)
    setSelectedSeller(supplierId)
    // Default to momo only when we can build a valid USSD string
    setPaymentMethod(hasDialableMomo ? "momo" : "cod")
    setPaymentMethodOpen(true)
  }

  // Handle payment method selection
  const proceedWithPayment = async () => {
    if (!selectedSeller) return

    // Guest checkout: only need contact for the seller (not a full "account")
    if (!isAuthenticated) {
      if (!anonymousName.trim() || !anonymousPhone.trim()) {
        alert("Add your name and mobile number so the shop can reach you about this order.")
        return
      }
      if (rememberGuestContact) {
        try {
          localStorage.setItem(
            GUEST_CHECKOUT_STORAGE_KEY,
            JSON.stringify({ name: anonymousName.trim(), phone: anonymousPhone.trim() })
          )
        } catch {
          /* ignore quota */
        }
      } else {
        try {
          localStorage.removeItem(GUEST_CHECKOUT_STORAGE_KEY)
        } catch {
          /* ignore */
        }
      }
    }

    if (paymentMethod === "cod") {
      setPaymentMethodOpen(false)
      setCodForSeller(selectedSeller)
      setDeliveryLocation(!isAuthenticated ? (tableInfo?.customerAddress || "") : user?.location || "")
      setContactPhone(!isAuthenticated ? anonymousPhone : user?.phone || "")
      setCodOpen(true)
      setSelectedSeller(null)
    } else {
      setPaymentMethodOpen(false)
      setMomoForSeller(selectedSeller)
      setMomoPaymentProvider(paymentMethod === "airtel" ? "airtel" : "mtn")
      setMomoOpen(true)
      setSelectedSeller(null)
    }
  }

  // Unified order creator for MoMo & COD
  const placeOrder = async (
    g: ReturnType<typeof getGroupsBySeller>[number],
    opts: {
      paymentName: "PAID_MTN_MOMO" | "PAID_AIRTEL_MOMO" | "PAY_ON_DELIVERY";
      buyerPhone?: string;
      buyerLocation?: string;
      reference?: string;
      paymentId?: string;
    }
  ) => {
    try {
      setBusy(g.supplierId)
      setPaymentStatus(g.supplierId, "pending")

      const items = g.items.map(it => ({
        name: it.name,
        qty: it.qty,
        unitPrice: it.price,
        unit: it.unit ?? "",
        itemCode: it.itemCode ?? it.id,
        notes: it.notes ?? "",
      }))

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
        ? (!isAuthenticated ? (anonymousName?.trim() || "Guest") : (user?.name || "Guest"))
        : (tableInfo?.customerName && String(tableInfo.customerName).trim()) ||
          (!isAuthenticated ? anonymousName : null) ||
          (isOrderingFromOwnShop ? (tableInfo?.customerName || anonymousName || "Guest") : user?.name) ||
          anonymousName ||
          user?.name ||
          "Guest";

      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerEmail: !isAuthenticated ? `guest_${Date.now()}@ihute.rw` : user?.email,
          buyerPhone: opts.buyerPhone || (!isAuthenticated ? anonymousPhone : user?.phone || ""),
          buyerLocation: opts.buyerLocation || (!isAuthenticated ? deliveryLocation : user?.location || "NA"),
          buyerName: String(resolvedBuyerName || "").trim() || "Guest",
          sellerAccount: g.supplierId,
          sellerName: g.supplierName,
          sellerPhone: g.phone || "",
          paymentName: opts.paymentName,
          paymentId: paymentId,
          reference: opts.reference || "",
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
              !isAuthenticated ? anonymousName : user?.name || "Guest",
              !isAuthenticated ? `guest_${Date.now()}@ihute.rw` : user?.email || "",
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
          clear()
          return
        }

        if ((opts.paymentName === "PAID_MTN_MOMO" || opts.paymentName === "PAID_AIRTEL_MOMO") && orderId) {
          pollPayment(orderId, g.supplierId)
        }

        // Lock table command if in table mode: clear cart but stay on page so user can add more items
        if (isInTableCommand() && activeSession?.isCreator) {
          clear()
          alert(`Order #${orderId} added to table "${activeSession.tableName}". Add more items or send the complete table order.`)
          return
        }

        // Clear cart (but table session persists in its own store)
        clear()

        // Redirect to order success page with WhatsApp details
        if (orderId) {
          const params = new URLSearchParams({
            orderId,
            sellerName: g.supplierName,
            sellerPhone: sellerTel || "",
            buyerPhone: !isAuthenticated ? anonymousPhone : (user?.phone || ""),
            total: String(g.subtotal),
            paymentMethod: opts.paymentName
          })
          router.push(`/order-success?${params.toString()}`)
        } else if (isAuthenticated) {
          router.push("/orders")
        } else {
          router.push("/")
        }
        router.refresh()
      } else {
        setPaymentStatus(g.supplierId, "failed")
        const baseMsg = json?.error || "Unknown error"
        const extra: string[] = []
        if (json?.hint && typeof json.hint === "string") extra.push(json.hint)
        if (json?.last?.raw) {
          const raw = String(json.last.raw).trim()
          if (raw) extra.push(raw.length > 320 ? `${raw.slice(0, 320)}…` : raw)
        }
        if (json?.details && typeof json.details === "object") {
          const d = json.details as Record<string, unknown>
          const inner =
            (typeof d.error === "string" && d.error) ||
            (typeof d.message === "string" && d.message) ||
            ""
          if (inner && inner !== baseMsg) extra.push(inner)
        }
        if (process.env.NODE_ENV === "development" && json?.ordersUrl) {
          extra.push(`(dev) ordersUrl: ${json.ordersUrl}`)
        }
        alert(extra.length ? `${baseMsg}\n\n${extra.join("\n\n")}` : `Failed to create order: ${baseMsg}`)
      }
    } catch (error) {
      console.error("Order creation error:", error)
      setPaymentStatus(g.supplierId, "failed")
      alert("Failed to create order. Please try again.")
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
      paymentId: `COD_${Date.now()}`
    })

    setCodOpen(false)
    setCodForSeller(null)
  }

  const confirmMoMoPayment = async () => {
    if (!momoForSeller) return
    const g = groups.find(x => x.supplierId === momoForSeller)
    if (!g) { setMomoOpen(false); return }
    await placeOrder(g, {
      paymentName: momoPaymentProvider === "airtel" ? "PAID_AIRTEL_MOMO" : "PAID_MTN_MOMO",
      reference: `MOMO_${Date.now()}`,
      paymentId: `MOMO_${Date.now()}`
    })
    setMomoOpen(false)
    setMomoForSeller(null)
  }

  const renderContent = () => (
    <div className="cart-summary-root">
      <div className="space-y-4">
        {groups.map((g) => {
          const status = getPaymentStatus(g.supplierId)
          const wa = sellerWhatsData.find(x => x.supplierId === g.supplierId)

          const momoPayLine = formatSellerMomoAccountLine(
            getMomoForGroup(g),
            getMomoCodeForGroup(g) || null
          )
          const unmark = () => setPaymentStatus(g.supplierId, "unpaid")

          return (
            <Card key={g.supplierId} className="border-2">
              <CardHeader className="pb-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base">
                    {g.supplierName}
                    {g.supplierLocation ? (
                      <span className="text-muted-foreground font-normal block sm:inline"> — {g.supplierLocation}</span>
                    ) : null}
                  </CardTitle>
                  {momoPayLine !== "—" ? (
                    <p className="text-sm text-muted-foreground mt-1">{momoPayLine}</p>
                  ) : null}
                </div>
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
                <div className="flex items-center justify-between text-sm">
                  <span>Items</span>
                  <span className="font-medium">{g.items.reduce((n, it) => n + it.qty, 0)} pcs</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Subtotal</span>
                  <span className="font-semibold">{g.subtotal.toLocaleString()} RWF</span>
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
                  disabled={busy === g.supplierId || status === "paid"}
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  {status === "paid" ? "Order Placed" : "Proceed to Checkout"}
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
              <div className="text-lg font-bold">{totalAfterDiscount.toLocaleString()} RWF</div>
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
            <DialogTitle>{!isAuthenticated ? "Pay as guest" : "Choose payment method"}</DialogTitle>
            <DialogDescription>
              {!isAuthenticated
                ? "No account needed. Add how the shop can reach you, then pick how you pay."
                : "Select how you'd like to pay for this order."}
            </DialogDescription>
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

          {/* Guest contact — framed as “reach you for this order”, not “create username” */}
          {!isAuthenticated && (
            <div className="space-y-3 rounded-xl border border-border bg-muted/35 p-4 pb-4">
              <div className="flex items-start gap-3">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-background text-base font-bold text-primary shadow-sm"
                  aria-hidden
                >
                  G
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-semibold leading-tight">Guest checkout</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    You are not signing in. The seller only needs a name and mobile number for this order (updates
                    on WhatsApp or phone). This is not a username or password.
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="guest-order-name" className="text-xs font-medium text-muted-foreground">
                    Name on the order
                  </Label>
                  <Input
                    id="guest-order-name"
                    autoComplete="name"
                    value={anonymousName}
                    onChange={(e) => setAnonymousName(e.target.value)}
                    placeholder={isInTableCommand() ? "Who is ordering (e.g. John)" : "Shown to the shop"}
                    className={!isInTableCommand() && tableInfo?.customerName ? "bg-muted/80" : ""}
                  />
                  {isInTableCommand() ? (
                    <p className="text-[11px] leading-snug text-muted-foreground">
                      So the kitchen sees who ordered; the table name is already included above.
                    </p>
                  ) : tableInfo?.customerName ? (
                    <p className="text-[11px] text-muted-foreground">Pre-filled from the shop link where possible.</p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="guest-order-phone" className="text-xs font-medium text-muted-foreground">
                    WhatsApp / mobile
                  </Label>
                  <Input
                    id="guest-order-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={anonymousPhone}
                    onChange={(e) => setAnonymousPhone(e.target.value)}
                    placeholder="+250 7XX XXX XXX"
                  />
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    For this delivery only — not a login.
                  </p>
                </div>
              </div>
              <label className="flex cursor-pointer items-start gap-2.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={rememberGuestContact}
                  onChange={(e) => setRememberGuestContact(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-primary"
                />
                <span>Remember name and number on this device for next time (stored only in your browser).</span>
              </label>
              <button
                type="button"
                className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                onClick={() => {
                  setPaymentMethodOpen(false)
                  const next = pathname && pathname.startsWith("/") ? pathname : "/cart"
                  router.push(`/login?redirect=${encodeURIComponent(next)}`)
                }}
              >
                Use my Ihute account instead
              </button>
            </div>
          )}

          {/* Payment method selection */}
          <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as "momo" | "airtel" | "cod")}>
            <div className="space-y-3">
              {selectedSeller && (() => {
                const g = groups.find(x => x.supplierId === selectedSeller)
                const hasDialableMomo = g ? groupHasDialableMtnUssd(g) : false

                return (
                  <>
                    <div
                      className={`flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-accent ${!hasDialableMomo ? 'opacity-50' : ''}`}
                      onClick={() => hasDialableMomo && setPaymentMethod("momo")}
                    >
                      <RadioGroupItem value="momo" id="momo" disabled={!hasDialableMomo} />
                      <Label htmlFor="momo" className={`flex items-center gap-2 flex-1 ${hasDialableMomo ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                        <Wallet className="h-5 w-5 text-yellow-600" />
                        <div className="min-w-0">
                          <div className="font-medium">MTN Mobile Money</div>
                          <div className="text-sm text-muted-foreground">
                            {hasDialableMomo ? "Pay instantly with MTN MoMo" : "USSD dial not available — use cash on delivery or contact the shop"}
                          </div>
                          {g && groupHasMoMoPayInfo(g) ? (
                            <div className="text-xs font-medium text-primary mt-1.5 break-all">
                              {formatSellerMomoAccountLine(
                                getMomoForGroup(g),
                                getMomoCodeForGroup(g) || null
                              )}
                            </div>
                          ) : null}
                          {g &&
                          groupHasMoMoPayInfo(g) &&
                          !getMomoCodeForGroup(g) &&
                          (getMomoForGroup(g).includes("*") || /\d\s*[•·.]+\s*\d/.test(getMomoForGroup(g))) ? (
                            <p className="text-[11px] text-amber-900/90 dark:text-amber-100/90 mt-1.5 leading-snug">
                              The shop profile did not return a MoMo Pay merchant code (<span className="font-mono">momoCode</span>) — only a masked number. The UI cannot invent one; it has to come from your Java/API. Use cash on delivery or pay the shop directly until that field is set.
                            </p>
                          ) : null}
                        </div>
                      </Label>
                    </div>

                    <div
                      className={`flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-accent ${!hasDialableMomo ? 'opacity-50' : ''}`}
                      onClick={() => hasDialableMomo && setPaymentMethod("airtel")}
                    >
                      <RadioGroupItem value="airtel" id="airtel" disabled={!hasDialableMomo} />
                      <Label htmlFor="airtel" className={`flex items-center gap-2 flex-1 ${hasDialableMomo ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                        <Wallet className="h-5 w-5 text-red-600" />
                        <div className="min-w-0">
                          <div className="font-medium">Airtel Money</div>
                          <div className="text-sm text-muted-foreground">
                            {hasDialableMomo ? "Pay with Airtel Money" : "Same as MTN — needs a dialable number or code"}
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
              <h4 className="font-medium text-sm text-muted-foreground">CONTACT FOR THIS ORDER</h4>
              {!isAuthenticated && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Name on order:</span>
                    <span className="font-medium">{anonymousName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">WhatsApp / mobile:</span>
                    <span className="font-medium">{anonymousPhone}</span>
                  </div>
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
                    {g.items.map((item, index) => (
                      <div key={index} className="flex justify-between items-center p-3 border-b last:border-b-0">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{item.name}</div>
                          {item.unit && (
                            <div className="text-xs text-muted-foreground">Unit: {item.unit}</div>
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
                    ))}
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
                    {isAuthenticated && (
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Contact phone</label>
                        <Input
                          value={contactPhone}
                          onChange={(e) => setContactPhone(e.target.value)}
                          placeholder="+2507…"
                        />
                      </div>
                    )}
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

      {/* MoMo payment dialog */}
      <Dialog open={momoOpen} onOpenChange={setMomoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {momoPaymentProvider === "airtel" ? "Pay with Airtel Money" : "Pay with MTN Mobile Money"}
            </DialogTitle>
            <DialogDescription>Complete payment to confirm your order</DialogDescription>
          </DialogHeader>

          {momoForSeller && (() => {
            const g = groups.find(x => x.supplierId === momoForSeller)
            if (!g) return null

            const momoTarget = getMomoForGroup(g)
            const momoCode = getMomoCodeForGroup(g) || null
            const resolved = resolveMtnMoMoUssd(momoTarget, g.subtotal, momoCode)
            const payload = resolved?.ussd ?? ""
            const hasUssdTarget = Boolean(payload)
            const telHref = hasUssdTarget ? `tel:${encodeURIComponent(payload)}` : ""
            const copyTarget = resolved?.copyLabel ?? formatSellerMomoAccountLine(momoTarget, momoCode)

            return (
              <div className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Amount to pay:</span>
                    <span className="font-bold text-lg">{g.subtotal.toLocaleString()} RWF</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Seller:</span>
                    <span className="font-medium">{g.supplierName}</span>
                  </div>
                </div>

                {hasUssdTarget && (
                  <>
                    <div className="text-center space-y-2">
                      <p className="text-sm font-medium">Scan QR code with your phone camera</p>
                      <div className="bg-white p-4 rounded-lg inline-block border-2">
                        <QRCode value={payload} size={200} />
                      </div>
                      <p className="text-xs font-semibold text-slate-800">USSD code (dial on your phone):</p>
                      <p className="font-mono text-sm bg-white border rounded px-2 py-1 break-all select-all" title="Copy or dial">
                        {payload}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {resolved?.kind === "merchant" ? "Merchant MoMo Pay (*182*8*1*…)" : "Send to number (*182*1*1*…)"}
                      </p>
                      <p className="text-xs text-muted-foreground">Or tap &quot;Dial now&quot; below to open your dialer with this code.</p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(copyTarget)
                            alert(`Copied: ${copyTarget}`)
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
                  <div className="text-center p-6 bg-muted rounded-lg space-y-2">
                    <p className="text-sm text-muted-foreground">
                      We could not build a dialable USSD string (e.g. masked number only). Use another payment method or pay the shop directly.
                    </p>
                    {copyTarget && copyTarget !== "—" ? (
                      <p className="text-xs font-mono break-all">{copyTarget}</p>
                    ) : null}
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-900">
                    <strong>Note:</strong> After completing the MoMo payment, click "I've Paid" below to confirm your order.
                  </p>
                </div>
              </div>
            )
          })()}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setMomoOpen(false); setMomoForSeller(null) }}>
              Cancel
            </Button>
            <Button
              onClick={confirmMoMoPayment}
              disabled={busy === momoForSeller}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {busy === momoForSeller ? "Processing..." : "I've Paid"}
            </Button>
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
                const hasDialableMomo = groupHasDialableMtnUssd(g)
                setSelectedSeller(tableCommandSeller.id)
                setPaymentMethod(hasDialableMomo ? "momo" : "cod")
                setPaymentMethodOpen(true)
              }
            }
          }}
          onIndividualOrder={() => {
            // User chose individual ordering - proceed with regular checkout flow
            if (tableCommandSeller) {
              const g = groups.find(x => x.supplierId === tableCommandSeller.id)
              if (g) {
                const hasDialableMomo = groupHasDialableMtnUssd(g)
                setSelectedSeller(tableCommandSeller.id)
                setPaymentMethod(hasDialableMomo ? "momo" : "cod")
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