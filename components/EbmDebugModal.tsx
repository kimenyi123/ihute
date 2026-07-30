"use client"

import { useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { EbmDebugView } from "@/lib/ebm/utils/ebm-browser-debug"

type EbmDebugModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  debug: EbmDebugView | null
}

function prettyBlock(value: unknown): string {
  if (value == null) return "(empty)"
  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2)
    } catch {
      return value
    }
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export function EbmDebugModal({ open, onOpenChange, debug }: EbmDebugModalProps) {
  const copyAll = useCallback(() => {
    if (!debug) return
    const text = [
      `User message: ${debug.userMessage}`,
      `Internal error: ${debug.internalError}`,
      `HTTP ${debug.statusCode}`,
      `${debug.method} ${debug.endpoint}`,
      "",
      "REQUEST:",
      prettyBlock(debug.requestPayload),
      "",
      "RESPONSE:",
      prettyBlock(debug.responsePayload),
    ].join("\n")
    void navigator.clipboard.writeText(text)
  }, [debug])

  if (!debug) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>EBM debug details</DialogTitle>
          <DialogDescription>{debug.userMessage}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-md border bg-muted/40 p-3 space-y-1">
            <p>
              <span className="font-medium">HTTP status:</span> {debug.statusCode}
            </p>
            <p>
              <span className="font-medium">Endpoint:</span> {debug.method} {debug.endpoint}
            </p>
            {debug.internalError && debug.internalError !== debug.userMessage ? (
              <p>
                <span className="font-medium">Internal error:</span> {debug.internalError}
              </p>
            ) : null}
          </div>

          <div>
            <p className="mb-1 font-medium">Request payload (sent to VSDC)</p>
            <pre className="max-h-48 overflow-auto rounded-md border bg-slate-950 p-3 text-xs text-green-100">
              {prettyBlock(debug.requestPayload)}
            </pre>
          </div>

          <div>
            <p className="mb-1 font-medium">Response payload (from VSDC)</p>
            <pre className="max-h-48 overflow-auto rounded-md border bg-slate-950 p-3 text-xs text-amber-100">
              {prettyBlock(debug.responsePayload)}
            </pre>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={copyAll}>
              Copy all
            </Button>
            <Button type="button" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
