"use client"

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

export type TableCommandStatus = "ACTIVE" | "SENT" | "CLOSED"

export type TableCommandSession = {
  tableName: string
  locationId: string // supplier ID (bar/restaurant)
  locationName: string // bar/restaurant name
  isCreator: boolean // true if this user created the table
  createdAt: string
  participants: string[] // list of participant names/phones
  status: TableCommandStatus // ACTIVE, SENT, CLOSED
  createdBy: string // email/phone of creator
  lastSentBy?: string // email/phone of last person who sent order
  userEmail: string // current user's identifier
  userName: string // user's display name for prefilling forms
}

type TableCommandState = {
  activeSession: TableCommandSession | null
  orderMode: "individual" | "table_command" // default is individual

  // Actions
  createTableCommand: (tableName: string, locationId: string, locationName: string, userName: string, userEmail: string) => void
  joinTableCommand: (tableName: string, locationId: string, locationName: string, userName: string, userEmail: string) => void
  leaveTableCommand: () => void
  lockTableCommand: (userEmail: string) => void // Mark as SENT after order placed
  closeTableCommand: () => void // Mark as CLOSED
  setOrderMode: (mode: "individual" | "table_command") => void
  isInTableCommand: () => boolean
  canCloseTable: () => boolean // Check if current user can close
  getTableInfo: () => TableCommandSession | null
}

export const useTableCommandStore = create<TableCommandState>()(
  persist(
    (set, get) => ({
      activeSession: null,
      orderMode: "individual",

      createTableCommand: (tableName, locationId, locationName, userName, userEmail) => {
        const session: TableCommandSession = {
          tableName: tableName.trim(),
          locationId,
          locationName,
          isCreator: true,
          createdAt: new Date().toISOString(),
          participants: [userName],
          status: "ACTIVE",
          createdBy: userEmail,
          userEmail: userEmail,
          userName: userName.trim(),
        }
        set({ activeSession: session, orderMode: "table_command" })
      },

      joinTableCommand: (tableName, locationId, locationName, userName, userEmail) => {
        const session: TableCommandSession = {
          tableName: tableName.trim(),
          locationId,
          locationName,
          isCreator: false,
          createdAt: new Date().toISOString(),
          participants: [userName], // Will be synced from backend
          status: "ACTIVE",
          createdBy: userEmail, // Will be updated from backend
          userEmail: userEmail,
          userName: userName.trim(),
        }
        set({ activeSession: session, orderMode: "table_command" })
      },

      leaveTableCommand: () => {
        set({ activeSession: null, orderMode: "individual" })
      },

      lockTableCommand: (userEmail) => {
        const session = get().activeSession
        if (session) {
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
        if (!session || !get().canCloseTable()) return

        try {
          // Call backend to close table
          const res = await fetch("/api/table-commands/close", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tableName: session.tableName,
              locationId: session.locationId,
              userEmail: session.userEmail,
            }),
          })

          const json = await res.json()
          if (json.ok) {
            // Update local state
            set({
              activeSession: {
                ...session,
                status: "CLOSED",
              },
            })
          } else {
            console.error("Failed to close table:", json.error)

            // Check if backend hasn't implemented the feature yet
            if (res.status === 501 || json.error?.includes("not implemented")) {
              alert(
                "⚠️ Backend feature not implemented yet.\n\n" +
                "The table will be closed locally, but the backend needs to implement the 'closeTable' action.\n\n" +
                "Please refer to BACKEND_TABLE_COMMANDS.md for implementation instructions."
              )
              // Close locally anyway
              set({
                activeSession: {
                  ...session,
                  status: "CLOSED",
                },
              })
            } else {
              alert(json.error || "Failed to close table")
            }
          }
        } catch (error) {
          console.error("Error closing table:", error)
          // Still close locally even if backend fails
          set({
            activeSession: {
              ...session,
              status: "CLOSED",
            },
          })
        }
      },

      setOrderMode: (mode) => {
        set({ orderMode: mode })
      },

      isInTableCommand: () => {
        const session = get().activeSession
        return session !== null && session.status === "ACTIVE" && get().orderMode === "table_command"
      },

      canCloseTable: () => {
        const session = get().activeSession
        if (!session || session.status !== "SENT") return false
        // User can close if they're the creator or the last person who sent
        return session.createdBy === session.userEmail || session.lastSentBy === session.userEmail
      },

      getTableInfo: () => {
        return get().activeSession
      },
    }),
    {
      name: "table-command-storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
)
