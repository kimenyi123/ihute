"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";

export default function EditProduct() {
  const router = useRouter();
  const params = useParams();
  const { user, isAuthenticated } = useAuthStore();
  const [product, setProduct] = useState<any>({
    ITEM_NAME: "",
    QUANTITY: 0,
    SALE_PRICE_INCLUSIVE: 0,
    COST_PRICE_INCLUSIVE: 0,
    DESCRIPTION: "",
    UNIT: "",
  });
  const [loading, setLoading] = useState(true);

  const itemCode = params.itemCode;

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "supplier") {
      router.push("/login");
      return;
    }

    const fetchProduct = async () => {
      try {
        const res = await fetch(`/api/supplier/stock/${itemCode}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to fetch product");
        setProduct(data.product);
        setLoading(false);
      } catch (err) {
        console.error(err);
        alert("Error fetching product");
      }
    };

    fetchProduct();
  }, [itemCode, isAuthenticated, user, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setProduct({ ...product, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/supplier/stock/${itemCode}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(product),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update product");
      alert("Product updated successfully");
      router.push("/supplier/dashboard");
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Error updating product");
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">Edit Product</h1>
      <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
        <input
          type="text"
          name="ITEM_NAME"
          placeholder="Product Name"
          value={product.ITEM_NAME}
          onChange={handleChange}
          className="w-full p-2 border rounded"
          required
        />
        <input
          type="number"
          name="QUANTITY"
          placeholder="Quantity"
          value={product.QUANTITY}
          onChange={handleChange}
          className="w-full p-2 border rounded"
          required
        />
        <input
          type="number"
          name="SALE_PRICE_INCLUSIVE"
          placeholder="Sale Price"
          value={product.SALE_PRICE_INCLUSIVE}
          onChange={handleChange}
          className="w-full p-2 border rounded"
          required
        />
        <input
          type="number"
          name="COST_PRICE_INCLUSIVE"
          placeholder="Cost Price"
          value={product.COST_PRICE_INCLUSIVE}
          onChange={handleChange}
          className="w-full p-2 border rounded"
          required
        />
        <textarea
          name="DESCRIPTION"
          placeholder="Description"
          value={product.DESCRIPTION}
          onChange={handleChange}
          className="w-full p-2 border rounded"
        />
        <input
          type="text"
          name="UNIT"
          placeholder="Unit (e.g., pcs, kg)"
          value={product.UNIT}
          onChange={handleChange}
          className="w-full p-2 border rounded"
        />
        <Button type="submit">Update Product</Button>
      </form>
    </div>
  );
}
