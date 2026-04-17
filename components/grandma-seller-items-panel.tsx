"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { shopCategoryToSectorSlug } from "@/lib/seller-category-sector"
import { cn } from "@/lib/utils"

type StockLine = {
  id: number
  itemName: string
  nikiCode: string
  quantity: number
  salePrice: number
  costPrice: number
}

type NikiHit = {
  nikiCode: string
  name: string
  busCategoryId?: string
}

function inventoryErrorMessage(
  json: { error?: string; raw?: string; upstreamStatus?: number; upstreamUrl?: string; code?: string },
  httpStatus: number,
): string {
  let msg = json.error || `HTTP ${httpStatus}`
  if (json.upstreamStatus != null) {
    msg = `${msg} (Tomcat HTTP ${json.upstreamStatus})`
  }
  if (json.raw) {
    const plain = json.raw
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
    const one = plain.replace(/\s+/g, " ").trim()
    if (one) {
      msg = `${msg}: ${one.slice(0, 320)}${one.length > 320 ? "…" : ""}`
    }
  } else if (json.code === "GRANDMA_NOT_JSON" && json.upstreamUrl) {
    msg = `${msg}. URL: ${json.upstreamUrl}`
  }
  return msg
}

export function GrandmaSellerItemsPanel(props: {
  sellerAccount: string
  businessCategoryLabel?: string
  formatRwf: (n: number) => string
}) {
  const { sellerAccount, businessCategoryLabel, formatRwf } = props
  const sectorSlug = businessCategoryLabel ? shopCategoryToSectorSlug(businessCategoryLabel) : ""

  const [lines, setLines] = useState<StockLine[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [searchQ, setSearchQ] = useState("")
  const [searchHits, setSearchHits] = useState<NikiHit[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  const [addOpen, setAddOpen] = useState(false)
  const [addName, setAddName] = useState("")
  const [addCost, setAddCost] = useState("")
  const [addSale, setAddSale] = useState("")
  const [addQty, setAddQty] = useState("1")
  const [addBusy, setAddBusy] = useState(false)

  const load = useCallback(async () => {
    if (!sellerAccount.trim()) return
    setLoading(true)
    setErr(null)
    try {
      const u = new URLSearchParams({ sellerAccount: sellerAccount.trim() })
      const res = await fetch(`/api/grandma/sellers/inventory?${u}`, { cache: "no-store" })
      const json = (await res.json()) as {
        ok?: boolean
        lines?: StockLine[]
        error?: string
        raw?: string
        upstreamStatus?: number
        upstreamUrl?: string
        code?: string
      }
      if (!res.ok || !json?.ok) throw new Error(inventoryErrorMessage(json, res.status))
      const raw = json.lines ?? []
      setLines(
        raw.map((r) => ({
          id: r.id,
          itemName: String(r.itemName ?? ""),
          nikiCode: String(r.nikiCode ?? ""),
          quantity: Number(r.quantity) || 0,
          salePrice: Number(r.salePrice) || 0,
          costPrice: Number(r.costPrice) || 0,
        })),
      )
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Load failed")
      setLines([])
    } finally {
      setLoading(false)
    }
  }, [sellerAccount])

  useEffect(() => {
    load()
  }, [load])

  const runSearch = useCallback(async () => {
    const q = searchQ.trim()
    if (q.length < 2) {
      setSearchHits([])
      return
    }
    setSearchLoading(true)
    try {
      const u = new URLSearchParams({
        sellerAccount: sellerAccount.trim(),
        action: "searchNiki",
        q,
        limit: "24",
      })
      const res = await fetch(`/api/grandma/sellers/inventory?${u}`, { cache: "no-store" })
      const json = (await res.json()) as { ok?: boolean; items?: NikiHit[] }
      if (!res.ok || !json?.ok) {
        setSearchHits([])
        return
      }
      setSearchHits(json.items ?? [])
    } catch {
      setSearchHits([])
    } finally {
      setSearchLoading(false)
    }
  }, [searchQ, sellerAccount])

  useEffect(() => {
    const t = setTimeout(() => runSearch(), 350)
    return () => clearTimeout(t)
  }, [searchQ, runSearch])

  const patchQty = async (nikiCode: string, quantity: number) => {
    setErr(null)
    try {
      const res = await fetch("/api/grandma/sellers/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerAccount: sellerAccount.trim(), nikiCode, quantity }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        raw?: string
        upstreamStatus?: number
        upstreamUrl?: string
        code?: string
      }
      if (!res.ok || !json?.ok) throw new Error(inventoryErrorMessage(json, res.status))
      await load()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Update failed")
    }
  }

  const submitAddYourself = async () => {
    const sale = Math.max(1, parseFloat(addSale) || 0)
    const cost = Math.max(0, parseFloat(addCost) || 0)
    const qty = Math.max(1, parseFloat(addQty) || 1)
    const name = addName.trim()
    if (!name) {
      setErr("Enter an item name")
      return
    }
    setAddBusy(true)
    setErr(null)
    try {
      const res = await fetch("/api/grandma/sellers/items/temp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerAccount: sellerAccount.trim(),
          itemName: name,
          sectorSlug,
          costPrice: cost,
          salePrice: sale,
          quantity: qty,
        }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        nikiCode?: string
        raw?: string
        upstreamStatus?: number
        upstreamUrl?: string
        code?: string
      }
      if (!res.ok || !json?.ok) throw new Error(inventoryErrorMessage(json, res.status))
      setAddOpen(false)
      setAddName("")
      setAddCost("")
      setAddSale("")
      setAddQty("1")
      await load()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Could not add item")
    } finally {
      setAddBusy(false)
    }
  }

  if (!sellerAccount.trim()) {
    return (
      <section className="seller-screen px-3 py-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Sign in as a seller and ensure your account has an Ishyiga ID to manage stock.
        </div>
      </section>
    )
  }

  return (
    <section className="seller-screen space-y-3 px-3 pb-8 pt-2">
      <div className="rounded-2xl border border-[#dbe7f3] bg-white p-4 shadow-sm">
        <div className="text-xs font-bold uppercase tracking-wide text-[#6f8399]">Search Niki catalog</div>
        <Input
          className="mt-2 border-[#dbe7f3]"
          placeholder="Type 2+ characters (same sector as your shop when possible)"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
        />
        {searchLoading ? <p className="mt-2 text-xs text-[#6f8399]">Searching…</p> : null}
        {searchQ.trim().length >= 2 && !searchLoading && searchHits.length === 0 ? (
          <p className="mt-2 text-xs text-[#6f8399]">No catalog hits — use “Add it yourself” below.</p>
        ) : null}
        <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm">
          {searchHits.map((h) => (
            <li key={h.nikiCode} className="flex justify-between gap-2 rounded-lg bg-[#f7fbff] px-2 py-1">
              <span className="min-w-0 truncate font-medium text-[#17324d]">{h.name}</span>
              <span className="shrink-0 font-mono text-xs text-[#127fc0]">{h.nikiCode}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-[#6f8399]">Your stock</h2>
        <Button type="button" size="sm" className="bg-[#1897e0] text-white" onClick={() => setAddOpen((v) => !v)}>
          {addOpen ? "Close" : "Add it yourself"}
        </Button>
      </div>

      {addOpen ? (
        <div className="space-y-3 rounded-2xl border border-[#1897e0] bg-[#f0f8ff] p-4">
          <p className="text-xs text-[#17324d]">
            Creates a pending row and a stock line with NIKI <code className="font-mono">PEND-…</code> (admin validation later).
          </p>
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={addName} onChange={(e) => setAddName(e.target.value)} className="bg-white" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Cost (RWF)</Label>
              <Input value={addCost} onChange={(e) => setAddCost(e.target.value)} inputMode="numeric" className="bg-white" />
            </div>
            <div className="space-y-1">
              <Label>Sale (RWF)</Label>
              <Input value={addSale} onChange={(e) => setAddSale(e.target.value)} inputMode="numeric" className="bg-white" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Qty</Label>
            <Input value={addQty} onChange={(e) => setAddQty(e.target.value)} inputMode="numeric" className="bg-white" />
          </div>
          <Button type="button" disabled={addBusy} className="w-full bg-[#17324d] text-white" onClick={() => void submitAddYourself()}>
            {addBusy ? "Saving…" : "Save to stock"}
          </Button>
        </div>
      ) : null}

      {err ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{err}</div> : null}

      {loading ? (
        <div className="text-sm text-[#6f8399]">Loading stock…</div>
      ) : (
        <div className="space-y-2">
          {lines.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#dbe7f3] p-6 text-center text-sm text-[#6f8399]">
              No stock lines yet.
            </div>
          ) : (
            lines.map((row) => (
              <div
                key={row.id}
                className={cn(
                  "flex flex-col gap-2 rounded-2xl border border-[#dbe7f3] bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between",
                )}
              >
                <div className="min-w-0">
                  <div className="font-semibold text-[#17324d]">{row.itemName || "—"}</div>
                  <div className="font-mono text-xs text-[#127fc0]">NIKI {row.nikiCode || "—"}</div>
                  <div className="text-xs text-[#6f8399]">
                    Sale {formatRwf(row.salePrice)} · Cost {formatRwf(row.costPrice)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => void patchQty(row.nikiCode, Math.max(0, row.quantity - 1))}>
                    −
                  </Button>
                  <span className="min-w-[3rem] text-center font-bold">{row.quantity}</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => void patchQty(row.nikiCode, row.quantity + 1)}>
                    +
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <Button type="button" variant="secondary" className="w-full" onClick={() => void load()}>
        Refresh
      </Button>
    </section>
  )
}
