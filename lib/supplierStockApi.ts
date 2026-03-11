/**
 * Supplier Stock API Client
 * TypeScript client for Redis-based stock management
 *
 * Redis format (used across search, dashboard, cart, shop-with-me):
 *   Key: "supplier_<account>" (e.g. supplier_ALGG0000187)
 *   Value: { key: "supplier_<account>", data: [ {...}, ... ] }
 *
 * Each item in data can have:
 *   item_commercial_name, item_packet, item_emballage (value or "" — pass through as-is; empty remains empty),
 *   selling_price (use this for price; item_emballage is not price), cost_price,
 *   item_key_words, item_state, famille, last_sync_time, lot,
 *   item_key_words_french, item_key_words_kinyarwanda, image_url
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

/**
 * Import Excel file to database and Redis.
 * Sends account in URL so the proxy can stream the file without buffering.
 */
export async function importStockExcel(file: File, account: string): Promise<ImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('account', account);

  const params = new URLSearchParams({ action: 'importExcel', account });
  const response = await fetch(`${API_BASE}?${params.toString()}`, {
    method: 'POST',
    body: formData,
  });

  return response.json();
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
