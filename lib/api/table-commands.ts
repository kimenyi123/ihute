/**
 * ✅ FRONTEND API: Table Commands
 *
 * Provides clean API methods for interacting with the refactored backend.
 * Handles table creation, joining, sending, and closing operations.
 */

import { getBackendBase } from "@/lib/backend-config";

function getApiBase(): string {
  try {
    return getBackendBase();
  } catch {
    return process.env.NEXT_PUBLIC_API_URL || "https://ihute.rw/Trading";
  }
}

const API_BASE = getApiBase();

export interface TableStatus {
  ok: boolean;
  exists: boolean;
  status?: "ACTIVE" | "SENT" | "CLOSED" | "EXPIRED";
  createdBy?: string;
  canJoin: boolean;
  message?: string;
  lastSentBy?: string;
  isCreator?: boolean;
  isLastSender?: boolean;
}

export interface SendTableOrderResponse {
  ok: boolean;
  masterOrderId: number;
  tableName: string;
  childOrderCount: number;
  totalAmount: number;
  sentBy: string;
  childOrders: Array<{
    orderId: number;
    buyerEmail: string;
    buyerName: string;
    amount: number;
    currency: string;
  }>;
  error?: string;
}

export interface CreateOrderResponse {
  ok: boolean;
  orderId: number;
  paymentName: string;
  tableCommand?: {
    tableName: string;
    tableLocation: string;
    status: string;
    tableCommandId?: number;
    shareableLink?: string;
    shareableToken?: string;
    qrCodeUrl?: string;
  };
  error?: string;
  stockError?: boolean;
}

export interface RemoveOrderResponse {
  ok: boolean;
  message: string;
  orderId: number;
  error?: string;
}

/**
 * ✅ Check table status before joining/creating
 */
export async function checkTableStatus(
  tableName: string,
  locationId: string,
  userEmail?: string
): Promise<TableStatus> {
  try {
    const url = new URL(`${API_BASE}/Kaos/OrdersServlet`);
    url.searchParams.set("action", "checkTableStatus");
    url.searchParams.set("tableName", tableName);
    url.searchParams.set("locationId", locationId);
    if (userEmail) {
      url.searchParams.set("userEmail", userEmail);
    }

    const response = await fetch(url.toString());
    const data = await response.json();

    return data;
  } catch (error) {
    console.error("❌ checkTableStatus error:", error);
    return {
      ok: false,
      exists: false,
      canJoin: false,
      message: "Failed to check table status",
    };
  }
}

/**
 * ✅ Create table command on the backend (so table exists before checkout).
 * Call this when the user clicks "Create table" so others can join via the share link.
 */
export interface CreateTableCommandResponse {
  ok: boolean;
  tableCommandId?: number;
  tableName?: string;
  tableLocation?: string;
  status?: string;
  shareableLink?: string;
  shareableToken?: string;
  qrCodeUrl?: string;
  message?: string;
  error?: string;
}

export async function createTableCommandApi(params: {
  tableName: string;
  locationId: string;
  locationName: string;
  userEmail: string;
  userName?: string;
}): Promise<CreateTableCommandResponse> {
  try {
    // Use Next.js API route (same origin) to avoid CORS when frontend and backend are on different domains
    const response = await fetch("/api/table-commands/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tableName: params.tableName.trim(),
        locationId: params.locationId,
        locationName: params.locationName || "",
        userEmail: params.userEmail,
        userName: params.userName || "Guest",
      }),
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("❌ createTableCommandApi error:", error);
    return {
      ok: false,
      error: "Failed to create table",
    };
  }
}

/**
 * ✅ Get list of active tables (for autocomplete/join)
 */
export async function getActiveTables(
  locationId: string,
  search?: string
): Promise<{ ok: boolean; tables: any[]; error?: string }> {
  try {
    const url = new URL(`${API_BASE}/Kaos/OrdersServlet`);
    url.searchParams.set("action", "getActiveTables");
    url.searchParams.set("locationId", locationId);
    if (search) {
      url.searchParams.set("search", search);
    }

    const response = await fetch(url.toString());
    const data = await response.json();

    return data;
  } catch (error) {
    console.error("❌ getActiveTables error:", error);
    return {
      ok: false,
      tables: [],
      error: "Failed to fetch active tables",
    };
  }
}

/**
 * ✅ Create order (supports both table command and individual orders)
 */
