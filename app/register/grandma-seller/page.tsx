import { redirect } from "next/navigation"
import { grandmaRegisterFormHref } from "@/lib/grandma-urls"

/** @deprecated Prefer `/grandma/register-form?role=seller`. Kept to avoid breaking bookmarks. */
export default function GrandmaSellerRegisterPage() {
  redirect(grandmaRegisterFormHref("seller"))
}
