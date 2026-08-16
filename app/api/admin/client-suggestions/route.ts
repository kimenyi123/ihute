import { NextRequest, NextResponse } from "next/server"
import { assertAdminApiAccess } from "@/lib/assert-admin-api-access"
import { listClientSuggestions } from "@/lib/client-suggestion"
import { parseClientSuggestionListFilters } from "@/lib/client-suggestion-shared"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const denied = await assertAdminApiAccess(req)
  if (denied) return denied

  const sp = req.nextUrl.searchParams
  const filters = parseClientSuggestionListFilters({
    status: sp.get("status"),
    category: sp.get("category"),
    sort: sp.get("sort"),
  })
  if (!filters.ok) {
    return NextResponse.json(
      { ok: false, error: filters.error, field: filters.field },
      { status: 400 },
    )
  }

  try {
    const result = await listClientSuggestions({
      page: Number(sp.get("page") || 1),
      limit: Number(sp.get("limit") || 20),
      q: sp.get("q")?.trim() || "",
      status: filters.value.status,
      category: filters.value.category,
      sort: filters.value.sort,
    })
    return NextResponse.json({
      ok: true,
      data: result.rows,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[api/admin/client-suggestions]", msg)
    if (msg === "MYSQL_NOT_CONFIGURED") {
      return NextResponse.json(
        { ok: false, error: "MySQL is not configured on this server.", data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } },
        { status: 503 },
      )
    }
    if (msg.startsWith("INVALID_LIST_FILTER:")) {
      return NextResponse.json({ ok: false, error: "Invalid filter." }, { status: 400 })
    }
    return NextResponse.json(
      { ok: false, error: "Could not load suggestions.", data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } },
      { status: 500 },
    )
  }
}
