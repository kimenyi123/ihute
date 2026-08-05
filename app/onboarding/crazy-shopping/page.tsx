import { redirect } from "next/navigation"
import { grandmaRegisterFormHref } from "@/lib/grandma-urls"

/** Legacy onboarding URL — Grandma seller registration lives under `/grandma/register-form`. */
export default function CrazyShoppingOnboardingRedirectPage() {
  redirect(grandmaRegisterFormHref("seller"))
}
