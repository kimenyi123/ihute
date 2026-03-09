"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Barcode, Loader2 } from "lucide-react"
import { useCartStore } from "@/lib/cart-store"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Manual barcode entry: user types or pastes a barcode, we search and add to cart.
 * Backend search can accept itemCode/barcode; we call fetchSuggestions or a barcode lookup.
 */
export function BarcodeAddToCart({ open, onOpenChange }: Props) {
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const addItem = useCartStore((s) => s.addOrInc ?? s.addItem)

  const handleSearch = async () => {
    const trimmed = code.trim()
    if (!trimmed) {
      setMessage({ type: "error", text: "Enter a barcode or product code" })
      return
    }
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch(
        `/api/fetchSuggestions?globalSearch=${encodeURIComponent(trimmed)}&Currency=RWF`,
        { cache: "no-store" }
      )
      const data = await res.json().catch(() => ({}))
      let list: unknown[] = Array.isArray(data?.products) ? data.products : []
      if (list.length === 0 && Array.isArray(data?.suppliersByProduct)) {
        list = data.suppliersByProduct.flatMap((s: { products?: unknown[] }) => s?.products ?? [])
      }
      const first = list[0] as Record<string, unknown> | undefined
      if (!first) {
        setMessage({ type: "error", text: "No product found for this code" })
        setLoading(false)
        return
      }
      const name = String(first.item_commercial_name ?? first.item_name ?? first.ITEM_NAME ?? "Product")
      const price = parsePrice(first.item_emballage ?? first.selling_price ?? first.SALE_PRICE_INCLUSIVE ?? 0)
      const itemCode = String(first.item_code ?? first.item_key_words ?? first.ITEM_CODE ?? trimmed)
      const supplierId = String(first.supplier_account ?? first.supplierAccount ?? "").trim()
      const supplierName = String(first.supplier_name ?? first.supplierName ?? "Supplier")
      addItem({
        id: itemCode,
        itemCode,
        name,
        price,
        unit: String(first.item_packet ?? first.item_packet ?? ""),
        supplierId: supplierId || "unknown",
        supplierName,
        qty: 1,
        image: typeof first.image_url === "string" ? first.image_url : typeof first.image === "string" ? first.image : undefined,
      })
      setMessage({ type: "success", text: `Added "${name}" to cart` })
      setCode("")
      setTimeout(() => onOpenChange(false), 800)
    } catch {
      setMessage({ type: "error", text: "Search failed" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Barcode className="h-5 w-5" />
            Add by barcode
          </DialogTitle>
          <DialogDescription>
            Enter or paste a product or barcode code. We’ll find the product and add it to your cart.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <Input
            placeholder="Barcode or product code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            autoFocus
          />
          {message && (
            <p className={`text-sm ${message.type === "success" ? "text-green-600" : "text-destructive"}`}>
              {message.text}
            </p>
          )}
          <Button className="w-full" onClick={handleSearch} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search & add to cart"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function parsePrice(v: unknown): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v
  const s = String(v ?? "").replace(/[^\d.,-]/g, "").replace(",", ".")
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}
