import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

import { getOrdersUrl } from "@/lib/backend-config"

/**
 * Create table command on the backend (so table exists before checkout).
 * POST body: { tableName, locationId, locationName?, userEmail, userName? }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { tableName, locationId, locationName, userEmail, userName } = body

    if (!tableName || !locationId || !userEmail) {
      return NextResponse.json(
        { ok: false, error: "tableName, locationId, and userEmail are required" },
        { status: 400 }
      )
    }

    const backendUrl = getOrdersUrl()
    const url = `${backendUrl}?action=createTableCommand`
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tableName: String(tableName).trim(),
        locationId: String(locationId),
        locationName: locationName != null ? String(locationName) : "",
        userEmail: String(userEmail),
        userName: userName != null ? String(userName) : "Guest",
      }),
      cache: "no-store",
    })

    const result = await response.json()
    return NextResponse.json(result)
  } catch (error: any) {
    console.error("[table-commands/create] Error:", error?.message)
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to create table" },
      { status: 500 }
    )
  }
}
