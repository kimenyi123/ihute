"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Smartphone, Banknote } from "lucide-react"
// Commented out unused payment method icons - uncomment when needed
// import { CreditCard, Wallet, Building2 } from "lucide-react"

export function PaymentMethods() {
  const methods = [
    { icon: Smartphone, name: "Mobile Money", color: "text-green-600" },
    { icon: Banknote, name: "Cash on Delivery", color: "text-slate-600" },
  ]

  // Commented out payment methods - uncomment when needed
  // const methods = [
  //   { icon: Smartphone, name: "Mobile Money", color: "text-green-600" },
  //   { icon: CreditCard, name: "Credit Card", color: "text-blue-600" },
  //   { icon: Wallet, name: "Debit Card", color: "text-purple-600" },
  //   { icon: Building2, name: "Bank Transfer", color: "text-orange-600" },
  //   { icon: Banknote, name: "Cash on Delivery", color: "text-slate-600" },
  // ]

  return (
    <section className="py-12 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Available Payment Methods</h2>
          <p className="text-slate-600 text-sm">Choose your preferred payment option</p>
        </div>
        <div className="flex flex-wrap justify-center gap-4 md:gap-6">
          {methods.map((method, index) => {
            const Icon = method.icon
            return (
              <Card key={index} className="border shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex flex-col items-center gap-2 min-w-[100px]">
                  <Icon className={`h-8 w-8 ${method.color}`} />
                  <span className="text-xs font-medium text-slate-700 text-center">{method.name}</span>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