export async function createOrder(orderData: {
  items: Array<{
    name: string;
    qty: number;
    unitPrice: number;
    unit: string;
    itemCode?: string;
  }>;
  sellerAccount: string;
  sellerName: string;
  sellerPhone?: string;
  buyerEmail: string;
  buyerName: string;
  buyerPhone: string;
  buyerLocation?: string;
  paymentName?: string;
  paymentId?: string;
  currency?: string;
  isTableCommand?: boolean;
  tableName?: string;
  tableLocation?: string;
}): Promise<CreateOrderResponse> {
  try {
    const response = await fetch(`${API_BASE}/Kaos/OrdersServlet?action=createOrder`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...orderData,
        paymentName: orderData.paymentName || "PAY_ON_DELIVERY",
        currency: orderData.currency || "RWF",
        buyerLocation: orderData.buyerLocation || "NA",
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("❌ createOrder error:", error);
    return {
      ok: false,
      orderId: 0,
      paymentName: "",
      error: "Failed to create order",
    };
  }
}

/**
 * ✅ Send complete table order (creates master order)
 */
export async function sendTableOrder(
  tableName: string,
  locationId: string,
  userEmail: string
): Promise<SendTableOrderResponse> {
  try {
    // Use Next.js API route (same origin) to avoid CORS when frontend and backend are on different domains
    const response = await fetch("/api/table-commands/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableName, locationId, userEmail }),
    });

    const data = await response.json();
    // Normalize to SendTableOrderResponse shape
    return {
      ok: data.ok ?? false,
      masterOrderId: data.masterOrderId ?? 0,
      tableName: data.tableName ?? tableName,
      childOrderCount: data.childOrderCount ?? data.orderCount ?? 0,
      totalAmount: data.totalAmount ?? 0,
      sentBy: data.sentBy ?? "",
      childOrders: data.childOrders ?? data.orders ?? [],
      error: data.error,
    };
  } catch (error) {
    console.error("❌ sendTableOrder error:", error);
    return {
      ok: false,
      masterOrderId: 0,
      tableName: "",
      childOrderCount: 0,
      totalAmount: 0,
      sentBy: "",
      childOrders: [],
      error: "Failed to send table order",
    };
  }
}

/**
 * ✅ Close table (final step)
 */
export async function closeTable(
  tableName: string,
  locationId: string,
  userEmail: string
): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const url = new URL(`${API_BASE}/Kaos/OrdersServlet`);
    url.searchParams.set("action", "closeTable");
    url.searchParams.set("tableName", tableName);
    url.searchParams.set("locationId", locationId);
    url.searchParams.set("userEmail", userEmail);

    const response = await fetch(url.toString(), {
      method: "POST",
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("❌ closeTable error:", error);
    return {
      ok: false,
      error: "Failed to close table",
    };
  }
}

/**
 * ✅ Remove order from table (when user leaves before order is sent)
 */
