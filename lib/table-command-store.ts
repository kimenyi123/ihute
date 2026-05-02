"use client"

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import { useCartStore, type CartItem } from "@/lib/cart-store"
import { type SendTableOrderResponse } from "@/lib/api/table-commands"

export type TableCommandStatus = "ACTIVE" | "SENT" | "CLOSED"

export type TableCommandSession = {
  tableName: string
  locationId: string // supplier ID (bar/restaurant)
  locationName: string // bar/restaurant name
  userName: string // user's display name
  userEmail: string // ✅ CRITICAL: Must stay consistent throughout session
  isCreator: boolean // true if this user created the table
  createdAt: string
  status: TableCommandStatus // ACTIVE, SENT, CLOSED
  createdBy: string // email/phone of creator
  lastSentBy?: string // email/phone of last person who sent order
  // Share data (only available for creator)
  shareableLink?: string
  shareableToken?: string
  qrCodeUrl?: string
}

type TableCartItem = CartItem & {
  tableName: string
  locationId: string
  addedAt: string
}

type TableCommandStore = {
  activeSession: TableCommandSession | null
  orderMode: "individual" | "table_command" // default is individual
  tableCartItems: TableCartItem[] // Items added for this table command

  // Actions
  createTableCommand: (
    tableName: string,
    locationId: string,
    locationName: string,
    userName: string,
    userEmail: string,
    shareData?: {
      shareableLink: string
      shareableToken: string
      qrCodeUrl: string
    }
  ) => void

  joinTableCommand: (
    tableName: string,
    locationId: string,
    locationName: string,
    userName: string,
    userEmail: string
  ) => void

  leaveTableCommand: () => void

  updateTableStatus: (status: TableCommandStatus, lastSentBy?: string) => void

  updateTableShareData: (shareData: {
    shareableLink: string
    shareableToken: string
    qrCodeUrl: string
  }) => void

  lockTableCommand: (userEmail: string) => void

  sendTableOrder: () => Promise<SendTableOrderResponse>

  closeTableCommand: () => Promise<void>

  setOrderMode: (mode: "individual" | "table_command") => void

  isInTableCommand: () => boolean

  canCloseTable: () => boolean

  getTableInfo: () => TableCommandSession | null
  
  // Cart management for table commands
  addToTableCart: (item: CartItem) => void
  removeFromTableCart: (itemId: string) => void
  updateTableCartItemQuantity: (itemId: string, quantity: number) => void
  clearTableCart: () => void
  getTableCartTotal: () => number
  getTableCartItemCount: () => number
  getTableCartItems: () => TableCartItem[]
  
  // Sync with main cart
  syncTableCartToMainCart: () => void
  clearTableCartFromMainCart: () => void
}

