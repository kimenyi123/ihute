"use client"

import { useState } from "react"
import { Copy, Check, ChevronDown, ArrowLeft, Globe } from "lucide-react"

interface UmuriroPayment {
  shopName: string
  momoCode: string
  phone: string
  shopCategory: string
  itemName: string
  priceRwf: number
  quantity: number
}

interface PaymentResponse {
  ok: boolean
  message?: string
  error?: string
  payment?: {
    shopName: string
    momoCode: string
    phone: string
    shopCategory: string
    itemName: string
    priceRwf: number
    quantity: number
    totalRwf: number
    momoUssd: string
  }
}

const CATEGORIES = [
  "—",
  "Boutique",
  "Pharmacy",
  "Liquor store",
  "Electronics",
  "Supermarket",
  "Restaurant",
  "Hardware",
  "Stationery",
]

export default function UmuriroPaymentForm() {
  const [formData, setFormData] = useState<UmuriroPayment>({
    shopName: "",
    momoCode: "",
    phone: "",
    shopCategory: "",
    itemName: "",
    priceRwf: 0,
    quantity: 1,
  })
  const [response, setResponse] = useState<PaymentResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [categoryOpen, setCategoryOpen] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setResponse(null)

    try {
      const res = await fetch("/api/umuriro", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      const data: PaymentResponse = await res.json()
      setResponse(data)
    } catch (error) {
      setResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Request failed",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: name === "priceRwf" || name === "quantity" ? Number(value) : value,
    }))
  }

  const handleCategorySelect = (category: string) => {
    setFormData((prev) => ({ ...prev, shopCategory: category }))
    setCategoryOpen(false)
  }

  const copyUssd = () => {
    if (momoUssd && momoUssd !== "-") {
      navigator.clipboard.writeText(momoUssd)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const totalRwf = formData.priceRwf * formData.quantity
  const momoUssd = formData.momoCode && totalRwf > 0
    ? `*182*${formData.momoCode}*${Math.round(totalRwf)}#`
    : "—"

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <header className="bg-sky-500 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="p-1 hover:bg-white/20 rounded">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                <span className="text-sky-500 font-bold text-sm">U</span>
              </div>
              <div>
                <h1 className="font-semibold text-lg leading-tight">Umuriro</h1>
                <p className="text-xs text-sky-100">Save a shop & pay (Umuriro)</p>
              </div>
            </div>
          </div>
          <button className="flex items-center gap-1 text-sm hover:bg-white/20 px-2 py-1 rounded">
            <Globe className="w-4 h-4" />
            <span>English</span>
          </button>
        </header>

        {/* Sign in banner */}
        <div className="bg-amber-50 border-b border-amber-100 px-4 py-3 text-sm">
          <span className="text-gray-700">Sign in to save shops to your account. </span>
          <a href="#" className="text-blue-600 font-medium underline">Sign in</a>
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-lg mx-auto p-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Section title */}
          <h2 className="text-xl font-semibold text-gray-800">
            Shop, Save, Pay <span className="text-orange-500">🔥</span>
          </h2>

          {/* Shop name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              I&apos;m shopping at
            </label>
            <input
              type="text"
              name="shopName"
              value={formData.shopName}
              onChange={handleChange}
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
              placeholder=""
            />
          </div>

          {/* MoMo code & Phone - side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                MoMo code
              </label>
              <input
                type="text"
                name="momoCode"
                value={formData.momoCode}
                onChange={handleChange}
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
                placeholder=""
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Phone (optional)
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
                placeholder="250..."
              />
            </div>
          </div>

          {/* Shop category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Shop category
            </label>
            <p className="text-xs text-gray-500 mb-1.5">
              Same as on the home page — boutique, pharmacy, liquor store, ...
            </p>
            <div className="relative">
              <button
                type="button"
                onClick={() => setCategoryOpen(!categoryOpen)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-left flex items-center justify-between focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
              >
                <span className={formData.shopCategory ? "text-gray-900" : "text-gray-500"}>
                  {formData.shopCategory || "—"}
                </span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>
              {categoryOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => handleCategorySelect(cat)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 text-sm"
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Item name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              I&apos;m buying
            </label>
            <p className="text-xs text-gray-500 mb-1.5">
              Search the catalog in the category above, or type any name.
            </p>
            <input
              type="text"
              name="itemName"
              value={formData.itemName}
              onChange={handleChange}
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
              placeholder=""
            />
          </div>

          {/* Price & Quantity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Price (RWF)
              </label>
              <input
                type="number"
                name="priceRwf"
                value={formData.priceRwf || ""}
                onChange={handleChange}
                min="0"
                step="1"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
                placeholder=""
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Quantity
              </label>
              <input
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleChange}
                min="1"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* Total */}
          <div className="border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between bg-white">
            <span className="text-sm text-gray-600">Total to pay (RWF):</span>
            <span className="text-sky-600 font-semibold text-lg">
              {totalRwf.toLocaleString()} RWF
            </span>
          </div>

          {/* MTN MoMo USSD */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              MTN MoMo USSD
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-4 py-3 bg-gray-100 rounded-lg font-mono text-gray-700">
                {momoUssd}
              </div>
              <button
                type="button"
                onClick={copyUssd}
                disabled={momoUssd === "—"}
                className="flex items-center gap-1.5 px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-green-600" />
                    <span className="text-green-600">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy code</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              *182 × MoMo digits × total (RWF) # — use at least 6 MoMo digits to pay.
            </p>
          </div>

          {/* Message to seller (SMS preview) */}
          <div className="bg-sky-50 border border-sky-100 rounded-lg p-4 space-y-3">
            <h3 className="font-medium text-gray-800">Message to seller (SMS preview)</h3>
            <p className="text-gray-600 text-sm">Mukeneye ibindi bicuruzwa matubwira</p>
            <p className="text-gray-700 text-sm leading-relaxed">
              Umukiriya wacu abaguriye &quot;{formData.itemName || "..."}&quot;, mukeneye
              kumugurishaho ibindi bicuruzwa, uzuza bishyiremo kuri{" "}
              <a
                href="http://64.225.66.239:8080/trading_ai/register/seller/preview"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-600 hover:underline break-all"
              >
                http://64.225.66.239:8080/trading_ai/register/seller/preview
              </a>{" "}
              gusa
            </p>
            <p className="text-emerald-600 text-sm">
              SMS to +250788880066 after save (if Twilio/webhook is configured).
            </p>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-sky-500 text-white font-medium rounded-lg hover:bg-sky-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
          >
            {loading ? "Processing..." : "Save & Pay"}
          </button>
        </form>

        {/* Response Message */}
        {response && (
          <div
            className={`mt-4 p-4 rounded-lg ${
              response.ok
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {response.ok ? (
              <>
                <p className="font-medium">{response.message}</p>
                {response.payment && (
                  <div className="mt-2 text-sm">
                    <p>Shop: {response.payment.shopName}</p>
                    <p>Item: {response.payment.itemName}</p>
                    <p>Total: {response.payment.totalRwf.toLocaleString()} RWF</p>
                    <p>USSD: {response.payment.momoUssd}</p>
                  </div>
                )}
              </>
            ) : (
              <p className="font-medium">Error: {response.error}</p>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
