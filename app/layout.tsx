import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import { SessionProvider } from "@/components/session-provider"
import { ServiceWorkerRegister } from "@/components/service-worker-register"
import { NotificationPrompt } from "@/components/notification-prompt"
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
    <html lang="en">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable} antialiased`}>
        <SessionProvider>
          <Suspense fallback={null}>{children}</Suspense>
        </SessionProvider>
        <ServiceWorkerRegister />
        <NotificationPrompt />
        <Analytics />
      </body>
    </html>
  )
}
