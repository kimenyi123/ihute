import { redirect } from "next/navigation"

export default function ForgotPasswordPage() {
  // Middleware rewrites /forgot-password by host; this is the web fallback entry.
  redirect("/forgot-password/web-form")
}
