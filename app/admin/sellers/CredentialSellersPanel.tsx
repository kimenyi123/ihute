"use client"

import { useCallback, useEffect, useState } from "react"
import { Eye, Pencil, Search, Trash2, X } from "lucide-react"
import { postAdminApi } from "@/lib/admin-client"

/** Map DB column label (any case) → Java {@code updateCredentialSeller} parameter name */
const COLUMN_TO_API: Record<string, string> = {
  FIRSTNAME: "firstName",
  LASTNAME: "lastName",
  EMAIL: "email",
  TEL: "tel",
  HQ_LOCATION: "location",
  TIN: "tin",
  OWNER: "owner",
  NICKNAME: "nickname",
  nickname: "nickname",
  STATUS: "status",
  CERTIFICATE: "certificate",
  DESCRIPTION: "description",
  PHOTO: "photo",
  LANGUAGE: "language",
  language: "language",
  DEPARTMENT: "department",
  department: "department",
  momo: "momo",
  MOMO: "momo",
  force_password_change: "forcePasswordChange",
  FORCE_PASSWORD_CHANGE: "forcePasswordChange",
  rating_star: "ratingStar",
  RATING_STAR: "ratingStar",
  discount: "discount",
  DISCOUNT: "discount",
}

function cellStr(v: unknown): string {
  if (v === null || v === undefined) return ""
  if (typeof v === "boolean") return v ? "1" : "0"
  if (typeof v === "object") return JSON.stringify(v)
  return String(v)
}

function getIshyiga(row: Record<string, unknown>): string {
  const v =
    row.ISHYIGA_ACCOUNT ?? row.ishyiga_account ?? row.Ishyiga_Account ?? ""
  return String(v)
}

function getEmail(row: Record<string, unknown>): string {
  const v = row.EMAIL ?? row.email ?? ""
  return String(v)
}

type CredentialSellersPanelProps = {
  active: boolean
  onPurgeSeller: (ishyiga: string) => void
  actionLoadingKey: string | null
  /** Increment from parent after destructive actions to reload the table. */
  refreshTrigger: number
}

const UPPER_TO_API: Record<string, string> = {}
for (const [col, api] of Object.entries(COLUMN_TO_API)) {
  UPPER_TO_API[col.toUpperCase()] = api
}

/** Not shown in the credentials table or edit form (still returned by the API). */
const CREDENTIAL_UI_HIDDEN_COLUMNS = new Set(
  [
    "APPROVED_AT",
    "APPROVED_BY",
    "AUTO_APPROVED",
    "BUYER_ROW_COUNT",
    "CERTIFICATE",
    "COUNTRY",
    "GPS_ACCURACY",
    "GPS_LAST_UPDATED",
    "GPS_OVERRIDE",
    "ID",
    "PWD_HASH",
    "PWD_RESET_EXPIRES",
    "PWD_RESET_TOKEN",
    "RATING_STAR",
    "REJECTED_AT",
    "REJECTED_BY",
    "REJECTION_REASON",
  ].map((c) => c.toUpperCase()),
)

function isCredentialUiHiddenColumn(key: string): boolean {
  return CREDENTIAL_UI_HIDDEN_COLUMNS.has(key.toUpperCase())
}

type CredentialTableCol = { id: string; header: string; pick: (r: Record<string, unknown>) => unknown }

/** Main grid: identifiers, owner, essentials. Passwords are set in Edit (modal), not in the table. */
const CREDENTIAL_TABLE_COLUMNS: CredentialTableCol[] = [
  { id: "ishyiga", header: "Ishyiga account", pick: (r) => getIshyiga(r) },
  { id: "owner", header: "Owner", pick: (r) => r.OWNER ?? r.owner ?? "" },
  { id: "email", header: "Email", pick: (r) => getEmail(r) },
  { id: "tel", header: "Phone", pick: (r) => r.TEL ?? r.tel ?? "" },
  { id: "status", header: "Status", pick: (r) => r.STATUS ?? r.status ?? "" },
  { id: "department", header: "Department", pick: (r) => r.DEPARTMENT ?? r.department ?? "" },
  { id: "hq", header: "HQ location", pick: (r) => r.HQ_LOCATION ?? r.hq_location ?? "" },
]

