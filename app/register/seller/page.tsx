import { Suspense } from "react"
import { CrazyShoppingBoarding } from "@/components/crazy-shopping-boarding"

export default function SellerRegisterPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">Loading…</div>}>
      <CrazyShoppingBoarding />
    </Suspense>
  )
}
