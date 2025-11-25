/**
 * ✅ COMPONENT: Enhanced Table Command Dialog
 *
 * Complete table command creation/join flow with payment method selection.
 * Supports both table creation and joining existing tables.
 *
 * @author Gilbert (Frontend Integration)
 */

"use client";

import { useState, useEffect } from "react";
import { useTableCommand } from "@/hooks/useTableCommand";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/api/table-commands";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Users,
  Plus,
  LogIn,
  AlertTriangle,
  Check,
  Loader2,
  Search,
} from "lucide-react";

interface EnhancedTableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationId: string;
  locationName: string;
  userEmail: string;
  onTableJoined?: (tableName: string) => void;
  onTableCreated?: (tableName: string) => void;
}

type DialogMode = "initial" | "create" | "join" | "payment";

export function EnhancedTableDialog({
  open,
  onOpenChange,
  locationId,
  locationName,
  userEmail,
  onTableJoined,
  onTableCreated,
}: EnhancedTableDialogProps) {
  const [mode, setMode] = useState<DialogMode>("initial");
  const [tableName, setTableName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>(
    "PAY_ON_DELIVERY"
  );
  const [availableTables, setAvailableTables] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const {
    tableStatus,
    isLoading,
    error,
    checkStatus,
    searchTables,
  } = useTableCommand({
    locationId,
    userEmail,
  });

  /**
   * ✅ Search for active tables
   */
  useEffect(() => {
    if (mode !== "join") return;

    const search = async () => {
      setIsSearching(true);
      const tables = await searchTables(locationId, searchQuery);
      setAvailableTables(tables);
      setIsSearching(false);
    };

    const debounce = setTimeout(search, 300);
    return () => clearTimeout(debounce);
  }, [mode, searchQuery, locationId, searchTables]);

  /**
   * ✅ Handle table name input
   */
  const handleTableNameChange = (value: string) => {
    // Auto-uppercase and remove spaces
    const cleaned = value.toUpperCase().replace(/\s+/g, "");
    setTableName(cleaned);
  };

  /**
   * ✅ Validate table name
   */
  const isValidTableName = (name: string) => {
    return name.length >= 3 && name.length <= 50 && /^[A-Z0-9_-]+$/.test(name);
  };

  /**
   * ✅ Handle create table
   */
  const handleCreateTable = async () => {
    if (!isValidTableName(tableName)) {
      return;
    }

    // Check if table already exists
    const status = await checkStatus(tableName, locationId, userEmail);

    if (status?.exists) {
      // Table exists - ask if they want to join instead
      setMode("join");
      setSearchQuery(tableName);
      return;
    }

    // Proceed to payment selection for unified payment (optional)
    setMode("payment");
  };

  /**
   * ✅ Handle join table
   */
  const handleJoinTable = async (table: string) => {
    const status = await checkStatus(table, locationId, userEmail);

    if (status?.canJoin) {
      setTableName(table);
      onTableJoined?.(table);
      onOpenChange(false);
      resetDialog();
    }
  };

  /**
   * ✅ Confirm table creation with payment method
   */
  const handleConfirmCreate = () => {
    // In production, you would send payment method to backend
    onTableCreated?.(tableName);
    onOpenChange(false);
    resetDialog();
  };

  /**
   * ✅ Reset dialog state
   */
  const resetDialog = () => {
    setMode("initial");
    setTableName("");
    setSearchQuery("");
    setSelectedPaymentMethod("PAY_ON_DELIVERY");
    setAvailableTables([]);
  };

  /**
   * ✅ Get payment method details
   */
  const getPaymentMethod = (id: string): PaymentMethod | undefined => {
    return PAYMENT_METHODS.find((pm) => pm.id === id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        {/* Initial Mode - Choose Create or Join */}
        {mode === "initial" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Table Command
              </DialogTitle>
              <DialogDescription>
                Create a new table or join an existing one at {locationName}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4 py-4">
              <Button
                variant="outline"
                className="h-32 flex flex-col gap-2"
                onClick={() => setMode("create")}
              >
                <Plus className="h-8 w-8" />
                <span className="font-semibold">Create Table</span>
                <span className="text-xs text-muted-foreground">
                  Start a new group order
                </span>
              </Button>

              <Button
                variant="outline"
                className="h-32 flex flex-col gap-2"
                onClick={() => setMode("join")}
              >
                <LogIn className="h-8 w-8" />
                <span className="font-semibold">Join Table</span>
                <span className="text-xs text-muted-foreground">
                  Join an existing table
                </span>
              </Button>
            </div>
          </>
        )}

        {/* Create Mode */}
        {mode === "create" && (
          <>
            <DialogHeader>
              <DialogTitle>Create New Table</DialogTitle>
              <DialogDescription>
                Choose a unique name for your table
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="tableName">Table Name</Label>
                <Input
                  id="tableName"
                  placeholder="e.g. ALGORITHM, TABLE5"
                  value={tableName}
                  onChange={(e) => handleTableNameChange(e.target.value)}
                  maxLength={50}
                />
                <p className="text-xs text-muted-foreground">
                  3-50 characters, uppercase letters, numbers, hyphens and
                  underscores only
                </p>

                {tableName && !isValidTableName(tableName) && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Invalid table name format
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setMode("initial")}>
                Back
              </Button>
              <Button
                onClick={handleCreateTable}
                disabled={!isValidTableName(tableName) || isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking...
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Payment Method Selection (Optional for unified payment) */}
        {mode === "payment" && (
          <>
            <DialogHeader>
              <DialogTitle>Select Payment Method (Optional)</DialogTitle>
              <DialogDescription>
                Choose how you want everyone to pay, or leave as split payment
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <RadioGroup
                value={selectedPaymentMethod}
                onValueChange={setSelectedPaymentMethod}
              >
                {PAYMENT_METHODS.map((method) => (
                  <div
                    key={method.id}
                    className="flex items-center space-x-2 border p-3 rounded-lg hover:bg-accent cursor-pointer"
                  >
                    <RadioGroupItem value={method.id} id={method.id} />
                    <Label
                      htmlFor={method.id}
                      className="flex-1 cursor-pointer flex items-center gap-2"
                    >
                      <span className="text-2xl">{method.icon}</span>
                      <div>
                        <div className="font-medium">{method.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {method.type === "IMMEDIATE"
                            ? "Pay now"
                            : "Pay when delivered"}
                        </div>
                      </div>
                    </Label>
                    {selectedPaymentMethod === method.id && (
                      <Check className="h-5 w-5 text-primary" />
                    )}
                  </div>
                ))}
              </RadioGroup>

              <Alert className="bg-blue-50 border-blue-200">
                <AlertDescription className="text-sm">
                  <strong>Split Payment:</strong> Each person pays for their own
                  order. You can change this after creating the table.
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setMode("create")}>
                Back
              </Button>
              <Button onClick={handleConfirmCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Create Table
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Join Mode */}
        {mode === "join" && (
          <>
            <DialogHeader>
              <DialogTitle>Join Existing Table</DialogTitle>
              <DialogDescription>
                Search for and join an active table at {locationName}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="search">Search Table</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Search by table name..."
                    value={searchQuery}
                    onChange={(e) =>
                      setSearchQuery(e.target.value.toUpperCase())
                    }
                    className="pl-8"
                  />
                </div>
              </div>

              {/* Available Tables */}
              <div className="max-h-[300px] overflow-y-auto space-y-2">
                {isSearching ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    <p className="text-sm text-muted-foreground mt-2">
                      Searching tables...
                    </p>
                  </div>
                ) : availableTables.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">
                      {searchQuery
                        ? "No tables found"
                        : "No active tables at this location"}
                    </p>
                  </div>
                ) : (
                  availableTables.map((table) => (
                    <div
                      key={table.id}
                      className="border p-3 rounded-lg hover:bg-accent cursor-pointer"
                      onClick={() => handleJoinTable(table.table_name)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-semibold">
                            {table.table_name}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Created by {table.created_by}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(table.created_at).toLocaleString()}
                          </div>
                        </div>
                        <Badge variant="default">{table.status}</Badge>
                      </div>

                      {table.order_count > 0 && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          {table.order_count} order(s) · Total:{" "}
                          {table.total_amount?.toLocaleString() || 0} RWF
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setMode("initial")}>
                Back
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
