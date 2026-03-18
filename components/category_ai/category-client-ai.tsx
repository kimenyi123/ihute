// components/category_ai/category-client-ai.tsx
// Enhanced category client for /category_ai/[categoryId].
// Copy of @/components/category-client – add AI/enhancements here.
// See docs/category_ai.md for upgrade notes.
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BusinessList } from "@/components/business-list";
import { ProductGrid } from "@/components/product-grid";
import { usePrefsStore } from "@/lib/prefs-store";

export function CategoryClientAI({
  categoryId,
  categoryName,
}: {
  categoryId: string;
  categoryName: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [supplierId, setSupplierId] = useState<"all" | string>("all");
  const [supplierName, setSupplierName] = useState("All Suppliers");
  const setSector = usePrefsStore((s) => s.setSector);

  useEffect(() => {
    setSector(categoryId || null);
    return () => setSector(null);
  }, [categoryId, setSector]);

  useEffect(() => {
    const urlSupplier = searchParams.get("supplier");
    const urlSupplierName = searchParams.get("supplierName");
    setSupplierId((urlSupplier as any) || "all");
    setSupplierName(urlSupplierName || "All Suppliers");
  }, [searchParams]);

  const updateQuery = (id: string, name?: string) => {
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    if (id === "all") {
      params.delete("supplier");
      params.delete("supplierName");
    } else {
      params.set("supplier", id);
      params.set("supplierName", name || "Supplier");
    }
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  return (
    <>
      <BusinessList
        categoryId={categoryId}
        selectedSupplier={supplierId}
        onSelect={(id, name) => {
          setSupplierId(id);
          setSupplierName(name || "Supplier");
          updateQuery(id, name);
          const el = document.getElementById("products-section");
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      />

      <section id="products-section" className="mt-8">
        <ProductGrid
          categoryId={categoryId}
          categoryName={categoryName}
          selectedSupplier={supplierId}
          selectedSupplierName={supplierName}
        />
      </section>
    </>
  );
}
