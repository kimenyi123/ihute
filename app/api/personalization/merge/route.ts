// app/api/personalization/merge/route.ts
import { NextResponse } from "next/server"

const JAVA_BACKEND_URL = 
  process.env.JAVA_BACKEND_BASE || "https://ihute.rw/Trading"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    
    const response = await fetch(`${JAVA_BACKEND_URL}/UserInteractionServlet?action=mergeSession`, {
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
    console.error("[personalization/merge] Error:", error)
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to merge session" },
      { status: 500 }
    )
  }
}


