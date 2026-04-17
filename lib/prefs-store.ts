// lib/prefs-store.ts
"use client"
import { create } from "zustand"

type PrefsState = {
  location: string | null
  sector: string | null      // slug you already use (e.g. "supermarket", "bar-resto", etc.)
  /** category_ai: shop tab vs item tab — drives header search when sector is set. */
  categoryBrowseMode: "shop" | "item"
  setLocation: (loc: string | null) => void
  setSector: (sec: string | null) => void
  setCategoryBrowseMode: (m: "shop" | "item") => void
}

export const usePrefsStore = create<PrefsState>()((set) => ({
  location: null,
  sector: null,
  categoryBrowseMode: "shop",
  setLocation: (location) => set({ location }),
  setSector: (sector) => set({ sector }),
  setCategoryBrowseMode: (categoryBrowseMode) => set({ categoryBrowseMode }),
}))
