"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useProductStore } from "@/lib/product-store"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

export default function SupplierEditProductPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const products = useProductStore((s) => s.products)
  const updateProduct = useProductStore((s) => s.updateProduct)

  const product = products.find((p) => p.id === id)
  const [price, setPrice] = useState("")
  const [stock, setStock] = useState("")

  useEffect(() => {
    if (product) {
      setPrice(String(product.price))
      setStock(String(product.stock))
    }
  }, [product])

  const onSave = () => {
    if (!product) return
    updateProduct(product.id, { price: Number(price || 0), stock: Number(stock || 0) })
    router.push("/supplier/dashboard")
  }

  if (!product) {
    return (
      <div className="p-4">
        <Card>
          <CardHeader>
            <CardTitle>Product not found</CardTitle>
            <CardDescription>Ensure you navigated from your products list.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4">
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Edit {product.name}</CardTitle>
          <CardDescription>Update price and stock</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Price (RWF)</Label>
            <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Stock</Label>
            <Input type="number" value={stock} onChange={(e) => setStock(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button onClick={onSave}>Save</Button>
            <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


