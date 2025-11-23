/**
 * ✅ HOOK: useTableCommand
 *
 * Complete table command management with real-time status updates.
 * Handles table creation, joining, order placement, and group checkout.
 *
 * @author Gilbert (Frontend Integration)
 */

import { useState, useEffect, useCallback } from "react";
import {
  checkTableStatus,
  getActiveTables,
  sendTableOrder,
  closeTable,
  getTableOrders,
  removeOrderFromTable,
  type TableStatus,
  type SendTableOrderResponse,
} from "@/lib/api/table-commands";

interface UseTableCommandProps {
  tableName?: string;
  locationId?: string;
  userEmail?: string;
  autoRefresh?: boolean;
  refreshInterval?: number; // milliseconds
}

interface TableCommandState {
  tableStatus: TableStatus | null;
  orders: any[];
  isLoading: boolean;
  isSending: boolean;
  isClosing: boolean;
  error: string | null;
  masterOrder: SendTableOrderResponse | null;
}

export function useTableCommand({
  tableName,
  locationId,
  userEmail,
  autoRefresh = false,
  refreshInterval = 5000,
}: UseTableCommandProps = {}) {
  const [state, setState] = useState<TableCommandState>({
    tableStatus: null,
    orders: [],
    isLoading: false,
    isSending: false,
    isClosing: false,
    error: null,
    masterOrder: null,
  });

  /**
   * ✅ Check table status
   */
  const checkStatus = useCallback(
    async (table?: string, location?: string, email?: string) => {
      const _tableName = table || tableName;
      const _locationId = location || locationId;
      const _userEmail = email || userEmail;

      if (!_tableName || !_locationId) {
        return null;
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const status = await checkTableStatus(_tableName, _locationId, _userEmail);

        setState((prev) => ({
          ...prev,
          isLoading: false,
          tableStatus: status,
          error: status.ok ? null : status.message || "Failed to check status",
        }));

        return status;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMsg,
        }));
        return null;
      }
    },
    [tableName, locationId, userEmail]
  );

  /**
   * ✅ Get all orders for table
   */
  const fetchOrders = useCallback(
    async (table?: string, location?: string) => {
      const _tableName = table || tableName;
      const _locationId = location || locationId;

      if (!_tableName || !_locationId) {
        return [];
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const result = await getTableOrders(_tableName, _locationId);

        if (result.ok) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            orders: result.orders || [],
            error: null,
          }));
          return result.orders || [];
        } else {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: result.error || "Failed to fetch orders",
          }));
          return [];
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMsg,
        }));
        return [];
      }
    },
    [tableName, locationId]
  );

  /**
   * ✅ Send table order (create master order)
   */
  const sendOrder = useCallback(
    async (table?: string, location?: string, email?: string) => {
      const _tableName = table || tableName;
      const _locationId = location || locationId;
      const _userEmail = email || userEmail;

      if (!_tableName || !_locationId || !_userEmail) {
        setState((prev) => ({
          ...prev,
          error: "Table name, location, and user email required",
        }));
        return null;
      }

      setState((prev) => ({ ...prev, isSending: true, error: null }));

      try {
        const result = await sendTableOrder(_tableName, _locationId, _userEmail);

        if (result.ok) {
          setState((prev) => ({
            ...prev,
            isSending: false,
            masterOrder: result,
            error: null,
          }));

          // Refresh table status
          await checkStatus(_tableName, _locationId, _userEmail);
        } else {
          setState((prev) => ({
            ...prev,
            isSending: false,
            error: result.error || "Failed to send order",
          }));
        }

        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        setState((prev) => ({
          ...prev,
          isSending: false,
          error: errorMsg,
        }));
        return null;
      }
    },
    [tableName, locationId, userEmail, checkStatus]
  );

  /**
   * ✅ Close table
   */
  const close = useCallback(
    async (table?: string, location?: string, email?: string) => {
      const _tableName = table || tableName;
      const _locationId = location || locationId;
      const _userEmail = email || userEmail;

      if (!_tableName || !_locationId || !_userEmail) {
        setState((prev) => ({
          ...prev,
          error: "Table name, location, and user email required",
        }));
        return { ok: false, error: "Missing required parameters" };
      }

      setState((prev) => ({ ...prev, isClosing: true, error: null }));

      try {
        const result = await closeTable(_tableName, _locationId, _userEmail);

        if (result.ok) {
          setState((prev) => ({
            ...prev,
            isClosing: false,
            tableStatus: null,
            orders: [],
            masterOrder: null,
            error: null,
          }));
        } else {
          setState((prev) => ({
            ...prev,
            isClosing: false,
            error: result.error || "Failed to close table",
          }));
        }

        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        setState((prev) => ({
          ...prev,
          isClosing: false,
          error: errorMsg,
        }));
        return { ok: false, error: errorMsg };
      }
    },
    [tableName, locationId, userEmail]
  );

  /**
   * ✅ Remove order from table (user leaves)
   */
  const removeOrder = useCallback(
    async (
      orderId: number,
      table?: string,
      location?: string,
      email?: string
    ) => {
      const _tableName = table || tableName;
      const _locationId = location || locationId;
      const _userEmail = email || userEmail;

      if (!_tableName || !_locationId || !_userEmail) {
        return { ok: false, message: "", orderId: 0, error: "Missing parameters" };
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const result = await removeOrderFromTable(
          orderId,
          _tableName,
          _locationId,
          _userEmail
        );

        if (result.ok) {
          // Refresh orders
          await fetchOrders(_tableName, _locationId);
        } else {
          setState((prev) => ({
            ...prev,
            error: result.error || "Failed to remove order",
          }));
        }

        setState((prev) => ({ ...prev, isLoading: false }));
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMsg,
        }));
        return { ok: false, message: "", orderId: 0, error: errorMsg };
      }
    },
    [tableName, locationId, userEmail, fetchOrders]
  );

  /**
   * ✅ Search for active tables
   */
  const searchTables = useCallback(
    async (location?: string, search?: string) => {
      const _locationId = location || locationId;

      if (!_locationId) {
        return [];
      }

      try {
        const result = await getActiveTables(_locationId, search);
        return result.tables || [];
      } catch (error) {
        console.error("Error searching tables:", error);
        return [];
      }
    },
    [locationId]
  );

  /**
   * ✅ Auto-refresh table status and orders
   */
  useEffect(() => {
    if (!autoRefresh || !tableName || !locationId) {
      return;
    }

    const refresh = async () => {
      await checkStatus();
      await fetchOrders();
    };

    refresh(); // Initial fetch

    const interval = setInterval(refresh, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, tableName, locationId, refreshInterval, checkStatus, fetchOrders]);

  return {
    // State
    tableStatus: state.tableStatus,
    orders: state.orders,
    isLoading: state.isLoading,
    isSending: state.isSending,
    isClosing: state.isClosing,
    error: state.error,
    masterOrder: state.masterOrder,

    // Computed
    isTableActive: state.tableStatus?.status === "ACTIVE",
    isTableSent: state.tableStatus?.status === "SENT",
    isTableClosed: state.tableStatus?.status === "CLOSED",
    canJoinTable: state.tableStatus?.canJoin || false,
    isCreator: state.tableStatus?.isCreator || false,
    isLastSender: state.tableStatus?.isLastSender || false,
    canSendOrder: state.tableStatus?.status === "ACTIVE" && state.orders.length > 0,
    canCloseTable:
      (state.tableStatus?.isCreator || state.tableStatus?.isLastSender) &&
      state.tableStatus?.status === "SENT",
    totalOrders: state.orders.length,
    totalAmount: state.orders.reduce(
      (sum, order) => sum + (order.TOTAL_AMOUNT || 0),
      0
    ),

    // Actions
    checkStatus,
    fetchOrders,
    sendOrder,
    close,
    removeOrder,
    searchTables,
    refresh: () => {
      checkStatus();
      fetchOrders();
    },
  };
}
