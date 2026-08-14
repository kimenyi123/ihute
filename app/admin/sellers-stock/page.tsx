"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  Eye,
  Package,
  RefreshCw,
  Search,
  ShoppingBag,
  Store,
  Users,
  Wallet,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  ActivityAnalyticsNav,
  AnalyticsHero,
  CollapsibleHelp,
  EmptyState,
  GlossaryGrid,
  MetricCard,
  SectionCard,
  fmtNum,
  fmtRwf,
  isoDateDaysAgo,
  todayIso,
} from "@/components/admin/activity-analytics-shell"
import { fetchAdminProtectedApi } from "@/lib/admin-client"
import {
  ORDER_MONITOR_DBS,
  decodeOrderMonitorDb,
  encodeOrderMonitorDb,
  orderMonitorDbLabel,
  readOrderMonitorDb,
  writeOrderMonitorDb,
  type OrderMonitorDb,
} from "@/lib/admin-order-db"
import { useAuthStore } from "@/lib/auth-store"

type SellerStockRow = {
  sellerAccount: string
  sellerName: string
  shopNickname: string
  status: string
  redisKey?: string
  productCount: number
  inStockCount: number
  outOfStockCount: number
  lowStockCount: number
  totalUnits: number
  stockValue: number
}

type StockProduct = {
  sellerAccount?: string
  sellerName?: string
  shopNickname?: string
  itemName?: string
  itemCode?: string
  itemKeywordsRw?: string
  famille?: string
  lot?: string
  itemState?: string
  itemPacket?: number
  itemEmballage?: number
  sellableUnits?: number
  sellingPrice?: number
  costPrice?: number
  lineValue?: number
  lastSyncTime?: string
  inStock?: boolean
}

type SellersStockPayload = {
  ok?: boolean
  error?: string
  currency?: string
  source?: string
  page?: number
  pageSize?: number
  total?: number
  totalPages?: number
  sellersWithStock?: number
  sellersWithCatalog?: number
  totalProducts?: number
  totalInStockProducts?: number
  totalUnits?: number
  totalStockValue?: number
  redisKeyCount?: number
  elapsedMs?: number
  sellers?: SellerStockRow[]
  products?: StockProduct[]
}

const PAGE_SIZE = 25

