import { RegisterAccountForm } from "@/components/register-account-form"

export default async function WebRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>
}) {
  const { role: roleParam } = await searchParams
  const role = roleParam === "seller" ? "seller" : "buyer"
  return <RegisterAccountForm initialRole={role} />
}
