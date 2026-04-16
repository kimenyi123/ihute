import { NextRequest, NextResponse } from "next/server"
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
    // Reuse our Next proxy so kiosk search gets the same enrichment/cache behavior
    // as the main search flow, and pass `sector` instead of `category`.
    const target = new URL("/api/fetchSuggestions", req.nextUrl.origin)
    target.searchParams.set("globalSearch", query)
    target.searchParams.set("sector", sector)
    target.searchParams.set("Currency", "RWF")
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
        item_code: String(p.item_code ?? p.ITEM_CODE ?? p.item_key_words ?? ""),
        item_commercial_name: String(
          p.item_commercial_name ?? p.ITEM_NAME ?? p.item_name ?? "",
        ),
        item_name: p.item_name ?? p.ITEM_NAME,
        selling_price: Number(p.selling_price ?? p.SALE_PRICE_INCLUSIVE ?? 0),
        unit: String(p.unit ?? p.UNIT ?? ""),
        image_url: p.image_url ?? p.item_image_url ?? p.image ?? p.IMAGE_URL,
        supplier_account: String(p.supplier_account ?? p.seller_account ?? ""),
        supplier_name: String(p.supplier_name ?? p.seller_name ?? ""),
        supplier_location: p.supplier_location ?? p.seller_location,
        search_priority: typeof p.search_priority === "number"
          ? p.search_priority
          : undefined,
        contains_ingredient: p.contains_ingredient,
        category: p.category ?? p.CATEGORY,
        sector: p.sector ?? p.SECTOR,
        item_department: p.item_department ?? p.famille ?? p.FAMILLE ?? p.category ?? p.CATEGORY,
        keywords: p.keywords ?? p.item_key_words ?? "",
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

