'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import {
  RotateCcw, Package, Calendar, ShoppingCart, AlertCircle,
  CheckCircle, X, Wallet, Truck, Copy, PhoneCall, MessageCircle,
  MapPin, User, Clock, Loader2
} from 'lucide-react';
import { useAuthStore } from "@/lib/auth-store";

const QRCode = dynamic(() => import("react-qr-code"), { ssr: false });

const CUR = "RWF";
//function normalizePhone(raw) {
//  let v = (raw || "").toString().trim().replace(/\s|-/g, "");
//  if (!v) return "";
//
//  // Remove any existing + prefix
//  if (v.startsWith("+")) v = v.substring(1);
//
//  // Handle different formats
//  if (v.startsWith("250")) return v;
//  if (v.startsWith("00250")) return v.slice(2);
//  if (/^0?7\d{8}$/.test(v)) return "250" + v.replace(/^0/, "");
//  if (v.startsWith("258")) return v;
//
//  // Default: assume it's already in correct format
//  return v;
//}
// Normalize phone numbers to international format (Rwanda example)
function normalizePhone(raw) {
  let v = (raw || "").toString().trim().replace(/\s|-/g, "");
  if (!v) return "";
  if (v.startsWith("+")) v = v.substring(1);

  // Rwanda specific formats
  if (/^250\d{9}$/.test(v)) return v;
  if (/^0\d{8}$/.test(v)) return "250" + v.substring(1); // 0783442098 => 250783442098
  if (/^00250\d{9}$/.test(v)) return v.substring(2); // 00250783442098 => 250783442098

  // For MoMo numbers starting with 258 (Mozambique?) keep as is
  if (/^258\d{8,9}$/.test(v)) return v;

  return v; // fallback, assume already correct
}

// Build WhatsApp href
function waHrefFor(phone, text) {
  if (!phone) return "";
  // Phone must be fully numeric, no '+'
  const cleaned = phone.replace(/\D/g, "");
  if (!/^\d+$/.test(cleaned)) return ""; // invalid number
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(text)}`;
}


function formatPhoneDisplay(raw) {
  const normalized = normalizePhone(raw);
  if (!normalized) return "";

  // Convert 250783442098 to 0783442098
  if (normalized.startsWith("250")) {
    return "0" + normalized.substring(3);
  }

  return normalized;
}

function formatMoney(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "0";
  return Number(n).toLocaleString();
}

function formatProductsForMessage(products = []) {
  if (!products || products.length === 0) return "(no items)";
  return products
    .map(p => {
      const qty = p.qty ?? p.quantity ?? 1;
      const unit = Number(p.unit_price ?? p.price ?? 0);
      const lineTotal = qty * unit;
      return `• ${p.name || p.code || 'Item'} (${p.code || '-'})\n  Qty: ${qty} × ${formatMoney(unit)} RWF = ${formatMoney(lineTotal)} RWF`;
    })
    .join("\n");
}

function buildWhatsAppMessage(args) {
  const { shop, orderId, total, paidAt, reference, myPhone, link, products = [], deliveryLocation } = args;
return [
  "Hello! 🔁 Reorder Confirmation",
  "",
  `🏪 Shop: ${shop || "-"}`,
  orderId ? `📦 Original Order: #${orderId}` : "",
  "\n🛒 Items:",
  formatProductsForMessage(products),
  "",
  `💰 Total: ${formatMoney(total)} ${CUR}`,
  `📱 Payment Method: ${paidAt || "-"}`,
  `🔖 Reference: ${reference || "-"}`,
  deliveryLocation ? `📍 Delivery: ${deliveryLocation}` : "",
  "",
  myPhone ? `📞 Buyer: ${myPhone}` : "",
  link ? `🔗 Track order: ${link}` : ""
].filter(Boolean).join("\n");


}

//function waHrefFor(phone, text) {
//  if (!phone) return "";
//  // Phone should already be normalized (no + prefix)
//  const p = phone.replace(/^\+/, "");
//  return `https://wa.me/${p}?text=${encodeURIComponent(text)}`;
//}

function formatDeliveryLocation(loc) {
  if (!loc || loc.includes("null")) return "Not specified";
  return loc.split("#").filter(x => x && x !== "null").join(" - ");
}

/* -------------------------
   Toast Notification Component
   ------------------------- */
