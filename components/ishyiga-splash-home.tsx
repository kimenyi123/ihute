"use client"

import Image from "next/image"
import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

type IshyigaSplashHomeProps = {
  /** After the splash, e.g. full home with sector UI. If omitted, shows the default tagline only. */
  children?: ReactNode
}

/** Kaos-style load splash (`index.jsp` loading-screen): full view, logo, then content. */
export function IshyigaSplashHome({ children }: IshyigaSplashHomeProps) {
  const [splashDone, setSplashDone] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setSplashDone(true), 1700)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <div
      className={cn(
        "relative min-h-screen w-full",
        !children && "overflow-hidden bg-white"
      )}
    >
      {/* Splash — white ground + full Ishyiga wordmark (icon + ISHYIGA / SOFTWARE) */}
      <div
        aria-hidden={splashDone}
        className={cn(
          "fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white transition-opacity duration-700 ease-out",
          splashDone ? "pointer-events-none opacity-0" : "opacity-100"
        )}
      >
        <div className="loading-container flex flex-col items-center px-6">
          <div className="loading-logo flex items-center justify-center">
            <div className={cn("splash-breathe", splashDone && "[animation:none]")}>
              <Image
                src="/images/ishyiga-logo-brand.png"
                alt="Ishyiga Software"
                width={480}
                height={160}
                priority
                sizes="(max-width: 640px) 90vw, 420px"
                className="h-auto w-[min(90vw,420px)] object-contain"
              />
            </div>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "min-h-screen w-full transition-opacity duration-700 ease-out",
          splashDone ? "opacity-100" : "opacity-0"
        )}
      >
        {children ?? (
          <main className="flex min-h-screen flex-col items-center justify-center bg-white px-4">
            <p className="text-center text-2xl font-semibold tracking-tight text-[#17324d] sm:text-3xl">
              AM IHUTE IN ONE PIECE
            </p>
          </main>
        )}
      </div>
    </div>
  )
}
