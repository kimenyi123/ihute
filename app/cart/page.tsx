import { Header } from "@/components/header"
import { CartContent } from "@/components/cart-content"
import { Breadcrumbs } from "@/components/breadcrumbs"

export default function CartPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-2 sm:px-4 py-5 sm:py-6">
        <Breadcrumbs categoryName="Shopping Cart" />
        <div className="mt-6">
          <CartContent />
        </div>
      </main>
    </div>
  )
}
