"use client"

import dynamic from "next/dynamic"

const QRCode = dynamic(() => import("react-qr-code"), { ssr: false })

type Props = {
  value: string
  size?: number
  logoUrl?: string
}

/**
 * QR with shop logo centered (from /account shop photo).
 * Uses error level H and ~32% center badge — large enough to read, still scannable.
 */
export function QrCodeWithLogo({ value, size = 200, logoUrl }: Props) {
  // Center badge ~32% of QR — typical max for level H while keeping scan reliability
  const badgeSize = Math.round(size * 0.32)
  const ring = Math.max(3, Math.round(size * 0.018))
  const innerPad = Math.max(3, Math.round(size * 0.014))

  return (
    <div
      className="relative inline-flex shrink-0 overflow-hidden rounded-xl bg-white"
      style={{ width: size, height: size }}
    >
      <QRCode value={value} size={size} level="H" bgColor="#FFFFFF" fgColor="#0f172a" />
      {logoUrl ? (
        <div
          className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-[10px] bg-white"
          style={{
            width: badgeSize,
            height: badgeSize,
            padding: innerPad,
            boxShadow: "0 2px 10px rgba(15, 23, 42, 0.14)",
            outline: `${ring}px solid #ffffff`,
          }}
        >
          <img
            src={logoUrl}
            alt=""
            className="h-full w-full object-contain object-center"
            decoding="async"
            draggable={false}
          />
        </div>
      ) : null}
    </div>
  )
}
