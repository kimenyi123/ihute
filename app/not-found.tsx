"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

/**
 * Shows the exact URL the user tried to open (instead of a bare Next.js 404).
 * Rendered inside the root layout — do not wrap in html/body.
 */
export default function NotFound() {
  const [fullUrl, setFullUrl] = useState<string>("")
  const [path, setPath] = useState<string>("")

  useEffect(() => {
    if (typeof window === "undefined") return
    setFullUrl(window.location.href)
    setPath(`${window.location.pathname}${window.location.search}${window.location.hash}`)
  }, [])

  return (
    <div
      style={{
        margin: 0,
        minHeight: "60vh",
        fontFamily: "system-ui, sans-serif",
        background: "#f4f6f8",
        color: "#142433",
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 420, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>404 — Page not found</h1>
        <p style={{ color: "#5a6b7a", fontSize: 15, lineHeight: 1.5 }}>
          The app could not find a page for this address. Copy the line below when reporting the issue.
        </p>
        <div
          style={{
            marginTop: 16,
            padding: 14,
            borderRadius: 12,
            background: "#fff",
            border: "1px solid #dbe3ea",
            wordBreak: "break-all",
            fontSize: 13,
            fontFamily: "ui-monospace, monospace",
          }}
        >
          {fullUrl || "(loading…)"}
        </div>
        {path ? (
          <p style={{ marginTop: 12, fontSize: 13, color: "#5a6b7a" }}>
            Path: <code style={{ fontSize: 12 }}>{path}</code>
          </p>
        ) : null}
        <p style={{ marginTop: 20 }}>
          <Link href="/" style={{ color: "#1897e0", fontWeight: 700 }}>
            Go to home
          </Link>
          {" · "}
          <Link href="/grandma" style={{ color: "#1897e0", fontWeight: 700 }}>
            Grandma
          </Link>
        </p>
      </div>
    </div>
  )
}
