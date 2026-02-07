"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useCartStore } from "@/lib/cart-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { CheckoutSummary } from "@/components/checkout-summary"
import { CreditCard, Smartphone, ArrowLeft, Check, MapPin } from "lucide-react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"

const checkoutSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  address: z.string().min(5, "Address must be at least 5 characters"),
  city: z.string().min(2, "City is required"),
  notes: z.string().optional(),
  paymentMethod: z.enum(["momo", "card"]),
  momoPhone: z.string().optional(),
  cardNumber: z.string().optional(),
  cardExpiry: z.string().optional(),
  cardCvv: z.string().optional(),
  cardName: z.string().optional(),
})

type CheckoutFormData = z.infer<typeof checkoutSchema>

export function CheckoutForm() {
  const router = useRouter()
  const { items, getTotalPrice, clearCart, getTableInfo } = useCartStore()
  const [isProcessing, setIsProcessing] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [showMap, setShowMap] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    setValue,
  } = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      paymentMethod: "momo",
    },
  })

  const paymentMethod = watch("paymentMethod")

  // ✅ Pre-fill customer info from cart store tableInfo
  useEffect(() => {
    const tableInfo = getTableInfo()
    console.log("[CheckoutForm] tableInfo from cart store:", tableInfo)

    // 1️⃣ Preferred: use explicit fields when available
    if (tableInfo?.customerName || tableInfo?.customerAddress) {
      if (tableInfo.customerName) {
        console.log("[CheckoutForm] Using customerName:", tableInfo.customerName)
        setValue("fullName", tableInfo.customerName)
      }
      if (tableInfo.customerAddress) {
        console.log("[CheckoutForm] Using customerAddress:", tableInfo.customerAddress)
        setValue("address", tableInfo.customerAddress)
      }
      return
    }

    // 2️⃣ Backwards compatibility: parse tableNumber "Name | Address"
    if (tableInfo?.tableNumber) {
      console.log("[CheckoutForm] Found tableNumber:", tableInfo.tableNumber)

      const parts = tableInfo.tableNumber.split("|").map((p) => p.trim())
      console.log("[CheckoutForm] Parsed into parts:", parts)

      if (parts.length >= 2) {
        const [name, address] = parts
        console.log("[CheckoutForm] Setting fullName:", name)
        console.log("[CheckoutForm] Setting address:", address)

        setValue("fullName", name)
        setValue("address", address)
      } else if (parts.length === 1 && parts[0]) {
        console.log("[CheckoutForm] Only one part found, using as fullName:", parts[0])
        setValue("fullName", parts[0])
      }
    } else {
      console.log("[CheckoutForm] No tableInfo or tableNumber found")
    }
  }, [getTableInfo, setValue])

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h2 className="text-2xl font-bold text-foreground mb-2">No items in cart</h2>
        <p className="text-muted-foreground mb-6">Add some products before checking out</p>
        <Link href="/">
          <Button className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Continue Shopping
          </Button>
        </Link>
      </div>
    )
  }

  const onSubmit = async (data: CheckoutFormData) => {
    if (!showReview) {
      if (data.paymentMethod === "momo" && !data.momoPhone) {
        alert("Please enter your Mobile Money phone number")
        return
      }
      if (data.paymentMethod === "card") {
        if (!data.cardNumber || !data.cardExpiry || !data.cardCvv || !data.cardName) {
          alert("Please fill in all card details")
          return
        }
      }
      setShowReview(true)
      return
    }

    setIsProcessing(true)
    try {
      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerEmail: data.email,
          buyerName: data.fullName,
          buyerPhone: data.phone,
          buyerLocation: `${data.address}, ${data.city}`,

          sellerAccount: items[0]?.supplierId || "",
          sellerName: items[0]?.supplierName || "",
          sellerPhone: "",

          paymentName: data.paymentMethod === "momo"
            ? "PAID_MTN_MOMO"
            : data.paymentMethod === "card"
              ? "PAID_CARD"
              : "PAY_ON_DELIVERY",
          paymentId: `TXN-${Date.now()}`,
          reference: data.notes || `ORDER-${Date.now()}`,
          currency: "RWF",

          items: items.map((it) => ({
            name: it.name,
            qty: it.qty,
            unitPrice: it.price,
            unit: it.unit || "pcs",
            itemCode: it.itemCode ?? it.id,
          })),

          subtotal: getTotalPrice(),
        }),
      })

      const json = await res.json()

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Order creation failed")
      }

      console.log("✅ Order created successfully:", json)

      clearCart()
      router.push(`/track-order/${json.orderId}`)

    } catch (e: any) {
      console.error("❌ Order creation error:", e)
      alert(e?.message || "Failed to create order. Please try again.")
    } finally {
      setIsProcessing(false)
    }
  }

  const formData = watch()

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  1
                </span>
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input id="fullName" placeholder="John Doe" {...register("fullName")} disabled={showReview} />
                  {errors.fullName && <p className="text-sm text-destructive">{errors.fullName.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+250 788 123 456"
                    {...register("phone")}
                    disabled={showReview}
                  />
                  {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  {...register("email")}
                  disabled={showReview}
                />
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Delivery Address *</Label>
                <div className="flex gap-2">
                  <Input
                    id="address"
                    placeholder="Street address, building, apartment"
                    {...register("address")}
                    disabled={showReview}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setShowMap(!showMap)}
                    disabled={showReview}
                  >
                    <MapPin className="h-4 w-4" />
                  </Button>
                </div>
                {errors.address && <p className="text-sm text-destructive">{errors.address.message}</p>}
              </div>

              {showMap && (
                <div className="rounded-lg border bg-muted/50 p-4">
                  <p className="text-sm text-muted-foreground mb-2">Click on the map to select your location</p>
                  <div className="aspect-video rounded-lg bg-muted flex items-center justify-center">
                    <div className="text-center">
                      <MapPin className="h-8 w-8 mx-auto mb-2 text-primary" />
                      <p className="text-sm text-muted-foreground">Map integration coming soon</p>
                      <p className="text-xs text-muted-foreground mt-1">For now, please enter your address manually</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="city">City *</Label>
                <Input id="city" placeholder="Kigali" {...register("city")} disabled={showReview} />
                {errors.city && <p className="text-sm text-destructive">{errors.city.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Delivery Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Any special instructions for delivery..."
                  rows={3}
                  {...register("notes")}
                  disabled={showReview}
                />
              </div>
            </CardContent>
          </Card>

          {/* Payment Method */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  2
                </span>
                Payment Method
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup
                value={paymentMethod}
                onValueChange={(value) => setValue("paymentMethod", value as "momo" | "card")}
                disabled={showReview}
                className="space-y-3"
              >
                <div className="flex items-center space-x-3 rounded-lg border p-4 transition-colors hover:bg-muted/50">
                  <RadioGroupItem value="momo" id="momo" />
                  <Label htmlFor="momo" className="flex flex-1 cursor-pointer items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Smartphone className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">Mobile Money (MoMo Pay)</p>
                      <p className="text-sm text-muted-foreground">Pay with MTN or Airtel Money</p>
                    </div>
                  </Label>
                </div>

                <div className="flex items-center space-x-3 rounded-lg border p-4 transition-colors hover:bg-muted/50">
                  <RadioGroupItem value="card" id="card" />
                  <Label htmlFor="card" className="flex flex-1 cursor-pointer items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <CreditCard className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">Credit / Debit Card</p>
                      <p className="text-sm text-muted-foreground">Visa, Mastercard accepted</p>
                    </div>
                  </Label>
                </div>
              </RadioGroup>

              {paymentMethod === "momo" && !showReview && (
                <div className="space-y-2 pt-2">
                  <Label htmlFor="momoPhone">Mobile Money Phone Number *</Label>
                  <Input id="momoPhone" type="tel" placeholder="+250 788 123 456" {...register("momoPhone")} />
                  <p className="text-xs text-muted-foreground">
                    You will receive a prompt on your phone to confirm payment
                  </p>
                </div>
              )}

              {paymentMethod === "card" && !showReview && (
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="cardName">Cardholder Name *</Label>
                    <Input id="cardName" placeholder="John Doe" {...register("cardName")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cardNumber">Card Number *</Label>
                    <Input
                      id="cardNumber"
                      placeholder="1234 5678 9012 3456"
                      maxLength={19}
                      {...register("cardNumber")}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cardExpiry">Expiry Date *</Label>
                      <Input id="cardExpiry" placeholder="MM/YY" maxLength={5} {...register("cardExpiry")} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cardCvv">CVV *</Label>
                      <Input id="cardCvv" type="password" placeholder="123" maxLength={3} {...register("cardCvv")} />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Review Section */}
          {showReview && (
            <Card className="border-accent">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
                    <Check className="h-5 w-5" />
                  </span>
                  Review Your Order
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                  <h4 className="font-semibold text-sm">Delivery Information</h4>
                  <div className="text-sm space-y-1">
                    <p>
                      <span className="text-muted-foreground">Name:</span> {formData.fullName}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Phone:</span> {formData.phone}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Email:</span> {formData.email}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Address:</span> {formData.address}, {formData.city}
                    </p>
                    {formData.notes && (
                      <p>
                        <span className="text-muted-foreground">Notes:</span> {formData.notes}
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                  <h4 className="font-semibold text-sm">Payment Method</h4>
                  <p className="text-sm">
                    {formData.paymentMethod === "momo" ? (
                      <>Mobile Money: {formData.momoPhone}</>
                    ) : (
                      <>Card ending in {formData.cardNumber?.slice(-4)}</>
                    )}
                  </p>
                </div>

                <Button type="button" variant="outline" onClick={() => setShowReview(false)} className="w-full">
                  Edit Information
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <CheckoutSummary isProcessing={isProcessing} showReview={showReview} />
        </div>
      </div>
    </form>
  )
}