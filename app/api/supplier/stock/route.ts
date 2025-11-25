import { NextRequest, NextResponse } from "next/server";
import MySQLConnector from "@/lib/MySQLConnector";
import { RowDataPacket } from "mysql2/promise";

type SupplierProduct = {
  ID: number;
  ITEM_NAME: string;
  ITEM_CODE: string;
  stock: number;
  price: number;
  cost: number;
  DESCRIPTION: string;
  UNIT: string;
  SELLER_ISHYIGA_ACCOUNT: string;
  OWNER: string;
};

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const account = url.searchParams.get("account");

    if (!account) {
      return NextResponse.json({ error: "Account parameter is required" }, { status: 400 });
    }

    // TODO: Add Redis caching here
    // const redisKey = `supplier:${account}:products`;
    // Check Redis first, if miss, query DB and cache result
    // For now, querying database directly

    const conn = await MySQLConnector.mpa();

    // ✅ Cast the rows to RowDataPacket[] first
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT
          s.ID,
          s.ITEM_NAME,
          s.ITEM_CODE,
          s.QUANTITY AS stock,
          s.SALE_PRICE_INCLUSIVE AS price,
          s.COST_PRICE_INCLUSIVE AS cost,
          s.DESCRIPTION,
          s.UNIT,
          s.SELLER_ISHYIGA_ACCOUNT,
          a.OWNER
       FROM seller_add_stock s
       JOIN account_signup a
         ON s.SELLER_ISHYIGA_ACCOUNT = a.ISHYIGA_ACCOUNT
       WHERE s.SELLER_ISHYIGA_ACCOUNT = ?
       ORDER BY s.ID DESC`,
      [account]
    );

    await conn.end();

    // ✅ Cast to SupplierProduct[]
    const products = rows as SupplierProduct[];

    // Return with fromCache flag (false since Redis not implemented yet)
    return NextResponse.json({
      products,
      fromCache: false // Will be true when Redis is implemented
    }, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching supplier stock:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
