import { redirect } from "next/navigation"
import { grandmaRegisterFormHref } from "@/lib/grandma-urls"

/**
 * Legacy Umuriro / SMS deep link.
 * Does not render Grandma registration UI under the Main `/register` tree —
 * redirects to the Grandma-owned canonical route.
 */
export default async function SellerRegisterWithShopIdPage({
  params,
}: {
  params: Promise<{ shopId: string }>
}) {
  const { shopId } = await params
  redirect(grandmaRegisterFormHref("seller", { shopId }))
}
