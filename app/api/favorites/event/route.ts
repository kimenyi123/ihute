// app/api/favorites/event/route.ts
import { NextResponse } from "next/server"

const JAVA_BACKEND_BASE = (process.env.JAVA_BACKEND_BASE || "https://ihute.rw/Trading").replace(/\/+$/, "")
const FAVORITES_SERVLET = `${JAVA_BACKEND_BASE}/Kaos/FavoritesServlet`

export async function POST(req: Request) {
  try {
    const body = await req.json()
    
    const res = await fetch(`${FAVORITES_SERVLET}?action=event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Cookie": req.headers.get("cookie") || "",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    })

    const data = await res.json()
    
    return NextResponse.json(data, { status: res.status })
  } catch (e: any) {
    console.error("[API /favorites/event] POST error:", e)
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to track event" },
      { status: 500 }
    )
  }
}
