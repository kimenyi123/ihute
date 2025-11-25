"use client"

import { useState, useEffect, useRef } from "react"
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
import { Users, Plus, LogIn, Beer, Utensils, User, Search, Loader2, AlertTriangle } from "lucide-react"
import { useTableCommandStore, getOrCreateGuestEmail } from "@/lib/table-command-store"
import { useAuthStore } from "@/lib/auth-store"

type TableInfo = {
  tableName: string
  status: string
  participantCount?: number
  canJoin?: boolean
}

type TableCommandDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  locationId: string
  locationName: string
  onIndividualOrder?: () => void
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
  const [activeTables, setActiveTables] = useState<TableInfo[]>([])
  const [loadingTables, setLoadingTables] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && mode === "join" && locationId) {
      fetchActiveTables()
    }
  }, [open, mode, locationId])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const fetchActiveTables = async (searchTerm?: string) => {
    setLoadingTables(true)
    try {
      const url = new URL("/api/table-commands/list", window.location.origin)
      url.searchParams.set("locationId", locationId)
      if (searchTerm) {
        url.searchParams.set("search", searchTerm)
      }

      const res = await fetch(url.toString())
      const json = await res.json()

      if (json.ok) {
        setActiveTables(json.tables || [])
      }
    } catch (err) {
      console.error("Failed to fetch active tables:", err)
    } finally {
      setLoadingTables(false)
    }
  }

  const handleTableNameChange = (value: string) => {
    setTableName(value)
    setError("")

    if (mode === "join" && value.length > 0) {
      setShowSuggestions(true)
      const timer = setTimeout(() => {
        fetchActiveTables(value)
      }, 300)
      return () => clearTimeout(timer)
    } else {
      setShowSuggestions(false)
    }
  }

  const selectTable = (table: TableInfo) => {
    if (table.canJoin !== false) {
      setTableName(table.tableName)
      setShowSuggestions(false)
    }
  }

  const filteredTables = activeTables.filter((table) =>
    table.tableName.toLowerCase().includes(tableName.toLowerCase())
  )

  const handleSubmit = async () => {
    if (submitting) return
    
    if (mode === "individual") {
      onOpenChange(false)
      if (onIndividualOrder) {
        onIndividualOrder()
      }
      return
    }

    if (!tableName.trim()) {
      setError("Please enter a table name")
      return
    }
    if (!userName.trim() && !isAuthenticated) {
      setError("Please enter your name")
      return
    }

    setSubmitting(true)
    setError("")

    try {
      // ✅ CRITICAL FIX: Get consistent user email
      const userEmail = isAuthenticated 
        ? (user?.email || user?.phone || getOrCreateGuestEmail()) 
        : getOrCreateGuestEmail() // Use persistent guest email
      
      console.log('🎫 Using user email:', userEmail)

      // ✅ Check table status before joining
      if (mode === "join") {
        const res = await fetch("/api/table-commands/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tableName: tableName.trim(),
            locationId,
          }),
        })
        const json = await res.json()

        if (json?.status !== "ACTIVE") {
          const statusMessage = json?.status === "SENT" 
            ? "is locked (order already sent)" 
            : json?.status === "CLOSED"
            ? "is closed"
            : "is not available"
          
          setError(
            `Table "${tableName.trim()}" ${statusMessage}. ` +
            `Please create a new table (e.g., ${tableName.trim()}-2) or select a different table.`
          )
          setSubmitting(false)
          return
        }
      }

      // Create or join table command with consistent email
      if (mode === "create") {
        createTableCommand(
          tableName.trim(), 
          locationId, 
          locationName, 
          userName.trim() || "Guest", 
          userEmail
        )
      } else if (mode === "join") {
        joinTableCommand(
          tableName.trim(), 
          locationId, 
          locationName, 
          userName.trim() || "Guest", 
          userEmail
        )
      }

      onOpenChange(false)
      setTableName("")
      setError("")
      
    } catch (err: any) {
      console.error("Error submitting table command:", err)
      setError(err?.message || "Failed to join/create table. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    onOpenChange(false)
    setTableName("")
    setError("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Beer className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 flex-shrink-0" />
            <span className="truncate">Table Command Mode</span>
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Order together with your group at <span className="font-medium break-words">{locationName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4 py-2 sm:py-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 sm:p-3">
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <Utensils className="h-3 w-3 sm:h-4 sm:w-4 text-amber-700 flex-shrink-0" />
              <span className="font-medium text-amber-900 break-words">{locationName}</span>
            </div>
            <p className="text-[10px] sm:text-xs text-amber-700 mt-1">
              Perfect for group ordering! All items will be combined into one order.
            </p>
          </div>

          <div className="space-y-2 sm:space-y-3">
            <Label className="text-xs sm:text-sm font-medium">What would you like to do?</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as "create" | "join" | "individual")}>
              <div
                className="flex items-center space-x-2 sm:space-x-3 border rounded-lg p-2 sm:p-3 cursor-pointer hover:bg-accent"
                onClick={() => setMode("create")}
              >
                <RadioGroupItem value="create" id="create-table" className="flex-shrink-0" />
                <Label htmlFor="create-table" className="cursor-pointer flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                  <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-xs sm:text-sm">Create New Table</div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground">
                      Start a new table command for your group
                    </div>
                  </div>
                </Label>
              </div>

              <div
                className="flex items-center space-x-2 sm:space-x-3 border rounded-lg p-2 sm:p-3 cursor-pointer hover:bg-accent"
                onClick={() => setMode("join")}
              >
                <RadioGroupItem value="join" id="join-table" className="flex-shrink-0" />
                <Label htmlFor="join-table" className="cursor-pointer flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                  <LogIn className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-xs sm:text-sm">Join Existing Table</div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground">
                      Join a table that someone else created
                    </div>
                  </div>
                </Label>
              </div>

              <div
                className="flex items-center space-x-2 sm:space-x-3 border rounded-lg p-2 sm:p-3 cursor-pointer hover:bg-accent"
                onClick={() => setMode("individual")}
              >
                <RadioGroupItem value="individual" id="order-individual" className="flex-shrink-0" />
                <Label htmlFor="order-individual" className="cursor-pointer flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                  <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-600 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-xs sm:text-sm">Order Individually</div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground">
                      Place your own order without joining a table
                    </div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {mode !== "individual" && (
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="tableName" className="text-xs sm:text-sm font-medium">
                {mode === "create" ? "Table Name *" : "Search & Select Table *"}
              </Label>
              <div className="relative">
                <div className="relative">
                  <Input
                    ref={inputRef}
                    id="tableName"
                    value={tableName}
                    onChange={(e) => handleTableNameChange(e.target.value)}
                    onFocus={() => {
                      if (mode === "join" && activeTables.length > 0) {
                        setShowSuggestions(true)
                      }
                    }}
                    placeholder={
                      mode === "create"
                        ? "e.g., Algorithm, VIP..."
                        : "Search for active tables..."
                    }
                    className="font-mono pr-8 sm:pr-10 text-xs sm:text-sm"
                    disabled={submitting}
                  />
                  {mode === "join" && (
                    <div className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      {loadingTables ? (
                        <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                      )}
                    </div>
                  )}
                </div>

                {mode === "join" && showSuggestions && filteredTables.length > 0 && (
                  <div
                    ref={suggestionsRef}
                    className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 sm:max-h-60 overflow-y-auto"
                  >
                    <div className="p-1.5 sm:p-2 border-b bg-gray-50 sticky top-0">
                      <p className="text-[10px] sm:text-xs text-gray-600 font-medium">
                        {filteredTables.filter(t => t.canJoin !== false).length} Active {filteredTables.filter(t => t.canJoin !== false).length === 1 ? "Table" : "Tables"}
                      </p>
                    </div>
                    {filteredTables.map((table, index) => {
                      const isLocked = table.canJoin === false || table.status === "SENT" || table.status === "CLOSED"
                      return (
                        <button
                          key={index}
                          type="button"
                          onClick={() => !isLocked && selectTable(table)}
                          disabled={isLocked}
                          className={`w-full text-left px-2 sm:px-4 py-2 sm:py-3 transition-colors border-b last:border-b-0 ${
                            isLocked
                              ? "bg-gray-50 cursor-not-allowed opacity-60"
                              : "hover:bg-amber-50 cursor-pointer active:bg-amber-100"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                              <Beer className="h-3 w-3 sm:h-4 sm:w-4 text-amber-600 flex-shrink-0" />
                              <span className="font-mono font-medium text-gray-900 text-xs sm:text-sm truncate">
                                {table.tableName}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                              {table.participantCount && table.participantCount > 0 && (
                                <span className="text-[10px] sm:text-xs text-gray-500 hidden xs:inline">
                                  {table.participantCount} {table.participantCount === 1 ? "person" : "people"}
                                </span>
                              )}
                              <span
                                className={`text-[9px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full font-medium whitespace-nowrap ${
                                  isLocked
                                    ? "bg-red-100 text-red-700"
                                    : "bg-green-100 text-green-700"
                                }`}
                              >
                                {isLocked ? "🔒 Locked" : "✓ Active"}
                              </span>
                            </div>
                          </div>
                          {isLocked && (
                            <div className="flex items-center gap-1 mt-1 ml-4 sm:ml-6">
                              <AlertTriangle className="h-3 w-3 text-red-600" />
                              <p className="text-[9px] sm:text-xs text-red-600">
                                Cannot join - order already sent
                              </p>
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}

                {mode === "join" &&
                  showSuggestions &&
                  tableName.length > 0 &&
                  filteredTables.length === 0 &&
                  !loadingTables && (
                    <div
                      ref={suggestionsRef}
                      className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 sm:p-4"
                    >
                      <p className="text-xs sm:text-sm text-gray-600 text-center">
                        No active tables found. Check the table name or create a new one.
                      </p>
                    </div>
                  )}
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                {mode === "create"
                  ? "Choose a unique name your friends can use to join"
                  : activeTables.length > 0
                  ? "Select from active tables or type to search"
                  : "Type the table name your group is using"}
              </p>
            </div>
          )}

          {mode !== "individual" && !isAuthenticated && (
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="userName" className="text-xs sm:text-sm font-medium">
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
                className="text-xs sm:text-sm"
                disabled={submitting}
              />
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                So your group knows who ordered what
              </p>
            </div>
          )}

          {mode === "individual" && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-2 sm:p-4">
              <p className="text-xs sm:text-sm text-purple-900">
                <strong>Individual Order:</strong> You'll proceed with a regular checkout flow.
                Enter your delivery location, choose payment method, and place your order.
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2 sm:p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs sm:text-sm text-red-700 break-words flex-1">{error}</p>
              </div>
            </div>
          )}

          {mode !== "individual" && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 sm:p-3">
              <p className="text-[10px] sm:text-xs text-blue-900">
                <strong>How it works:</strong> Everyone at your table can add items to their order. When ready,
                any member can send the combined order to the bar/restaurant. The table will be locked after sending.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 flex-col sm:flex-row">
          <Button 
            variant="outline" 
            onClick={handleCancel} 
            className="w-full sm:w-auto text-xs sm:text-sm"
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            className="gap-1.5 sm:gap-2 w-full sm:w-auto text-xs sm:text-sm"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : mode === "individual" ? (
              <>
                <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="truncate">Continue to Checkout</span>
              </>
            ) : (
              <>
                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="truncate">{mode === "create" ? "Create Table" : "Join Table"}</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}