export const useTableCommandStore = create<TableCommandStore>()(
  persist(
    (set, get) => ({
      activeSession: null,
      orderMode: "individual",
      tableCartItems: [],

      createTableCommand: (tableName, locationId, locationName, userName, userEmail, shareData) => {
        const finalEmail = userEmail || getOrCreateGuestEmail()

        console.log("📝 Creating table command:", {
          tableName,
          locationId,
          locationName,
          userName,
          userEmail: finalEmail,
          shareData,
        })

        const session: TableCommandSession = {
          tableName: tableName.trim(),
          locationId,
          locationName,
          userName: userName || "Guest",
          userEmail: finalEmail,
          isCreator: true,
          createdAt: new Date().toISOString(),
          status: "ACTIVE",
          createdBy: finalEmail,
          shareableLink: shareData?.shareableLink,
          shareableToken: shareData?.shareableToken,
          qrCodeUrl: shareData?.qrCodeUrl,
        }

        set({ activeSession: session, orderMode: "table_command", tableCartItems: [] })
      },

      joinTableCommand: (tableName, locationId, locationName, userName, userEmail) => {
        const finalEmail = userEmail || getOrCreateGuestEmail()

        console.log("🚪 Joining table command:", {
          tableName,
          locationId,
          locationName,
          userName,
          userEmail: finalEmail,
        })

        const session: TableCommandSession = {
          tableName: tableName.trim(),
          locationId,
          locationName,
          userName: userName || "Guest",
          userEmail: finalEmail,
          isCreator: false,
          createdAt: new Date().toISOString(),
          status: "ACTIVE",
          createdBy: finalEmail,
        }

        set({ activeSession: session, orderMode: "table_command", tableCartItems: [] })
      },

      leaveTableCommand: () => {
        console.log("👋 Leaving table command")
        set({ activeSession: null, orderMode: "individual", tableCartItems: [] })
      },

      updateTableStatus: (status, lastSentBy) => {
        const session = get().activeSession
        if (session) {
          console.log("🔄 Updating table status:", status, "lastSentBy:", lastSentBy)
          set({
            activeSession: {
              ...session,
              status,
              lastSentBy: lastSentBy || session.lastSentBy,
            },
          })
        }
      },

      updateTableShareData: (shareData) => {
        const session = get().activeSession
        if (session) {
          console.log("🔗 Updating table share data:", shareData)
          set({
            activeSession: {
              ...session,
              shareableLink: shareData.shareableLink,
              shareableToken: shareData.shareableToken,
              qrCodeUrl: shareData.qrCodeUrl,
            },
          })
        }
      },

      lockTableCommand: (userEmail) => {
        const session = get().activeSession
        if (session) {
          console.log("🔒 Locking table command, sent by:", userEmail)
          set({
            activeSession: {
              ...session,
              status: "SENT",
              lastSentBy: userEmail,
            },
          })
        }
      },

      sendTableOrder: async () => {
        const session = get().activeSession
        if (!session) throw new Error("No active table command session")

        if (!session.isCreator) {
          throw new Error("Only the table creator can send the complete order")
        }

        if (session.status !== "ACTIVE") {
          throw new Error(`Cannot send order. Table status is ${session.status}`)
        }

        console.log("📤 Sending complete table order:", {
          tableName: session.tableName,
          locationId: session.locationId,
          userEmail: session.userEmail,
        })

        try {
          // Import the API function
          const { sendTableOrder: apiSendTableOrder } = await import("@/lib/api/table-commands")

          const result = await apiSendTableOrder(
            session.tableName,
            session.locationId,
            session.userEmail
          )

          if (!result.ok) {
            console.error("Backend error:", result)
            throw new Error(result.error || "Failed to send table order")
          }

          // Update status to SENT and set lastSentBy
          get().updateTableStatus("SENT", session.userEmail)
          console.log("✅ Table order sent successfully:", {
            masterOrderId: result.masterOrderId,
            childOrderCount: result.childOrderCount,
            totalAmount: result.totalAmount,
          })

          return result
        } catch (error: any) {
          console.error("❌ Error sending table order:", error)
          throw error
        }
      },

      closeTableCommand: async () => {
        const session = get().activeSession
        if (!session) throw new Error("No active table command session")

        if (!get().canCloseTable()) {
          throw new Error("You are not authorized to close this table")
        }

        console.log("🔒 Closing table command:", {
          tableName: session.tableName,
          locationId: session.locationId,
          userEmail: session.userEmail,
        })

        try {
          const response = await fetch("/api/table-commands/close", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tableName: session.tableName,
              locationId: session.locationId,
              userEmail: session.userEmail,
            }),
          })

          const result = await response.json()

          if (!result.ok) {
            console.error("Backend error:", result)
            throw new Error(result.error || "Failed to close table")
          }

          get().updateTableStatus("CLOSED")
          console.log("✅ Table closed successfully")
        } catch (error: any) {
          console.error("❌ Error closing table:", error)

          if (error.message?.includes("not implemented")) {
            alert(
              "⚠️ Backend feature not ready\n\n" +
                "The table will be closed locally.\n" +
                "Backend needs to implement the closeTable action."
            )
            get().updateTableStatus("CLOSED")
            return
          }

          throw error
        }
      },

      setOrderMode: (mode) => set({ orderMode: mode }),

      isInTableCommand: () => {
        const session = get().activeSession
        return (
          session !== null &&
          session.status !== "CLOSED" &&
          get().orderMode === "table_command"
        )
      },

      // ✅ UPDATED: More detailed canCloseTable logic
      canCloseTable: () => {
        const session = get().activeSession
        if (!session) return false

        console.log("🔐 Checking if user can close table:", {
          userEmail: session.userEmail,
          createdBy: session.createdBy,
          lastSentBy: session.lastSentBy,
          status: session.status,
        })

        // ✅ User can ONLY close if:
        // 1️⃣ Table is in SENT status
        // 2️⃣ AND user is either the creator OR the last person who sent the order
        const isCreator = session.userEmail === session.createdBy
        const isLastSender = session.lastSentBy === session.userEmail
        const canClose =
          session.status === "SENT" && (isCreator || isLastSender)

        console.log("🔐 Close authorization result:", {
          isCreator,
          isLastSender,
          canClose,
        })

        return canClose
      },

      getTableInfo: () => get().activeSession,
      
      // ✅ NEW: Add item to table cart
      addToTableCart: (item) => {
        const session = get().activeSession
        if (!session) {
          console.warn("No active table session. Adding to regular cart only.")
          // Still add to regular cart
          useCartStore.getState().addOrInc?.(item)
          return
        }
        
        const state = get()
        const existingItem = state.tableCartItems.find(i => i.id === item.id)
        
        if (existingItem) {
          // Update quantity
          set(state => ({
            tableCartItems: state.tableCartItems.map(i =>
              i.id === item.id ? { 
                ...i, 
                qty: i.qty + 1
              } : i
            )
          }))
        } else {
          // Add new item with table context
          const tableCartItem: TableCartItem = {
            ...item,
            tableName: session.tableName,
            locationId: session.locationId,
            addedAt: new Date().toISOString()
          }
          
          set(state => ({
            tableCartItems: [...state.tableCartItems, tableCartItem]
          }))
        }
        
        // Also add to regular cart for consistency
        // This ensures users can see their items in the cart page
        useCartStore.getState().addOrInc?.(item)
        
        console.log("🛒 Added to table cart:", item.name)
      },
      
      // ✅ NEW: Remove item from table cart
      removeFromTableCart: (itemId) => {
        set(state => ({
          tableCartItems: state.tableCartItems.filter(i => i.id !== itemId)
        }))
        
        // Also remove from regular cart
        useCartStore.getState().remove?.(itemId)
      },
      
      // ✅ NEW: Update item quantity in table cart
      updateTableCartItemQuantity: (itemId, quantity) => {
        if (quantity <= 0) {
          get().removeFromTableCart(itemId)
          return
        }
        
        set(state => ({
          tableCartItems: state.tableCartItems.map(i =>
            i.id === itemId ? { 
              ...i, 
              qty: quantity,
              updatedAt: new Date().toISOString()
            } : i
          )
        }))
        

      },
      
      // ✅ NEW: Clear table cart
      clearTableCart: () => {
        // Remove table cart items from main cart
        const tableItemIds = get().tableCartItems.map(item => item.id)
        tableItemIds.forEach(id => {
          useCartStore.getState().remove?.(id)
        })
        
        set({ tableCartItems: [] })
      },
      
      // ✅ NEW: Get table cart total
      getTableCartTotal: () => {
        return get().tableCartItems.reduce((total, item) => {
          return total + (item.price * item.qty)
        }, 0)
      },
      
      // ✅ NEW: Get table cart item count
      getTableCartItemCount: () => {
        return get().tableCartItems.reduce((count, item) => {
          return count + item.qty
        }, 0)
      },
      
      // ✅ NEW: Get table cart items
      getTableCartItems: () => {
        return get().tableCartItems
      },
      
      // ✅ NEW: Sync table cart to main cart (useful when switching between sessions)
      syncTableCartToMainCart: () => {
        const tableCartItems = get().tableCartItems
        const cartStore = useCartStore.getState()
        
        // Clear existing cart first
        cartStore.clearCart?.()
        
        // Add all table cart items to main cart
        tableCartItems.forEach(item => {
          cartStore.addOrInc?.(item)
        })
        
        console.log("🔄 Synced table cart to main cart:", tableCartItems.length, "items")
      },
      
      // ✅ NEW: Clear table cart items from main cart
      clearTableCartFromMainCart: () => {
        const tableItemIds = get().tableCartItems.map(item => item.id)
        const cartStore = useCartStore.getState()
        
        tableItemIds.forEach(id => {
          cartStore.remove?.(id)
        })
        
        console.log("🗑️ Removed table cart items from main cart")
      }
    }),
    {
      name: "table-command-storage",
      storage: createJSONStorage(() => localStorage),
      // Only persist these specific fields
      partialize: (state) => ({
        activeSession: state.activeSession,
        orderMode: state.orderMode,
        tableCartItems: state.tableCartItems,
      }),
    }
  )
)

