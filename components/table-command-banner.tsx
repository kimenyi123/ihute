"use client"

import { useTableCommandStore } from "@/lib/table-command-store"
import { Button } from "@/components/ui/button"
import { Beer, X, Lock, CheckCircle, Send, Link2 } from "lucide-react"
import { useEffect, useState } from "react"
import { TableCommandShareModal } from "@/components/table-command-share-modal"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export function TableCommandBanner() {
  const {
    activeSession,
    leaveTableCommand,
    canCloseTable,
    closeTableCommand,
    sendTableOrder,
  } = useTableCommandStore()

  const [showLeaveDialog, setShowLeaveDialog] = useState(false)
  const [showCloseDialog, setShowCloseDialog] = useState(false)
  const [showSendDialog, setShowSendDialog] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [closeError, setCloseError] = useState("")
  const [sendError, setSendError] = useState("")
  const [sendSuccess, setSendSuccess] = useState<any>(null)
  const [isSending, setIsSending] = useState(false)

  const isActive = activeSession?.status === "ACTIVE"
  const isSent = activeSession?.status === "SENT"
  const isClosed = activeSession?.status === "CLOSED"
  const userCanClose = canCloseTable()

  useEffect(() => {
    if (isClosed && activeSession) {
      const timer = setTimeout(() => {
        leaveTableCommand()
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [isClosed, leaveTableCommand, activeSession])

  if (!activeSession) return null

  // background color based on status
  const bgClass = isClosed
    ? "bg-gradient-to-r from-gray-500 to-gray-600"
    : isSent
    ? "bg-gradient-to-r from-orange-500 to-red-500"
    : "bg-gradient-to-r from-amber-500 to-orange-500"

  const handleSendTableOrder = async () => {
    setSendError("")
    setSendSuccess(null)
    setIsSending(true)
    try {
      const result = await sendTableOrder()
      setSendSuccess(result)
      // Auto-close dialog after 3 seconds on success
      setTimeout(() => {
        setShowSendDialog(false)
        setSendSuccess(null)
      }, 3000)
    } catch (error: any) {
      setSendError(error.message || "Failed to send table order.")
    } finally {
      setIsSending(false)
    }
  }

  const handleCloseTable = async () => {
    setCloseError("")
    try {
      await closeTableCommand()
      setShowCloseDialog(false)
    } catch (error: any) {
      setCloseError(error.message || "Failed to close table.")
    }
  }

  const handleLeaveTable = () => {
    leaveTableCommand()
    setShowLeaveDialog(false)
  }

  return (
    <>
      <div className={`${bgClass} border-b border-amber-600 shadow-md`}>
        <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-3">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            {/* LEFT: Table info */}
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <div className="flex items-center justify-center h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-white/20 backdrop-blur-sm shrink-0">
                {isClosed ? (
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                ) : isSent ? (
                  <Lock className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                ) : (
                  <Beer className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                  <span className="text-xs sm:text-sm font-semibold text-white">
                    {isClosed ? "Closed:" : isSent ? "Locked:" : "Table:"}
                  </span>
                  <span className="font-mono font-bold text-xs sm:text-sm text-white bg-white/20 px-1.5 sm:px-2 py-0.5 rounded truncate max-w-[120px] sm:max-w-none">
                    {activeSession.tableName}
                  </span>

                  {isSent && (
                    <span className="text-[10px] sm:text-xs bg-white/30 text-white px-1.5 sm:px-2 py-0.5 rounded whitespace-nowrap">
                      Order Sent
                    </span>
                  )}
                  {isClosed && (
                    <span className="text-[10px] sm:text-xs bg-white/30 text-white px-1.5 sm:px-2 py-0.5 rounded whitespace-nowrap">
                      Completed
                    </span>
                  )}
                </div>

                <p className="text-[10px] sm:text-xs text-white/90 truncate hidden sm:block">
                  {isClosed
                    ? "This table session is closed. Create a new one to order more."
                    : isSent
                    ? userCanClose
                      ? "Order sent! You can close this table."
                      : "Order sent! Waiting for the table owner to close."
                    : `Ordering at ${activeSession.locationName}${
                        activeSession.isCreator ? " • You created this table" : ""
                      }`}
                </p>
              </div>
            </div>

            {/* RIGHT: Buttons */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              {/* SEND COMPLETE TABLE ORDER BUTTON (ACTIVE tables, creators only) */}
              {isActive && activeSession.isCreator && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSendDialog(true)}
                  className="text-white hover:bg-white/20 hover:text-white gap-1 sm:gap-1.5 bg-emerald-600 hover:bg-emerald-700 h-7 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm font-semibold"
                >
                  <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Send Complete Order</span>
                  <span className="sm:hidden">Send</span>
                </Button>
              )}

              {/* SHARE TABLE LINK BUTTON (creators only) */}
              {activeSession.isCreator && activeSession.shareableLink && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowShareModal(true)}
                  className="text-white hover:bg-white/20 hover:text-white gap-1 sm:gap-1.5 bg-blue-600 hover:bg-blue-700 h-7 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm"
                >
                  <Link2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Share</span>
                </Button>
              )}

              {isSent && userCanClose && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCloseDialog(true)}
                  className="text-white hover:bg-white/20 hover:text-white gap-1 sm:gap-1.5 bg-white/10 h-7 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm"
                >
                  <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Close Table</span>
                  <span className="sm:hidden">Close</span>
                </Button>
              )}

              {isSent && !userCanClose && (
                <div className="text-[10px] sm:text-xs text-white/80 bg-white/10 px-2 sm:px-3 py-1 sm:py-1.5 rounded">
                  Only table creator can close
                </div>
              )}

              {/* Leave Table button - hidden when table is closed (auto-leaves) */}
              {!isClosed && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowLeaveDialog(true)}
                  className="text-white hover:bg-white/20 hover:text-white gap-1 sm:gap-1.5 h-7 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm"
                >
                  <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Leave Table</span>
                  <span className="sm:hidden">Leave</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Leave Table Confirmation */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent className="max-w-md w-[95vw] sm:w-full">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <X className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
              Leave Table "{activeSession.tableName}"?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm">
              Are you sure you want to leave this table session?
              {activeSession.isCreator && (
                <span className="block mt-2 text-amber-600 font-medium text-xs sm:text-sm">
                  Note: You created this table. Leaving won’t delete it — others can still use it.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto text-xs sm:text-sm">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeaveTable}
              className="bg-red-600 hover:bg-red-700 w-full sm:w-auto text-xs sm:text-sm"
            >
              Leave Table
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send Complete Table Order Confirmation */}
      <AlertDialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <AlertDialogContent className="max-w-md w-[95vw] sm:w-full">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Send className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
              Send Complete Table Order?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm">
              This will send all orders from table <span className="font-mono font-semibold">"{activeSession.tableName}"</span> to the kitchen/bar as one master order.
              <span className="block mt-2 text-amber-600 font-medium">
                After sending, no one can add more items. You'll still be able to close the table afterward.
              </span>
              {sendError && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                  <p className="text-red-700 text-xs">{sendError}</p>
                </div>
              )}
              {sendSuccess && (
                <div className="mt-2 p-2 bg-emerald-50 border border-emerald-200 rounded">
                  <p className="text-emerald-700 text-xs font-semibold">
                    ✅ Order sent successfully!
                  </p>
                  <p className="text-emerald-600 text-xs mt-1">
                    Master Order ID: {sendSuccess.masterOrderId}
                  </p>
                  <p className="text-emerald-600 text-xs">
                    Total: {sendSuccess.totalAmount} RWF
                  </p>
                  <p className="text-emerald-600 text-xs">
                    {sendSuccess.childOrderCount} orders combined
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel
              className="w-full sm:w-auto text-xs sm:text-sm"
              onClick={() => {
                setSendError("")
                setSendSuccess(null)
              }}
              disabled={isSending}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSendTableOrder}
              className="bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto text-xs sm:text-sm"
              disabled={isSending}
            >
              {isSending ? "Sending..." : "Send Order"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Close Table Confirmation */}
      <AlertDialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <AlertDialogContent className="max-w-md w-[95vw] sm:w-full">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Lock className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />
              Close Table "{activeSession.tableName}"?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm">
              Are you sure you want to close this table? No one will be able to add more items after closing.
              {closeError && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                  <p className="text-red-700 text-xs">{closeError}</p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel
              className="w-full sm:w-auto text-xs sm:text-sm"
              onClick={() => setCloseError("")}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCloseTable}
              className="bg-orange-600 hover:bg-orange-700 w-full sm:w-auto text-xs sm:text-sm"
            >
              Close Table
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Share Modal */}
      {activeSession.shareableLink && (
        <TableCommandShareModal
          open={showShareModal}
          onOpenChange={setShowShareModal}
          data={{
            tableName: activeSession.tableName,
            tableLocation: activeSession.locationName,
            shareableLink: activeSession.shareableLink,
            qrCodeUrl: activeSession.qrCodeUrl || "",
            shareableToken: activeSession.shareableToken || "",
          }}
        />
      )}
    </>
  )
}
