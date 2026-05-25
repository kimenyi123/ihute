"use client"

import { Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, ArrowLeft } from "lucide-react"

function PaymentTrackInner() {
  const searchParams = useSearchParams()
  const transactionId = searchParams.get("transactionId") ?? "—"
  const status = searchParams.get("status") ?? "—"
  const method = searchParams.get("method") ?? "—"
  const phone = searchParams.get("phone") ?? "—"
  const amount = searchParams.get("amount") ?? "—"
  const orderId = searchParams.get("orderId")

  const amountLabel =
    amount !== "—" && !Number.isNaN(Number(amount)) ? `${Number(amount).toLocaleString()} RWF` : amount

  const statusNorm = status.trim().toUpperCase()
  const isSuccess = statusNorm === "SUCCESS" || statusNorm === "COMPLETED" || statusNorm === "PAID"

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="container mx-auto max-w-lg px-4 py-10">
          <div className="mb-6 flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/payment/initiate" className="gap-1">
                <ArrowLeft className="h-4 w-4" />
                Payments
              </Link>
            </Button>
          </div>

          <Card className="overflow-hidden border-emerald-500/25 shadow-md">
            <CardHeader className="border-b bg-emerald-500/10">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" aria-hidden />
                <div>
                  <CardTitle className="text-lg">
                    {isSuccess ? "Payment successful" : "Transaction"}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {isSuccess ? "Your mobile money payment was processed (demo)." : "Payment tracking"}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-6 text-sm">
              <div className="flex justify-between gap-4 border-b border-border pb-3">
                <span className="text-muted-foreground">Status</span>
                <span className="font-semibold text-foreground">{status}</span>
              </div>
              <div className="flex justify-between gap-4 border-b border-border pb-3">
                <span className="text-muted-foreground">Payment method</span>
                <span className="text-right font-medium text-foreground">{method}</span>
              </div>
              <div className="flex justify-between gap-4 border-b border-border pb-3">
                <span className="text-muted-foreground">Phone</span>
                <span className="font-mono text-foreground">{phone}</span>
              </div>
              <div className="flex justify-between gap-4 border-b border-border pb-3">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-semibold text-foreground">{amountLabel}</span>
              </div>
              <div className="flex justify-between gap-4 pb-1">
                <span className="text-muted-foreground">Transaction ID</span>
                <span className="max-w-[55%] break-all text-right font-mono text-xs text-foreground">{transactionId}</span>
              </div>
              {orderId ? (
                <div className="flex justify-between gap-4 pt-2">
                  <span className="text-muted-foreground">Order</span>
                  <span className="font-mono text-foreground">{orderId}</span>
                </div>
              ) : null}
              <p className="pt-2 text-xs leading-relaxed text-muted-foreground">
                Demo environment: this receipt reflects a simulated payment. Connect a live gateway for production.
              </p>
              <Button asChild className="w-full">
                <Link href="/">Home</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default function PaymentTrackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
          Loading…
        </div>
      }
    >
      <PaymentTrackInner />
    </Suspense>
  )
}
