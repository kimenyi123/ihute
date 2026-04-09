import { NextResponse } from "next/server"
import { ensureAutoGuestAccount } from "@/lib/auto-guest-creator"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/account/auto-guest
 * Auto-creates individual guest users without any environment setup
 * 
 * Body: { name?: string, phone?: string, location?: string }
 * Returns: { ok: boolean, ishyigaAccount: string, email: string, isNew: boolean }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const { name, phone, location } = body as {
      name?: string
      phone?: string
      location?: string
    }

    console.log("[AutoGuest API] Creating guest user:", { name, phone, location })

    const result = await ensureAutoGuestAccount({ name, phone, location })

    if (!result.ok) {
      return NextResponse.json(
        { 
          ok: false, 
          error: result.error,
          hint: "Check MySQL connection in lib/auto-guest-creator.ts"
        },
        { status: 503 }
      )
    }

    console.log("[AutoGuest API] Success:", {
      ishyigaAccount: result.ishyigaAccount,
      email: result.email,
      isNew: result.isNew,
    })

    return NextResponse.json({
      ok: true,
      ishyigaAccount: result.ishyigaAccount,
      email: result.email,
      isNew: result.isNew,
      message: result.isNew ? "Guest user created" : "Existing guest user found"
    })

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[AutoGuest API] Error:", msg)
    return NextResponse.json(
      { ok: false, error: "Unexpected error: " + msg },
      { status: 502 }
    )
  }
}
