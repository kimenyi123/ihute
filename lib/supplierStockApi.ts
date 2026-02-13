/**
 * Supplier Stock API Client
 * TypeScript client for Redis-based stock management
 */

export interface StockItem {
  item_commercial_name: string;
  item_packet: string;
  item_emballage: string;
  item_key_words: string;
  item_state: string;
}

export interface StockData {
  key: string;
  data: StockItem[];
}

export interface ImportResult {
  ok: boolean;
  message: string;
  itemsImported?: number;
  rowsParsed?: number;
  rowsSkipped?: number;
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

const API_BASE = '/supplier/stock/api';

/**
 * Import Excel file to Redis
 */
export async function importStockExcel(file: File): Promise<ImportResult> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}?action=importExcel`, {
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
