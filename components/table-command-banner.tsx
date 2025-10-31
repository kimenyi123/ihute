"use client"

import { useTableCommandStore } from "@/lib/table-command-store"
import { Button } from "@/components/ui/button"
import { Users, X, Beer, AlertCircle, Lock, CheckCircle } from "lucide-react"
import { useState } from "react"
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
  const { activeSession, leaveTableCommand, isInTableCommand, canCloseTable, closeTableCommand } = useTableCommandStore()
  const [showLeaveDialog, setShowLeaveDialog] = useState(false)
  const [showCloseDialog, setShowCloseDialog] = useState(false)

  // Show banner for any session (ACTIVE, SENT, or CLOSED)
  if (!activeSession) {
    return null
  }

  const isActive = activeSession.status === "ACTIVE"
  const isSent = activeSession.status === "SENT"
  const isClosed = activeSession.status === "CLOSED"

  const handleLeave = () => {
    leaveTableCommand()
    setShowLeaveDialog(false)
  }

  // Background color based on status
  const bgClass = isClosed
    ? "bg-gradient-to-r from-gray-500 to-gray-600"
    : isSent
    ? "bg-gradient-to-r from-orange-500 to-red-500"
    : "bg-gradient-to-r from-amber-500 to-orange-500"

  return (
    <>
      <div className={`${bgClass} border-b border-amber-600 shadow-md`}>
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm shrink-0">
                {isClosed ? (
                  <CheckCircle className="h-5 w-5 text-white" />
                ) : isSent ? (
                  <Lock className="h-5 w-5 text-white" />
                ) : (
                  <Beer className="h-5 w-5 text-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-white">
                    {isClosed ? "Table Closed:" : isSent ? "Table Locked:" : "Table Command Mode:"}
                  </span>
                  <span className="font-mono font-bold text-white bg-white/20 px-2 py-0.5 rounded">
                    {activeSession.tableName}
                  </span>
                  {isSent && (
                    <span className="text-xs bg-white/30 text-white px-2 py-0.5 rounded">
                      Order Sent
                    </span>
                  )}
                  {isClosed && (
                    <span className="text-xs bg-white/30 text-white px-2 py-0.5 rounded">
                      Completed
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/90 truncate">
                  {isClosed
                    ? "This table session is closed. Create a new one to order more."
                    : isSent
                    ? `Order sent! ${activeSession.isCreator || activeSession.lastSentBy === activeSession.userEmail ? "You can close this table or keep it open." : "Waiting for table owner to close."}`
                    : `Ordering at ${activeSession.locationName}${activeSession.isCreator ? " • You created this table" : ""}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Show Close Table button when table is SENT and user is authorized */}
              {isSent && canCloseTable() && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCloseDialog(true)}
                  className="text-white hover:bg-white/20 hover:text-white gap-1.5 bg-white/10"
                >
                  <CheckCircle className="h-4 w-4" />
                  <span className="hidden sm:inline">Close Table</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowLeaveDialog(true)}
                className="text-white hover:bg-white/20 hover:text-white gap-1.5"
              >
                <X className="h-4 w-4" />
                <span className="hidden sm:inline">Leave Table</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Leave Confirmation Dialog */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              Leave Table Command?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave table "{activeSession.tableName}"?
              {activeSession.isCreator && (
                <span className="block mt-2 text-amber-600 font-medium">
                  Note: You created this table. Leaving won't delete it, but others can still join and order.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeave} className="bg-red-600 hover:bg-red-700">
              Leave Table
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Close Table Confirmation Dialog */}
      <AlertDialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-orange-600" />
              Close Table "{activeSession.tableName}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to close this table? No one will be able to add more items after closing.
              {activeSession.isCreator && (
                <span className="block mt-2 text-orange-600 font-medium">
                  Note: You created this table. Closing it will end the session for everyone.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                closeTableCommand()
                setShowCloseDialog(false)
              }}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Close Table
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
