/**
 * Supplier Stock API Client
 * TypeScript client for Redis-based stock management
 *
 * Backend (fetchSuggestions, etc.) must always search Redis first; when no data, search DB.
 *
 * Redis value format (used across search, dashboard, cart, shop-with-me):
 *   - **Sellable stock** (one row) = `item_packet / item_emballage` (emballage missing or invalid → treat as 1).
 *   - **Line price** (customer) = `selling_price × item_emballage` (base × pack multiplier).
 *   {
 *     "key": "supplier_<account>",   // e.g. "supplier_ALGG0000187"
 *     "data": [
 *       {
 *         "item_commercial_name": string,
 *         "item_packet": string,     // raw inventory qty (smallest units on this line)
 *         "item_emballage": string,  // units per sellable pack; pass through as-is; empty "" allowed
 *         "selling_price": string,   // base unit price; `price` may alias same value (not item_emballage)
 *         "cost_price": string,
 *         "item_key_words": string,
 *         "item_state": string,     // e.g. expiry date; can be ""
 *         "famille": string,        // optional, e.g. "DRUG"
 *         "last_sync_time": string, // e.g. "2026-01-27 14:30:00"
 *         "lot": string,
 *         "item_key_words_french": string,
 *         "item_key_words_kinyarwanda": string,
 *         "image_url": string
 *       }
 *     ]
 *   }
 */

export interface StockItem {
  item_commercial_name: string;
  item_packet: string;
  /** Pass through as-is; empty remains empty. Not used for price — use selling_price. */
  item_emballage?: string;
  item_key_words: string;
  item_state?: string;
  selling_price?: number | string;
  cost_price?: number | string;
  famille?: string;
  last_sync_time?: string;
  lot?: string;
  item_key_words_french?: string;
  item_key_words_kinyarwanda?: string;
  image_url?: string;
  item_image_url?: string;
}

export interface StockData {
  key: string;
  data: StockItem[];
}

export interface ImportResult {
  ok: boolean;
  message: string;
  itemsImported?: number;
  itemsUpdated?: number;
  rowsParsed?: number;
  rowsSkipped?: number;
  /** Why rows were skipped (e.g. title/footer/blank rows) */
  rowsSkippedNote?: string;
  backupKey?: string;
  supplierKey?: string;
  errors?: string[];
  error?: string;
}

export interface StockResponse {
  ok: boolean;
  stock?: StockData;
  error?: string;
}

export interface SearchResponse {
  ok: boolean;
  query?: string;
  results?: StockItem[];
  count?: number;
  error?: string;
}

export interface DeleteResponse {
  ok: boolean;
  message?: string;
  code?: string;
  error?: string;
}

export interface UpsertResponse {
  ok: boolean;
  message?: string;
  item?: StockItem;
  error?: string;
}

const API_BASE = '/api/supplier/stock';

function coerceOk(v: unknown): boolean {
  return v === true || v === 'true' || v === 1 || v === '1';
}

/** Normalize backend / proxy JSON so the upload UI always has ok + message. */
export function normalizeImportResult(raw: unknown, httpStatus: number): ImportResult {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const itemsImported = Number(r.itemsImported ?? r.items_imported ?? 0) || 0;
  const itemsUpdated = Number(r.itemsUpdated ?? r.items_updated ?? 0) || 0;
  const rowsParsedRaw = Number(r.rowsParsed ?? r.rows_parsed);
  const rowsParsed =
    Number.isFinite(rowsParsedRaw) && rowsParsedRaw > 0
      ? rowsParsedRaw
      : itemsImported + itemsUpdated;
  const rowsSkipped = Number(r.rowsSkipped ?? r.rows_skipped ?? 0) || 0;
  const ok = coerceOk(r.ok) || coerceOk(r.success);
  const errMsg =
    (typeof r.error === 'string' && r.error) ||
    (typeof r.message === 'string' && r.message && !ok ? r.message : '') ||
    '';

  let message =
    (typeof r.message === 'string' && r.message.trim() && ok ? r.message.trim() : '') ||
    '';
  if (!message) {
    if (ok) {
      const n = itemsImported + itemsUpdated;
      message =
        n > 0
          ? `Success — ${itemsImported} added, ${itemsUpdated} updated (${n} total).`
          : `Import finished (${rowsParsed} row(s) processed).`;
    } else {
      message = errMsg || `Import failed (${httpStatus}).`;
    }
  }

  const errors = Array.isArray(r.errors)
    ? (r.errors as unknown[]).map((e) => String(e))
    : undefined;

  return {
    ok,
    message,
    itemsImported: itemsImported || undefined,
    itemsUpdated: itemsUpdated || undefined,
    rowsParsed: rowsParsed || undefined,
    rowsSkipped: rowsSkipped || undefined,
    rowsSkippedNote: typeof r.rowsSkippedNote === 'string' ? r.rowsSkippedNote : undefined,
    backupKey: typeof r.backupKey === 'string' ? r.backupKey : undefined,
    supplierKey: typeof r.supplierKey === 'string' ? r.supplierKey : undefined,
    errors,
    error: ok ? undefined : errMsg || message,
  };
}

/**
 * Import Excel file to database and Redis.
 * Sends account in URL so the proxy can stream the file without buffering.
 */
export async function importStockExcel(
  file: File,
  account: string,
  opts?: { signal?: AbortSignal },
): Promise<ImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('account', account);

  const params = new URLSearchParams({ action: 'importExcel', account });
  const response = await fetch(`${API_BASE}?${params.toString()}`, {
    method: 'POST',
    body: formData,
    signal: opts?.signal,
  });

  let data: ImportResult;
  try {
    const json = (await response.json()) as unknown;
    data = normalizeImportResult(json, response.status);
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      return {
        ok: false,
        message: 'Import cancelled',
        error: 'Import cancelled',
      };
    }
    return {
      ok: false,
      message: 'Invalid response from server',
      error: `Server returned non-JSON (${response.status})`,
    };
  }

  if (!response.ok && !data.ok) {
    return {
      ...data,
      ok: false,
      message: data.message || data.error || `Import failed (${response.status})`,
      error: data.error || data.message || `HTTP ${response.status}`,
    };
  }

  return data;
}

/**
 * Get all stock items for current supplier
 */
export async function getStock(): Promise<StockResponse> {
  const response = await fetch(`${API_BASE}?action=getStock`, {
    method: 'GET',
  });

  return response.json();
}

/**
 * Search stock by keyword
 */
export async function searchStock(query: string): Promise<SearchResponse> {
  const response = await fetch(`${API_BASE}?action=searchStock&query=${encodeURIComponent(query)}`, {
    method: 'GET',
  });

  return response.json();
}

/**
 * Delete item by code
 */
export async function deleteItem(code: string): Promise<DeleteResponse> {
  const response = await fetch(`${API_BASE}?action=deleteItem`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code }),
  });

  return response.json();
}

/**
 * Insert or update item
 */
export async function upsertItem(item: StockItem): Promise<UpsertResponse> {
  const response = await fetch(`${API_BASE}?action=upsertItem`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(item),
  });

  return response.json();
}
