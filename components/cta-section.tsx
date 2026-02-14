"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Store, ShoppingBag } from "lucide-react"

export function CTASection() {
  return (
    <section className="py-12 bg-gradient-to-r from-slate-900 to-slate-800">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Join Our Marketplace</h2>
          <p className="text-slate-300 text-sm md:text-base">Start selling or shopping today</p>
        </div>
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <Card className="border-2 border-orange-500 bg-white hover:shadow-xl transition-shadow">
            <CardContent className="p-6 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-500/10 mb-4">
                <Store className="h-8 w-8 text-orange-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Become a Supplier</h3>
              <p className="text-slate-600 text-sm mb-4">
                Reach thousands of customers and grow your business with our platform
              </p>
              <Button className="w-full bg-orange-600 hover:bg-orange-700" size="lg" asChild>
                <Link href="/register?type=supplier">
                  Register as Supplier
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-2 border-green-500 bg-white hover:shadow-xl transition-shadow">
            <CardContent className="p-6 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-4">
                <ShoppingBag className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Become a Customer</h3>
              <p className="text-slate-600 text-sm mb-4">
                Shop from local businesses and get products delivered to your door
              </p>
              <Button className="w-full bg-green-600 hover:bg-green-700" size="lg" asChild>
                <Link href="/register?type=customer">
                  Register as Customer
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}
