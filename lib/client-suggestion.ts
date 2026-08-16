import type { ResultSetHeader, RowDataPacket } from "mysql2/promise"
import mysql from "mysql2/promise"
import {
  getOnboardingMysqlConfig,
  toMysqlConnectionOptions,
} from "@/lib/onboarding-mysql"
import {
  isClientSuggestionStatus,
  parseClientSuggestionListFilters,
  type ClientSuggestionInput,
  type ClientSuggestionRow,
  type ClientSuggestionStatus,
} from "@/lib/client-suggestion-shared"

export {
  CLIENT_SUGGESTION_CATEGORIES,
  CLIENT_SUGGESTION_STATUSES,
  isClientSuggestionCategory,
  isClientSuggestionStatus,
  parseClientSuggestionListFilters,
  validateClientSuggestionInput,
  type ClientSuggestionCategory,
  type ClientSuggestionInput,
  type ClientSuggestionRow,
  type ClientSuggestionStatus,
} from "@/lib/client-suggestion-shared"

export const ENSURE_CLIENT_SUGGESTION_TABLE = `
CREATE TABLE IF NOT EXISTS client_suggestion (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(24) NOT NULL,
  subject VARCHAR(200) NOT NULL,
  suggestion_details TEXT NOT NULL,
  category VARCHAR(40) DEFAULT NULL,
  status ENUM('NEW', 'READ', 'IN_PROGRESS', 'RESOLVED') NOT NULL DEFAULT 'NEW',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_client_suggestion_created (created_at),
  KEY idx_client_suggestion_status (status),
  KEY idx_client_suggestion_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

function mapRow(r: RowDataPacket): ClientSuggestionRow {
  const statusRaw = String(r.status ?? "NEW")
  const status: ClientSuggestionStatus = isClientSuggestionStatus(statusRaw) ? statusRaw : "NEW"
  return {
    id: Number(r.id),
    fullName: String(r.full_name ?? ""),
    email: String(r.email ?? ""),
    phone: String(r.phone ?? ""),
    subject: String(r.subject ?? ""),
    suggestionDetails: String(r.suggestion_details ?? ""),
    category: r.category != null && String(r.category).trim() ? String(r.category) : null,
    status,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at ?? ""),
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at ?? ""),
  }
}

async function withSuggestionConn<T>(fn: (conn: mysql.Connection) => Promise<T>): Promise<T> {
  const cfg = getOnboardingMysqlConfig()
  if (!cfg) {
    throw new Error("MYSQL_NOT_CONFIGURED")
  }
  const conn = await mysql.createConnection(toMysqlConnectionOptions(cfg))
  try {
    await conn.query(ENSURE_CLIENT_SUGGESTION_TABLE)
    return await fn(conn)
  } finally {
    await conn.end()
  }
}

export async function insertClientSuggestion(input: ClientSuggestionInput): Promise<{ id: number }> {
  return withSuggestionConn(async (conn) => {
    const [result] = await conn.query<ResultSetHeader>(
      `INSERT INTO client_suggestion
         (full_name, email, phone, subject, suggestion_details, category, status)
       VALUES (?, ?, ?, ?, ?, ?, 'NEW')`,
      [
        input.fullName,
        input.email,
        input.phone,
        input.subject,
        input.suggestionDetails,
        input.category,
      ],
    )
    return { id: Number(result.insertId) }
  })
}

export type ListClientSuggestionsParams = {
  page?: number
  limit?: number
  q?: string
  status?: string
  category?: string
  sort?: "newest" | "oldest"
}

export async function listClientSuggestions(params: ListClientSuggestionsParams): Promise<{
  rows: ClientSuggestionRow[]
  page: number
  limit: number
  total: number
  totalPages: number
}> {
  const page = Math.max(1, Number(params.page) || 1)
  const limit = Math.min(50, Math.max(1, Number(params.limit) || 20))
  const offset = (page - 1) * limit
  const q = String(params.q ?? "").trim()
  const filters = parseClientSuggestionListFilters({
    status: params.status,
    category: params.category,
    sort: params.sort,
  })
  if (!filters.ok) {
    throw new Error(`INVALID_LIST_FILTER:${filters.field}`)
  }

  const where: string[] = []
  const binds: unknown[] = []
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, "")}%`
    where.push(
      `(full_name LIKE ? OR email LIKE ? OR subject LIKE ? OR suggestion_details LIKE ? OR phone LIKE ?)`,
    )
    binds.push(like, like, like, like, like)
  }
  if (filters.value.status) {
    where.push(`status = ?`)
    binds.push(filters.value.status)
  }
  if (filters.value.category) {
    where.push(`category = ?`)
    binds.push(filters.value.category)
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : ""
  const orderSql =
    filters.value.sort === "oldest"
      ? "ORDER BY created_at ASC, id ASC"
      : "ORDER BY created_at DESC, id DESC"

  return withSuggestionConn(async (conn) => {
    const [countRows] = await conn.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM client_suggestion ${whereSql}`,
      binds,
    )
    const total = Number(countRows[0]?.cnt ?? 0)
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id, full_name, email, phone, subject, suggestion_details, category, status, created_at, updated_at
       FROM client_suggestion
       ${whereSql}
       ${orderSql}
       LIMIT ? OFFSET ?`,
      [...binds, limit, offset],
    )
    return {
      rows: rows.map(mapRow),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    }
  })
}

export async function getClientSuggestionById(id: number): Promise<ClientSuggestionRow | null> {
  if (!Number.isFinite(id) || id < 1) return null
  return withSuggestionConn(async (conn) => {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id, full_name, email, phone, subject, suggestion_details, category, status, created_at, updated_at
       FROM client_suggestion WHERE id = ? LIMIT 1`,
      [id],
    )
    return rows[0] ? mapRow(rows[0]) : null
  })
}

export async function updateClientSuggestionStatus(
  id: number,
  status: ClientSuggestionStatus,
): Promise<ClientSuggestionRow | null> {
  if (!Number.isFinite(id) || id < 1) return null
  return withSuggestionConn(async (conn) => {
    const [result] = await conn.query<ResultSetHeader>(
      `UPDATE client_suggestion SET status = ? WHERE id = ?`,
      [status, id],
    )
    if (!result.affectedRows) return null
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id, full_name, email, phone, subject, suggestion_details, category, status, created_at, updated_at
       FROM client_suggestion WHERE id = ? LIMIT 1`,
      [id],
    )
    return rows[0] ? mapRow(rows[0]) : null
  })
}

export function friendlySuggestionDbError(raw: string): string {
  if (raw === "MYSQL_NOT_CONFIGURED") {
    return "Suggestions are temporarily unavailable. Please try again later."
  }
  if (/ER_NO_SUCH_TABLE|doesn't exist/i.test(raw)) {
    return "Suggestions are not ready on this server yet."
  }
  if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|connect/i.test(raw)) {
    return "Could not save your suggestion right now. Please try again."
  }
  return "Could not save your suggestion. Please try again."
}
