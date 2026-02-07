// app/api/personalization/track/route.ts
import { NextResponse } from "next/server"

import { getBackendBase } from "@/lib/backend-config"

const JAVA_BACKEND_URL = getBackendBase()

export async function POST(req: Request) {
  try {
    const body = await req.json()
    
    const response = await fetch(`${JAVA_BACKEND_URL}/UserInteractionServlet?action=track`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    })

    const text = await response.text()
    let json: any
    
    try {
      json = JSON.parse(text)
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid response from backend" }, { status: 500 })
    }

    return NextResponse.json(json)
  } catch (error: any) {
    console.error("[personalization/track] Error:", error)
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to track interaction" },
      { status: 500 }
    )
  }
}


