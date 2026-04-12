import { NextRequest, NextResponse } from "next/server"
import { getFetchSuggestionsUrl } from "@/lib/backend-config"
import { dedupeSearchProductsByItemCodeAndSellingPrice } from "@/lib/dedupe-search-products"
import type {
  KioskCategory,
  KioskMenuItem,
  KioskModifierGroup,
  KioskSearchResponse,
} from "@/src/modules/self-order/types"

function mapKioskCategoryToSector(category: KioskCategory): string {
  switch (category) {
    case "BAR":
    case "RESTRO":
      return "BAR_RESTAURANT"
    case "COFFEE_SHOP":
      return "COFFEE_SHOP"
    default:
      return ""
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get("query") || ""
  const category = searchParams.get("category") as KioskCategory | null
  const supplier = searchParams.get("supplier") || undefined
  const location = searchParams.get("location") || undefined

  if (!query.trim()) {
    return NextResponse.json<KioskSearchResponse>(
      { items: [], total: 0, query: "", category: category ?? undefined },
      { status: 200 },
    )
  }
  if (!category) {
    return NextResponse.json({ error: "Missing category" }, { status: 400 })
  }

  const sector = mapKioskCategoryToSector(category)
  if (!sector) {
    return NextResponse.json({ error: "Unsupported category" }, { status: 400 })
  }

  try {
    const target = new URL(getFetchSuggestionsUrl())
    target.searchParams.set("globalSearch", query)
    target.searchParams.set("category", sector)
    if (supplier) target.searchParams.set("supplier", supplier)
    if (location) target.searchParams.set("location", location)

    const resp = await fetch(target.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    })

    if (!resp.ok) {
      const text = await resp.text()
      console.error("[kiosk/search] backend error", resp.status, text)
      return NextResponse.json(
        { error: "Search service unavailable" },
        { status: 502 },
      )
    }

    const raw = await resp.json()
    const products: any[] = dedupeSearchProductsByItemCodeAndSellingPrice(
      Array.isArray(raw.products) ? raw.products : [],
    ) as any[]

    const items: KioskMenuItem[] = products.map((p) => {
      const sizes = (p.sizes as KioskModifierGroup[] | undefined) ??
        (p.SIZES as KioskModifierGroup[] | undefined)
      const modifiers = (p.modifiers as KioskModifierGroup[] | undefined) ??
        (p.MODIFIERS as KioskModifierGroup[] | undefined)
      const toppings = (p.toppings as KioskModifierGroup[] | undefined) ??
        (p.TOPPINGS as KioskModifierGroup[] | undefined)

      return {
        item_code: String(p.item_code ?? ""),
        item_commercial_name: String(
          p.item_commercial_name ?? p.item_name ?? "",
        ),
        item_name: p.item_name,
        selling_price: Number(p.selling_price ?? p.SALE_PRICE_INCLUSIVE ?? 0),
        unit: String(p.unit ?? ""),
        image_url: p.image_url ?? p.item_image_url,
        supplier_account: String(p.supplier_account ?? ""),
        supplier_name: String(p.supplier_name ?? ""),
        supplier_location: p.supplier_location,
        search_priority: typeof p.search_priority === "number"
          ? p.search_priority
          : undefined,
        contains_ingredient: p.contains_ingredient,
        category: p.category,
        sector: p.sector,
        keywords: p.item_key_words,
        sizes,
        modifiers,
        toppings,
      }
    })

    return NextResponse.json<KioskSearchResponse>({
      items,
      total: items.length,
      query,
      category,
    })
  } catch (e: any) {
    console.error("[kiosk/search] error", e?.message || e)
    return NextResponse.json(
      { error: "Search request failed" },
      { status: 500 },
    )
  }
}

