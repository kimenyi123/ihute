import { redirect } from "next/navigation"

/** Default signup is buyer onboarding; sellers and riders use `/register/seller` and `/register/rider`. */
export default function RegisterPage() {
  redirect("/register/buyer")
}
