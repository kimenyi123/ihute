/**
 * B2B Procurement API Client
 * Handles all communication with B2B Procurement Servlet
 */

export interface B2BProduct {
  id: number;
  itemCode: string;
  itemName: string;
  keywords: string;
  price: number;
  quantity: number;
  unit: string;
  sellerAccount: string;
  sellerName: string;
  location: string;
  gpsLat: number | null;
  gpsLng: number | null;
}

export interface B2BDraftOrder {
  id: number;
  status: string;
  amount: number;
  currency: string;
  importBatchId: string;
  importFileName: string;
  createdAt: string;
}

export interface B2BDraftLine {
  id: number;
  itemCode: string;
  itemName: string;
  quantity: number;
  requestPrice: number;
  matchStatus: "MATCHED" | "UNMATCHED" | "AMBIGUOUS";
  matchNotes: string;
  supplierStockId: string | null; // Changed to string for Redis synthetic IDs
  sellerAccount: string;
  sellerName: string;
  supplierPrice: number | null;
  supplierStock: number | null;
}

export interface B2BOrder {
  id: number;
  orderType: string;
  status: string;
  amount: number;
  currency: string;
  buyerAccount: string;
  buyerName: string;
  sellerAccount: string;
  sellerName: string;
  importFileName: string;
  createdAt: string;
  isChildOrder: boolean;
  parentOrderId: number | null;
  childCount: number;
  taxes: number;
  costAmount: number;
}

export interface B2BOrderLine {
  id: number;
  itemCode: string;
  itemName: string;
  quantity: number;
  confirmedReceivedQty: number;
  requestPrice: number;
  receivePrice: number;
  unityPrice: number;
  sellerAccount: string;
  supplierStockId: string | null; // Changed to string for Redis synthetic IDs
  availableStock: number | null;
  suggestedPrice: number | null;
  vatRate: number;
}

export interface SupplierOption {
  stockId: string; // Changed to string for Redis synthetic IDs  
  supplierId: string;
  supplierName: string;
  location: string;
  itemName: string;
  unitPrice: number;
  availableQty: number;
  matchScore?: number; // Added for Redis supplier matching
}

export interface LineUpdate {
  lineId: number;
  confirmedQty: number;
  unitPrice: number;
}

export interface ApiResponse<T = any> {
  ok: boolean;
  error?: string;
  data?: T;
}

export interface SearchResponse {
  products: B2BProduct[];
  query: string;
  page: number;
  limit: number;
  total: number;
}

export interface DraftResponse {
  order: B2BDraftOrder;
  lines: B2BDraftLine[];
}

export interface OrderDetailsResponse {
  order: B2BOrder;
  lines: B2BOrderLine[];
}

export interface OrdersListResponse {
  orders: B2BOrder[];
  page: number;
  limit: number;
  total: number;
}

export interface ImportResponse {
  draftOrderId: number;
  batchId: string;
  rowsImported: number;
  errors: string[];
  message: string;
}

export interface SupplierOptionsResponse {
  suppliers: SupplierOption[];
  itemCode: string;
  itemName: string;
}

export class B2BApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "B2BApiError";
  }
}

/**
 * Base API fetch wrapper with credentials and error handling
 *
 * ✅ Fixes:
 * - Handles empty JSON responses (prevents "Unexpected end of JSON input")
 * - Handles HTML error pages safely
 * - Handles file downloads + invoice html properly
 * - Avoids setting JSON Content-Type for FormData
 */
async function apiFetch(url: string, options: RequestInit = {}): Promise<any> {
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  // Merge headers safely
  const headers = new Headers(options.headers || {});

  // Only set JSON content-type when NOT sending FormData and when caller didn't override it
  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    credentials: "include",
    ...options,
    headers,
  });

  const contentType = response.headers.get("content-type") || "";

  // ✅ Excel download responses
  if (
    contentType.includes(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
  ) {
    if (!response.ok) {
      throw new B2BApiError("Failed to download template", response.status);
    }
    return response; // caller will .blob()
  }

  // ✅ HTML invoice responses OR HTML error pages
  if (contentType.includes("text/html")) {
    const text = await response.text();
    if (!response.ok) {
      // bubble the server html message if any
      throw new B2BApiError(text || "HTML error response", response.status);
    }
    return response; // caller will .text() if needed
  }

  // ✅ JSON responses (safe even if empty body)
  if (contentType.includes("application/json")) {
    const text = await response.text(); // safe even if empty
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      throw new B2BApiError(
        data?.error || `Request failed (HTTP ${response.status})`,
        response.status
      );
    }

    if (!data?.ok) {
      throw new B2BApiError(data?.error || "API returned error", response.status);
    }

    return data;
  }

  // ✅ Fallback: treat as text (covers weird proxies)
  const text = await response.text();
  if (!response.ok) {
    throw new B2BApiError(text || `Request failed (HTTP ${response.status})`, response.status);
  }
  return text;
}

