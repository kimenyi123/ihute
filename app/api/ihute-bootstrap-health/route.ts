import { NextResponse } from "next/server"

/** Used by the Capacitor shell (`public-capacitor/index.html`) to verify the site is reachable before redirecting. */
export async function GET() {
  const body = { ok: true as const, service: "ihute-bootstrap-health", t: Date.now() }
  return NextResponse.json(body, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "no-store",
    },
  })
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}
