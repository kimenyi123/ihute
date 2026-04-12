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
import { validateStock } from "@/lib/api/table-commands"
import { orderErrorMessageWithProductNames } from "@/lib/order-error-display"
import { kaosCatalogBaseUnitPrice } from "@/lib/kaos-catalog-price"
import { CreditCard, Smartphone, ArrowLeft, Check, MapPin, Users } from "lucide-react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"

const checkoutSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  address: z.string().min(2, "Address must be at least 2 characters"),
  city: z.string().min(2, "City is required").optional().or(z.literal("")),
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
  const { items, getTotalPrice, clearCart, tableInfo } = useCartStore()
  const [isProcessing, setIsProcessing] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [showMap, setShowMap] = useState(false)

  // Check if this is a table order
  const hasTableNumber = Boolean(tableInfo?.tableNumber && tableInfo.tableNumber.trim() !== "")
  const isTableOrder: boolean = hasTableNumber

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

  // ✅ IMPROVED: Pre-fill form with table info
  useEffect(() => {
    if (tableInfo?.tableNumber) {
      const tableNum = tableInfo.tableNumber.trim()

      // Check if tableNumber contains "Name | Address" format
      if (tableNum.includes("|")) {
        const parts = tableNum.split("|").map(p => p.trim())
        if (parts.length >= 2) {
          const [name, address] = parts
          setValue("fullName", name)
          setValue("address", address)
        }
      } else {
        // If it's just a table number, use it for both name and address
        setValue("fullName", tableNum)
        setValue("address", tableNum)
      }

      // Set city to shop name for context
      if (tableInfo.shopName) {
        setValue("city", tableInfo.shopName)
      }
    }
  }, [tableInfo, setValue])

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
      const sellerAccount = items[0]?.supplierId || ""
      if (sellerAccount) {
        const stockItems = items.map((it) => {
          const rawCode = (it.itemCode ?? it.id).toString().trim()
          const itemCode = rawCode.replace(/__p\d+$/i, "") || rawCode
          const emb = it.itemEmballage
          return {
            itemCode,
            itemName: it.name,
            quantity: it.qty,
            unitPrice: kaosCatalogBaseUnitPrice(it.price, emb),
            ...(emb ? { item_emballage: emb, ITEM_EMBALLAGE: emb } : {}),
          }
        })
        const validation = await validateStock(stockItems, sellerAccount)
        if (!validation.allAvailable) {
          const bad =
            validation.items?.filter((i) => !i.isAvailable) ?? []
          const detail =
            bad.length > 0
              ? bad
                  .map(
                    (i) =>
                      `${i.itemName || i.itemCode}: need ${i.requestedQty}, available ${i.availableQty}`,
                  )
                  .join("\n")
              : validation.error || "Stock could not be confirmed"
          throw new Error(orderErrorMessageWithProductNames(detail, items))
        }
        if (!validation.ok && validation.error) {
          throw new Error(orderErrorMessageWithProductNames(validation.error, items))
        }
      }

      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerEmail: data.email || "",
          buyerName: data.fullName,
          buyerPhone: data.phone,
          buyerLocation: data.city ? `${data.address}, ${data.city}` : data.address,

          // ✅ Include table info if available
          tableNumber: isTableOrder ? tableInfo?.tableNumber : undefined,
          shopId: isTableOrder ? tableInfo?.shopId : undefined,

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

          items: items.map((it) => {
            const rawCode = (it.itemCode ?? it.id).toString().trim()
            const itemCode = rawCode.replace(/__p\d+$/i, "") || rawCode
            const catalogBase = kaosCatalogBaseUnitPrice(it.price, it.itemEmballage)
            return {
              name: it.name,
              qty: it.qty,
              unitPrice: catalogBase,
              unit: it.unit || "pcs",
              itemCode,
              ...(it.itemEmballage
                ? { item_emballage: it.itemEmballage, ITEM_EMBALLAGE: it.itemEmballage }
                : {}),
              ...(it.item_state ? { item_state: it.item_state } : {}),
              ...(it.expiryLabel ? { expiry_label: it.expiryLabel } : {}),
            }
          }),

          subtotal: getTotalPrice(),
        }),
      })

      const json = await res.json()

      if (!res.ok || !json?.ok) {
        throw new Error(
          orderErrorMessageWithProductNames(
            json?.error || "Order creation failed",
            items,
          ),
        )
      }

      console.log("✅ Order created successfully:", json)

      clearCart()
      router.push(`/track-order/${json.orderId}`)

    } catch (e: any) {
      console.error("❌ Order creation error:", e)
      const raw = e?.message || "Failed to create order. Please try again."
      alert(orderErrorMessageWithProductNames(raw, items))
    } finally {
      setIsProcessing(false)
    }
  }

  const formData = watch()

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Table Order Info Banner */}
          {isTableOrder && (
            <Card className="border-primary bg-primary/5">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">Table Order</p>
                    <p className="text-sm text-muted-foreground">
                      {tableInfo?.shopName} - {tableInfo?.tableNumber}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  1
                </span>
                {isTableOrder ? "Table Information" : "Customer Information"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName">
                    {isTableOrder ? "Table Number / Name" : "Full Name"} *
                  </Label>
                  <Input
                    id="fullName"
                    placeholder={isTableOrder ? "Table 5" : "John Doe"}
                    {...register("fullName", { disabled: showReview || isTableOrder })}
                    className={isTableOrder ? "bg-muted" : undefined}
                  />
                  {isTableOrder && (
                    <p className="text-xs text-muted-foreground">
                      Pre-filled from your table selection
                    </p>
                  )}
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
                <Label htmlFor="email">
                  Email Address {isTableOrder ? "(Optional)" : "*"}
                </Label>
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
                <Label htmlFor="address">
                  {isTableOrder ? "Table Location" : "Delivery Address"} *
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="address"
                    placeholder={isTableOrder ? "Table 5" : "Street address, building, apartment"}
                    {...register("address", { disabled: showReview || isTableOrder })}
                    className={`flex-1 ${isTableOrder ? "bg-muted" : ""}`}
                  />
                  {!isTableOrder && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowMap(!showMap)}
                      disabled={showReview}
                    >
                      <MapPin className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {isTableOrder && (
                  <p className="text-xs text-muted-foreground">
                    Your order will be delivered to this table
                  </p>
                )}
                {errors.address && <p className="text-sm text-destructive">{errors.address.message}</p>}
              </div>

              {showMap && !isTableOrder && (
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

              {!isTableOrder && (
                <div className="space-y-2">
                  <Label htmlFor="city">City *</Label>
                  <Input id="city" placeholder="Kigali" {...register("city")} disabled={showReview} />
                  {errors.city && <p className="text-sm text-destructive">{errors.city.message}</p>}
                </div>
              )}

              {isTableOrder && (
                <div className="space-y-2">
                  <Label htmlFor="city">Restaurant/Bar</Label>
                  <Input
                    id="city"
                    placeholder={tableInfo?.shopName}
                    {...register("city")}
                    disabled={showReview || isTableOrder}
                    className="bg-muted"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">
                  {isTableOrder ? "Special Requests (Optional)" : "Delivery Notes (Optional)"}
                </Label>
                <Textarea
                  id="notes"
                  placeholder={isTableOrder ? "Any special requests for your order..." : "Any special instructions for delivery..."}
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
                    <div>Mobile Money (MoMo Pay)
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
                  <h4 className="font-semibold text-sm">
                    {isTableOrder ? "Table Information" : "Delivery Information"}
                  </h4>
                  <div className="text-sm space-y-1">
                    <p>
                      <span className="text-muted-foreground">
                        {isTableOrder ? "Table:" : "Name:"}
                      </span> {formData.fullName}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Phone:</span> {formData.phone}
                    </p>
                    {formData.email && (
                      <p>
                        <span className="text-muted-foreground">Email:</span> {formData.email}
                      </p>
                    )}
                    <p>
                      <span className="text-muted-foreground">
                        {isTableOrder ? "Location:" : "Address:"}
                      </span> {formData.address}{formData.city && `, ${formData.city}`}
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