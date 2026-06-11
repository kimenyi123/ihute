import { NextRequest, NextResponse } from "next/server"
import { getBackendBaseForProxy } from "@/lib/backend-config"

export const runtime = "nodejs"

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
}

/** Serve account_seller.photo paths (/img/shops/…) from the Java WAR (Tomcat). */
export async function GET(req: NextRequest) {
  const rawPath = (req.nextUrl.searchParams.get("path") || "").trim()
  if (!rawPath || !rawPath.startsWith("/img/shops/")) {
    return NextResponse.json({ ok: false, error: "Invalid path" }, { status: 400 })
  }
  if (rawPath.includes("..")) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
  }

  const backend = getBackendBaseForProxy().replace(/\/+$/, "")
  const upstream = `${backend}${rawPath}`

  try {
    const res = await fetch(upstream, { cache: "no-store" })
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: "Not found", upstream }, { status: res.status })
    }
    const buf = Buffer.from(await res.arrayBuffer())
    const ext = rawPath.slice(rawPath.lastIndexOf(".")).toLowerCase()
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": MIME[ext] || res.headers.get("Content-Type") || "application/octet-stream",
        "Cache-Control": "public, max-age=300",
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Upstream error"
    return NextResponse.json({ ok: false, error: msg, upstream }, { status: 502 })
  }
}
