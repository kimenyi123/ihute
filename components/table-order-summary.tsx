/**
 * ✅ COMPONENT: Table Order Summary
 *
 * Displays master order details after table order is sent.
 * Shows aggregated items, child orders, and payment breakdown.
 *
 * @author Gilbert (Frontend Integration)
 */

"use client";

import { useState, useEffect } from "react";
import { useTableCommand } from "@/hooks/useTableCommand";
import { getPaymentStatus } from "@/lib/api/table-commands";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Receipt,
  Users,
  ShoppingBag,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Download,
} from "lucide-react";

interface TableOrderSummaryProps {
  tableName: string;
  locationId: string;
  locationName: string;
  userEmail: string;
  masterOrderId?: number;
  onClose?: () => void;
}

export function TableOrderSummary({
  tableName,
  locationId,
  locationName,
  userEmail,
  masterOrderId,
  onClose,
}: TableOrderSummaryProps) {
  const [paymentStatus, setPaymentStatus] = useState<string>("PENDING");
  const [isLoadingPayment, setIsLoadingPayment] = useState(false);

  const {
    tableStatus,
    orders,
    masterOrder,
    isLoading,
    isClosing,
    error,
    isCreator,
    isLastSender,
    canCloseTable,
    totalOrders,
    totalAmount,
    close,
    refresh,
  } = useTableCommand({
    tableName,
    locationId,
    userEmail,
    autoRefresh: true,
    refreshInterval: 15000, // 15 seconds
  });

  /**
   * ✅ Fetch payment status for master order
   */
  useEffect(() => {
    if (!masterOrderId && !masterOrder?.masterOrderId) return;

    const fetchPaymentStatus = async () => {
      setIsLoadingPayment(true);
      const orderId = masterOrderId || masterOrder?.masterOrderId || 0;
      const result = await getPaymentStatus(orderId);

      if (result.ok) {
        setPaymentStatus(result.paymentStatus);
      }
      setIsLoadingPayment(false);
    };

    fetchPaymentStatus();

    // Poll payment status every 10 seconds
    const interval = setInterval(fetchPaymentStatus, 10000);
    return () => clearInterval(interval);
  }, [masterOrderId, masterOrder]);

  /**
   * ✅ Handle close table
   */
  const handleCloseTable = async () => {
    const result = await close();
    if (result.ok) {
      onClose?.();
    }
  };

  /**
   * ✅ Render payment status badge
   */
  const renderPaymentBadge = () => {
    if (isLoadingPayment) {
      return (
        <Badge variant="outline">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Checking...
        </Badge>
      );
    }

    switch (paymentStatus) {
      case "PAID":
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Paid
          </Badge>
        );
      case "PENDING":
        return (
          <Badge variant="outline">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "FAILED":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">{paymentStatus}</Badge>;
    }
  };

  /**
   * ✅ Render table status badge
   */
  const renderTableStatusBadge = () => {
    if (!tableStatus) return null;

    const status = tableStatus.status;
    const variant =
      status === "ACTIVE"
        ? "default"
        : status === "SENT"
        ? "secondary"
        : "outline";

    return <Badge variant={variant}>{status}</Badge>;
  };

  if (isLoading && !masterOrder && orders.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Table Order: {tableName}
              </CardTitle>
              <CardDescription className="mt-1">
                {locationName}
              </CardDescription>
            </div>
            <div className="flex flex-col items-end gap-2">
              {renderTableStatusBadge()}
              {masterOrder && renderPaymentBadge()}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Master Order Details */}
      {masterOrder && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Master Order Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Order ID</p>
                <p className="font-semibold">#{masterOrder.masterOrderId}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="font-bold text-lg">
                  {masterOrder.totalAmount.toLocaleString()} RWF
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Child Orders</p>
                <p className="font-semibold">{masterOrder.childOrderCount}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sent By</p>
                <p className="font-semibold text-sm">{masterOrder.sentBy}</p>
              </div>
            </div>

            <Separator />

            {/* Child Orders Breakdown */}
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Individual Orders ({masterOrder.childOrders.length})
              </h4>

              <div className="space-y-2">
                {masterOrder.childOrders.map((childOrder, index) => (
                  <div
                    key={childOrder.orderId}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{childOrder.buyerName}</p>
                      <p className="text-xs text-muted-foreground">
                        {childOrder.buyerEmail}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {childOrder.amount.toLocaleString()} {childOrder.currency}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Order #{childOrder.orderId}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Orders (Before Sending) */}
      {!masterOrder && orders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              Current Orders ({orders.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {orders.map((order) => (
                <div
                  key={order.ID_ORDER}
                  className="flex items-start justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium">{order.BUYER_NAME}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.BUYER_EMAIL}
                    </p>
                    <div className="mt-2 text-sm">
                      <p className="text-muted-foreground">
                        {order.ITEMS_COUNT || 0} item(s)
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">
                      {(order.TOTAL_AMOUNT || 0).toLocaleString()} RWF
                    </p>
                    <Badge variant="outline" className="mt-1 text-xs">
                      {order.PAYMENT_NAME}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>

            <Separator className="my-4" />

            <div className="flex justify-between items-center">
              <span className="font-semibold">Table Total:</span>
              <span className="font-bold text-xl">
                {totalAmount.toLocaleString()} RWF
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="space-y-2">
        {/* Close Table Button */}
        {canCloseTable && (
          <Alert className="bg-blue-50 border-blue-200">
            <AlertDescription>
              <div className="flex items-center justify-between">
                <div>
                  <strong>Ready to close?</strong>
                  <p className="text-sm mt-1">
                    Close this table after all orders are delivered and paid.
                  </p>
                </div>
                <Button
                  variant="default"
                  onClick={handleCloseTable}
                  disabled={isClosing}
                >
                  {isClosing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Closing...
                    </>
                  ) : (
                    "Close Table"
                  )}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Download Receipt (Future Feature) */}
        {masterOrder && (
          <Button variant="outline" className="w-full" disabled>
            <Download className="mr-2 h-4 w-4" />
            Download Receipt (Coming Soon)
          </Button>
        )}

        {/* Refresh Button */}
        <Button variant="outline" className="w-full" onClick={refresh}>
          Refresh Status
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Status Messages */}
      {tableStatus?.status === "CLOSED" && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            This table has been closed. Thank you!
          </AlertDescription>
        </Alert>
      )}

      {!isCreator && !isLastSender && tableStatus?.status === "SENT" && (
        <Alert>
          <AlertDescription className="text-sm">
            Only the table creator or the person who sent the order can close this
            table.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
