"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"

/** Product categories (Drugs, Beer, Wines, BBQ, …). Replace with API when ready. */
const PRODUCT_CATEGORIES = [
  { slug: "drugs", name: "Drugs" },
  { slug: "beer", name: "Beer" },
  { slug: "wines", name: "Wines" },
  { slug: "bbq", name: "BBQ" },
  { slug: "beverages", name: "Beverages" },
  { slug: "food", name: "Food" },
  { slug: "cosmetics", name: "Cosmetics" },
  { slug: "household", name: "Household" },
]

export function CategoryListAI() {
  return (
    <section className="py-8 md:py-12 bg-slate-50/50">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap gap-2">
          {PRODUCT_CATEGORIES.map((cat) => (
            <Link
              key={cat.slug}
              href={`/search?q=${encodeURIComponent(cat.name)}`}
              className={cn(
                "inline-flex items-center rounded-full border bg-background px-4 py-2 text-sm font-medium",
                "hover:bg-accent hover:text-accent-foreground transition-colors"
              )}
            >
              {cat.name}
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
