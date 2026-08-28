export const MOH_ERX_DASHBOARD_EMAIL = "moh_erx@algorithm.rw"
export const MOH_ERX_DASHBOARD_PASSWORD = "moh123@"
export const MOH_ERX_SESSION_COOKIE = "erx_moh_session"
export const MOH_ERX_SESSION_VALUE = "moh-erx-authenticated-v1"

export function verifyMohDashboardCredentials(email: string, password: string): boolean {
  return (
    email.trim().toLowerCase() === MOH_ERX_DASHBOARD_EMAIL.toLowerCase() &&
    password === MOH_ERX_DASHBOARD_PASSWORD
  )
}

export function mohSessionCookieValue(): string {
  return MOH_ERX_SESSION_VALUE
}
