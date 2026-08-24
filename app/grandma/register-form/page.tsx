import { BuyerRegisterForm } from "@/components/buyer-register-form"
import { CrazyShoppingBoarding } from "@/components/crazy-shopping-boarding"

/**
 * Dedicated Grandma registration entry.
 * - Buyer: `/grandma/register-form` or `?role=buyer`
 * - Seller: `/grandma/register-form?role=seller`
 *
 * Main Ihute registration stays on `/register/web-form`.
 */
export default async function GrandmaRegisterFormPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>
}) {
  const { role: roleParam } = await searchParams
  const role = roleParam === "seller" ? "seller" : "buyer"

  if (role === "seller") {
    return <CrazyShoppingBoarding />
  }

  return <BuyerRegisterForm />
}
