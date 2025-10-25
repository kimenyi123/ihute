// app/api/orders/route.ts
import { NextResponse } from "next/server"

const SERVLET =
  (process.env.JAVA_SERVLET_URL && process.env.JAVA_SERVLET_URL.replace(/\/+$/, "")) ||
  ((process.env.JAVA_BACKEND_BASE || "http://localhost:8080/Trading").replace(/\/+$/, "") + "/Kaos/fetchSuggestions")

export async function POST(req: Request) {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), Number(process.env.PROXY_TIMEOUT_MS ?? 12000))

  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ transactions: [], error: "email required" }, { status: 200 })

    const resp = await fetch(SERVLET, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ email }), // fetchSuggestions.doPost() -> fetchTransactionHistory(email)
      signal: controller.signal,
      cache: "no-store",
    })

    const text = await resp.text()
    let data: any
    try { data = JSON.parse(text) } catch { return NextResponse.json({ transactions: [] }, { status: 200 }) }

    // Explicitly handle upstream shapes:
    // 1) { transactions: [...] }
    // 2) { transactions: "No transaction found" }
    // 3) [...] (array at top level)
    // 4) anything else -> []
    let transactions: any[] = []
    if (Array.isArray(data)) {
      transactions = data
    } else if (Array.isArray(data?.transactions)) {
      transactions = data.transactions
    } else if (typeof data?.transactions === "string") {
      // "No transaction found" (or any string) => empty list
      transactions = []
    } else {
      transactions = []
    }

    return NextResponse.json({ transactions }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ transactions: [], error: e?.message }, { status: 200 })
  } finally {
    clearTimeout(t)
  }
}
