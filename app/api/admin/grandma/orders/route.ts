import { NextResponse } from "next/server"
import mysql from "mysql2/promise"
import type { GrandmaAdminOrder } from "@/lib/admin-grandma-orders"
import { getOnboardingMysqlConfig } from "@/lib/onboarding-mysql"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function nz(v: unknown): string {
  return v == null ? "" : String(v).trim()
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function asIso(v: unknown): string {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString()
  const s = nz(v)
  return s
}

function isUnknownOrderSourceColumn(e: unknown): boolean {
  const err = e as { code?: string; errno?: number; message?: string }
  const msg = String(err?.message ?? "").toLowerCase()
  return err?.code === "ER_BAD_FIELD_ERROR" || err?.errno === 1054 || msg.includes("order_source")
}

function quoteIdent(name: string): string {
  return `\`${name.replace(/`/g, "")}\``
}

async function resolveOrderSourceSchema(
  conn: mysql.Connection,
  preferred: string,
): Promise<string | null> {
  const [rows] = await conn.query(
    `SELECT TABLE_SCHEMA AS schemaName
     FROM information_schema.COLUMNS
     WHERE TABLE_NAME = 'order_transaction' AND COLUMN_NAME = 'ORDER_SOURCE'
     ORDER BY CASE WHEN TABLE_SCHEMA = ? THEN 0 ELSE 1 END, TABLE_SCHEMA
     LIMIT 8`,
    [preferred],
  )
  const list = Array.isArray(rows) ? rows : []
  const first = list[0] as { schemaName?: unknown } | undefined
  const name = first?.schemaName != null ? String(first.schemaName).trim() : ""
  return name || null
}

/**
 * Admin Grandma — orders stamped ORDER_SOURCE='GRANDMA' by GrandmaOrderServlet.
 * Uses the same MySQL as other /api/admin/grandma/* routes.
 */
export async function GET() {
  const cfg = getOnboardingMysqlConfig()
  if (!cfg) {
    return NextResponse.json({
      ok: true,
      orders: [] as GrandmaAdminOrder[],
      message: "Set ONBOARDING_MYSQL_* in .env.local to load Grandma orders.",
    })
  }

  let conn: mysql.Connection | null = null
  try {
    conn = await mysql.createConnection(cfg)
    const schema = await resolveOrderSourceSchema(conn, cfg.database)
    if (!schema) {
      return NextResponse.json({
        ok: false,
        orders: [] as GrandmaAdminOrder[],
        error:
          "order_transaction.ORDER_SOURCE is missing. Run java-maputo-search/sql/order_transaction_order_source.sql on this schema.",
      })
    }
    const qSchema = quoteIdent(schema)
    const [rows] = await conn.query(
      `SELECT
         ot.ID_ORDER AS id,
         ot.order_number AS orderNumber,
         ot.SELLER_NAMES AS sellerName,
         ot.SELLER_ISHYIGA_ACCOUNT AS sellerAccount,
         ot.BUYER_NAMES AS buyerName,
         ot.BUYER_PHONE AS buyerPhone,
         ot.AMOUNT AS amount,
         ot.ORDER_STATUS AS status,
         ot.heure AS placedAt,
         ot.DELIVERY_LOCATION AS deliveryLocation,
         ot.PAYMENT_STATUS AS paymentStatus,
         ot.PAYMENT_NAME AS paymentName,
         ot.PAYMENT_ID AS paymentId
       FROM ${qSchema}.order_transaction ot
       WHERE UPPER(TRIM(COALESCE(ot.ORDER_SOURCE, ''))) = 'GRANDMA'
       ORDER BY ot.heure DESC
       LIMIT 300`,
    )
    const list = Array.isArray(rows) ? rows : []
    const orders: GrandmaAdminOrder[] = list.map((raw) => {
      const row = raw as Record<string, unknown>
      return {
        id: num(row.id),
        orderNumber: nz(row.orderNumber),
        sellerName: nz(row.sellerName),
        sellerAccount: nz(row.sellerAccount),
        buyerName: nz(row.buyerName),
        buyerPhone: nz(row.buyerPhone),
        amount: num(row.amount),
        status: nz(row.status),
        placedAt: asIso(row.placedAt),
        deliveryLocation: nz(row.deliveryLocation),
        paymentStatus: nz(row.paymentStatus),
        paymentName: nz(row.paymentName),
        paymentId: nz(row.paymentId),
        items: "",
      }
    })

    const ids = orders.map((o) => o.id).filter((id) => id > 0)
    if (ids.length > 0) {
      const placeholders = ids.map(() => "?").join(",")
      try {
        const [lineRows] = await conn.query(
          `SELECT ID_ORDER AS id, ITEM_NAME AS itemName, QUANTITY AS qty
           FROM ${qSchema}.order_transaction_list
           WHERE ID_ORDER IN (${placeholders})
           ORDER BY ID_ORDER, ID_LIST`,
          ids,
        )
        const byId = new Map<number, string[]>()
        for (const raw of Array.isArray(lineRows) ? lineRows : []) {
          const line = raw as Record<string, unknown>
          const id = num(line.id)
          const name = nz(line.itemName) || "Item"
          const qty = num(line.qty)
          const label = qty > 0 ? `${name} × ${qty}` : name
          const prev = byId.get(id) ?? []
          prev.push(label)
          byId.set(id, prev)
        }
        for (const order of orders) {
          const parts = byId.get(order.id)
          if (parts?.length) order.items = parts.join(", ")
        }
      } catch (lineErr) {
        console.error("[admin/grandma/orders] line items", lineErr)
      }
    }

    return NextResponse.json({ ok: true, orders, totalCount: orders.length })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[admin/grandma/orders]", msg)
    if (isUnknownOrderSourceColumn(e)) {
      return NextResponse.json({
        ok: false,
        orders: [] as GrandmaAdminOrder[],
        error:
          "order_transaction.ORDER_SOURCE is missing. Run java-maputo-search/sql/order_transaction_order_source.sql on this schema.",
      })
    }
    return NextResponse.json({ ok: false, error: msg, orders: [] as GrandmaAdminOrder[] }, { status: 200 })
  } finally {
    if (conn) await conn.end()
  }
}