// ✅ HELPER: Get or create persistent guest email
export function getOrCreateGuestEmail(): string {
  if (typeof window === "undefined") return ""

  let guestEmail = localStorage.getItem("guest_email")

  if (!guestEmail) {
    guestEmail = `guest_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`
    localStorage.setItem("guest_email", guestEmail)
    console.log("🆕 Created new guest email:", guestEmail)
  } else {
    console.log("♻️ Using existing guest email:", guestEmail)
  }

  return guestEmail
}

// ✅ HELPER: Get or create/set guest name
export function getOrCreateGuestName(): string {
  if (typeof window === "undefined") return "Guest"

  let guestName = localStorage.getItem("guest_name")

  if (!guestName) {
    guestName = "Guest"
    localStorage.setItem("guest_name", guestName)
  }

  return guestName
}

// ✅ HELPER: Set guest name explicitly
export function setGuestName(name: string): void {
  if (typeof window !== "undefined" && name) {
    localStorage.setItem("guest_name", name.trim())
    console.log("✅ Set guest name:", name)
  }
}

// ✅ HELPER: Get guest name
export function getGuestName(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("guest_name")
}

// ✅ HELPER: Clear guest email
export function clearGuestEmail(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("guest_email")
    console.log("🗑️ Cleared guest email")
  }
}

// ✅ HELPER: Clear guest name
export function clearGuestName(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("guest_name")
    console.log("🗑️ Cleared guest name")
  }
}

// ✅ HELPER: Check if user is in a table command
export const isUserInTableCommand = (): boolean => {
  return useTableCommandStore.getState().isInTableCommand()
}

// ✅ HELPER: Get current table cart items
export const getCurrentTableCartItems = (): TableCartItem[] => {
  return useTableCommandStore.getState().getTableCartItems()
}

// ✅ HELPER: Get current table info
export const getCurrentTableInfo = (): TableCommandSession | null => {
  return useTableCommandStore.getState().getTableInfo()
}