/**
 * Search B2B products
 */
export async function searchB2B(params: {
  q: string;
  sort?: "relevance" | "cheapest" | "stock";
  page?: number;
  limit?: number;
}): Promise<SearchResponse> {
  const searchParams = new URLSearchParams({
    action: "search",
    q: params.q,
    page: (params.page || 1).toString(),
    limit: (params.limit || 20).toString(),
  });

  if (params.sort) {
    searchParams.set("sort", params.sort);
  }

  const data = await apiFetch(`/supplier/b2b/api?${searchParams}`);
  return data as SearchResponse;
}

/**
 * Download Excel template
 */
export async function downloadTemplate(): Promise<Blob> {
  const response = await apiFetch("/supplier/b2b/api?action=downloadTemplate");
  return (response as Response).blob();
}

/**
 * Import Excel file
 */
export async function importExcel(file: File): Promise<ImportResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await apiFetch("/supplier/b2b/api?action=importExcel", {
    method: "POST",
    headers: {}, // let browser set multipart boundary
    body: formData,
  });

  return response as ImportResponse;
}

/**
 * Get draft order details
 */
export async function getDraft(draftOrderId: number): Promise<DraftResponse> {
  const data = await apiFetch(
    `/supplier/b2b/api?action=getDraft&draftOrderId=${draftOrderId}`
  );
  return data as DraftResponse;
}

/**
 * Get supplier options for a draft line (Redis-enabled)
 */
export async function getSupplierOptions(
  lineId: number
): Promise<{ options: SupplierOption[]; source: string }> {
  const data = await apiFetch(
    `/supplier/b2b/api?action=supplierOptions&lineId=${lineId}`
  );
  return data as { options: SupplierOption[]; source: string };
}

/**
 * Update line in draft
 *
 * ✅ Fix: send '{}' body so JSON parsing in proxies never crashes
 */
export async function updateLine(params: {
  lineId: number;
  lineAction: "changeSupplier" | "updateQty";
  newSupplierStockId?: number;
  newQuantity?: number;
}): Promise<{ message: string }> {
  const searchParams = new URLSearchParams({
    action: "updateLine",
    lineId: params.lineId.toString(),
    lineAction: params.lineAction,
  });

  if (params.newSupplierStockId !== undefined) {
    searchParams.set("newSupplierStockId", params.newSupplierStockId.toString());
  }

  if (params.newQuantity !== undefined) {
    searchParams.set("newQuantity", params.newQuantity.toString());
  }

  const data = await apiFetch(`/supplier/b2b/api?${searchParams}`, {
    method: "POST",
    body: "{}", // important: avoid empty-body JSON parse errors in middleware
  });

  return data as { message: string };
}

/**
 * Update line supplier (supports both Redis synthetic IDs and DB numeric IDs)
 */
export async function updateLineSupplier(params: {
  lineId: number;
  stockId: string; // Now supports both "redis:SUPPLIER:CODE" and "12345"
}): Promise<{
  message: string;
  supplierId: string;
  supplierName: string;
  unitPrice: number;
  availableQty: number;
}> {
  const searchParams = new URLSearchParams({
    action: "updateLine",
    lineId: params.lineId.toString(),
    stockId: params.stockId,
  });

  const data = await apiFetch(`/supplier/b2b/api?${searchParams}`, {
    method: "POST",
    body: "{}", // avoid empty-body JSON parse errors
  });

  return data as {
    message: string;
    supplierId: string;
    supplierName: string;
    unitPrice: number;
    availableQty: number;
  };
}

/**
 * Remove line from draft
 */
export async function removeLine(lineId: number): Promise<{ message: string }> {
  const data = await apiFetch(`/supplier/b2b/api?action=removeLine&lineId=${lineId}`, {
    method: "POST",
    body: "{}", // keep consistent, avoid proxy empty-body issues
  });

  return data as { message: string };
}

