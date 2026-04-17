"use client"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { BuyerOrdersPanel } from "@/components/buyer-orders-panel"

export default function BuyerOrdersPage() {
  return (
    <div className="min-h-screen w-full flex flex-col bg-slate-50">
      <Header />
      <BuyerOrdersPanel variant="buyer" loginRedirect="/login" />
      <Footer />
    </div>
  )
}
