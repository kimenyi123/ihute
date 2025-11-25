"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, LogOut } from "lucide-react";
import Link from "next/link";

const UNITS = ["piece", "box", "carton", "crate", "kg", "liter", "pack", "bottle"];

export default function AddProductPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const handleLogout = () => {
    logout();
    router.push("/");
  };
  const [formData, setFormData] = useState({
    ITEM_NAME: "",
    QUANTITY: "",
    SALE_PRICE_INCLUSIVE: "",
    COST_PRICE_INCLUSIVE: "",
    DESCRIPTION_KEYWORD: "",
    UNIT: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/supplier/add-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          SUPPLIER_ACCOUNT: user?.ishyigaAccount,
          OWNER: user?.businessName,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        console.error("Server response:", err);
        throw new Error(err.message || "Failed to add product");
      }

      // ✅ Notify dashboards to update instantly
      window.dispatchEvent(new Event("productAdded"));

      alert("✅ Product added successfully!");
      router.push("/supplier/dashboard");
    } catch (error) {
      console.error("Error adding product:", error);
      alert("❌ Failed to add product. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              {user?.businessName || "Supplier Dashboard"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600">
              {user?.businessCategory || "Supplier Panel"}
            </p>
          </div>
          <Button variant="outline" onClick={handleLogout} className="w-full sm:w-auto">
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Link href="/supplier/dashboard">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>Add New Product</CardTitle>
            <CardDescription>Provide all necessary product details below</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ITEM_NAME">Product Name</Label>
                <Input
                  id="ITEM_NAME"
                  placeholder="e.g., product name"
                  value={formData.ITEM_NAME}
                  onChange={(e) => setFormData({ ...formData, ITEM_NAME: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="QUANTITY">Quantity</Label>
                  <Input
                    id="QUANTITY"
                    type="number"
                    placeholder="e.g., 100"
                    value={formData.QUANTITY}
                    onChange={(e) => setFormData({ ...formData, QUANTITY: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="UNIT">Unit</Label>
                  <Select
                    onValueChange={(val) => setFormData({ ...formData, UNIT: val })}
                    value={formData.UNIT}
                  >
                    <SelectTrigger id="UNIT">
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {UNITS.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="SALE_PRICE_INCLUSIVE">Sale Price (RWF)</Label>
                  <Input
                    id="SALE_PRICE_INCLUSIVE"
                    type="number"
                    placeholder="e.g., 1500"
                    value={formData.SALE_PRICE_INCLUSIVE}
                    onChange={(e) => setFormData({ ...formData, SALE_PRICE_INCLUSIVE: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="COST_PRICE_INCLUSIVE">Cost Price (RWF)</Label>
                  <Input
                    id="COST_PRICE_INCLUSIVE"
                    type="number"
                    placeholder="e.g., 1000"
                    value={formData.COST_PRICE_INCLUSIVE}
                    onChange={(e) => setFormData({ ...formData, COST_PRICE_INCLUSIVE: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="DESCRIPTION_KEYWORD">Description</Label>
                <Textarea
                  id="DESCRIPTION_KEYWORD"
                  placeholder="Short product details or keywords"
                  value={formData.DESCRIPTION_KEYWORD}
                  onChange={(e) => setFormData({ ...formData, DESCRIPTION_KEYWORD: e.target.value })}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Adding Product..." : "Add Product"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