function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const colors = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  };

  const Icon = type === 'success' ? CheckCircle : AlertCircle;

  return (
    <div className={`fixed top-4 right-4 z-50 ${colors[type]} border rounded-lg p-4 shadow-lg flex items-start gap-3 max-w-md animate-slide-in`}>
      <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
      <p className="flex-1 text-sm">{message}</p>
      <button onClick={onClose} className="flex-shrink-0">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/* -------------------------
   Order Card Component
   ------------------------- */
function OrderCard({ order, onReorder, isReordering }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-100">
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-bold text-gray-900">
                Order #{order.order_number}
              </h3>
              <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                Completed
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {order.order_time}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {order.products?.length || 0} items
              </span>
            </div>
          </div>

          <button
            onClick={() => onReorder(order)}
            disabled={isReordering}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-colors"
          >
            {isReordering ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            {isReordering ? "Processing..." : "Reorder"}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Seller</p>
            <p className="font-semibold text-gray-900">{order.seller?.name}</p>
            <p className="text-sm text-gray-600 mt-0.5">{order.seller?.phone}</p>
            {order.seller?.momo && order.seller.momo !== "null" && (
              <p className="text-sm text-blue-600 flex items-center gap-1 mt-1">
                <Wallet className="h-3 w-3" />
                MoMo Available
              </p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Delivery</p>
            <p className="font-medium text-gray-900 flex items-start gap-1">
              <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5 text-gray-400" />
              <span>{formatDeliveryLocation(order.delivery?.location)}</span>
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Total Amount</p>
            <p className="font-bold text-2xl text-blue-600">
              {formatMoney(order.total_amount)} <span className="text-lg">RWF</span>
            </p>
          </div>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-left py-2 flex items-center justify-between text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          <span className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            View Items ({order.products?.length || 0})
          </span>
          <span className={`transform transition-transform ${expanded ? 'rotate-180' : ''}`}>▼</span>
        </button>

        {expanded && (
          <div className="mt-3 space-y-2 animate-slide-down">
            {order.products?.map((p, i) => {
              const qty = p.qty ?? p.quantity ?? 1;
              const unit = Number(p.unit_price ?? p.price ?? 0);
              const lineTotal = qty * unit;
              return (
                <div key={`${p.code ?? i}-${i}`} className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{p.name}</p>
                      <p className="text-sm text-gray-600 mt-1">Quantity: {qty}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{formatMoney(unit)} RWF</p>
                      <p className="text-sm text-gray-500 mt-0.5">Total: {formatMoney(lineTotal)} RWF</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------
   Payment Method Dialog
   ------------------------- */
function PaymentMethodDialog({ order, onClose, onContinue }) {
  const [method, setMethod] = useState('cod');
  const sellerHasMomo = order?.seller?.momo && order.seller.momo !== "null";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl animate-scale-in">
        <div className="p-6 border-b border-gray-100">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">Choose Payment Method</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <label
            className={`flex items-start p-5 border-2 rounded-xl transition-all
              ${!sellerHasMomo ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:shadow-md"}
              ${method === "momo" ? "border-blue-600 bg-blue-50 shadow-sm" : "border-gray-200"}`}
          >
            <input
              type="radio"
              name="payment"
              value="momo"
              disabled={!sellerHasMomo}
              checked={method === "momo"}
              onChange={() => setMethod("momo")}
              className="mt-1 accent-blue-600"
            />
            <div className="ml-4 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="h-5 w-5 text-blue-600" />
                <span className="font-semibold text-gray-900">MTN Mobile Money</span>
              </div>
              {sellerHasMomo ? (
                <p className="text-sm text-gray-600">Pay instantly with MoMo - Fast & Secure</p>
              ) : (
                <p className="text-sm text-gray-500">Seller hasn't set up MoMo payments</p>
              )}
            </div>
          </label>

          <label
            className={`flex items-start p-5 border-2 rounded-xl transition-all cursor-pointer hover:shadow-md
              ${method === 'cod' ? 'border-blue-600 bg-blue-50 shadow-sm' : 'border-gray-200'}`}
          >
            <input
              type="radio"
              name="payment"
              value="cod"
              checked={method === "cod"}
              onChange={() => setMethod("cod")}
              className="mt-1 accent-blue-600"
            />
            <div className="ml-4 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Truck className="h-5 w-5 text-blue-600" />
                <span className="font-semibold text-gray-900">Cash on Delivery</span>
              </div>
              <p className="text-sm text-gray-600">Pay when your order arrives</p>
            </div>
          </label>
        </div>

        <div className="p-6 bg-gray-50 rounded-b-2xl flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-100 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onContinue(method)}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------
   COD Dialog
   ------------------------- */
function CODDialog({ order, onClose, onSubmit, isSubmitting, buyerName, whatsAppData }) {
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!deliveryLocation.trim()) {
      setError('Please enter delivery location');
      return;
    }
    onSubmit(deliveryLocation);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 sticky top-0 bg-white">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">Review Order & Delivery</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-gray-50 p-4 border rounded-lg space-y-2">
            <h4 className="text-sm font-medium text-gray-600">CUSTOMER INFORMATION</h4>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Buyer Name:</span>
              <span className="font-medium">{buyerName}</span>
            </div>
            <div className="flex justify-between text-sm">

            </div>
          </div>

          <div className="bg-gray-50 border rounded-lg p-4 space-y-2">
            <h4 className="text-sm font-semibold text-gray-700">ORDER SUMMARY</h4>
            <div className="text-sm flex justify-between">
              <span className="text-gray-600">Items:</span>
              <span className="font-medium">{order.products?.length ?? 0}</span>
            </div>

            <div className="border-t pt-2 space-y-2">
              {order.products?.map((p, i) => {
                const qty = p.qty ?? p.quantity ?? 1;
                const unit = Number(p.unit_price ?? p.price ?? 0);
                const lineTotal = qty * unit;
                return (
                  <div key={i} className="text-sm">
                    <p className="font-medium">{p.name}</p>
                    <div className="grid grid-cols-2 gap-2 text-gray-600 mt-1">
                      <span>Qty: {qty}</span>
                      <span>Unit price: {formatMoney(unit)} RWF</span>
                      <span>Total: {formatMoney(lineTotal)} RWF</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-sm flex justify-between pt-2 border-t">
              <span className="font-semibold">Total Amount:</span>
              <span className="font-bold text-blue-600 text-lg">{formatMoney(order.total_amount)} RWF</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Delivery Location *</label>
            <input
              type="text"
              value={deliveryLocation}
              onChange={(e) => {
                setDeliveryLocation(e.target.value);
                setError('');
              }}
              className="w-full border border-gray-300 px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="e.g., Kigali, Kacyiru, Plot 12"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          {whatsAppData && (
            <div className="border-t pt-4 space-y-3">
              <h3 className="font-semibold text-sm">Send order to seller</h3>
              <div className="flex gap-2">
                <a
                  href={whatsAppData.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-[#25D366] hover:bg-[#20b05a] text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  <MessageCircle className="h-4 w-4" />
                  Send WhatsApp
                </a>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(whatsAppData.message);
                      alert("Message copied!");
                    } catch {}
                  }}
                  className="flex-1 border px-4 py-2 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2 transition-colors"
                >
                  <Copy className="h-4 w-4" />
                  Copy message
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 bg-gray-50 rounded-b-2xl flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-100 font-medium transition-colors"
          >
            Back
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Placing...
              </>
            ) : (
              <>
                <Truck className="h-4 w-4" />
                Place Order
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------
   MoMo Dialog
   ------------------------- */
function MoMoDialog({ order, onClose, onConfirm, isSubmitting, whatsAppData }) {
  const momoTarget = order.seller?.momo?.trim() || '';
  const payload = `*182*8*1*${momoTarget}*${order.total_amount}#`;
  const telHref = `tel:${encodeURIComponent(payload)}`;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900">Pay with MTN MoMo</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Amount to pay:</span>
              <span className="font-bold text-lg">{formatMoney(order.total_amount)} RWF</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Seller:</span>
              <span className="font-medium">{order.seller?.name}</span>
            </div>
          </div>

          <div className="bg-gray-50 border rounded-lg p-4 space-y-2">
            <h4 className="text-sm font-semibold text-gray-700">ORDER SUMMARY</h4>
            <div className="text-sm flex justify-between">
              <span className="text-gray-600">Order #:</span>
              <span className="font-medium">{order.order_number}</span>
            </div>
            <div className="text-sm flex justify-between">
              <span className="text-gray-600">Items:</span>
              <span className="font-medium">{order.products?.length ?? 0}</span>
            </div>

            <div className="border-t pt-2 space-y-2">
              {order.products?.map((p, i) => {
                const qty = p.qty ?? p.quantity ?? 1;
                const unit = Number(p.unit_price ?? p.price ?? 0);
                const lineTotal = qty * unit;
                return (
                  <div key={i} className="text-sm">
                    <p className="font-medium">{p.name}</p>
                    <div className="grid grid-cols-2 gap-2 text-gray-600 mt-1">

                      <span>Qty: {qty}</span>
                      <span>Unit: {formatMoney(unit)} RWF</span>
                      <span>Total: {formatMoney(lineTotal)} RWF</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-sm flex justify-between pt-2 border-t">
              <span className="font-semibold">Total Amount:</span>
              <span className="font-bold text-blue-600 text-lg">{formatMoney(order.total_amount)} RWF</span>
            </div>
          </div>

          {momoTarget && (
            <>
              <div className="text-center space-y-2">
                <p className="text-sm font-medium">Scan QR code with your phone camera</p>
                <div className="bg-white p-4 rounded-lg inline-block border-2">
                  <QRCode value={payload} size={200} />
                </div>
                <p className="text-xs text-gray-500">Or dial manually: {payload}</p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(momoTarget);
                      alert(`Copied: ${momoTarget}`);
                    } catch {}
                  }}
                  className="flex-1 border px-4 py-2 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2 transition-colors"
                >
                  <Copy className="h-4 w-4" />
                  Copy number
                </button>
                <a
                  href={telHref}
                  className="flex-1 border px-4 py-2 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2 transition-colors"
                >
                  <PhoneCall className="h-4 w-4" />
                  Dial now
                </a>
              </div>
            </>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-900">
              <strong>Note:</strong> After completing the MoMo payment, click "I've Paid" below to confirm your order.
            </p>
          </div>

          {whatsAppData && (
            <div className="border-t pt-4 space-y-3">
              <h3 className="font-semibold text-sm">Send order to seller</h3>
              <div className="flex gap-2">
                <a
                  href={whatsAppData.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-[#25D366] hover:bg-[#20b05a] text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  <MessageCircle className="h-4 w-4" />
                  Send WhatsApp
                </a>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(whatsAppData.message);
                      alert("Message copied!");
                    } catch {}
                  }}
                  className="flex-1 border px-4 py-2 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2 transition-colors"
                >
                  <Copy className="h-4 w-4" />
                  Copy message
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 bg-gray-50 rounded-b-2xl flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-100 font-medium transition-colors"
          >
            Back
          </button>
          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className="flex-1 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                I've Paid
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------
   Main Component
   ------------------------- */
export default function ReorderPage() {
  const { user } = useAuthStore();
  const buyerAccount = user?.ishyigaAccount || '';
  const buyerName = user?.name || '';
  const buyerPhone = user?.phone || '';

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [reordering, setReordering] = useState(null);

  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showCodDialog, setShowCodDialog] = useState(false);
  const [showMomoDialog, setShowMomoDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [newOrderId, setNewOrderId] = useState(null);

  useEffect(() => {
    if (buyerAccount) fetchRecentOrders();
    else {
      setOrders([]);
      setLoading(false);
    }
  }, [buyerAccount]);

  const fetchRecentOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fetch', buyerAccount })
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.orders)) {
        setOrders(data.orders);
      } else {
        setOrders([]);
        showToast(data.message || 'Failed to fetch orders', 'error');
      }
    } catch (err) {
      showToast('Failed to fetch orders: ' + (err?.message || err), 'error');
    } finally {
      setLoading(false);
    }
  };

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
  }, []);

  const openPaymentDialog = (order) => {
    setSelectedOrder(order);
    setPaymentMethod('cod');
    setShowPaymentDialog(true);
    setNewOrderId(null);
  };

  const handleContinue = (method) => {
    setPaymentMethod(method);
    setShowPaymentDialog(false);
    if (method === 'cod') {
      setShowCodDialog(true);
    } else {
      setShowMomoDialog(true);
    }
  };

  const handleReorder = async (deliveryLocation = null) => {
    if (!selectedOrder) return;
    setReordering(selectedOrder.order_id);

    const orderData = {
      action: 'create',
      buyerAccount,
      orderId: selectedOrder.order_id,
      paymentMethod: paymentMethod === 'momo' ? 'PAID_MTN_MOMO' : 'PAY_ON_DELIVERY',
    };

    if (paymentMethod === "momo") {
      orderData.sellerMomo = selectedOrder?.seller?.momo || "";
      orderData.paymentId = `MOMO_${Date.now()}`;
    }

    if (deliveryLocation) {
      orderData.deliveryLocation = deliveryLocation;
      orderData.paymentId = `COD_${Date.now()}`;
    }

    if (selectedOrder.products) {
      orderData.products = selectedOrder.products;
    }

    try {
      const res = await fetch('/api/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });
      const data = await res.json();

      if (data.success) {
        const orderId = data.newOrderId ?? data.orderId ?? null;
        setNewOrderId(orderId);
        showToast(
          `Order #${orderId ?? 'N/A'} created successfully! Total: ${formatMoney(data.totalAmount ?? selectedOrder.total_amount)} ${CUR}`,
          'success'
        );

        if (paymentMethod === 'cod') {
          setShowCodDialog(false);
        }

        setTimeout(() => { fetchRecentOrders(); }, 800);
      } else {
        showToast(data.message || 'Failed to create reorder', 'error');
      }
    } catch (err) {
      showToast('Failed to create reorder: ' + (err?.message || err), 'error');
    } finally {
      setReordering(null);
    }
  };

  const getWhatsAppData = () => {
    if (!selectedOrder || !newOrderId) return null;

    const sellerPhone = normalizePhone(selectedOrder.seller?.phone || selectedOrder.seller?.momo);
    const message = buildWhatsAppMessage({
      shop: selectedOrder.seller?.name,
      orderId: selectedOrder.order_number,
      total: selectedOrder.total_amount,
      paidAt: paymentMethod === 'momo' ? 'MTN MoMo' : 'Cash on Delivery',
      reference: `REORDER-${newOrderId}`,
      myPhone: buyerPhone || '',
      link: `${(process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_API_URL || "https://ihute.rw").replace(/\/Trading\/?$/, "")}/orders/${newOrderId}`,
      products: selectedOrder.products || [],
      deliveryLocation: formatDeliveryLocation(selectedOrder.delivery?.location || '')
    });

    return {
      phone: sellerPhone,
      message,
      href: sellerPhone ? waHrefFor(sellerPhone, message) : ''
    };
  };

  if (!buyerAccount) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Header />
        <div className="text-center">
          <User className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-600 text-lg">Please log in to view your orders</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-600 mb-4" />
            <p className="text-gray-600">Loading your orders...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const whatsAppData = getWhatsAppData();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Header />

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Reorder Items</h1>
          <p className="text-gray-600">Quickly reorder from your previous purchases</p>
        </div>

        {orders.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-16 text-center">
            <Package className="h-20 w-20 mx-auto text-gray-300 mb-4" />
            <h3 className="text-2xl font-semibold text-gray-700 mb-2">No Recent Orders</h3>
            <p className="text-gray-500">Your previous orders will appear here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <OrderCard
                key={order.order_id}
                order={order}
                onReorder={openPaymentDialog}
                isReordering={reordering === order.order_id}
              />
            ))}
          </div>
        )}
      </div>

      {showPaymentDialog && selectedOrder && (
        <PaymentMethodDialog
          order={selectedOrder}
          onClose={() => setShowPaymentDialog(false)}
          onContinue={handleContinue}
        />
      )}

      {showCodDialog && selectedOrder && (
        <CODDialog
          order={selectedOrder}
          buyerName={buyerName}
          onClose={() => {
            setShowCodDialog(false);
            setShowPaymentDialog(true);
          }}
          onSubmit={handleReorder}
          isSubmitting={reordering === selectedOrder.order_id}
          whatsAppData={whatsAppData}
        />
      )}

      {showMomoDialog && selectedOrder && (
        <MoMoDialog
          order={selectedOrder}
          onClose={() => {
            setShowMomoDialog(false);
            setShowPaymentDialog(true);
          }}
          onConfirm={() => handleReorder()}
          isSubmitting={reordering === selectedOrder.order_id}
          whatsAppData={whatsAppData}
        />
      )}

      <Footer />

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scale-in {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes slide-in {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes slide-down {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
        .animate-slide-down {
          animation: slide-down 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}