export interface UrubutoAuditEvent {
  id?: number
  action: string
  actorEmail?: string
  payloadJson?: string
  createdAt?: string
  sellerPayerCode?: string
  displayName?: string
  eventKey?: string
  isRead?: boolean
}

const FIELD_LABELS: Record<string, string> = {
  status: "Status changed/set to",
  onboardingApproved: "IHUTE onboarding approved",
  urubutoMerchantCode: "Merchant code",
  urubutoServiceCode: "Service code",
  rejectionReason: "Rejection reason",
  reason: "Rejection reason",
  documentId: "Document ID",
  docType: "Document type",
  filename: "File",
  originalFilename: "File",
  documentCount: "Documents submitted",
  emailSent: "Email sent",
  recipientEmail: "Recipient email",
  autoVerified: "Auto verified",
  note: "Internal note",
}

const CODE_FIELDS = new Set(["urubutoMerchantCode", "urubutoServiceCode"])
const BOOLEAN_FIELDS = new Set(["onboardingApproved", "emailSent", "autoVerified"])
const NUMERIC_FIELDS = new Set(["documentId", "documentCount"])

export function formatUrubutoAuditTitle(action: string): string {
  switch (action) {
    case "application_submitted_for_review":
      return "Application submitted for review"
    case "document_uploaded":
      return "Document uploaded"
    case "verify_document":
      return "Document verified"
    case "reject_document":
      return "Document rejected"
    case "update_merchant":
      return "Merchant updated"
    case "submitted_to_urubuto":
      return "Marked submitted to Urubuto"
    case "internal_note":
      return "Internal note updated"
    case "resend_review_email":
      return "Review email resent"
    case "send_live_email":
      return "Seller live email sent"
    default:
      return titleCase(action.replace(/_/g, " "))
  }
}

export function formatUrubutoAuditPayloadLines(payloadJson?: string): string[] {
  const raw = payloadJson?.trim()
  if (!raw || raw === "{}") return []

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return [raw]
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return [String(parsed ?? "")]
  }

  return Object.entries(parsed as Record<string, unknown>)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => formatPayloadField(key, value))
    .filter((line): line is string => Boolean(line))
}

function formatPayloadField(key: string, value: unknown): string | null {
  const label = FIELD_LABELS[key] ?? titleCase(key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " "))
  if (BOOLEAN_FIELDS.has(key)) {
    if (typeof value === "boolean") return `${label}: ${value ? "Yes" : "No"}`
    const boolText = String(value).trim().toLowerCase()
    if (boolText === "true" || boolText === "1") return `${label}: Yes`
    if (boolText === "false" || boolText === "0") return `${label}: No`
  }
  if (NUMERIC_FIELDS.has(key)) {
    if (typeof value === "boolean") return null
    const numericText = String(value).trim()
    return numericText ? `${label}: ${numericText}` : null
  }
  if (typeof value === "boolean") return `${label}: ${value ? "Yes" : "No"}`

  const text = String(value).trim()
  if (CODE_FIELDS.has(key)) return `${label}: ${text || "Not assigned"}`
  if (key === "status") return `${label} ${text || "Not set"}`
  if (!text) return `${label}: Not assigned`
  return `${label}: ${text}`
}

function titleCase(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ")
}
