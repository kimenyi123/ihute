// app/api/favorites/remove/route.ts
import { NextResponse } from "next/server"

const JAVA_BACKEND_BASE = (process.env.JAVA_BACKEND_BASE || "https://ihute.rw/Trading").replace(/\/+$/, "")
const FAVORITES_SERVLET = `${JAVA_BACKEND_BASE}/Kaos/FavoritesServlet`

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const productId = searchParams.get("productId") || ""
    const supplierId = searchParams.get("supplierId") || ""
    
    const url = `${FAVORITES_SERVLET}?action=remove&productId=${encodeURIComponent(productId)}&supplierId=${encodeURIComponent(supplierId)}`
    
    const res = await fetch(url, {
      method: "DELETE",
      headers: {
        "Accept": "application/json",
        "Cookie": req.headers.get("cookie") || "",
      },
      cache: "no-store",
    })

    const data = await res.json()
    
    return NextResponse.json(data, { status: res.status })
  } catch (e: any) {
    console.error("[API /favorites/remove] DELETE error:", e)
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to remove favorite" },
      { status: 500 }
    )
  }
}
