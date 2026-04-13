import { NextResponse } from "next/server"
import {
  getBackendBase,
  getGrandmaBuyerApiUrl,
  getGrandmaSellerApiUrl,
  getGrandmaSellerInventoryApiUrl,
  getGrandmaSellerStockApiUrl,
  getGrandmaSellerTempItemApiUrl,
} from "@/lib/backend-config"

export const runtime = "nodejs"

/**
 * Dev-only: shows which Java base URL the Next server resolves (same as /api/grandma/buyers proxy).
 * Open GET http://localhost:3000/api/debug/backend-target while `next dev` is running.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({
    ok: true,
    backendBase: getBackendBase(),
    grandmaBuyerPostUrl: getGrandmaBuyerApiUrl(),
    grandmaSellerPostUrl: getGrandmaSellerApiUrl(),
    grandmaSellerStockPostUrl: getGrandmaSellerStockApiUrl(),
    grandmaInventoryUrl: getGrandmaSellerInventoryApiUrl(),
    grandmaTempItemPostUrl: getGrandmaSellerTempItemApiUrl(),
    note:
      "Save to stock (Items) POSTs to grandmaTempItemPostUrl. Default backendBase is ihute.rw if env is unset — that uses production MySQL, not your local chaos_theta.",
    env: {
      BACKEND_URL: process.env.BACKEND_URL ?? null,
      JAVA_BACKEND_BASE: process.env.JAVA_BACKEND_BASE ?? null,
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? null,
      GRANDMA_BUYER_API_URL: process.env.GRANDMA_BUYER_API_URL ?? null,
      GRANDMA_SELLER_API_URL: process.env.GRANDMA_SELLER_API_URL ?? null,
      GRANDMA_SELLER_STOCK_API_URL: process.env.GRANDMA_SELLER_STOCK_API_URL ?? null,
      GRANDMA_INVENTORY_API_URL: process.env.GRANDMA_INVENTORY_API_URL ?? null,
      GRANDMA_TEMP_ITEM_API_URL: process.env.GRANDMA_TEMP_ITEM_API_URL ?? null,
    },
  })
}
