import test from "node:test"
import assert from "node:assert/strict"
import {
  isClientSuggestionCategory,
  isClientSuggestionStatus,
  parseClientSuggestionListFilters,
  validateClientSuggestionInput,
} from "./client-suggestion-shared"

test("rejects missing name and invalid email", () => {
  const noName = validateClientSuggestionInput({
    fullName: "A",
    email: "not-an-email",
    phone: "0788123456",
    subject: "Hello",
    suggestionDetails: "This is a longer suggestion.",
  })
  assert.equal(noName.ok, false)
})

test("accepts a valid Rwanda phone and optional category", () => {
  const ok = validateClientSuggestionInput({
    fullName: "Jane Buyer",
    email: "jane@example.com",
    phone: "0788123456",
    subject: "Search idea",
    suggestionDetails: "Please add more bakery shops in my sector.",
    category: "Suggestion",
  })
  assert.equal(ok.ok, true)
  if (ok.ok) {
    assert.equal(ok.value.phone.startsWith("+250"), true)
    assert.equal(ok.value.category, "Suggestion")
  }
})

test("rejects unknown category and too-short details", () => {
  const cat = validateClientSuggestionInput({
    fullName: "Jane Buyer",
    email: "jane@example.com",
    phone: "0788123456",
    subject: "Hi there",
    suggestionDetails: "Please add more bakery shops nearby.",
    category: "NotARealCategory",
  })
  assert.equal(cat.ok, false)
  const short = validateClientSuggestionInput({
    fullName: "Jane Buyer",
    email: "jane@example.com",
    phone: "0788123456",
    subject: "Hi there",
    suggestionDetails: "Too short",
  })
  assert.equal(short.ok, false)
})

test("status and category helpers", () => {
  assert.equal(isClientSuggestionStatus("NEW"), true)
  assert.equal(isClientSuggestionStatus("done"), false)
  assert.equal(isClientSuggestionCategory("Bug / Problem"), true)
  assert.equal(isClientSuggestionCategory("Random"), false)
})

test("admin list filters: valid status and category", () => {
  const ok = parseClientSuggestionListFilters({
    status: "NEW",
    category: "Suggestion",
    sort: "newest",
  })
  assert.equal(ok.ok, true)
  if (ok.ok) {
    assert.equal(ok.value.status, "NEW")
    assert.equal(ok.value.category, "Suggestion")
    assert.equal(ok.value.sort, "newest")
  }
})

test("admin list filters: invalid status and invalid category", () => {
  const badStatus = parseClientSuggestionListFilters({ status: "INVALID" })
  assert.equal(badStatus.ok, false)
  if (!badStatus.ok) assert.equal(badStatus.field, "status")

  const badCategory = parseClientSuggestionListFilters({ category: "NotARealCategory" })
  assert.equal(badCategory.ok, false)
  if (!badCategory.ok) assert.equal(badCategory.field, "category")
})

test("admin list filters: missing status and category are allowed", () => {
  const empty = parseClientSuggestionListFilters({})
  assert.equal(empty.ok, true)
  if (empty.ok) {
    assert.equal(empty.value.status, "")
    assert.equal(empty.value.category, "")
    assert.equal(empty.value.sort, "newest")
  }
  const blanks = parseClientSuggestionListFilters({ status: "  ", category: "" })
  assert.equal(blanks.ok, true)
  if (blanks.ok) {
    assert.equal(blanks.value.status, "")
    assert.equal(blanks.value.category, "")
  }
})
