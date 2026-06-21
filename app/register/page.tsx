import { redirect } from "next/navigation"

export default function RegisterPage() {
  // Middleware handles host branching for /register/buyer and /register/seller
  // This page is the web fallback entry point
  redirect("/register/web-form?role=buyer")
}
