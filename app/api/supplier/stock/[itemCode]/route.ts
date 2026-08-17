import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getSupplierStockUrl } from "@/lib/backend-config";

const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "Algo@12345",
  database: "chaos_test",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const STOCK_SERVLET_URL = getSupplierStockUrl();

type Ctx = { params: Promise<{ itemCode: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const { itemCode } = await params;
  if (!itemCode) return NextResponse.json({ ok: false, message: "Item code is required" }, { status: 400 });

  try {
    const [rows]: any = await pool.query(
      "SELECT * FROM seller_add_stock WHERE ITEM_CODE = ?",
      [itemCode]
    );

    if (rows.length === 0) return NextResponse.json({ ok: false, message: "Product not found" }, { status: 404 });

    return NextResponse.json({ ok: true, product: rows[0] });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ ok: false, message: err.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { itemCode } = await params;
  const body = await req.json();

  try {
    const { ITEM_NAME, QUANTITY, SALE_PRICE_INCLUSIVE, COST_PRICE_INCLUSIVE, DESCRIPTION, UNIT } = body;

    if (!ITEM_NAME || QUANTITY == null || SALE_PRICE_INCLUSIVE == null || COST_PRICE_INCLUSIVE == null)
      return NextResponse.json({ ok: false, message: "Missing required fields" }, { status: 400 });

    const [result]: any = await pool.query(
      `UPDATE seller_add_stock SET 
        ITEM_NAME = ?, QUANTITY = ?, SALE_PRICE_INCLUSIVE = ?, COST_PRICE_INCLUSIVE = ?, DESCRIPTION = ?, UNIT = ?
       WHERE ITEM_CODE = ?`,
      [ITEM_NAME, QUANTITY, SALE_PRICE_INCLUSIVE, COST_PRICE_INCLUSIVE, DESCRIPTION || "NA", UNIT || "NA", itemCode]
    );

    if (result.affectedRows === 0)
      return NextResponse.json({ ok: false, message: "Product not found" }, { status: 404 });

    return NextResponse.json({ ok: true, message: "Product updated successfully" });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ ok: false, message: err.message || "Internal Server Error" }, { status: 500 });
  }
}

/** Proxy to Java SupplierStock servlet (DB + Redis). */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { itemCode } = await params;
  const account = req.nextUrl.searchParams.get("account");

  if (!itemCode) {
    return NextResponse.json({ ok: false, message: "Item code is required" }, { status: 400 });
  }

  let url = `${STOCK_SERVLET_URL}?itemCode=${encodeURIComponent(itemCode)}`;
  if (account) {
    url += `&account=${encodeURIComponent(account)}`;
  }

  const headers: HeadersInit = {
    Accept: "application/json",
  };
  const cookieHeader = req.headers.get("cookie");
  if (cookieHeader) {
    headers.Cookie = cookieHeader;
  }

  try {
    const resp = await fetch(url, {
      method: "DELETE",
      headers,
      cache: "no-store",
    });

    const text = await resp.text();
    let data: { ok?: boolean; message?: string; error?: string };
    try {
      data = JSON.parse(text);
    } catch {
      console.error("[SUPPLIER-STOCK] Invalid DELETE response:", text.slice(0, 200));
      return NextResponse.json(
        { ok: false, message: "Invalid response from backend" },
        { status: 502 },
      );
    }

    if (!resp.ok || !data.ok) {
      return NextResponse.json(
        { ok: false, message: data.error || data.message || "Failed to delete product" },
        { status: resp.status || 500 },
      );
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete product";
    console.error("[SUPPLIER-STOCK] DELETE proxy error:", err);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