export function CredentialSellersPanel({
  active,
  onPurgeSeller,
  actionLoadingKey,
  refreshTrigger,
}: CredentialSellersPanelProps) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const pageSize = 20
  const [searchDraft, setSearchDraft] = useState("")
  const [searchApplied, setSearchApplied] = useState("")
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [edit, setEdit] = useState<Record<string, string>>({})
  const [pwdSeller, setPwdSeller] = useState("")
  const [pwdBuyer, setPwdBuyer] = useState("")
  const [showPwdS, setShowPwdS] = useState(false)
  const [showPwdB, setShowPwdB] = useState(false)
  const [forcePwdChangeSeller, setForcePwdChangeSeller] = useState(true)
  const [forcePwdChangeBuyer, setForcePwdChangeBuyer] = useState(true)
  const [saving, setSaving] = useState(false)

  const [delEmail, setDelEmail] = useState("")
  const [delIshyiga, setDelIshyiga] = useState("")
  const [delScope, setDelScope] = useState<"buyer" | "seller" | "both">("buyer")
  const [delBusy, setDelBusy] = useState(false)

  const loadTable = useCallback(async () => {
    if (!active) return
    setLoading(true)
    setErr(null)
    try {
      const res = await postAdminApi({
        action: "listCredentialSellers",
        page,
        pageSize,
        credentialSearch: searchApplied,
      })
      const data = await res.json()
      if (!data.ok) {
        setRows([])
        setTotal(0)
        setErr(data.error || "Failed to load")
        return
      }
      setRows((data.sellers as Record<string, unknown>[]) || [])
      setTotal(Number(data.totalCount) || 0)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Request failed")
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [active, page, pageSize, searchApplied, refreshTrigger])

  useEffect(() => {
    void loadTable()
  }, [loadTable])

  const openEdit = (row: Record<string, unknown>) => {
    const o: Record<string, string> = {}
    for (const [k, v] of Object.entries(row)) {
      o[k] = cellStr(v)
    }
    setEdit(o)
    setPwdSeller("")
    setPwdBuyer("")
    setShowPwdS(false)
    setShowPwdB(false)
    setForcePwdChangeSeller(true)
    setForcePwdChangeBuyer(true)
    setEditOpen(true)
  }

  const saveEdit = async () => {
    const ishyiga = getIshyiga(edit)
    if (!ishyiga) {
      alert("Missing ISHYIGA_ACCOUNT in row")
      return
    }
    const body: Record<string, unknown> = {
      action: "updateCredentialSeller",
      sellerAccount: ishyiga,
    }
    for (const k of Object.keys(edit)) {
      const up = k.toUpperCase()
      if (isCredentialUiHiddenColumn(k)) continue
      const api = UPPER_TO_API[up]
      if (!api) continue
      body[api] = edit[k] ?? ""
    }
    const hasProfile = Object.keys(body).length > 2
    setSaving(true)
    setErr(null)
    try {
      if (hasProfile) {
        const res = await postAdminApi(body)
        const data = await res.json()
        if (!data.ok) {
          alert(data.error || "Update failed")
          return
        }
      } else if (!pwdSeller.trim() && !pwdBuyer.trim()) {
        alert("Change at least one field or enter a new password.")
        setSaving(false)
        return
      }
      if (pwdSeller.trim() || pwdBuyer.trim()) {
        const email = getEmail(edit)
        const pr = await postAdminApi({
          action: "updateDualAccountCredentials",
          credentialEmail: email,
          credentialIshyiga: ishyiga,
          newSellerPassword: pwdSeller.trim(),
          newBuyerPassword: pwdBuyer.trim(),
          forcePasswordChangeSeller: forcePwdChangeSeller ? 1 : 0,
          forcePasswordChangeBuyer: forcePwdChangeBuyer ? 1 : 0,
        })
        const pd = await pr.json()
        if (!pd.ok) {
          alert("Profile saved but passwords: " + (pd.error || "failed"))
        }
      }
      setEditOpen(false)
      await loadTable()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const runDelete = async () => {
    const email = delEmail.trim()
    const ishyiga = delIshyiga.trim()
    if (!email && !ishyiga) {
      setErr("Enter email or Ishyiga for row delete below.")
      return
    }
    if (!confirm(`Delete (${delScope}) for this identifier?`)) return
    setDelBusy(true)
    setErr(null)
    try {
      const res = await postAdminApi({
        action: "deleteDualAccountCredentials",
        credentialEmail: email,
        credentialIshyiga: ishyiga,
        deleteScope: delScope,
      })
      const data = await res.json()
      if (!data.ok) {
        setErr(data.error || "Delete failed")
        return
      }
      await loadTable()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Delete failed")
    } finally {
      setDelBusy(false)
    }
  }

  const maxPage = Math.max(1, Math.ceil(total / pageSize))

  if (!active) return null

  return (
    <div className="bg-white p-6 rounded-lg border shadow-sm space-y-6">
      <p className="text-sm text-gray-600">
        Compact view: Ishyiga, owner, contact, status, and location. Stored passwords are bcrypt and cannot be shown;
        use <strong>Edit</strong> (pencil) to change fields and set new seller or buyer passwords.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              className="w-full border rounded-lg pl-8 pr-3 py-2"
              placeholder="Email, Ishyiga, name, phone, owner…"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setSearchApplied(searchDraft.trim())
            setPage(1)
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg"
        >
          Search
        </button>
        <button
          type="button"
          onClick={() => {
            setSearchDraft("")
            setSearchApplied("")
            setPage(1)
          }}
          className="px-3 py-2 border rounded-lg"
        >
          Reset
        </button>
      </div>

      {err && (
        <div className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-lg px-3 py-2">{err}</div>
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading…</div>
      ) : (
        <div className="overflow-x-auto max-h-[70vh] overflow-y-auto border rounded-lg">
          <table className="min-w-full text-xs divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                {CREDENTIAL_TABLE_COLUMNS.map((c) => (
                  <th
                    key={c.id}
                    className="px-2 py-2 text-left font-medium text-gray-600 whitespace-nowrap border-b"
                  >
                    {c.header}
                  </th>
                ))}
                <th className="px-2 py-2 text-right font-medium text-gray-600 border-b sticky right-0 bg-gray-50">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row, i) => {
                const ishyiga = getIshyiga(row)
                return (
                  <tr key={`${ishyiga}-${i}`} className="hover:bg-gray-50">
                    {CREDENTIAL_TABLE_COLUMNS.map((c) => (
                      <td
                        key={c.id}
                        className="px-2 py-1 text-gray-800 max-w-[220px] truncate"
                        title={cellStr(c.pick(row))}
                      >
                        {cellStr(c.pick(row))}
                      </td>
                    ))}
                    <td className="px-2 py-1 text-right whitespace-nowrap sticky right-0 bg-white">
                      <button
                        type="button"
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                        title="Edit"
                        onClick={() => openEdit(row)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="p-1 text-red-900 hover:bg-red-50 rounded disabled:opacity-40"
                        title="Purge seller (full)"
                        disabled={!ishyiga || actionLoadingKey === ishyiga}
                        onClick={() => onPurgeSeller(ishyiga)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          Page {page} of {maxPage} — {total} sellers
        </span>
        <div className="space-x-2">
          <button
            type="button"
            className="px-3 py-1 border rounded disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <button
            type="button"
            className="px-3 py-1 border rounded disabled:opacity-50"
            disabled={page >= maxPage}
            onClick={() => setPage((p) => (p < maxPage ? p + 1 : p))}
          >
            Next
          </button>
        </div>
      </div>

      <div className="border-t pt-4 space-y-3">
        <h3 className="font-medium text-red-800">Row delete (email or Ishyiga)</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            className="border rounded-lg px-3 py-2 text-sm"
            placeholder="Email"
            value={delEmail}
            onChange={(e) => setDelEmail(e.target.value)}
          />
          <input
            className="border rounded-lg px-3 py-2 text-sm"
            placeholder="Ishyiga"
            value={delIshyiga}
            onChange={(e) => setDelIshyiga(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={delScope}
            onChange={(e) => setDelScope(e.target.value as "buyer" | "seller" | "both")}
            className="border rounded-lg px-2 py-2 text-sm"
          >
            <option value="buyer">Delete buyer only</option>
            <option value="seller">Delete seller only</option>
            <option value="both">Delete buyer then seller</option>
          </select>
          <button
            type="button"
            disabled={delBusy}
            onClick={() => void runDelete()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>

      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Edit seller</h3>
              <button type="button" className="p-2 hover:bg-gray-100 rounded" onClick={() => setEditOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Ishyiga: <strong>{getIshyiga(edit)}</strong> (account id — do not change here)
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.keys(edit)
                .filter(
                  (k) =>
                    !isCredentialUiHiddenColumn(k) &&
                    k.toUpperCase() !== "ISHYIGA_ACCOUNT" &&
                    k.toLowerCase() !== "ishyiga_account",
                )
                .sort((a, b) => a.localeCompare(b))
                .map((k) => {
                  const up = k.toUpperCase()
                  const isFpc =
                    up === "FORCE_PASSWORD_CHANGE" || up === "FORCEPASSWORDCHANGE" || k === "force_password_change"
                  if (isFpc) {
                    const raw = String(edit[k] ?? "").trim().toLowerCase()
                    const checked = raw === "1" || raw === "true" || raw === "yes"
                    return (
                      <label key={k} className="block text-xs sm:col-span-2">
                        <span className="text-gray-500">{k} — require change on next login</span>
                        <div className="mt-1">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300"
                            checked={checked}
                            onChange={(e) =>
                              setEdit((prev) => ({ ...prev, [k]: e.target.checked ? "1" : "0" }))
                            }
                          />
                        </div>
                      </label>
                    )
                  }
                  return (
                    <label key={k} className="block text-xs">
                      <span className="text-gray-500">{k}</span>
                      <input
                        className="mt-0.5 w-full border rounded px-2 py-1.5 text-sm"
                        value={edit[k] ?? ""}
                        onChange={(e) => setEdit((prev) => ({ ...prev, [k]: e.target.value }))}
                      />
                    </label>
                  )
                })}
            </div>
            <div className="border-t pt-3 space-y-2">
              <p className="text-sm font-medium text-gray-800">New passwords (optional)</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Seller password</span>
                    <button type="button" onClick={() => setShowPwdS((s) => !s)}>
                      <Eye size={14} />
                    </button>
                  </div>
                  <input
                    type={showPwdS ? "text" : "password"}
                    className="w-full border rounded px-2 py-1.5 text-sm"
                    value={pwdSeller}
                    onChange={(e) => setPwdSeller(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Buyer password</span>
                    <button type="button" onClick={() => setShowPwdB((s) => !s)}>
                      <Eye size={14} />
                    </button>
                  </div>
                  <input
                    type={showPwdB ? "text" : "password"}
                    className="w-full border rounded px-2 py-1.5 text-sm"
                    value={pwdBuyer}
                    onChange={(e) => setPwdBuyer(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300"
                  checked={forcePwdChangeSeller}
                  onChange={(e) => setForcePwdChangeSeller(e.target.checked)}
                />
                Force password change on next login (seller) — applies when seller password above is set
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300"
                  checked={forcePwdChangeBuyer}
                  onChange={(e) => setForcePwdChangeBuyer(e.target.checked)}
                />
                Force password change on next login (buyer) — applies when buyer password above is set
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="px-4 py-2 border rounded-lg" onClick={() => setEditOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg disabled:opacity-50"
                onClick={() => void saveEdit()}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
