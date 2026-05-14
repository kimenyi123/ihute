import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function POST(req: Request) {
  void req
  return NextResponse.json(
    {
      ok: false,
      error: "OTP step removed. Use request-to-pay and confirm directly on phone.",
    },
    { status: 410 },
  )
}
