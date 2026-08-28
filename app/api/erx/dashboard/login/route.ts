import { NextRequest, NextResponse } from "next/server"

import {
  MOH_ERX_SESSION_COOKIE,
  mohSessionCookieValue,
  verifyMohDashboardCredentials,
} from "@/lib/erx/moh-dashboard-auth.constants"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_BODY" }, { status: 400 })
  }

  const email = (body.email || "").trim()
  const password = body.password || ""
  if (!verifyMohDashboardCredentials(email, password)) {
    return NextResponse.json({ ok: false, code: "INVALID_CREDENTIALS" }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(MOH_ERX_SESSION_COOKIE, mohSessionCookieValue(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(MOH_ERX_SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 })
  return res
}
