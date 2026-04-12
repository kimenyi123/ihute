/**
 * ✅ COMPONENT: Enhanced Table Command Cart
 *
 * Real-time stock validation and reservation management.
 * Displays cart items with availability status and expiry countdown.
 *
 * @author Gilbert (Frontend Integration)
 */

"use client";

import { useState, useEffect } from "react";
import { useTableCommand } from "@/hooks/useTableCommand";
import { useStockReservation } from "@/hooks/useStockReservation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { kaosCatalogBaseUnitPrice } from "@/lib/kaos-catalog-price";
import {
  ShoppingCart,
  AlertTriangle,
  Clock,
  Check,
  X,
  Send,
  Loader2,
} from "lucide-react";

interface CartItem {
  itemCode: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  unit: string;
  /** Catalog package multiplier — forwarded to Kaos validateStock when set */
  itemEmballage?: string;
}

interface EnhancedTableCartProps {
  tableName: string;
  locationId: string;
  sellerAccount: string;
  userEmail: string;
  items: CartItem[];
  onRemoveItem: (itemCode: string) => void;
  onUpdateQuantity: (itemCode: string, quantity: number) => void;
  onCheckout: () => void;
  onSendOrder?: () => void;
}

export function EnhancedTableCart({
  tableName,
  locationId,
  sellerAccount,
  userEmail,
  items,
  onRemoveItem,
  onUpdateQuantity,
  onCheckout,
  onSendOrder,
}: EnhancedTableCartProps) {
  const [autoValidate, setAutoValidate] = useState(true);
  const [lastValidation, setLastValidation] = useState<Date | null>(null);

  const {
    tableStatus,
    orders,
    isSending,
    error: tableError,
    isCreator,
    canSendOrder,
    totalOrders,
    totalAmount: tableTotalAmount,
    sendOrder,
    fetchOrders,
  } = useTableCommand({
    tableName,
    locationId,
    userEmail,
    autoRefresh: true,
    refreshInterval: 10000, // 10 seconds
  });

  const {
    isValidating,
    isReserving,
    validationResult,
    reservationExpiry,
    formattedTimeRemaining,
    error: stockError,
    hasStockIssues,
    unavailableItems,
    isExpired,
    isReserved,
    validate,
    reserve,
    clearReservation,
  } = useStockReservation({
    sellerAccount,
    buyerEmail: userEmail,
    tableName,
    autoValidate: false,
  });

  // Calculate cart total
  const cartTotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );

  /**
   * ✅ Auto-validate stock when items change
   */
  useEffect(() => {
    if (!autoValidate || items.length === 0) return;

    const validateTimer = setTimeout(() => {
      const stockItems = items.map((item) => ({
        itemCode: item.itemCode,
        itemName: item.itemName,
        quantity: item.quantity,
        unitPrice: kaosCatalogBaseUnitPrice(item.unitPrice, item.itemEmballage),
        ...(item.itemEmballage
          ? { item_emballage: item.itemEmballage, ITEM_EMBALLAGE: item.itemEmballage }
          : {}),
      }));

      validate(stockItems);
      setLastValidation(new Date());
    }, 500); // Debounce 500ms

    return () => clearTimeout(validateTimer);
  }, [items, autoValidate, validate]);

  /**
   * ✅ Handle checkout with stock reservation
   */
  const handleCheckout = async () => {
    // 1. Validate stock
    const stockItems = items.map((item) => ({
      itemCode: item.itemCode,
      itemName: item.itemName,
      quantity: item.quantity,
      unitPrice: kaosCatalogBaseUnitPrice(item.unitPrice, item.itemEmballage),
      ...(item.itemEmballage
        ? { item_emballage: item.itemEmballage, ITEM_EMBALLAGE: item.itemEmballage }
        : {}),
    }));

    const validation = await validate(stockItems);

    if (!validation.allAvailable) {
      return; // Show validation errors
    }

    // 2. Reserve stock (optional - can be done in backend during order creation)
    // const reservation = await reserve(stockItems);
    // if (!reservation.ok) {
    //   return;
    // }

    // 3. Proceed to checkout
    onCheckout();
  };

  /**
   * ✅ Handle send table order (master order creation)
   */
  const handleSendOrder = async () => {
    if (!canSendOrder) return;

    const result = await sendOrder();

    if (result?.ok) {
      clearReservation();
      onSendOrder?.();
    }
  };

  /**
   * ✅ Render stock status badge
   */
  const renderStockBadge = (itemCode: string) => {
    if (!validationResult || isValidating) {
      return (
        <Badge variant="outline" className="text-xs">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Checking...
        </Badge>
      );
    }

    const itemValidation = validationResult.items.find(
      (v) => v.itemCode === itemCode
    );

    if (!itemValidation) return null;

    if (itemValidation.isAvailable) {
      return (
        <Badge variant="default" className="text-xs bg-green-500">
          <Check className="h-3 w-3 mr-1" />
          Available ({itemValidation.availableQty})
        </Badge>
      );
    } else {
      return (
        <Badge variant="destructive" className="text-xs">
          <X className="h-3 w-3 mr-1" />
          Only {itemValidation.availableQty} available
        </Badge>
      );
    }
  };

  return (
    <div className="space-y-4">
      {/* Reservation Timer */}
      {isReserved && formattedTimeRemaining && (
        <Alert className="bg-blue-50 border-blue-200">
          <Clock className="h-4 w-4" />
          <AlertDescription>
            Stock reserved for <strong>{formattedTimeRemaining}</strong>
            {isExpired && " - Reservation expired!"}
          </AlertDescription>
        </Alert>
      )}

      {/* Stock Validation Errors */}
      {hasStockIssues && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Stock Issues:</strong>
            <ul className="mt-2 list-disc list-inside">
              {unavailableItems.map((item) => (
                <li key={item.itemCode}>
                  {item.itemName}: Requested {item.requestedQty}, Available{" "}
                  {item.availableQty}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Cart Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Your Cart ({items.length} items)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Your cart is empty
            </p>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.itemCode}
                  className="flex items-start justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium">{item.itemName}</h4>
                        <p className="text-sm text-muted-foreground">
                          {item.quantity} {item.unit} × {item.unitPrice.toLocaleString()} RWF
                        </p>
                      </div>
                      {renderStockBadge(item.itemCode)}
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          onUpdateQuantity(item.itemCode, item.quantity - 1)
                        }
                        disabled={item.quantity <= 1}
                      >
                        -
                      </Button>
                      <span className="w-12 text-center">{item.quantity}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          onUpdateQuantity(item.itemCode, item.quantity + 1)
                        }
                      >
                        +
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => onRemoveItem(item.itemCode)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>

                  <div className="text-right ml-4">
                    <p className="font-bold">
                      {(item.quantity * item.unitPrice).toLocaleString()} RWF
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Cart Total */}
          {items.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-lg">Total:</span>
                <span className="font-bold text-xl">
                  {cartTotal.toLocaleString()} RWF
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table Summary */}
      {tableStatus && tableStatus.status === "ACTIVE" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Table: {tableName}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Status:</span>
                <Badge>{tableStatus.status}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Total Orders:</span>
                <strong>{totalOrders}</strong>
              </div>
              <div className="flex justify-between">
                <span>Table Total:</span>
                <strong>{tableTotalAmount.toLocaleString()} RWF</strong>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="space-y-2">
        {/* Checkout Button */}
        {items.length > 0 && (
          <Button
            className="w-full"
            size="lg"
            onClick={handleCheckout}
            disabled={hasStockIssues || isValidating || isReserving}
          >
            {isValidating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Validating Stock...
              </>
            ) : isReserving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Reserving Stock...
              </>
            ) : (
              <>Proceed to Checkout</>
            )}
          </Button>
        )}

        {/* Send Order Button (Creator Only) */}
        {isCreator && canSendOrder && (
          <Button
            className="w-full"
            size="lg"
            variant="default"
            onClick={handleSendOrder}
            disabled={isSending}
          >
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending Order...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Table Order ({totalOrders} orders)
              </>
            )}
          </Button>
        )}
      </div>

      {/* Errors */}
      {(stockError || tableError) && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{stockError || tableError}</AlertDescription>
        </Alert>
      )}

      {/* Last Validation Time */}
      {lastValidation && (
        <p className="text-xs text-center text-muted-foreground">
          Last checked: {lastValidation.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
