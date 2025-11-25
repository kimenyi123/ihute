/**
 * ✅ HOOK: useStockReservation
 *
 * Manages stock reservations with automatic expiry tracking.
 * Validates stock before order creation and reserves inventory for 30 minutes.
 *
 * @author Gilbert (Frontend Integration)
 */

import { useState, useEffect, useCallback } from "react";
import {
  validateStock,
  reserveStock,
  getStockStatus,
  type StockItem,
  type StockValidationResponse,
} from "@/lib/api/table-commands";

interface UseStockReservationProps {
  sellerAccount: string;
  buyerEmail?: string;
  tableName?: string;
  autoValidate?: boolean;
}

interface StockReservationState {
  isValidating: boolean;
  isReserving: boolean;
  validationResult: StockValidationResponse | null;
  reservationExpiry: Date | null;
  error: string | null;
}

export function useStockReservation({
  sellerAccount,
  buyerEmail,
  tableName,
  autoValidate = false,
}: UseStockReservationProps) {
  const [state, setState] = useState<StockReservationState>({
    isValidating: false,
    isReserving: false,
    validationResult: null,
    reservationExpiry: null,
    error: null,
  });

  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  /**
   * ✅ Validate stock availability
   */
  const validate = useCallback(
    async (items: StockItem[]) => {
      if (!items.length) {
        setState((prev) => ({
          ...prev,
          validationResult: {
            ok: true,
            allAvailable: true,
            items: [],
          },
        }));
        return { ok: true, allAvailable: true, items: [] };
      }

      setState((prev) => ({ ...prev, isValidating: true, error: null }));

      try {
        const result = await validateStock(items, sellerAccount);

        setState((prev) => ({
          ...prev,
          isValidating: false,
          validationResult: result,
          error: result.ok ? null : result.error || "Validation failed",
        }));

        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        setState((prev) => ({
          ...prev,
          isValidating: false,
          error: errorMsg,
        }));

        return {
          ok: false,
          allAvailable: false,
          items: [],
          error: errorMsg,
        };
      }
    },
    [sellerAccount]
  );

  /**
   * ✅ Reserve stock (creates 30-minute hold)
   */
  const reserve = useCallback(
    async (items: StockItem[], orderId?: number) => {
      if (!buyerEmail) {
        setState((prev) => ({
          ...prev,
          error: "Buyer email required for reservation",
        }));
        return { ok: false, error: "Buyer email required" };
      }

      setState((prev) => ({ ...prev, isReserving: true, error: null }));

      try {
        const result = await reserveStock(
          items,
          buyerEmail,
          sellerAccount,
          tableName,
          orderId
        );

        if (result.ok && result.expiresAt) {
          const expiry = new Date(result.expiresAt);
          setState((prev) => ({
            ...prev,
            isReserving: false,
            reservationExpiry: expiry,
            error: null,
          }));
        } else {
          setState((prev) => ({
            ...prev,
            isReserving: false,
            error: result.error || "Reservation failed",
          }));
        }

        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        setState((prev) => ({
          ...prev,
          isReserving: false,
          error: errorMsg,
        }));

        return { ok: false, error: errorMsg };
      }
    },
    [buyerEmail, sellerAccount, tableName]
  );

  /**
   * ✅ Get real-time stock status
   */
  const getStatus = useCallback(
    async (itemCodes: string[]) => {
      try {
        const result = await getStockStatus(itemCodes, sellerAccount);
        return result;
      } catch (error) {
        console.error("Error getting stock status:", error);
        return { ok: false, stocks: [], error: "Failed to get stock status" };
      }
    },
    [sellerAccount]
  );

  /**
   * ✅ Clear reservation state
   */
  const clearReservation = useCallback(() => {
    setState((prev) => ({
      ...prev,
      reservationExpiry: null,
      timeRemaining: null,
    }));
    setTimeRemaining(null);
  }, []);

  /**
   * ✅ Auto-update time remaining until expiry
   */
  useEffect(() => {
    if (!state.reservationExpiry) {
      setTimeRemaining(null);
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      const diff = state.reservationExpiry!.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining(0);
        setState((prev) => ({ ...prev, reservationExpiry: null }));
      } else {
        setTimeRemaining(Math.floor(diff / 1000)); // seconds
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [state.reservationExpiry]);

  /**
   * ✅ Format time remaining as MM:SS
   */
  const formatTimeRemaining = useCallback(() => {
    if (timeRemaining === null) return null;

    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }, [timeRemaining]);

  return {
    // State
    isValidating: state.isValidating,
    isReserving: state.isReserving,
    validationResult: state.validationResult,
    reservationExpiry: state.reservationExpiry,
    timeRemaining,
    formattedTimeRemaining: formatTimeRemaining(),
    error: state.error,
    isExpired: timeRemaining === 0,
    isReserved: state.reservationExpiry !== null && timeRemaining !== 0,

    // Computed
    hasStockIssues:
      state.validationResult !== null && !state.validationResult.allAvailable,
    unavailableItems:
      state.validationResult?.items.filter((item) => !item.isAvailable) || [],

    // Actions
    validate,
    reserve,
    getStatus,
    clearReservation,
  };
}