/**
 * Submit draft order
 */
export async function submitDraft(draftOrderId: number): Promise<{
  parentOrderId: number;
  childOrders: number[];
  message: string;
}> {
  const data = await apiFetch(
    `/supplier/b2b/api?action=submitDraft&draftOrderId=${draftOrderId}`,
    { method: "POST", body: "{}" }
  );

  return data;
}

/**
 * List outgoing orders
 */
export async function listOutgoing(params?: {
  status?: string;
  page?: number;
  limit?: number;
}): Promise<OrdersListResponse> {
  const searchParams = new URLSearchParams({
    action: "listOutgoing",
    page: (params?.page || 1).toString(),
    limit: (params?.limit || 20).toString(),
  });

  if (params?.status) {
    searchParams.set("status", params.status);
  }

  const data = await apiFetch(`/supplier/b2b/api?${searchParams}`);
  return data as OrdersListResponse;
}

/**
 * List incoming orders
 */
export async function listIncoming(params?: {
  status?: string;
  page?: number;
  limit?: number;
}): Promise<OrdersListResponse> {
  const searchParams = new URLSearchParams({
    action: "listIncoming",
    page: (params?.page || 1).toString(),
    limit: (params?.limit || 20).toString(),
  });

  if (params?.status) {
    searchParams.set("status", params.status);
  }

  const data = await apiFetch(`/supplier/b2b/api?${searchParams}`);
  return data as OrdersListResponse;
}

/**
 * Get order details
 */
export async function getOrderDetails(orderId: number): Promise<OrderDetailsResponse> {
  const data = await apiFetch(`/supplier/b2b/api?action=getOrderDetails&orderId=${orderId}`);
  return data as OrderDetailsResponse;
}

/**
 * Update supplier decision
 *
 * ✅ Fixes:
 * - sends reason if provided
 * - does NOT default lineUpdates to [] (backend wants full lines for accept/finalize)
 */
export async function updateSupplierDecision(params: {
  orderId: number;
  decision: "accept" | "reject" | "propose_changes" | "finalize";
  lineUpdates?: LineUpdate[];
  reason?: string;
}): Promise<{ orderId: number; newStatus: string; message: string }> {
  const searchParams = new URLSearchParams({
    action: "updateSupplierDecision",
    orderId: params.orderId.toString(),
    decision: params.decision,
  });

  if (params.reason) {
    searchParams.set("reason", params.reason);
  }

  const response = await apiFetch(`/supplier/b2b/api?${searchParams}`, {
    method: "POST",
    body: JSON.stringify({
      lineUpdates: params.lineUpdates,
    }),
  });

  return response;
}

/**
 * Buyer accepts changes
 */
export async function buyerAcceptChanges(orderId: number): Promise<{
  orderId: number;
  newStatus: string;
  message: string;
}> {
  const data = await apiFetch(
    `/supplier/b2b/api?action=buyerAcceptChanges&orderId=${orderId}`,
    { method: "POST", body: "{}" }
  );

  return data;
}

/**
 * Get invoice HTML URL
 */
export function getInvoiceHtmlUrl(orderId: number): string {
  return `/supplier/b2b/api?action=invoiceHtml&orderId=${orderId}`;
}

/**
 * Download invoice as HTML
 */
export async function getInvoiceHtml(orderId: number): Promise<string> {
  const response = await apiFetch(`/supplier/b2b/api?action=invoiceHtml&orderId=${orderId}`);
  return (response as Response).text();
}

/**
 * Quick Buy: Submit cart items as B2B order
 */
export interface QuickBuyItem {
  productId: number;
  quantity: number;
}

export async function submitQuickBuy(items: QuickBuyItem[]): Promise<{
  parentOrderId: number;
  childOrders: number[];
  message: string;
}> {
  const data = await apiFetch(`/supplier/b2b/api?action=quickBuySubmit`, {
    method: "POST",
    body: JSON.stringify({ items }),
  });

  return data;
}

export default {
  searchB2B,
  downloadTemplate,
  importExcel,
  getDraft,
  getSupplierOptions,
  updateLineSupplier,
  removeLine,
  submitDraft,
  listOutgoing,
  listIncoming,
  getOrderDetails,
  updateSupplierDecision,
  buyerAcceptChanges,
  getInvoiceHtmlUrl,
  getInvoiceHtml,
  submitQuickBuy,
};
