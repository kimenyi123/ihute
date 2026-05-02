"use client"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { Order } from "@/lib/orders-store"
import { Receipt } from "lucide-react"

/** SDC / DB strings exactly as the API sends them (no Date parsing). */
export function sdcRaw(v: unknown): string {
  if (v == null) return "N/A"
  const s = typeof v === "string" ? v : String(v)
  const t = s.trim()
  return t === "" ? "N/A" : t
}

export function orderHasAnySdc(o: Order): boolean {
  return (
    sdcRaw(o.timeSdc) !== "N/A" ||
    sdcRaw(o.sdcId) !== "N/A" ||
    sdcRaw(o.receiptNumber) !== "N/A" ||
    sdcRaw(o.sdcInternalData) !== "N/A" ||
    sdcRaw(o.receiptSignature) !== "N/A"
  )
}

function truncatePreview(s: string, max: number): string {
  if (s.length <= max) return s
  return `${s.slice(0, max)}…`
}

function sdcSummaryLine(o: Order): { text: string; title: string } {
  const receipt = sdcRaw(o.receiptNumber)
  const sdcId = sdcRaw(o.sdcId)
  const time = sdcRaw(o.timeSdc)
  const sig = sdcRaw(o.receiptSignature)
  const internal = sdcRaw(o.sdcInternalData)
  if (receipt !== "N/A")
    return { text: truncatePreview(receipt, 26), title: receipt }
  if (sdcId !== "N/A") return { text: truncatePreview(sdcId, 26), title: sdcId }
  if (time !== "N/A") return { text: truncatePreview(time, 26), title: time }
  if (sig !== "N/A") return { text: truncatePreview(sig, 26), title: sig }
  return { text: truncatePreview(internal, 26), title: internal }
}

/** Compact table cell: preview + popover with full SDC fields (verbatim). */
export function SdcInfoCell({ order }: { order: Order }) {
  if (!orderHasAnySdc(order)) {
    return <span className="text-muted-foreground text-sm">N/A</span>
  }
  const { text, title } = sdcSummaryLine(order)
  return (
    <Popover>
      <div className="flex items-center gap-2 min-w-0 max-w-[200px]">
        <Receipt className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="text-xs font-mono text-foreground truncate min-w-0" title={title}>
          {text}
        </span>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs shrink-0">
            Details
          </Button>
        </PopoverTrigger>
      </div>
      <PopoverContent className="w-96 max-w-[calc(100vw-2rem)]" align="start">
        <p className="text-sm font-semibold text-foreground mb-3">SDC</p>
        <dl className="space-y-2.5 text-xs">
          <div>
            <dt className="text-muted-foreground font-sans mb-0.5">TIME SDC</dt>
            <dd className="font-mono text-foreground break-all">{sdcRaw(order.timeSdc)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground font-sans mb-0.5">SDC ID</dt>
            <dd className="font-mono text-foreground break-all">{sdcRaw(order.sdcId)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground font-sans mb-0.5">RECEIPT NUMBER</dt>
            <dd className="font-mono text-foreground break-all">{sdcRaw(order.receiptNumber)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground font-sans mb-0.5">SDC INTERNAL DATA</dt>
            <dd className="font-mono text-foreground break-all">{sdcRaw(order.sdcInternalData)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground font-sans mb-0.5">RECEIPT SIGNATURE</dt>
            <dd className="font-mono text-foreground break-all">{sdcRaw(order.receiptSignature)}</dd>
          </div>
        </dl>
      </PopoverContent>
    </Popover>
  )
}
