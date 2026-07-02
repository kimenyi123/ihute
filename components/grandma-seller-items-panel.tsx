"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  enqueueAdd,
  enqueuePatch,
  flushPendingOps,
  isOffline,
  loadCachedLines,
  loadPendingOps,
  saveCachedLines,
} from "@/lib/grandma-offline-stock"
import { shopCategoryToSectorSlug } from "@/lib/seller-category-sector"
import { downloadExcel, grandmaStockToExcelRows } from "@/lib/grandma-excel-export"
import { cn } from "@/lib/utils"
import { useLanguageStore, type Language } from "@/lib/language-store"

const ITEMS_UI: Record<Language, {
  signInSeller: string; searchCatalog: string; searchPlaceholder: string
  searching: string; noCatalogHits: string; yourStock: string; close: string
  addItYourself: string; addHint: string; name: string; costRwf: string
  saleRwf: string; qty: string; saving: string; saveToStock: string
  loadingStock: string; noStockYet: string; sale: string; cost: string
  refresh: string; syncNow: string; offlineQueued: string
  offlineQtyNote: string; offlineNewItem: string; offlineShow: string
  offlineNoCache: string; enterItemName: string
  exportExcel: string; exportExcelEmpty: string
}> = {
  en: {
    signInSeller: "Sign in as a seller and ensure your account has an Ishyiga ID to manage stock.",
    searchCatalog: "Search Niki catalog",
    searchPlaceholder: "Type 2+ characters",
    searching: "Searching\u2026",
    noCatalogHits: "No catalog hits \u2014 use \u201cAdd it yourself\u201d below.",
    yourStock: "Your stock",
    close: "Close",
    addItYourself: "Add it yourself",
    addHint: "Creates a pending row and a stock line with NIKI PEND-\u2026 (admin validation later).",
    name: "Name",
    costRwf: "Cost (RWF)",
    saleRwf: "Sale (RWF)",
    qty: "Qty",
    saving: "Saving\u2026",
    saveToStock: "Save to stock",
    loadingStock: "Loading stock\u2026",
    noStockYet: "No stock lines yet.",
    sale: "Sale",
    cost: "Cost",
    refresh: "Refresh",
    syncNow: "Sync now",
    offlineQueued: "offline change(s) queued",
    offlineQtyNote: "Offline: quantity saved on this device \u2014 will sync when you\u2019re back online.",
    offlineNewItem: "Offline: new item is queued on this device. It will be created on the server when you\u2019re back online.",
    offlineShow: "You\u2019re offline \u2014 showing saved stock. Quantity changes are queued to sync when you\u2019re back online.",
    offlineNoCache: "You\u2019re offline and have no cached stock yet. Open Items once while online to save a copy.",
    enterItemName: "Enter an item name",
    exportExcel: "Export Excel",
    exportExcelEmpty: "No stock rows to export yet.",
  },
  rw: {
    signInSeller: "Injira nk\u2019umucuruzi kandi wishimikize ko konti yawe ifite Ishyiga ID yo gucunga sitoki.",
    searchCatalog: "Shakisha muri katalogi ya Niki",
    searchPlaceholder: "Andika nibura inyuguti 2",
    searching: "Birimo gushakisha\u2026",
    noCatalogHits: "Nta bisubizo \u2014 koresha \u00abOngeraho ubwawe\u00bb hepfo.",
    yourStock: "Sitoki yawe",
    close: "Funga",
    addItYourself: "Ongeraho ubwawe",
    addHint: "Bigatuma umurongo utegereje n\u2019umurongo wa sitoki ufite NIKI PEND-\u2026 (kwemezwa n\u2019umuyobozi nyuma).",
    name: "Izina",
    costRwf: "Igiciro cy\u2019igurisha (RWF)",
    saleRwf: "Igiciro cyo kugurisha (RWF)",
    qty: "Ingano",
    saving: "Birimo kubika\u2026",
    saveToStock: "Bika muri sitoki",
    loadingStock: "Turimo gufata sitoki\u2026",
    noStockYet: "Nta micuruzwa iri muri sitoki.",
    sale: "Igurisha",
    cost: "Igiciro",
    refresh: "Kura amakuru",
    syncNow: "Huza nonaha",
    offlineQueued: "impinduka zitegereje",
    offlineQtyNote: "Ntuzuri kuri interineti: ingano yabitswe kuri iki cyuma \u2014 izahuzwa igihe usubiye kuri interineti.",
    offlineNewItem: "Ntuzuri kuri interineti: igicuruzwa gishya gitegereje. Kizashyirwa kuri seriveri igihe usubiye kuri interineti.",
    offlineShow: "Ntuzuri kuri interineti \u2014 turerekana sitoki yabitswe. Impinduka z\u2019ingano zitegereje guhuzwa.",
    offlineNoCache: "Ntuzuri kuri interineti kandi nta sitoki yabitswe. Fungura Ibicuruzwa rimwe uri kuri interineti kugira ngo ubike kopi.",
    enterItemName: "Andika izina ry\u2019igicuruzwa",
    exportExcel: "Kohereza Excel",
    exportExcelEmpty: "Nta micuruzwa yo kohereza.",
  },
  fr: {
    signInSeller: "Connectez-vous en tant que vendeur et v\u00e9rifiez que votre compte dispose d\u2019un ID Ishyiga pour g\u00e9rer le stock.",
    searchCatalog: "Rechercher dans le catalogue Niki",
    searchPlaceholder: "Saisissez 2+ caract\u00e8res",
    searching: "Recherche\u2026",
    noCatalogHits: "Aucun r\u00e9sultat \u2014 utilisez \u00ab Ajouter vous-m\u00eame \u00bb ci-dessous.",
    yourStock: "Votre stock",
    close: "Fermer",
    addItYourself: "Ajouter vous-m\u00eame",
    addHint: "Cr\u00e9e une ligne en attente avec un code NIKI PEND-\u2026 (validation admin ult\u00e9rieure).",
    name: "Nom",
    costRwf: "Co\u00fbt (RWF)",
    saleRwf: "Vente (RWF)",
    qty: "Qt\u00e9",
    saving: "Enregistrement\u2026",
    saveToStock: "Enregistrer dans le stock",
    loadingStock: "Chargement du stock\u2026",
    noStockYet: "Aucune ligne de stock.",
    sale: "Vente",
    cost: "Co\u00fbt",
    refresh: "Actualiser",
    syncNow: "Synchroniser",
    offlineQueued: "modification(s) en attente",
    offlineQtyNote: "Hors ligne : quantit\u00e9 enregistr\u00e9e localement \u2014 synchronis\u00e9e au retour en ligne.",
    offlineNewItem: "Hors ligne : nouvel article en attente. Il sera cr\u00e9\u00e9 sur le serveur au retour en ligne.",
    offlineShow: "Hors ligne \u2014 stock enregistr\u00e9 affich\u00e9. Les modifications de quantit\u00e9 seront synchronis\u00e9es.",
    offlineNoCache: "Hors ligne et aucun stock en cache. Ouvrez Articles une fois en ligne pour enregistrer une copie.",
    enterItemName: "Saisissez un nom d\u2019article",
    exportExcel: "Exporter Excel",
    exportExcelEmpty: "Aucune ligne de stock \u00e0 exporter.",
  },
}

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
      msg = `${msg}: ${one.slice(0, 320)}${one.length > 320 ? "\u2026" : ""}`
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
  const language = useLanguageStore((s) => s.language)
  const ui = ITEMS_UI[language] ?? ITEMS_UI.en

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
  const [offlineNote, setOfflineNote] = useState<string | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncBusy, setSyncBusy] = useState(false)

  const refreshPendingCount = useCallback(() => {
    setPendingCount(loadPendingOps(sellerAccount).length)
  }, [sellerAccount])

  const load = useCallback(async () => {
    if (!sellerAccount.trim()) return
    setLoading(true)
    setErr(null)
    setOfflineNote(null)
    try {
      if (isOffline()) {
        const cached = loadCachedLines(sellerAccount)
        if (cached && cached.length > 0) {
          setLines(cached)
          setOfflineNote(ui.offlineShow)
        } else {
          setLines([])
          setErr(ui.offlineNoCache)
        }
        setLoading(false)
        refreshPendingCount()
        return
      }

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
      const mapped = raw.map((r) => ({
        id: r.id,
        itemName: String(r.itemName ?? ""),
        nikiCode: String(r.nikiCode ?? ""),
        quantity: Number(r.quantity) || 0,
        salePrice: Number(r.salePrice) || 0,
        costPrice: Number(r.costPrice) || 0,
      }))
      setLines(mapped)
      saveCachedLines(sellerAccount, mapped)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Load failed")
      setLines([])
    } finally {
      setLoading(false)
      refreshPendingCount()
    }
  }, [sellerAccount, refreshPendingCount, ui.offlineShow, ui.offlineNoCache])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const onOnline = () => {
      void (async () => {
        if (!sellerAccount.trim()) return
        setSyncBusy(true)
        setOfflineNote(null)
        try {
          const r = await flushPendingOps(sellerAccount)
          if (r.ok > 0 || r.fail > 0) {
            setOfflineNote(
              r.fail
                ? `Sync: ${r.ok} ok, ${r.fail} failed${r.lastError ? ` (${r.lastError})` : ""}`
                : `Synced ${r.ok} offline change(s).`,
            )
          }
          await load()
        } finally {
          setSyncBusy(false)
          refreshPendingCount()
        }
      })()
    }
    window.addEventListener("online", onOnline)
    return () => window.removeEventListener("online", onOnline)
  }, [sellerAccount, load, refreshPendingCount])

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
    if (isOffline()) {
      setLines((prev) => {
        const next = prev.map((p) => (p.nikiCode === nikiCode ? { ...p, quantity } : p))
        saveCachedLines(sellerAccount, next)
        return next
      })
      enqueuePatch(sellerAccount, nikiCode, quantity)
      refreshPendingCount()
      setOfflineNote(ui.offlineQtyNote)
      return
    }
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
      setErr(ui.enterItemName)
      return
    }
    setAddBusy(true)
    setErr(null)
    if (isOffline()) {
      enqueueAdd(sellerAccount, {
        itemName: name,
        sectorSlug,
        costPrice: cost,
        salePrice: sale,
        quantity: qty,
      })
      setAddOpen(false)
      setAddName("")
      setAddCost("")
      setAddSale("")
      setAddQty("1")
      setAddBusy(false)
      refreshPendingCount()
      setOfflineNote(ui.offlineNewItem)
      return
    }
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
          {ui.signInSeller}
        </div>
      </section>
    )
  }

  return (
    <section className="seller-screen space-y-3 px-3 pb-8 pt-2">
      {offlineNote ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">{offlineNote}</div>
      ) : null}
      {pendingCount > 0 ? (
        <div className="rounded-xl border border-[#1897e0] bg-[#f0f8ff] px-3 py-2 text-sm text-[#17324d]">
          {pendingCount} {ui.offlineQueued}
          {syncBusy ? " \u2014 syncing\u2026" : ""}.
          <button
            type="button"
            className="ml-2 font-bold text-[#127fc0] underline"
            onClick={() => void load()}
          >
            {ui.refresh}
          </button>
          {!isOffline() ? (
            <button
              type="button"
              className="ml-2 font-bold text-[#127fc0] underline"
              onClick={() => {
                void (async () => {
                  setSyncBusy(true)
                  setOfflineNote(null)
                  try {
                    const r = await flushPendingOps(sellerAccount)
                    if (r.ok > 0 || r.fail > 0) {
                      setOfflineNote(
                        r.fail
                          ? `Sync: ${r.ok} ok, ${r.fail} failed${r.lastError ? ` (${r.lastError})` : ""}`
                          : `Synced ${r.ok} offline change(s).`,
                      )
                    }
                    await load()
                  } finally {
                    setSyncBusy(false)
                    refreshPendingCount()
                  }
                })()
              }}
            >
              {ui.syncNow}
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="rounded-2xl border border-[#dbe7f3] bg-white p-4 shadow-sm">
        <div className="text-xs font-bold uppercase tracking-wide text-[#6f8399]">{ui.searchCatalog}</div>
        <Input
          className="mt-2 border-[#dbe7f3]"
          placeholder={ui.searchPlaceholder}
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
        />
        {searchLoading ? <p className="mt-2 text-xs text-[#6f8399]">{ui.searching}</p> : null}
        {searchQ.trim().length >= 2 && !searchLoading && searchHits.length === 0 ? (
          <p className="mt-2 text-xs text-[#6f8399]">{ui.noCatalogHits}</p>
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
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-[#6f8399]">{ui.yourStock}</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-[#1897e0] text-[#127fc0] hover:bg-[#f0f8ff]"
            disabled={lines.length === 0}
            onClick={() => {
              const ok = downloadExcel(
                grandmaStockToExcelRows(lines),
                "Stock",
                `grandma_stock_${sellerAccount.trim()}`,
              )
              if (!ok) window.alert(ui.exportExcelEmpty)
            }}
          >
            📥 {ui.exportExcel}
          </Button>
          <Button type="button" size="sm" className="bg-[#1897e0] text-white" onClick={() => setAddOpen((v) => !v)}>
            {addOpen ? ui.close : ui.addItYourself}
          </Button>
        </div>
      </div>

      {addOpen ? (
        <div className="space-y-3 rounded-2xl border border-[#1897e0] bg-[#f0f8ff] p-4">
          <p className="text-xs text-[#17324d]">{ui.addHint}</p>
          <div className="space-y-1">
            <Label>{ui.name}</Label>
            <Input value={addName} onChange={(e) => setAddName(e.target.value)} className="bg-white" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>{ui.costRwf}</Label>
              <Input value={addCost} onChange={(e) => setAddCost(e.target.value)} inputMode="numeric" className="bg-white" />
            </div>
            <div className="space-y-1">
              <Label>{ui.saleRwf}</Label>
              <Input value={addSale} onChange={(e) => setAddSale(e.target.value)} inputMode="numeric" className="bg-white" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>{ui.qty}</Label>
            <Input value={addQty} onChange={(e) => setAddQty(e.target.value)} inputMode="numeric" className="bg-white" />
          </div>
          <Button type="button" disabled={addBusy} className="w-full bg-[#17324d] text-white" onClick={() => void submitAddYourself()}>
            {addBusy ? ui.saving : ui.saveToStock}
          </Button>
        </div>
      ) : null}

      {err ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{err}</div> : null}

      {loading ? (
        <div className="text-sm text-[#6f8399]">{ui.loadingStock}</div>
      ) : (
        <div className="space-y-2">
          {lines.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#dbe7f3] p-6 text-center text-sm text-[#6f8399]">
              {ui.noStockYet}
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
                  <div className="font-semibold text-[#17324d]">{row.itemName || "\u2014"}</div>
                  <div className="font-mono text-xs text-[#127fc0]">NIKI {row.nikiCode || "\u2014"}</div>
                  <div className="text-xs text-[#6f8399]">
                    {ui.sale} {formatRwf(row.salePrice)} \u00b7 {ui.cost} {formatRwf(row.costPrice)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => void patchQty(row.nikiCode, Math.max(0, row.quantity - 1))}>
                    \u2212
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
        {ui.refresh}
      </Button>
    </section>
  )
}
