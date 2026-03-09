import { NextRequest, NextResponse } from "next/server"
import { getBackendBase } from "@/lib/backend-config"

const emptyOk = () => NextResponse.json({ ok: true, data: [], message: "Backend unavailable" }, { status: 200 })

export async function GET(req: NextRequest) {
    try {
        const base = getBackendBase()
        const backendUrl = `${base.replace(/\/+$/, "")}/GPSAuditServlet`
        const cookies = req.headers.get("cookie") || ""

        const controller = new AbortController()
        const t = setTimeout(() => controller.abort(), 10000)
        const response = await fetch(backendUrl, {
            method: "GET",
            headers: { "Content-Type": "application/json", "Cookie": cookies },
            credentials: "include",
            cache: "no-store",
            signal: controller.signal,
        }).catch(() => null)
        clearTimeout(t)

        if (!response) return emptyOk()
        const text = await response.text().catch(() => "")
        const contentType = response.headers.get("content-type") || ""
        if (!response.ok || !contentType.includes("application/json") || text.trim().startsWith("<")) {
            return emptyOk()
        }
        const data = JSON.parse(text)
        return NextResponse.json(data)
    } catch (_) {
        return emptyOk()
    }
}
