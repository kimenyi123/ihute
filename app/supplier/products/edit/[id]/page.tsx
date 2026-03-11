"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useAuthStore } from "@/lib/auth-store"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Trash2, Loader2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type Product = {
  id: string
  name: string
  price: number
  stock: number
  category?: string
}

export default function SupplierEditProductPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuthStore()

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [price, setPrice] = useState("")
  const [stock, setStock] = useState("")

  // Fetch product from API
  useEffect(() => {
    const fetchProduct = async () => {
      if (!user?.ishyigaAccount) return

      try {
        setLoading(true)
        const res = await fetch(`/api/supplier/stock?account=${user.ishyigaAccount}`)
        const json = await res.json()

        console.log('[EDIT-PRODUCT] API Response:', json)
        console.log('[EDIT-PRODUCT] Looking for product ID:', id)

        if (json.products) {
          console.log('[EDIT-PRODUCT] All product IDs:', json.products.map((p: any) => ({
            item_key_words: p.item_key_words,
            ITEM_CODE: p.ITEM_CODE,
            id: p.id,
            name: p.item_commercial_name || p.ITEM_NAME
          })))

          const foundProduct = json.products.find((p: any) => 
            (p.item_key_words || p.ITEM_CODE || p.id) === id
          )

          console.log('[EDIT-PRODUCT] Found product:', foundProduct)

          if (foundProduct) {
            // Handle both Redis format and database format
            const productId = foundProduct.item_key_words || foundProduct.ITEM_CODE || foundProduct.id
            const productName = foundProduct.item_commercial_name || foundProduct.ITEM_NAME || foundProduct.name
            
            // Prefer selling_price (Redis); then item_emballage; then DB/API price
            let productPrice = 0
            if (foundProduct.selling_price != null) {
              productPrice = typeof foundProduct.selling_price === "number" ? foundProduct.selling_price : parseFloat(String(foundProduct.selling_price)) || 0
            }
            if (productPrice <= 0 && foundProduct.item_emballage) {
              const priceStr = foundProduct.item_emballage.replace(/RWF/gi, '').trim()
              productPrice = parseFloat(priceStr) || 0
            }
            if (productPrice <= 0) {
              productPrice = parseFloat(foundProduct.price || foundProduct.SALE_PRICE_INCLUSIVE || 0)
            }
            
            // Parse stock from Redis format or database format
            let productStock = 0
            if (foundProduct.item_packet) {
              productStock = parseInt(foundProduct.item_packet) || 0
            } else {
              productStock = parseInt(foundProduct.stock || foundProduct.QUANTITY || 0)
            }

            const mapped: Product = {
              id: productId,
              name: productName,
              price: productPrice,
              stock: productStock,
              category: foundProduct.category || "uncategorized",
            }
            setProduct(mapped)
            setPrice(String(mapped.price))
            setStock(String(mapped.stock))
          } else {
            console.error('[EDIT-PRODUCT] Product not found in list')
          }
        }
      } catch (err) {
        console.error("Error fetching product:", err)
        setError("Failed to load product")
      } finally {
        setLoading(false)
      }
    }

    fetchProduct()
  }, [id, user])

  const onSave = async () => {
    if (!product || !user?.ishyigaAccount) return

    try {
      setSaving(true)
      setError(null)

      const res = await fetch(`/api/supplier/stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateProduct",
          account: user.ishyigaAccount,
          itemCode: product.id,
          price: Number(price || 0),
          stock: Number(stock || 0),
        }),
      })

      const json = await res.json()

      if (json.ok) {
        router.push("/supplier/products")
      } else {
        setError(json.error || "Failed to update product")
      }
    } catch (err) {
      console.error("Error updating product:", err)
      setError("Failed to update product")
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async () => {
    if (!product || !user?.ishyigaAccount) return

    try {
      setDeleting(true)
      setError(null)

      const res = await fetch(
        `/api/supplier/stock/${encodeURIComponent(product.id)}?account=${encodeURIComponent(user.ishyigaAccount)}`,
        { method: "DELETE" }
      )

      const json = await res.json()

      if (json.ok) {
        router.push("/supplier/products")
      } else {
        setError(json.error || json.message || "Failed to delete product")
        setShowDeleteDialog(false)
      }
    } catch (err) {
      console.error("Error deleting product:", err)
      setError("Failed to delete product")
      setShowDeleteDialog(false)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="pt-6 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="ml-2">Loading product...</span>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="p-4">
        <Card>
          <CardHeader>
            <CardTitle>Product not found</CardTitle>
            <CardDescription>Ensure you navigated from your products list.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/supplier/products")}>
              Back to Products
            </Button>
          </CardContent>
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
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label>Product Code</Label>
            <Input value={product.id} disabled />
          </div>

          <div className="space-y-2">
            <Label>Price (RWF)</Label>
            <Input 
              type="number" 
              value={price} 
              onChange={(e) => setPrice(e.target.value)}
              disabled={saving || deleting}
            />
          </div>

          <div className="space-y-2">
            <Label>Stock</Label>
            <Input 
              type="number" 
              value={stock} 
              onChange={(e) => setStock(e.target.value)}
              disabled={saving || deleting}
            />
          </div>

          <div className="flex gap-2 justify-between">
            <div className="flex gap-2">
              <Button onClick={onSave} disabled={saving || deleting}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save
              </Button>
              <Button 
                variant="outline" 
                onClick={() => router.back()}
                disabled={saving || deleting}
              >
                Cancel
              </Button>
            </div>

            <Button
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
              disabled={saving || deleting}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{product.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}


