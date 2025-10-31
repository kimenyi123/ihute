"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Users, Plus, LogIn, Beer, Utensils, User } from "lucide-react"
import { useTableCommandStore } from "@/lib/table-command-store"
import { useAuthStore } from "@/lib/auth-store"

type TableCommandDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  locationId: string
  locationName: string
  onIndividualOrder?: () => void // Callback for individual ordering
}

export function TableCommandDialog({
  open,
  onOpenChange,
  locationId,
  locationName,
  onIndividualOrder,
}: TableCommandDialogProps) {
  const { user, isAuthenticated } = useAuthStore()
  const { createTableCommand, joinTableCommand } = useTableCommandStore()

  const [mode, setMode] = useState<"create" | "join" | "individual">("create")
  const [tableName, setTableName] = useState("")
  const [userName, setUserName] = useState(user?.name || "")
  const [error, setError] = useState("")

  const handleSubmit = async () => {
    // Handle individual ordering
    if (mode === "individual") {
      onOpenChange(false)
      if (onIndividualOrder) {
        onIndividualOrder()
      }
      return
    }

    // Validation for table command modes
    if (!tableName.trim()) {
      setError("Please enter a table name")
      return
    }
    if (!userName.trim() && !isAuthenticated) {
      setError("Please enter your name")
      return
    }

    // Get user email/phone for tracking
    const userEmail = isAuthenticated ? (user?.email || user?.phone || `guest_${Date.now()}`) : `guest_${Date.now()}`

    // If joining, check table status first
    if (mode === "join") {
      try {
        const res = await fetch("/api/table-commands/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tableName: tableName.trim(),
            locationId,
          }),
        })
        const json = await res.json()

        if (json?.status === "SENT" || json?.status === "CLOSED") {
          setError(`Table "${tableName.trim()}" is no longer active. Please create a new one (e.g., ${tableName.trim()}-2)`)
          return
        }
      } catch (err) {
        console.error("Failed to check table status:", err)
        // Continue anyway - backend will validate
      }
    }

    // Create or join table command
    if (mode === "create") {
      createTableCommand(tableName.trim(), locationId, locationName, userName.trim(), userEmail)
    } else if (mode === "join") {
      joinTableCommand(tableName.trim(), locationId, locationName, userName.trim(), userEmail)
    }

    // Close dialog
    onOpenChange(false)

    // Reset form
    setTableName("")
    setError("")
  }

  const handleCancel = () => {
    onOpenChange(false)
    setTableName("")
    setError("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Beer className="h-5 w-5 text-amber-600" />
            Table Command Mode
          </DialogTitle>
          <DialogDescription>
            Order together with your group at {locationName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Location Info */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-sm">
              <Utensils className="h-4 w-4 text-amber-700" />
              <span className="font-medium text-amber-900">{locationName}</span>
            </div>
            <p className="text-xs text-amber-700 mt-1">
              Perfect for group ordering! All items will be combined into one order.
            </p>
          </div>

          {/* Mode Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">What would you like to do?</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as "create" | "join" | "individual")}>
              <div
                className="flex items-center space-x-3 border rounded-lg p-3 cursor-pointer hover:bg-accent"
                onClick={() => setMode("create")}
              >
                <RadioGroupItem value="create" id="create-table" />
                <Label htmlFor="create-table" className="cursor-pointer flex items-center gap-2 flex-1">
                  <Plus className="h-4 w-4 text-green-600" />
                  <div>
                    <div className="font-medium">Create New Table</div>
                    <div className="text-xs text-muted-foreground">
                      Start a new table command for your group
                    </div>
                  </div>
                </Label>
              </div>

              <div
                className="flex items-center space-x-3 border rounded-lg p-3 cursor-pointer hover:bg-accent"
                onClick={() => setMode("join")}
              >
                <RadioGroupItem value="join" id="join-table" />
                <Label htmlFor="join-table" className="cursor-pointer flex items-center gap-2 flex-1">
                  <LogIn className="h-4 w-4 text-blue-600" />
                  <div>
                    <div className="font-medium">Join Existing Table</div>
                    <div className="text-xs text-muted-foreground">
                      Join a table that someone else created
                    </div>
                  </div>
                </Label>
              </div>

              <div
                className="flex items-center space-x-3 border rounded-lg p-3 cursor-pointer hover:bg-accent"
                onClick={() => setMode("individual")}
              >
                <RadioGroupItem value="individual" id="order-individual" />
                <Label htmlFor="order-individual" className="cursor-pointer flex items-center gap-2 flex-1">
                  <User className="h-4 w-4 text-purple-600" />
                  <div>
                    <div className="font-medium">Order Individually</div>
                    <div className="text-xs text-muted-foreground">
                      Place your own order without joining a table
                    </div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Table Name Input - Only show for create/join modes */}
          {mode !== "individual" && (
            <div className="space-y-2">
              <Label htmlFor="tableName" className="text-sm font-medium">
                {mode === "create" ? "Table Name *" : "Table Name to Join *"}
              </Label>
              <Input
                id="tableName"
                value={tableName}
                onChange={(e) => {
                  setTableName(e.target.value)
                  setError("")
                }}
                placeholder={mode === "create" ? "e.g., Algorithm, VIP Table 5, etc." : "Enter the table name"}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                {mode === "create"
                  ? "Choose a unique name your friends can use to join"
                  : "Ask your group for the table name"}
              </p>
            </div>
          )}

          {/* User Name Input - Only for table modes when not authenticated */}
          {mode !== "individual" && !isAuthenticated && (
            <div className="space-y-2">
              <Label htmlFor="userName" className="text-sm font-medium">
                Your Name *
              </Label>
              <Input
                id="userName"
                value={userName}
                onChange={(e) => {
                  setUserName(e.target.value)
                  setError("")
                }}
                placeholder="Enter your name"
              />
              <p className="text-xs text-muted-foreground">
                So your group knows who ordered what
              </p>
            </div>
          )}

          {/* Individual Mode Info */}
          {mode === "individual" && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <p className="text-sm text-purple-900">
                <strong>Individual Order:</strong> You'll proceed with a regular checkout flow.
                Enter your delivery location, choose payment method, and place your order.
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Info Box - Only for table modes */}
          {mode !== "individual" && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-900">
                <strong>How it works:</strong> Everyone at your table can add items to their order. When ready,
                the table creator or any member can send the combined order to the bar/restaurant.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="gap-2">
            {mode === "individual" ? (
              <>
                <User className="h-4 w-4" />
                Continue to Checkout
              </>
            ) : (
              <>
                <Users className="h-4 w-4" />
                {mode === "create" ? "Create Table" : "Join Table"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
