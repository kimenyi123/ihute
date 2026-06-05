import { getSupplierStockUrl } from "@/lib/backend-config"
import {
  parseStockExcelBuffer,
  type ParsedStockRow,
} from "@/lib/supplier-stock-excel-parse"
import type { ImportResult } from "@/lib/supplierStockApi"

const CONCURRENCY = 1

async function postClearStockCatalog(
  account: string,
  cookie: string,
  signal?: AbortSignal,
): Promise<{ ok: boolean; error?: string }> {
  const url = `${getSupplierStockUrl()}?action=clearStockCatalog`
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({ action: "clearStockCatalog", account }),
      cache: "no-store",
      signal,
    })
    const text = await resp.text()
    let data: { ok?: boolean; error?: string } = {}
    try {
      data = JSON.parse(text) as { ok?: boolean; error?: string }
    } catch {
      return { ok: false, error: text.slice(0, 120) || `HTTP ${resp.status}` }
    }
    if (!resp.ok || data.ok === false) {
      return { ok: false, error: data.error || `HTTP ${resp.status}` }
    }
    return { ok: true }
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return { ok: false, error: "aborted" }
    }
    return { ok: false, error: e instanceof Error ? e.message : "Request failed" }
  }
}

async function postAddProduct(
  account: string,
  row: ParsedStockRow,
  cookie: string,
  signal?: AbortSignal,
): Promise<{ ok: boolean; error?: string }> {
  const url = `${getSupplierStockUrl()}?action=addProduct`
  const body = {
    action: "addProduct",
    account,
    itemName: row.itemName,
    itemCode: row.itemCode,
    quantity: row.quantity,
    price: row.price,
    cost: row.cost || undefined,
    description: [row.category, row.subcategory].filter(Boolean).join(" / ") || undefined,
    unit: "PCS",
    item_key_words: row.itemCode,
    item_commercial_name: row.itemName,
    item_packet: String(row.quantity),
    selling_price: String(row.price),
    cost_price: row.cost ? String(row.cost) : undefined,
    item_key_words_french: row.french || undefined,
    item_key_words_kinyarwanda: row.kinyarwanda || undefined,
    image_url: row.imageUrl || undefined,
  }

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal,
    })
    const text = await resp.text()
    let data: { ok?: boolean; error?: string } = {}
    try {
      data = JSON.parse(text) as { ok?: boolean; error?: string }
    } catch {
      return { ok: false, error: text.slice(0, 120) || `HTTP ${resp.status}` }
    }
    if (!resp.ok || data.ok === false) {
      return { ok: false, error: data.error || `HTTP ${resp.status}` }
    }
    return { ok: true }
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return { ok: false, error: "aborted" }
    }
    return { ok: false, error: e instanceof Error ? e.message : "Request failed" }
  }
}

async function runPool<T>(
  items: T[],
  worker: (item: T, index: number) => Promise<void>,
  signal?: AbortSignal,
): Promise<void> {
  let next = 0
  const runners = Array.from({ length: Math.min(CONCURRENCY, Math.max(items.length, 1)) }, async () => {
    while (next < items.length) {
      if (signal?.aborted) return
      const i = next++
      await worker(items[i], i)
    }
  })
  await Promise.all(runners)
}

/**
 * Fallback when Java `importExcel` is unreachable: clear catalog first, then addProduct per row.
 * Never stacks on top of an existing catalog (unlike the old behaviour that caused 300→1000+ dupes).
 */
export async function importStockExcelViaAddProduct(
  file: Blob,
  fileName: string,
  account: string,
  cookie: string,
  signal?: AbortSignal,
): Promise<ImportResult> {
  const buffer = await file.arrayBuffer()
  if (signal?.aborted) {
    return { ok: false, message: "Import cancelled", error: "Import cancelled" }
  }

  const cleared = await postClearStockCatalog(account, cookie, signal)
  if (!cleared.ok) {
    return {
      ok: false,
      message: "Could not clear existing stock before import",
      error: cleared.error ?? "clearStockCatalog failed",
    }
  }

  const parsed = parseStockExcelBuffer(buffer, fileName)

  if (parsed.errors.length && parsed.rows.length === 0) {
    return {
      ok: false,
      message: "Could not parse Excel file",
      error: parsed.errors[0],
      errors: parsed.errors,
    }
  }

  let itemsImported = 0
  const errors: string[] = [...parsed.errors]

  await runPool(
    parsed.rows,
    async (row, index) => {
      if (signal?.aborted) return
      const res = await postAddProduct(account, row, cookie, signal)
      if (res.ok) {
        itemsImported++
      } else if (errors.length < 25) {
        errors.push(`Row ${index + 1} (${row.itemName}): ${res.error ?? "failed"}`)
      }
    },
    signal,
  )

  if (signal?.aborted) {
    return {
      ok: itemsImported > 0,
      message:
        itemsImported > 0
          ? `Import stopped — ${itemsImported} product(s) were saved before cancel.`
          : "Import cancelled — nothing was saved.",
      itemsImported: itemsImported || undefined,
      itemsUpdated: 0,
      rowsParsed: parsed.rowsParsed,
      error: itemsImported > 0 ? undefined : "Import cancelled",
    }
  }

  const ok = itemsImported > 0
  return {
    ok,
    message: ok
      ? `Success — ${itemsImported} product(s) added to your stock. Open the dashboard to see them in your list.`
      : "No products were saved. Check your file format and try again.",
    itemsImported,
    itemsUpdated: 0,
    rowsParsed: parsed.rowsParsed,
    rowsSkipped: parsed.rowsSkipped,
    rowsSkippedNote: parsed.rowsSkippedNote,
    errors: errors.length ? errors : undefined,
    error: ok ? undefined : errors[0] ?? "Import failed",
  }
}
