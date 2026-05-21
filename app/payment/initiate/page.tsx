"use client"

import { useState } from "react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import PaymentForm from "@/components/payment/payment-form"
import PaymentStatus from "@/components/payment/payment-status"
import { MobileMoneyPaymentWizard } from "@/components/payment/mobile-money/MobileMoneyPaymentWizard"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AcceptedCardNetworksStrip } from "@/components/payment/AcceptedCardNetworksStrip"

export default function PaymentInitiationPage() {
  const [paymentResult, setPaymentResult] = useState<unknown>(null)

  const handlePaymentInitiated = (result: unknown) => {
    setPaymentResult(result)
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-blue-50/40 via-background to-background">
      <Header />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">
          <div className="mx-auto max-w-4xl">
            <div className="mb-8 text-center">
              <h1 className="mb-2 text-3xl font-bold tracking-tight text-blue-950">Pay</h1>
              <p className="text-sm text-blue-900/75">
                Mobile money demo or Urubuto when your gateway is configured.
              </p>
            </div>

            <div className="mb-6 rounded-2xl border border-blue-100 bg-white/70 px-4 py-3 shadow-sm">
              <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-wide text-blue-800">
                Card networks (Urubuto card flow)
              </p>
              <AcceptedCardNetworksStrip />
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <div className="space-y-6">
                <Tabs defaultValue="mobile" className="w-full">
                  <TabsList className="grid h-12 w-full grid-cols-2 rounded-xl bg-blue-100/60 p-1">
                    <TabsTrigger
                      value="mobile"
                      className="rounded-lg font-semibold data-[state=active]:bg-white data-[state=active]:text-blue-900 data-[state=active]:shadow-sm"
                    >
                      MTN / Airtel
                    </TabsTrigger>
                    <TabsTrigger
                      value="urubuto"
                      className="rounded-lg font-semibold data-[state=active]:bg-white data-[state=active]:text-blue-900 data-[state=active]:shadow-sm"
                    >
                      Urubuto
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="mobile" className="mt-4">
                    <MobileMoneyPaymentWizard />
                  </TabsContent>
                  <TabsContent value="urubuto" className="mt-4">
                    <PaymentForm onPaymentInitiated={handlePaymentInitiated} />
                  </TabsContent>
                </Tabs>
              </div>

              <div>
                {paymentResult ? (
                  <PaymentStatus paymentResult={paymentResult} />
                ) : (
                  <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-6 text-blue-950 shadow-sm">
                    <h3 className="mb-2 text-base font-semibold">Tips</h3>
                    <ul className="space-y-2 text-sm text-blue-900/85">
                      <li>• MTN / Airtel: enter number and amount, then confirm on your phone.</li>
                      <li>• Airtel flow shows a USSD confirmation preview.</li>
                      <li>• Urubuto: needs API env configuration.</li>
                      <li>• Never enter wallet PIN in app screens.</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
