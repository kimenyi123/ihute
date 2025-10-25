// lib/prefs-store.ts
"use client"
import { create } from "zustand"

type PrefsState = {
  location: string | null
  sector: string | null      // slug you already use (e.g. "supermarket", "bar-resto", etc.)
  setLocation: (loc: string | null) => void
  setSector: (sec: string | null) => void
}

export const usePrefsStore = create<PrefsState>()((set) => ({
  location: null,
  sector: null,
  setLocation: (location) => set({ location }),
  setSector: (sector) => set({ sector }),
}))
