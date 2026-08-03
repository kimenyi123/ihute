/**
 * GET /api/supplier/item-order-sales?account=...&nickname=...
 *
 * Units sold per ITEM_CODE for the seller (last 30 days by default).
 * Powers the supplier dashboard FMCG shelf.
 *
 * 1) Query order MySQL (GQ_MYSQL_* / ONBOARDING_* / MYSQL_*)
 * 2) If empty and nickname given → fall back to shop-with-me (Java already enriches totalSold)
 */

import { NextRequest, NextResponse } from "next/server"
import {
  fetchShopItemOrderSales,
} from "@/lib/shop-item-order-sales"
import { VELOCITY_LOOKBACK_DAYS } from "@/lib/sales-velocity"

function nz(v: unknown): string {
  return v == null ? "" : String(v).trim()
}

function num(v: unknown): number {
  if (v == null) return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function putSale(sales: Record<string, number>, code: string, qty: number) {
  const k = code.trim().toUpperCase()
  if (!k || qty <= 0) return
  sales[k] = Math.max(sales[k] ?? 0, qty)
}

async function salesFromShopWithMe(
  nickname: string,
  origin: string,
): Promise<Record<string, number>> {
  const sales: Record<string, number> = {}
  const nick = nickname.trim().toLowerCase()
  if (!nick) return sales

  const url = `${origin}/api/shop-with-me?nickname=${encodeURIComponent(nick)}`
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    })
    const data = await res.json().catch(() => null)
    if (!data?.ok || !Array.isArray(data.sellers)) return sales

    for (const seller of data.sellers) {
      const products = Array.isArray(seller?.products) ? seller.products : []
      for (const p of products) {
        if (!p || typeof p !== "object") continue
        const row = p as Record<string, unknown>
        const qty = num(row.totalSold ?? row.unitsSold ?? row.units_sold)
        if (qty <= 0) continue
        for (const key of [
          "ITEM_CODE",
          "item_code",
          "itemCode",
          "item_key_words",
          "niki_code",
          "NIKI_CODE",
        ]) {
          putSale(sales, nz(row[key]), qty)
        }
      }
    }
  } catch (e) {
    console.warn("[api/supplier/item-order-sales] shop-with-me fallback failed:", e)
  }
  return sales
}

export async function GET(req: NextRequest) {
  const account = req.nextUrl.searchParams.get("account")?.trim()
  if (!account) {
    return NextResponse.json({ ok: false, error: "account required" }, { status: 400 })
  }

  const nickname = req.nextUrl.searchParams.get("nickname")?.trim() ?? ""
  const lookbackRaw = req.nextUrl.searchParams.get("days")
  const lookbackDays = lookbackRaw
    ? Math.max(1, Math.min(365, Number(lookbackRaw) || VELOCITY_LOOKBACK_DAYS))
    : VELOCITY_LOOKBACK_DAYS

  try {
    const map = await fetchShopItemOrderSales(account, lookbackDays)
    const sales: Record<string, number> = {}
    for (const [code, qty] of map) {
      sales[code] = qty
    }

    let source: "mysql" | "shop-with-me" | "empty" = map.size > 0 ? "mysql" : "empty"

    if (Object.keys(sales).length === 0 && nickname) {
      const origin = req.nextUrl.origin
      const fromSwm = await salesFromShopWithMe(nickname, origin)
      Object.assign(sales, fromSwm)
      if (Object.keys(sales).length > 0) source = "shop-with-me"
    }

    return NextResponse.json({
      ok: true,
      lookbackDays,
      sales,
      count: Object.keys(sales).length,
      source,
    })
  } catch (e) {
    console.warn("[api/supplier/item-order-sales]", e)
    return NextResponse.json(
      { ok: false, error: "Failed to load item order sales" },
      { status: 500 },
    )
  }
}
