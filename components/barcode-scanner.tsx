"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScanBarcode } from "lucide-react"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onScan: (barcode: string) => void
}

export function BarcodeScanner({ open, onOpenChange, onScan }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [manualCode, setManualCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [hasBarcodeDetector, setHasBarcodeDetector] = useState(false)

  useEffect(() => {
    setHasBarcodeDetector(typeof window !== "undefined" && "BarcodeDetector" in window)
  }, [])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!open) {
      stopCamera()
      setManualCode("")
      setError(null)
      return
    }
    if (!hasBarcodeDetector) return
    let cancelled = false
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      } catch (e) {
        if (!cancelled) setError("Camera access denied or unavailable")
      }
    }
    start()
    return () => {
      cancelled = true
      stopCamera()
    }
  }, [open, hasBarcodeDetector, stopCamera])

  useEffect(() => {
    if (!open || !hasBarcodeDetector || !videoRef.current) return
    const detector = (window as any).BarcodeDetector
    if (!detector) return
    const video = videoRef.current
    const detect = async () => {
      if (!video.videoWidth || !video.srcObject) return
      try {
        const barcodes = await new detector().detect(video)
        if (barcodes.length > 0 && barcodes[0].rawValue) {
          onScan(barcodes[0].rawValue)
          onOpenChange(false)
        }
      } catch {
        // ignore single frame errors
      }
    }
    const id = setInterval(detect, 500)
    return () => clearInterval(id)
  }, [open, hasBarcodeDetector, onScan, onOpenChange])

  const handleManualSubmit = () => {
    const code = manualCode.trim()
    if (!code) return
    onScan(code)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanBarcode className="h-5 w-5" />
            Scan barcode
          </DialogTitle>
          <DialogDescription>
            Scan a product barcode to add it to your cart, or enter the code manually.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {hasBarcodeDetector && (
            <div className="relative aspect-video rounded-lg bg-slate-900 overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {error && (
                <p className="absolute inset-0 flex items-center justify-center text-sm text-red-400 bg-black/50">
                  {error}
                </p>
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="barcode-manual">Or enter code manually</Label>
            <Input
              id="barcode-manual"
              placeholder="Product or barcode"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleManualSubmit} disabled={!manualCode.trim()}>
            Add by code
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
