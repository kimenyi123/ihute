import UmuriroPaymentForm from "@/components/umuriro/UmuriroPaymentForm"

export const metadata = {
  title: "Umuriro - Save a shop & pay",
  description: "Save shop details and generate MTN MoMo USSD payment code",
}

export default function UmuriroPage() {
  return <UmuriroPaymentForm />
}
