import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "Algo@12345",
  database: "chaos_test",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export async function GET(req: NextRequest, { params }: { params: { itemCode: string } }) {
  const { itemCode } = params;
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
export async function PUT(req: NextRequest, { params }: { params: { itemCode: string } }) {
  const { itemCode } = params;
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
