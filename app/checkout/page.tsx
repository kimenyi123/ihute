import { Header } from "@/components/header"
import { CheckoutForm } from "@/components/checkout-form"
import { Breadcrumbs } from "@/components/breadcrumbs"

export default function CheckoutPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6">
        <Breadcrumbs categoryName="Checkout" />
        <div className="mt-6">
          <CheckoutForm />
        </div>
      </main>
    </div>
  )
}