export default function AdminSellersStockPage() {
  const searchParams = useSearchParams()
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  const [from] = useState(() => searchParams.get("from") || isoDateDaysAgo(30))
  const [to] = useState(() => searchParams.get("to") || todayIso())
  const [environment] = useState(() => searchParams.get("environment") || "")
  const [db, setDb] = useState<OrderMonitorDb>("chaos_beta")
  const [dbReady, setDbReady] = useState(false)
  const [sellerAccount, setSellerAccount] = useState(() => searchParams.get("sellerAccount") || "")
  const [summary, setSummary] = useState<SellersStockPayload>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)

  // Debounce search → reset to page 1
  useEffect(() => {
    const t = setTimeout(() => {
      const next = searchInput.trim()
      setQ((prev) => {
        if (prev !== next) setPage(1)
        return next
      })
    }, 250)
    return () => clearTimeout(t)
  }, [searchInput])

  const selectDb = (next: OrderMonitorDb) => {
    if (next === db) return
    writeOrderMonitorDb(next)
    setDb(next)
    setPage(1)
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const p = new URLSearchParams({
        onlyWithStock: sellerAccount.trim() ? "0" : "1",
        page: String(page),
        pageSize: String(PAGE_SIZE),
        db: encodeOrderMonitorDb(db),
      })
      if (sellerAccount.trim()) p.set("sellerAccount", sellerAccount.trim())
      if (q) p.set("q", q)
      const res = await fetchAdminProtectedApi(`/api/activity/sellers-stock?${p}`)
      const json = (await res.json().catch(() => ({}))) as SellersStockPayload
      if (!res.ok || json.ok === false) {
        setError(json.error || "Failed to load sellers stock")
        setSummary({})
        return
      }
      setSummary(json)
      if (typeof json.page === "number" && json.page !== page) {
        setPage(json.page)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sellers stock")
      setSummary({})
    } finally {
      setLoading(false)
    }
  }, [sellerAccount, page, q, db])

  useEffect(() => {
    const initialDb = decodeOrderMonitorDb(searchParams.get("db")) ?? readOrderMonitorDb()
    setDb(initialDb)
    writeOrderMonitorDb(initialDb)
    setDbReady(true)
  }, [searchParams])

  useEffect(() => {
    if (!hasHydrated || !dbReady) return
    void load()
  }, [hasHydrated, dbReady, load])

  useEffect(() => {
    if (!dbReady) return
    const p = new URLSearchParams()
    p.set("from", from)
    p.set("to", to)
    p.set("db", encodeOrderMonitorDb(db))
    if (environment.trim()) p.set("environment", environment.trim())
    if (sellerAccount.trim()) p.set("sellerAccount", sellerAccount.trim())
    if (page > 1) p.set("page", String(page))
    if (q) p.set("q", q)
    const qs = p.toString()
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname)
  }, [from, to, environment, sellerAccount, page, q, db, dbReady])

  const sellerMode = Boolean(sellerAccount.trim())
  const sellers = summary.sellers || []
  const products = summary.products || []
  const total = summary.total ?? 0
  const totalPages = Math.max(1, summary.totalPages ?? 1)

  const selectedSeller =
    sellers.find((s) => s.sellerAccount.toLowerCase() === sellerAccount.trim().toLowerCase()) ||
    sellers[0]

  function openSeller(account: string) {
    setSellerAccount(account)
    setSearchInput("")
    setQ("")
    setPage(1)
  }

  function backToSellers() {
    setSellerAccount("")
    setSearchInput("")
    setQ("")
    setPage(1)
  }

  const rangeFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeTo = Math.min(page * PAGE_SIZE, total)

  return (
    <div className="space-y-6 pb-8">
      <ActivityAnalyticsNav active="stock" from={from} to={to} environment={environment} />

      <AnalyticsHero
        title={
          sellerMode
            ? `${selectedSeller?.sellerName || sellerAccount} — Redis stock`
            : "Sellers with stock"
        }
        subtitle={
          sellerMode
            ? `Full Redis catalog for supplier_${sellerAccount} (same shape as Redis_ai / supplier dashboard).`
            : "Live Redis catalogs (supplier_<account>) — same source SupplierStock and Redis_ai use for My Products."
        }
        icon={Package}
        actions={
          <>
            {sellerMode ? (
              <Button type="button" variant="outline" size="sm" onClick={backToSellers}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                All sellers
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Database">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Database</span>
        {ORDER_MONITOR_DBS.map((opt) => {
          const active = db === opt.id
          const isProd = opt.id === "chaos_test"
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => selectDb(opt.id)}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? isProd
                    ? "border-emerald-700 bg-emerald-700 text-white"
                    : "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              }`}
              title={opt.label}
            >
              {opt.label}
            </button>
          )
        })}
        <span className="text-xs text-slate-500">
          Viewing {orderMonitorDbLabel(db)} seller directory (Redis catalogs are shared)
        </span>
      </div>

      {error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label={sellerMode ? "Catalog products" : "Sellers with stock"}
          value={fmtNum(sellerMode ? summary.totalProducts ?? 0 : summary.sellersWithStock ?? 0)}
          hint={
            sellerMode
              ? `Redis key supplier_${sellerAccount}`
              : "Sellers with ≥1 sellable Redis product"
          }
          icon={Store}
          tone="shop"
          loading={loading}
        />
        <MetricCard
          label="In-stock products"
          value={fmtNum(summary.totalInStockProducts ?? 0)}
          hint={`${fmtNum(summary.totalProducts ?? 0)} catalog rows`}
          icon={ShoppingBag}
          tone="info"
          loading={loading}
        />
        <MetricCard
          label="Total units"
          value={fmtNum(summary.totalUnits ?? 0)}
          hint="Sellable units = item_packet ÷ item_emballage"
          icon={Users}
          tone="success"
          loading={loading}
        />
        <MetricCard
          label="Stock value"
          value={fmtRwf(summary.totalStockValue ?? 0)}
          hint="Units × selling_price"
          icon={Wallet}
          tone="warning"
          loading={loading}
        />
      </div>

      {sellerMode ? (
        <SectionCard
          title="Whole stock"
          subtitle={`Redis catalog lines for ${selectedSeller?.redisKey || `supplier_${sellerAccount}`} · ${fmtNum(total)} matching`}
          action={
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Search name, code, famille, lot…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
          }
        >
          {loading && products.length === 0 ? (
            <EmptyState title="Loading catalog…" description="Reading Redis supplier catalog." icon={Package} />
          ) : products.length === 0 ? (
            <EmptyState
              title="No products in Redis"
              description="This seller has no catalog under supplier_<account>, or nothing matches the search."
              icon={Package}
            />
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-medium">Product</th>
                      <th className="px-4 py-3 font-medium">Code</th>
                      <th className="px-4 py-3 font-medium">Famille</th>
                      <th className="px-4 py-3 font-medium">Lot</th>
                      <th className="px-4 py-3 font-medium text-right">Units</th>
                      <th className="px-4 py-3 font-medium text-right">Price</th>
                      <th className="px-4 py-3 font-medium text-right">Value</th>
                      <th className="px-4 py-3 font-medium">Sync</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {products.map((p, i) => (
                      <tr
                        key={`${p.itemCode || p.itemName || "row"}-${i}`}
                        className={p.inStock ? "hover:bg-slate-50" : "bg-slate-50/60 text-slate-500 hover:bg-slate-50"}
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{p.itemName || "—"}</div>
                          {p.itemKeywordsRw ? (
                            <div className="text-xs text-slate-500 line-clamp-1">{p.itemKeywordsRw}</div>
                          ) : null}
                          {p.itemState ? (
                            <div className="mt-0.5 font-mono text-[11px] text-slate-400">{p.itemState}</div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">{p.itemCode || "—"}</td>
                        <td className="px-4 py-3 text-slate-700">{p.famille || "—"}</td>
                        <td className="px-4 py-3 text-slate-700">{p.lot || "—"}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {fmtNum(p.sellableUnits ?? 0)}
                          <div className="text-[11px] text-slate-400">
                            pkt {fmtNum(p.itemPacket ?? 0)} / emb {fmtNum(p.itemEmballage ?? 1)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{fmtRwf(p.sellingPrice ?? 0)}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold">{fmtRwf(p.lineValue ?? 0)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">{p.lastSyncTime || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationBar
                rangeFrom={rangeFrom}
                rangeTo={rangeTo}
                total={total}
                page={page}
                totalPages={totalPages}
                loading={loading}
                onPrev={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
              />
            </>
          )}
        </SectionCard>
      ) : (
        <SectionCard
          title="Sellers with stock"
          subtitle={`From Redis supplier_* · ${fmtNum(total)} sellers${summary.redisKeyCount != null ? ` · ${fmtNum(summary.redisKeyCount)} keys` : ""}`}
          action={
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Search seller, account, nickname…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
          }
        >
          {loading && sellers.length === 0 ? (
            <EmptyState title="Loading stock…" description="Reading Redis catalogs via kaos." icon={Package} />
          ) : sellers.length === 0 ? (
            <EmptyState
              title="No sellers with stock"
              description="Sellers appear when Redis has supplier_<account> with sellable products, or nothing matches the search."
              icon={Package}
            />
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-medium">Seller</th>
                      <th className="px-4 py-3 font-medium">Shop</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium text-right">In stock</th>
                      <th className="px-4 py-3 font-medium text-right">Low</th>
                      <th className="px-4 py-3 font-medium text-right">Out</th>
                      <th className="px-4 py-3 font-medium text-right">Units</th>
                      <th className="px-4 py-3 font-medium text-right">Value</th>
                      <th className="px-4 py-3 font-medium text-right"> </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sellers.map((s) => (
                      <tr key={s.sellerAccount} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{s.sellerName}</div>
                          <div className="font-mono text-xs text-slate-500">{s.sellerAccount}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {s.shopNickname ? `@${s.shopNickname}` : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                            {s.status || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-700">
                          {fmtNum(s.inStockCount)}
                          <span className="ml-1 text-xs font-normal text-slate-400">/ {fmtNum(s.productCount)}</span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-amber-700">{fmtNum(s.lowStockCount)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-500">{fmtNum(s.outOfStockCount)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{fmtNum(s.totalUnits)}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold">{fmtRwf(s.stockValue)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8"
                              onClick={() => openSeller(s.sellerAccount)}
                            >
                              <Package className="mr-1 h-3.5 w-3.5" />
                              Stock
                            </Button>
                            <Button type="button" variant="outline" size="sm" className="h-8" asChild>
                              <Link
                                href={`/admin/ihute-stats?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&sellerAccount=${encodeURIComponent(s.sellerAccount)}`}
                              >
                                Stats
                              </Link>
                            </Button>
                            {s.shopNickname ? (
                              <Button type="button" variant="outline" size="sm" className="h-8" asChild>
                                <Link href={`/shop-with-me/${encodeURIComponent(s.shopNickname)}`} target="_blank">
                                  <Eye className="mr-1 h-3.5 w-3.5" />
                                  Shop
                                </Link>
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationBar
                rangeFrom={rangeFrom}
                rangeTo={rangeTo}
                total={total}
                page={page}
                totalPages={totalPages}
                loading={loading}
                onPrev={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
              />
            </>
          )}
        </SectionCard>
      )}

      <CollapsibleHelp title="Data source">
        <GlossaryGrid
          items={[
            {
              term: "Redis key",
              def: "supplier_<ISHYIGA_ACCOUNT> — same key Redis_ai writes and SupplierStock reads for My Products.",
            },
            {
              term: "Payload",
              def: 'JSON { "key": "supplier_…", "data": [ { item_commercial_name, item_packet, item_emballage, selling_price, … } ] } or a raw array.',
            },
            {
              term: "Sellable units",
              def: "item_packet ÷ item_emballage (emballage defaults to 1).",
            },
            {
              term: "In stock",
              def: "Sellable units > 0 and selling_price > 0.",
            },
          ]}
        />
      </CollapsibleHelp>

      <p className="text-xs text-slate-500">
        Source: kaos Redis ({summary.source || "redis"}). {summary.currency || "RWF"}.
        {summary.elapsedMs != null ? ` Loaded in ${summary.elapsedMs}ms.` : ""}
      </p>
    </div>
  )
}

function PaginationBar({
  rangeFrom,
  rangeTo,
  total,
  page,
  totalPages,
  loading,
  onPrev,
  onNext,
}: {
  rangeFrom: number
  rangeTo: number
  total: number
  page: number
  totalPages: number
  loading: boolean
  onPrev: () => void
  onNext: () => void
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm text-slate-500">
        Showing {fmtNum(rangeFrom)}–{fmtNum(rangeTo)} of {fmtNum(total)} · page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" disabled={page <= 1 || loading} onClick={onPrev}>
          Previous
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={onNext}>
          Next
        </Button>
      </div>
    </div>
  )
}
