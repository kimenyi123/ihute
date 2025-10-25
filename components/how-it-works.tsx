import Image from "next/image"
import { Package } from "lucide-react"

export function HowItWorks() {
  return (
    <section className="py-12 md:py-16 bg-slate-50">
      <div className="container mx-auto px-4">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">How It Works</h2>
          <p className="mt-2 text-muted-foreground">Simple steps to get your products delivered</p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 rounded-full bg-primary/10 p-6">
              <Package className="h-10 w-10 text-primary" />
            </div>
            <h3 className="mb-2 text-xl font-semibold">1. Browse & Order</h3>
            <p className="text-muted-foreground">Choose from thousands of products from local suppliers</p>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="relative mb-4 h-32 w-full">
              <Image src="/images/delivery-forklift.png" alt="Order Processing" fill className="object-contain" />
            </div>
            <h3 className="mb-2 text-xl font-semibold">2. We Process</h3>
            <p className="text-muted-foreground">Your order is prepared and packaged with care</p>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="relative mb-4 h-32 w-full">
              <Image src="/images/delivery-handoff.png" alt="Fast Delivery" fill className="object-contain" />
            </div>
            <h3 className="mb-2 text-xl font-semibold">3. Fast Delivery</h3>
            <p className="text-muted-foreground">Receive your products at your doorstep quickly</p>
          </div>
        </div>
      </div>
    </section>
  )
}