export async function removeOrderFromTable(
  orderId: number,
  tableName: string,
  locationId: string,
  userEmail: string
): Promise<RemoveOrderResponse> {
  try {
    const url = new URL(`${API_BASE}/Kaos/OrdersServlet`);
    url.searchParams.set("action", "removeOrderFromTable");
    url.searchParams.set("orderId", orderId.toString());
    url.searchParams.set("tableName", tableName);
    url.searchParams.set("locationId", locationId);
    url.searchParams.set("userEmail", userEmail);

    const response = await fetch(url.toString(), {
      method: "POST",
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("❌ removeOrderFromTable error:", error);
    return {
      ok: false,
      message: "",
      orderId: 0,
      error: "Failed to remove order",
    };
  }
}

/**
 * ✅ Get all orders for a table
 */
export async function getTableOrders(tableName: string, locationId: string) {
  try {
    const url = new URL(`${API_BASE}/Kaos/OrdersServlet`);
    url.searchParams.set("action", "getTableOrders");
    url.searchParams.set("tableName", tableName);
    url.searchParams.set("locationId", locationId);

    const response = await fetch(url.toString());
    const data = await response.json();

    return data;
  } catch (error) {
    console.error("❌ getTableOrders error:", error);
    return {
      ok: false,
      orders: [],
      error: "Failed to fetch table orders",
    };
  }
}

/**
 * ✅ Complete table order (send + close in one call) - Convenience method
 */
export async function completeTableOrder(
  tableName: string,
  locationId: string,
  userEmail: string
): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const url = new URL(`${API_BASE}/Kaos/OrdersServlet`);
    url.searchParams.set("action", "completeTableOrder");
    url.searchParams.set("tableName", tableName);
    url.searchParams.set("locationId", locationId);
    url.searchParams.set("userEmail", userEmail);

    const response = await fetch(url.toString(), {
      method: "POST",
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("❌ completeTableOrder error:", error);
    return {
      ok: false,
      error: "Failed to complete table order",
    };
  }
}

/**
 * ✅ Stock Management API
 */

export interface StockItem {
  itemCode: string;
  itemName: string;
  quantity: number;
}

export interface StockValidationResponse {
  ok: boolean;
  allAvailable: boolean;
  items: Array<{
    itemCode: string;
    itemName: string;
    requestedQty: number;
    availableQty: number;
    reserved: number;
    isAvailable: boolean;
  }>;
  error?: string;
}

export interface StockReservationResponse {
  ok: boolean;
  reservationId?: number;
  expiresAt?: string;
  message?: string;
  error?: string;
}

/**
 * ✅ Validate stock availability before creating order
 */
export async function validateStock(
  items: StockItem[],
  sellerAccount: string
): Promise<StockValidationResponse> {
  try {
    const response = await fetch(`${API_BASE}/Kaos/OrdersServlet?action=validateStock`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items,
        sellerAccount,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("❌ validateStock error:", error);
    return {
      ok: false,
      allAvailable: false,
      items: [],
      error: "Failed to validate stock",
    };
  }
}

/**
 * ✅ Reserve stock for table command orders (30-minute hold)
 */
export async function reserveStock(
  items: StockItem[],
  buyerEmail: string,
  sellerAccount: string,
  tableName?: string,
  orderId?: number
): Promise<StockReservationResponse> {
  try {
    const response = await fetch(`${API_BASE}/Kaos/OrdersServlet?action=reserveStock`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items,
        buyerEmail,
        sellerAccount,
        tableName,
        orderId,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("❌ reserveStock error:", error);
    return {
      ok: false,
      error: "Failed to reserve stock",
    };
  }
}

/**
 * ✅ Get real-time stock status for items
 */
export async function getStockStatus(
  itemCodes: string[],
  sellerAccount: string
): Promise<{
  ok: boolean;
  stocks: Array<{
    itemCode: string;
    itemName: string;
    totalStock: number;
    reservedStock: number;
    availableStock: number;
  }>;
  error?: string;
}> {
  try {
    const response = await fetch(`${API_BASE}/Kaos/OrdersServlet?action=getStockStatus`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        itemCodes,
        sellerAccount,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("❌ getStockStatus error:", error);
    return {
      ok: false,
      stocks: [],
      error: "Failed to get stock status",
    };
  }
}

/**
 * ✅ Payment Management API
 */

export interface PaymentMethod {
  id: string;
  name: string;
  type: "IMMEDIATE" | "ON_DELIVERY";
  icon?: string;
}

export const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: "PAY_ON_DELIVERY",
    name: "Pay on Delivery",
    type: "ON_DELIVERY",
    icon: "💵",
  },
  {
    id: "MOBILE_MONEY",
    name: "Mobile Money",
    type: "IMMEDIATE",
    icon: "📱",
  },
  {
    id: "CARD",
    name: "Credit/Debit Card",
    type: "IMMEDIATE",
    icon: "💳",
  },
  {
    id: "CASH",
    name: "Cash",
    type: "ON_DELIVERY",
    icon: "💰",
  },
];

/**
 * ✅ Get order payment status
 */
export async function getPaymentStatus(
  orderId: number
): Promise<{
  ok: boolean;
  paymentStatus: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
  paymentMethod?: string;
  paymentId?: string;
  error?: string;
}> {
  try {
    const url = new URL(`${API_BASE}/Kaos/OrdersServlet`);
    url.searchParams.set("action", "paymentStatus");
    url.searchParams.set("orderId", orderId.toString());

    const response = await fetch(url.toString());
    const data = await response.json();

    return data;
  } catch (error) {
    console.error("❌ getPaymentStatus error:", error);
    return {
      ok: false,
      paymentStatus: "PENDING",
      error: "Failed to get payment status",
    };
  }
}
