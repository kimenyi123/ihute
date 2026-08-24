import { NextRequest, NextResponse } from "next/server"
import { assertAdminApiAccess } from "@/lib/assert-admin-api-access"
import {
  getClientSuggestionById,
  isClientSuggestionStatus,
  updateClientSuggestionStatus,
} from "@/lib/client-suggestion"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const denied = await assertAdminApiAccess(req)
  if (denied) return denied
  const { id: idRaw } = await ctx.params
  const id = Number(idRaw)
  if (!Number.isFinite(id) || id < 1) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 })
  }
  try {
    const row = await getClientSuggestionById(id)
    if (!row) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
    return NextResponse.json({ ok: true, data: row })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[api/admin/client-suggestions/:id GET]", msg)
    if (msg === "MYSQL_NOT_CONFIGURED") {
      return NextResponse.json({ ok: false, error: "MySQL is not configured on this server." }, { status: 503 })
    }
    return NextResponse.json({ ok: false, error: "Could not load suggestion." }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const denied = await assertAdminApiAccess(req)
  if (denied) return denied
  const { id: idRaw } = await ctx.params
  const id = Number(idRaw)
  if (!Number.isFinite(id) || id < 1) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 })
  }
  try {
    const body = (await req.json()) as { status?: unknown }
    const status = typeof body.status === "string" ? body.status.trim() : ""
    if (!isClientSuggestionStatus(status)) {
      return NextResponse.json({ ok: false, error: "Invalid status" }, { status: 400 })
    }
    const row = await updateClientSuggestionStatus(id, status)
    if (!row) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
    return NextResponse.json({ ok: true, data: row })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[api/admin/client-suggestions/:id PATCH]", msg)
    if (msg === "MYSQL_NOT_CONFIGURED") {
      return NextResponse.json({ ok: false, error: "MySQL is not configured on this server." }, { status: 503 })
    }
    return NextResponse.json({ ok: false, error: "Could not update status." }, { status: 500 })
  }
}
