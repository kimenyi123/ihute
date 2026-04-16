import { NextRequest, NextResponse } from "next/server"
import type { KioskCategory, KioskMenuItem, KioskModifierGroup } from "@/src/modules/self-order/types"

function mapKioskCategoryToHomepageCategoryId(category: KioskCategory): string {
  switch (category) {
    case "BAR":
    case "RESTRO":
      return "bar-resto"
    case "COFFEE_SHOP":
      return "coffee-shop"
    default:
      return ""
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get("category") as KioskCategory | null
  const currency = searchParams.get("currency") || "RWF"

  if (!category) {
    return NextResponse.json({ error: "Missing category" }, { status: 400 })
  }

  const homepageCategoryId = mapKioskCategoryToHomepageCategoryId(category)
  if (!homepageCategoryId) {
    return NextResponse.json({ error: "Unsupported category" }, { status: 400 })
  }

  try {
    // Sector shop list via Next proxy → Kaos sectorListSuppliers (same JSON as legacy fetchSuggestions),
    // which already selects sellers based on preferredCategories from account_signup.
    const origin = req.nextUrl.origin
    const url = new URL("/api/sector-list-suppliers", origin)
    url.searchParams.set("sector", homepageCategoryId)
    url.searchParams.set("Currency", currency)

    const resp = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    })

    if (!resp.ok) {
      const raw = await resp.text()
      console.error("[kiosk/menu] fetchSuggestions error", resp.status, raw.slice(0, 200))
      return NextResponse.json({
        items: [],
        total: 0,
        category,
        error: "Menu service unavailable",
      })
    }

    const parsed = await resp.json()
    const sellers: any[] = Array.isArray(parsed) ? parsed : []

    const items: KioskMenuItem[] = []

    for (const s of sellers) {
      const sellerAccount =
        s.seller_account ?? s.SELLER_ISHYIGA_ACCOUNT ?? s.seller_ishyiga_account ?? ""
      const sellerName = s.seller_name ?? s.SELLER_NAMES ?? ""
      const sellerLoc = s.seller_location ?? s.LOCATION ?? ""

      for (const p of s.products || []) {
        const sizes = (p.sizes as KioskModifierGroup[] | undefined) ??
          (p.SIZES as KioskModifierGroup[] | undefined)
        const modifiers = (p.modifiers as KioskModifierGroup[] | undefined) ??
          (p.MODIFIERS as KioskModifierGroup[] | undefined)
        const toppings = (p.toppings as KioskModifierGroup[] | undefined) ??
          (p.TOPPINGS as KioskModifierGroup[] | undefined)

        items.push({
          item_code: String(p.item_code ?? p.ITEM_CODE ?? ""),
          item_commercial_name: String(
            p.item_commercial_name ?? p.ITEM_NAME ?? p.item_name ?? "Product",
          ),
          item_name: p.item_name ?? p.ITEM_NAME,
          selling_price: Number(p.selling_price ?? p.SALE_PRICE_INCLUSIVE ?? 0),
          unit: String(p.unit ?? p.UNIT ?? ""),
          image_url: p.image_url ?? p.item_image_url ?? p.image ?? p.IMAGE_URL,
          supplier_account: String(p.supplier_account ?? sellerAccount),
          supplier_name: String(p.supplier_name ?? sellerName),
          supplier_location: p.supplier_location ?? sellerLoc,
          search_priority:
            typeof p.search_priority === "number" ? p.search_priority : undefined,
          contains_ingredient: p.contains_ingredient,
          // Pass through any backend category/sector hints
          category: p.category ?? p.CATEGORY,
          sector: p.sector ?? p.SECTOR,
          keywords: p.keywords ?? p.item_key_words ?? "",
          sizes,
          modifiers,
          toppings,
        })
      }
    }

    return NextResponse.json({
      items,
      total: items.length,
      category,
    })
  } catch (e: any) {
    console.error("[kiosk/menu] error", e?.message || e)
    return NextResponse.json({
      items: [],
      total: 0,
      category,
      error: "Menu request failed",
    })
  }
}
