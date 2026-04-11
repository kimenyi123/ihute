"use client"

import { useState } from "react"
import { ShoppingCart, Send, Trash2, AlertCircle, Users, Plus } from "lucide-react"

// Mock store hooks - replace with your actual imports
const useCartStore = () => ({
  items: [
    { id: 1, name: "Beer", qty: 2, price: 1000, unit: "bottle", selectedUnit: "bottle" },
    { id: 2, name: "Fries", qty: 1, price: 2000, unit: "plate", selectedUnit: "plate" }
  ],
  getTotalPrice: () => 4000,
  clearCart: () => console.log("Clear cart"),
  remove: (id: number, unit: string) => console.log("Remove", id, unit)
})

const useTableCommandStore = () => ({
  activeSession: {
    tableName: "Algorithm",
    locationId: "ALGGG0942009",
    locationName: "The Spot Bar",
    userName: "John Doe",
    userEmail: "john@example.com",
    status: "ACTIVE",
    isCreator: true,
    lastSentBy: null
  },
  isInTableCommand: () => true,
  canCloseTable: () => true,
  closeTableCommand: () => console.log("Close table")
})

// UI Components
const Button = ({ children, variant = "default", size = "default", className = "", onClick, disabled }: any) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`px-4 py-2 rounded font-medium transition-colors ${
      variant === "outline" ? "border border-gray-300 hover:bg-gray-50" :
      variant === "ghost" ? "hover:bg-gray-100" :
      "bg-blue-600 text-white hover:bg-blue-700"
    } ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
  >
    {children}
  </button>
)

const Sheet = ({ children, open, onOpenChange }: any) => (
  <div className={`fixed inset-0 z-50 ${open ? "" : "hidden"}`}>
    <div className="fixed inset-0 bg-black/50" onClick={() => onOpenChange(false)} />
    <div className="fixed right-0 top-0 h-full w-full sm:max-w-lg bg-white shadow-xl">
      {children}
    </div>
  </div>
)

const SheetTrigger = ({ children, asChild }: any) => <>{children}</>
const SheetContent = ({ children, className }: any) => <div className={`flex flex-col h-full ${className}`}>{children}</div>
const SheetHeader = ({ children }: any) => <div className="border-b p-4">{children}</div>
const SheetTitle = ({ children, className }: any) => <h2 className={`text-lg font-semibold ${className}`}>{children}</h2>
const SheetDescription = ({ children, className }: any) => <p className={`text-sm text-gray-600 mt-1 ${className}`}>{children}</p>
const SheetFooter = ({ children, className }: any) => <div className={`border-t p-4 mt-auto ${className}`}>{children}</div>

const AlertDialog = ({ children, open, onOpenChange }: any) => (
  <div className={`fixed inset-0 z-50 flex items-center justify-center ${open ? "" : "hidden"}`}>
    <div className="fixed inset-0 bg-black/50" onClick={() => onOpenChange(false)} />
    <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
      {children}
    </div>
  </div>
)

const AlertDialogContent = ({ children }: any) => <>{children}</>
const AlertDialogHeader = ({ children }: any) => <div className="mb-4">{children}</div>
const AlertDialogTitle = ({ children, className }: any) => <h3 className={`text-lg font-semibold ${className}`}>{children}</h3>
const AlertDialogDescription = ({ children, className }: any) => <p className={`text-sm text-gray-600 mt-2 ${className}`}>{children}</p>
const AlertDialogFooter = ({ children, className }: any) => <div className={`flex gap-2 mt-6 ${className}`}>{children}</div>
const AlertDialogCancel = ({ children, disabled, className }: any) => (
  <button disabled={disabled} className={`px-4 py-2 border rounded hover:bg-gray-50 ${className}`}>{children}</button>
)
const AlertDialogAction = ({ children, onClick, disabled, className }: any) => (
  <button onClick={onClick} disabled={disabled} className={`px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 ${className}`}>
    {children}
  </button>
)

export default function TableCommandCartFixed() {
  const { items, getTotalPrice, clearCart, remove } = useCartStore()
  const { activeSession, isInTableCommand } = useTableCommandStore()
  const totalPrice = getTotalPrice()
  const [open, setOpen] = useState(false)
  const [showSendDialog, setShowSendDialog] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")

  const isTableActive = activeSession?.status === "ACTIVE"
  const isTableSent = activeSession?.status === "SENT"

  // ✅ NEW: Add items to table WITHOUT sending
  const handleAddToTable = async () => {
    if (!activeSession || !isInTableCommand()) {
      setError("You are not in an active table command session")
      return
    }

    if (items.length === 0) {
      setError("Your cart is empty. Add items before submitting.")
      return
    }

    setSending(true)
    setError("")

    try {
      // Create individual order for this person (table stays ACTIVE)
      const response = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => {
            const row = item as {
              name: string
              qty: number
              price: number
              unit?: string
              itemCode?: string
              id: string | number
              itemEmballage?: string
            }
            return {
              name: row.name,
              qty: row.qty,
              unitPrice: row.price,
              unit: row.unit || "pcs",
              itemCode: row.itemCode ?? String(row.id),
              ...(row.itemEmballage
                ? { item_emballage: row.itemEmballage, ITEM_EMBALLAGE: row.itemEmballage }
                : {}),
            }
          }),
          sellerAccount: activeSession.locationId,
          sellerName: activeSession.locationName,
          buyerEmail: activeSession.userEmail,
          buyerName: activeSession.userName,
          isTableCommand: true,
          tableName: activeSession.tableName,
          tableLocation: activeSession.locationName,
          paymentName: "PAY_ON_DELIVERY",
        }),
      })

      const result = await response.json()

      if (!result.ok) {
        throw new Error(result.error || "Failed to add items to table")
      }

      // ✅ SUCCESS: Items added, table still ACTIVE
      clearCart()
      setOpen(false)
      alert(`✅ Your order added to table "${activeSession.tableName}"!\n\nItems: ${items.length}\nTotal: ${totalPrice} RWF\n\nTable is still open for others to join.`)

    } catch (err: any) {
      console.error("Error adding to table:", err)
      setError(err.message || "Failed to add items to table")
    } finally {
      setSending(false)
    }
  }

  // ✅ SEPARATE: Send complete table order (locks table)
  const handleSendTableOrder = async () => {
    if (!activeSession || !isInTableCommand()) {
      setError("You are not in an active table command session")
      return
    }

    setSending(true)
    setError("")

    try {
      // Send the combined table order (this locks the table to SENT)
      const sendResponse = await fetch("/api/table-commands/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableName: activeSession.tableName,
          locationId: activeSession.locationId,
          userEmail: activeSession.userEmail,
        }),
      })

      const sendResult = await sendResponse.json()

      if (!sendResult.ok) {
        throw new Error(sendResult.error || "Failed to send table order")
      }

      setShowSendDialog(false)
      alert(`✅ Complete table order sent!\n\nTable: ${activeSession.tableName}\nOrders: ${sendResult.orderCount}\nTotal: ${sendResult.totalAmount} RWF\n\n🔒 Table is now locked.`)

    } catch (err: any) {
      console.error("Error sending table order:", err)
      setError(err.message || "Failed to send table order")
    } finally {
      setSending(false)
    }
  }

  if (items.length === 0) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <ShoppingCart className="h-4 w-4" />
            <span>Cart (0)</span>
          </Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Your Cart</SheetTitle>
            <SheetDescription>Your cart is empty</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}>
            <ShoppingCart className="h-4 w-4" />
            <span>Cart ({items.length})</span>
          </Button>
        </SheetTrigger>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Your Cart
            </SheetTitle>
            {isInTableCommand() && isTableActive && (
              <SheetDescription className="flex items-center gap-2 text-amber-600">
                <Users className="h-4 w-4" />
                Table: <span className="font-mono font-medium">{activeSession?.tableName}</span>
              </SheetDescription>
            )}
          </SheetHeader>

          <div className="flex flex-col gap-4 py-4 flex-1 overflow-y-auto">
            {items.map((item) => (
              <div key={`${item.id}-${item.selectedUnit}`} className="flex items-center justify-between gap-4 border-b pb-3">
                <div className="flex-1">
                  <h4 className="font-medium">{item.name}</h4>
                  <p className="text-sm text-gray-500">
                    {item.qty} × {item.price.toLocaleString()} RWF
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">
                    {(item.qty * item.price).toLocaleString()} RWF
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(item.id, item.selectedUnit)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          <SheetFooter className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-lg font-bold border-t pt-3">
              <span>Total:</span>
              <span>{totalPrice.toLocaleString()} RWF</span>
            </div>

            {/* ✅ NEW: Different buttons based on context */}
            {isInTableCommand() && isTableActive ? (
              <>
                {/* Add to table WITHOUT locking */}
                <Button
                  onClick={handleAddToTable}
                  className="w-full gap-2"
                  disabled={sending}
                >
                  <Plus className="h-4 w-4" />
                  {sending ? "Adding..." : "Add My Order to Table"}
                </Button>

                {/* Only table creator or authorized users can send complete order */}
                {activeSession?.isCreator && (
                  <Button
                    onClick={() => setShowSendDialog(true)}
                    className="w-full gap-2 bg-green-600 hover:bg-green-700"
                    variant="outline"
                  >
                    <Send className="h-4 w-4" />
                    Send Complete Table Order
                  </Button>
                )}

                <p className="text-xs text-gray-600 text-center">
                  ℹ️ Your items will be added to the table. Others can still join and order.
                  {activeSession?.isCreator && " You can send the complete order when everyone is ready."}
                </p>
              </>
            ) : isTableSent ? (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-xs text-orange-700">
                  Table order already sent. Create a new table to continue ordering.
                </p>
              </div>
            ) : (
              <Button onClick={() => window.location.href = "/checkout"} className="w-full gap-2">
                <ShoppingCart className="h-4 w-4" />
                Proceed to Checkout
              </Button>
            )}

            <Button variant="outline" onClick={() => clearCart()} className="w-full">
              Clear Cart
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Send Complete Order Dialog */}
      <AlertDialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-600" />
              Send Complete Table Order?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will send ALL orders from table "<span className="font-mono font-medium">{activeSession?.tableName}</span>"
              to the supplier. After sending:
              <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                <li>🔒 Table will be locked</li>
                <li>❌ No one else can join</li>
                <li>✅ All orders will be combined</li>
                <li>📨 Supplier receives complete order</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSendTableOrder} disabled={sending}>
              {sending ? "Sending..." : "Send Complete Order"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}