import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import { SessionProvider } from "@/components/session-provider"
import { LanguageSyncProvider } from "@/components/language-sync-provider"
import { ServiceWorkerRegister } from "@/components/service-worker-register"
import { NotificationPrompt } from "@/components/notification-prompt"
import { GlobalRatingManager } from "@/components/GlobalRatingManager"
import { Toaster } from "@/components/ui/toaster"
import "./globals.css"

export const metadata: Metadata = {
  title: "ihute.rw - Shop Everything You Need",
  description: "Rwanda's premier online marketplace for pharmacy, groceries, fashion, and more",
  generator: "v0.app",
  icons: {
    icon: "/images/ishyiga-logo.png",
    apple: "/images/ishyiga-logo.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="rw" data-scroll-behavior="smooth">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable} antialiased`} suppressHydrationWarning>
        <SessionProvider>
          <LanguageSyncProvider>
            <Suspense fallback={null}>{children}</Suspense>
          </LanguageSyncProvider>
        </SessionProvider>
        <Toaster />
        <ServiceWorkerRegister />
        <NotificationPrompt />
        <GlobalRatingManager />
        <Analytics />
      </body>
    </html>
  )
}
