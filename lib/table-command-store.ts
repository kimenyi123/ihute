"use client"

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

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
}

type TableCommandStore = {
  activeSession: TableCommandSession | null
  orderMode: "individual" | "table_command" // default is individual

  // Actions
  createTableCommand: (
    tableName: string,
    locationId: string,
    locationName: string,
    userName: string,
    userEmail: string
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

  lockTableCommand: (userEmail: string) => void

  closeTableCommand: () => Promise<void>

  setOrderMode: (mode: "individual" | "table_command") => void

  isInTableCommand: () => boolean

  canCloseTable: () => boolean

  getTableInfo: () => TableCommandSession | null
}

export const useTableCommandStore = create<TableCommandStore>()(
  persist(
    (set, get) => ({
      activeSession: null,
      orderMode: "individual",

      createTableCommand: (tableName, locationId, locationName, userName, userEmail) => {
        const finalEmail = userEmail || getOrCreateGuestEmail()

        console.log("📝 Creating table command:", {
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
          isCreator: true,
          createdAt: new Date().toISOString(),
          status: "ACTIVE",
          createdBy: finalEmail,
        }

        set({ activeSession: session, orderMode: "table_command" })
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

        set({ activeSession: session, orderMode: "table_command" })
      },

      leaveTableCommand: () => {
        console.log("👋 Leaving table command")
        set({ activeSession: null, orderMode: "individual" })
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
    }),
    {
      name: "table-command-storage",
      storage: createJSONStorage(() => localStorage),
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

// ✅ HELPER: Clear guest email
export function clearGuestEmail(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("guest_email")
    console.log("🗑️ Cleared guest email")
  }
}
