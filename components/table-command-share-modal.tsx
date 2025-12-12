"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Copy, CheckCircle2, Download, MessageCircle, X } from "lucide-react"
import { useState } from "react"
import dynamic from "next/dynamic"

// Dynamically import QR code to avoid SSR issues
const QRCode = dynamic(() => import("react-qr-code"), { ssr: false })

interface TableCommandShareData {
  tableName: string
  tableLocation: string
  shareableLink: string
  qrCodeUrl: string
  shareableToken: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: TableCommandShareData | null
}

export function TableCommandShareModal({ open, onOpenChange, data }: Props) {
  const [copied, setCopied] = useState(false)

  if (!data) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(data.shareableLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const handleDownloadQR = () => {
    // Create a link element to download the QR code image
    const link = document.createElement("a")
    link.href = data.qrCodeUrl
    link.download = `table-${data.tableName}-qr-code.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleWhatsAppShare = () => {
    const message = encodeURIComponent(
      `Join me at table "${data.tableName}" on Ihute!\n\n${data.shareableLink}`
    )
    const whatsappUrl = `https://wa.me/?text=${message}`
    window.open(whatsappUrl, "_blank")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            🎉 Table Command Created!
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Table Info */}
          <div className="bg-muted rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Table Name:</span>
              <span className="font-medium">{data.tableName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Location:</span>
              <span className="font-medium">{data.tableLocation}</span>
            </div>
          </div>

          {/* QR Code Section */}
          <div className="text-center space-y-3">
            <h3 className="font-semibold text-sm">Share with Friends</h3>
            <div className="bg-white p-4 rounded-lg border-2 inline-block">
              <QRCode value={data.shareableLink} size={200} />
            </div>
            <p className="text-xs text-muted-foreground">Scan to join this table</p>
          </div>

          {/* Shareable Link */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Shareable Link</h3>
            <div className="flex gap-2">
              <Input
                value={data.shareableLink}
                readOnly
                className="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                className={copied ? "bg-green-50 border-green-200" : ""}
              >
                {copied ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2">
            <Button
              onClick={handleWhatsAppShare}
              className="w-full bg-[#25D366] hover:bg-[#20BA5A]"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Share via WhatsApp
            </Button>
            <Button
              variant="outline"
              onClick={handleDownloadQR}
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              Download QR Code
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
