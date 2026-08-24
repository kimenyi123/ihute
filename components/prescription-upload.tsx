"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Camera, Loader2, X } from "lucide-react"

type Props = {
  /** Reuse the same pending folder across re-uploads for one seller checkout. */
  pendingKey?: string
  /** Bound into pending .meta.json for createOrder ownership checks. */
  buyerEmail?: string
  onUploaded: (result: {
    pendingKey: string
    publicUrl: string
    fileName: string
  }) => void
  onCleared?: () => void
  disabled?: boolean
}

/**
 * Dedicated prescription photo capture/upload — not shared with shop/account/Urubuto uploaders.
 */
export function PrescriptionUpload({
  pendingKey: initialPendingKey,
  buyerEmail,
  onUploaded,
  onCleared,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [pendingKey, setPendingKey] = useState(initialPendingKey || "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clear = () => {
    setPreview(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ""
    onCleared?.()
  }

  const onFile = async (file: File | null) => {
    if (!file) return
    setError(null)
    setBusy(true)
    try {
      const localUrl = URL.createObjectURL(file)
      setPreview(localUrl)

      const fd = new FormData()
      fd.append("file", file)
      if (pendingKey) fd.append("pendingKey", pendingKey)
      if (buyerEmail?.trim()) fd.append("buyerEmail", buyerEmail.trim())

      const res = await fetch("/api/orders/prescription-upload", {
        method: "POST",
        body: fd,
      })
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        pendingKey?: string
        publicUrl?: string
        fileName?: string
      }
      if (!res.ok || !json.ok || !json.publicUrl || !json.pendingKey) {
        setError(json.error || "Upload failed")
        setPreview(null)
        return
      }
      setPendingKey(json.pendingKey)
      onUploaded({
        pendingKey: json.pendingKey,
        publicUrl: json.publicUrl,
        fileName: json.fileName || "",
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed")
      setPreview(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50/80 p-3">
      <Label className="text-sm font-medium text-amber-950">
        Prescription photo required
      </Label>
      <p className="text-xs text-amber-900/80">
        This order includes medicine that needs a prescription. Upload a clear photo of the
        prescription before placing the order.
      </p>

      {preview ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Prescription preview"
            className="max-h-40 rounded border border-amber-200 object-contain"
          />
          <button
            type="button"
            className="absolute -right-2 -top-2 rounded-full bg-white p-1 shadow disabled:opacity-50"
            onClick={clear}
            disabled={busy || disabled}
            aria-label="Remove prescription"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/heic,image/heif,.jpg,.jpeg,.png,.heic"
          capture="environment"
          className="hidden"
          disabled={busy || disabled}
          onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || disabled}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Camera className="mr-1.5 h-4 w-4" />
          )}
          {preview ? "Replace photo" : "Upload prescription"}
        </Button>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
