"use client"

import { useEffect, useState } from "react"
import { useCartStore, type CartItem } from "@/lib/cart-store"
import { Input } from "@/components/ui/input"

type Props = {
  line: CartItem
  /** Dark sidebar (KioskCartPanel) vs light cart page */
  variant?: "light" | "dark"
}

export function KioskCartLineQty({ line, variant = "light" }: Props) {
  const setQty = useCartStore((s) => s.setQty)
  const [text, setText] = useState(String(line.qty))

  useEffect(() => {
    setText(String(line.qty))
  }, [line.qty])

  const className =
    variant === "dark"
      ? "h-9 w-20 text-center tabular-nums border-slate-700 bg-slate-900/80 text-slate-50"
      : "h-9 w-20 text-center tabular-nums"

  return (
    <Input
      type="number"
      inputMode="numeric"
      min={1}
      step={1}
      value={text}
      onChange={(e) => {
        const v = e.target.value
        setText(v)
        const n = Number.parseInt(v, 10)
        if (Number.isFinite(n) && n >= 1) {
          setQty(line.id, n, line.selectedUnit)
        }
      }}
      onBlur={() => {
        const n = Number.parseInt(text, 10)
        const clamped = Number.isFinite(n) && n >= 1 ? n : 1
        setText(String(clamped))
        setQty(line.id, clamped, line.selectedUnit)
      }}
      aria-label="Quantity"
      className={className}
    />
  )
}
