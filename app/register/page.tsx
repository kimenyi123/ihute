import { redirect } from "next/navigation"

export default function RegisterPage() {
  redirect("/register/web-form?role=buyer")
}
