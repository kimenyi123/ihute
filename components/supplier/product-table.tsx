// components/product-table.tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useProductStore, type Product } from "@/lib/product-store"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Pencil, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { GlobalSearch } from "@/components/global-search" // ⬅️ NEW

export function ProductTable({ products }: { products: Product[] }) {
  const router = useRouter()
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [editForm, setEditForm] = useState({ price: "", stock: "" })
  const updateProduct = useProductStore((state) => state.updateProduct)
  const deleteProduct = useProductStore((state) => state.deleteProduct)

  // We no longer filter locally; show everything in the table.
  const filteredProducts = products

  const handleEdit = (product: Product) => {
    router.push(`/supplier/products/edit/${product.id}`)
  }

  const handleUpdate = () => {
    if (editingProduct) {
      updateProduct(editingProduct.id, {
        price: Number.parseFloat(editForm.price),
        stock: Number.parseInt(editForm.stock),
      })
      setEditingProduct(null)
    }
  }

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this product?")) {
      deleteProduct(id)
    }
  }

  return (
    <div className="space-y-4">
      {/* 🔎 Global Search (routes to /search and/or shows global suggestions) */}
      <GlobalSearch placeholder="Search all products & suppliers…" className="max-w-xl" />

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No products found
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.category}</TableCell>
                  <TableCell>{product.price.toLocaleString()} RWF</TableCell>
                  <TableCell>{product.unit}</TableCell>
                  <TableCell>
                    <span
                      className={
                        product.stock < 10 ? "text-red-600 font-medium" : product.stock < 50 ? "text-yellow-600" : ""
                      }
                    >
                      {product.stock}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(product)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(product.id)}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
