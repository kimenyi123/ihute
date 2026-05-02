import { useAuthStore } from "@/lib/auth-store"

const LEGACY_DISCARD_EMAILS = new Set<string>(["admin0799338897@ihute.local"])

/**
 * POST to the Next.js /api/admin proxy. Identity comes from the hydrated auth store
 * (email + optional adminApiToken), not stale body.adminEmail.
 */
export function postAdminApi(body: Record<string, unknown>): Promise<Response> {
  const { user, hasHydrated, logout } = useAuthStore.getState()
  let userEmail = (user?.email ?? "").trim()
  if (userEmail && LEGACY_DISCARD_EMAILS.has(userEmail.toLowerCase())) {
    console.warn("[postAdminApi] stale legacy email in memory — signing out:", userEmail)
    logout()
    userEmail = ""
    return Promise.resolve(
      new Response(
        JSON.stringify({
          ok: false,
          error: "Stale session removed. Sign in again with your real admin account.",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      ),
    )
  }
  const incoming =
    typeof body.adminEmail === "string" && body.adminEmail.trim() !== "" ? body.adminEmail.trim() : ""

  if (incoming && userEmail && incoming.toLowerCase() !== userEmail.toLowerCase()) {
    console.warn("[postAdminApi] ignoring body.adminEmail (stale):", incoming, "→ using store:", userEmail)
  }
  if (!hasHydrated) {
    console.warn("[postAdminApi] auth store not rehydrated yet — wait before calling admin APIs")
  }

  const payload: Record<string, unknown> = { ...body }
  delete payload.adminEmail
  if (userEmail) {
    payload.adminEmail = userEmail
  }

  const tok = user?.adminApiToken?.trim()
  if (tok) {
    payload.adminToken = tok
  }

  return fetch("/api/admin", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(userEmail ? { "x-admin-email": userEmail } : {}),
      ...(tok ? { "x-admin-token": tok } : {}),
    },
    body: JSON.stringify(payload),
  })
}
