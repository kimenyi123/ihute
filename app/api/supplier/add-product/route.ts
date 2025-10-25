import { NextResponse } from "next/server";
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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      ITEM_NAME,
      QUANTITY,
      SALE_PRICE_INCLUSIVE,
      COST_PRICE_INCLUSIVE,
      DESCRIPTION_KEYWORD,
      UNIT,
      SUPPLIER_ACCOUNT,
    } = body;

    // ✅ Validate required fields
    if (
      !ITEM_NAME ||
      !QUANTITY ||
      !SALE_PRICE_INCLUSIVE ||
      !COST_PRICE_INCLUSIVE ||
      !SUPPLIER_ACCOUNT
    ) {
      return NextResponse.json(
        { ok: false, message: "Missing required fields" },
        { status: 400 }
      );
    }

    // ✅ Generate unique ITEM_CODE automatically
    const ITEM_CODE = "ITM" + Math.floor(100000 + Math.random() * 900000).toString();

    // ✅ Insert product into database
    const [result]: any = await pool.query(
      `INSERT INTO seller_add_stock 
        (ITEM_NAME, ITEM_CODE, QUANTITY, SALE_PRICE_INCLUSIVE, COST_PRICE_INCLUSIVE, description, unit, SELLER_ISHYIGA_ACCOUNT)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ITEM_NAME,
        ITEM_CODE,
        QUANTITY,
        SALE_PRICE_INCLUSIVE,
        COST_PRICE_INCLUSIVE,
        DESCRIPTION_KEYWORD || "NA",
        UNIT || "NA",
        SUPPLIER_ACCOUNT,
      ]
    );

    return NextResponse.json({ ok: true, id: result.insertId, ITEM_CODE });
  } catch (err: any) {
    console.error("Error adding product:", err);
    return NextResponse.json(
      { ok: false, message: err.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
