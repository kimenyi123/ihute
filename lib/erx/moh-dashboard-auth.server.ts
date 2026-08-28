import { cookies } from "next/headers"

import { MOH_ERX_SESSION_COOKIE, MOH_ERX_SESSION_VALUE } from "@/lib/erx/moh-dashboard-auth.constants"

export async function isMohDashboardAuthed(): Promise<boolean> {
  const jar = await cookies()
  return jar.get(MOH_ERX_SESSION_COOKIE)?.value === MOH_ERX_SESSION_VALUE
}
