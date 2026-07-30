"use client"

import dynamic from "next/dynamic"

const QRCode = dynamic(() => import("react-qr-code"), { ssr: false })

type InvoiceQRCodeProps = {
  value: string | null
  show: boolean
}

export function InvoiceQRCode({ value, show }: InvoiceQRCodeProps) {
  if (!show || !value) return null

  return (
    <div id="tax-invoice-qr" className="tax-invoice-qr">
      <p className="tax-invoice-qr-label">Verification QR Code</p>
      <div className="tax-invoice-qr-box">
        <QRCode value={value} size={128} level="M" bgColor="#FFFFFF" fgColor="#000000" />
      </div>
    </div>
  )
}
