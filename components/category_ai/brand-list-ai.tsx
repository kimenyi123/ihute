"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"

/** Brands (Heineken, etc.). Replace with API when ready. */
const BRANDS = [
  { slug: "heineken", name: "Heineken" },
  { slug: "primus", name: "Primus" },
  { slug: "mutzig", name: "Mutzig" },
  { slug: "coca-cola", name: "Coca-Cola" },
  { slug: "pepsi", name: "Pepsi" },
  { slug: "mtn", name: "MTN" },
]

export function BrandListAI() {
  return (
    <section className="py-8 md:py-12 bg-slate-50/50">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap gap-2">
          {BRANDS.map((brand) => (
            <Link
              key={brand.slug}
              href={`/search?q=${encodeURIComponent(brand.name)}`}
              className={cn(
                "inline-flex items-center rounded-full border bg-background px-4 py-2 text-sm font-medium",
                "hover:bg-accent hover:text-accent-foreground transition-colors"
              )}
            >
              {brand.name}
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
