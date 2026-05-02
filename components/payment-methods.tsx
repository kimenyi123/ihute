"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Smartphone, Banknote, CreditCard } from "lucide-react"

export function PaymentMethods() {

  return (
    <section className="py-12 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Available Payment Methods</h2>
          <p className="text-slate-600 text-sm">Choose your preferred payment option</p>
        </div>
        <div className="flex flex-wrap justify-center gap-4 md:gap-6">
          <Card className="border shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex flex-col items-center gap-2 min-w-[140px]">
              <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-yellow-600" />
              </div>
              <span className="text-sm font-medium text-slate-700 text-center">MTN Mobile Money</span>
            </CardContent>
          </Card>

          <Card className="border shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex flex-col items-center gap-2 min-w-[140px]">
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Smartphone className="h-6 w-6 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-slate-700 text-center">Airtel Money</span>
            </CardContent>
          </Card>

            {/* CARD FOR URUBUTO PAY  */}
          {/* <Card className="border shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex flex-col items-center gap-2 min-w-[140px]">
              <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                <Wallet className="h-6 w-6 text-purple-600" />
              </div>
              <span className="text-sm font-medium text-slate-700 text-center">UrubutoPay</span>
            </CardContent>
          </Card> */}

          <Card className="border shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex flex-col items-center gap-2 min-w-[140px]">
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <Banknote className="h-6 w-6 text-green-600" />
              </div>
              <span className="text-sm font-medium text-slate-700 text-center">Cash on Delivery</span>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}
