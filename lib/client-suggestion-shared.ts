import { isValidRwandaMobileE164, normalizeRwandaMobileE164 } from "@/lib/rwanda-phone"

export const CLIENT_SUGGESTION_CATEGORIES = [
  "Suggestion",
  "Complaint",
  "Bug / Problem",
  "Service Feedback",
  "Product Feedback",
  "Other",
] as const

export type ClientSuggestionCategory = (typeof CLIENT_SUGGESTION_CATEGORIES)[number]

export const CLIENT_SUGGESTION_STATUSES = ["NEW", "READ", "IN_PROGRESS", "RESOLVED"] as const

export type ClientSuggestionStatus = (typeof CLIENT_SUGGESTION_STATUSES)[number]

export type ClientSuggestionRow = {
  id: number
  fullName: string
  email: string
  phone: string
  subject: string
  suggestionDetails: string
  category: string | null
  status: ClientSuggestionStatus
  createdAt: string
  updatedAt: string
}

export type ClientSuggestionInput = {
  fullName: string
  email: string
  phone: string
  subject: string
  suggestionDetails: string
  category?: string | null
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isClientSuggestionCategory(raw: string): raw is ClientSuggestionCategory {
  return (CLIENT_SUGGESTION_CATEGORIES as readonly string[]).includes(raw)
}

export function isClientSuggestionStatus(raw: string): raw is ClientSuggestionStatus {
  return (CLIENT_SUGGESTION_STATUSES as readonly string[]).includes(raw)
}

export type ClientSuggestionListFilters = {
  status: ClientSuggestionStatus | ""
  category: ClientSuggestionCategory | ""
  sort: "newest" | "oldest"
}

export function parseClientSuggestionListFilters(params: {
  status?: string | null
  category?: string | null
  sort?: string | null
}):
  | { ok: true; value: ClientSuggestionListFilters }
  | { ok: false; error: string; field: "status" | "category" } {
  const statusRaw = typeof params.status === "string" ? params.status.trim() : ""
  const categoryRaw = typeof params.category === "string" ? params.category.trim() : ""
  const sort = params.sort === "oldest" ? "oldest" : "newest"

  if (statusRaw && !isClientSuggestionStatus(statusRaw)) {
    return { ok: false, error: "Invalid status.", field: "status" }
  }
  if (categoryRaw && !isClientSuggestionCategory(categoryRaw)) {
    return { ok: false, error: "Invalid category.", field: "category" }
  }

  return {
    ok: true,
    value: {
      status: isClientSuggestionStatus(statusRaw) ? statusRaw : "",
      category: isClientSuggestionCategory(categoryRaw) ? categoryRaw : "",
      sort,
    },
  }
}

function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const e164 = normalizeRwandaMobileE164(trimmed)
  if (e164 && isValidRwandaMobileE164(e164)) return e164
  const digits = trimmed.replace(/\D/g, "")
  if (digits.length >= 8 && digits.length <= 15) return trimmed.slice(0, 24)
  return null
}

export function validateClientSuggestionInput(
  body: unknown,
): { ok: true; value: ClientSuggestionInput } | { ok: false; error: string; field?: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid request" }
  }
  const rec = body as Record<string, unknown>
  const fullName = typeof rec.fullName === "string" ? rec.fullName.trim() : ""
  const email = typeof rec.email === "string" ? rec.email.trim() : ""
  const phoneRaw = typeof rec.phone === "string" ? rec.phone : ""
  const subject = typeof rec.subject === "string" ? rec.subject.trim() : ""
  const suggestionDetails =
    typeof rec.suggestionDetails === "string" ? rec.suggestionDetails.trim() : ""
  const categoryRaw = typeof rec.category === "string" ? rec.category.trim() : ""

  if (fullName.length < 2) return { ok: false, error: "Please enter your full name.", field: "fullName" }
  if (fullName.length > 120) return { ok: false, error: "Name is too long.", field: "fullName" }
  if (!EMAIL_RE.test(email) || email.length > 255) {
    return { ok: false, error: "Please enter a valid email address.", field: "email" }
  }
  const phone = normalizePhone(phoneRaw)
  if (!phone) return { ok: false, error: "Please enter a valid phone number.", field: "phone" }
  if (subject.length < 3) return { ok: false, error: "Please enter a subject.", field: "subject" }
  if (subject.length > 200) return { ok: false, error: "Subject is too long.", field: "subject" }
  if (suggestionDetails.length < 10) {
    return { ok: false, error: "Please describe your suggestion in more detail.", field: "suggestionDetails" }
  }
  if (suggestionDetails.length > 4000) {
    return { ok: false, error: "Suggestion is too long (max 4000 characters).", field: "suggestionDetails" }
  }
  let category: string | null = null
  if (categoryRaw) {
    if (!isClientSuggestionCategory(categoryRaw)) {
      return { ok: false, error: "Unknown category.", field: "category" }
    }
    category = categoryRaw
  }

  return {
    ok: true,
    value: { fullName, email, phone, subject, suggestionDetails, category },
  }
}
