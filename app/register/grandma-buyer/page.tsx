import { redirect } from "next/navigation"
import { grandmaRegisterFormHref } from "@/lib/grandma-urls"

/** @deprecated Prefer `/grandma/register-form?role=buyer`. Kept to avoid breaking bookmarks. */
export default function GrandmaBuyerPage() {
  redirect(grandmaRegisterFormHref("buyer"))
}
