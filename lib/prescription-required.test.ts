import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "fs"

import {
  isLikelyPrescriptionDrug,
  PRESCRIPTION_SEED_BY_NIKI,
} from "./prescription-classifier"
import {
  newPrescriptionFileToken,
  newPendingKey,
  publicUrlForPrescriptionFile,
  extensionForMime,
} from "./prescription-upload-paths"

test("classifier flags antibiotic INN keywords", () => {
  const r = isLikelyPrescriptionDrug({ item_inn: "Amoxicillin / clavulanic acid" })
  assert.equal(r.likely, true)
  assert.equal(r.reason, "antibiotic")
})

test("classifier does not flag plain vitamins", () => {
  const r = isLikelyPrescriptionDrug({ item_commercial_name: "Vitamin C 500mg" })
  assert.equal(r.likely, false)
})

test("seed list includes known Rx niki codes", () => {
  assert.ok(PRESCRIPTION_SEED_BY_NIKI.ACIAMOX00044)
  assert.ok(PRESCRIPTION_SEED_BY_NIKI.ANTBEVA00001)
})

test("prescription file token is unguessable (64 hex chars)", () => {
  const a = newPrescriptionFileToken()
  const b = newPrescriptionFileToken()
  assert.match(a, /^[a-f0-9]{64}$/)
  assert.notEqual(a, b)
  assert.notEqual(newPendingKey(), newPendingKey())
})

test("public URL nests under prescriptions/ only", () => {
  const url = publicUrlForPrescriptionFile("pending/abc/token.jpg")
  assert.equal(url, "/uploads/prescriptions/pending/abc/token.jpg")
  assert.ok(!url.includes("shop-images"))
  assert.ok(!url.includes("account"))
})

test("extensionForMime accepts jpeg/png/heic only", () => {
  assert.equal(extensionForMime("image/jpeg", "x.jpg"), "jpg")
  assert.equal(extensionForMime("image/png", "x.png"), "png")
  assert.equal(extensionForMime("application/pdf", "x.pdf"), null)
})

test("prescription upload module does not import shop/account/Urubuto upload code", () => {
  const src = readFileSync(
    new URL("../app/api/orders/prescription-upload/route.ts", import.meta.url),
    "utf8",
  )
  assert.ok(!/shop-image-overrides|account\/photo|urubuto-merchant|persistShopImageUpload/.test(src))
  assert.ok(src.includes("prescription-upload-paths"))
  assert.ok(src.includes("cleanupStalePendingPrescriptions"))
})

test("rejects attacker-controlled external prescription URLs", async () => {
  const { parsePendingPrescriptionUrl } = await import("./prescription-pending-auth")
  assert.equal(parsePendingPrescriptionUrl("https://evil.example/rx.jpg"), null)
  assert.equal(parsePendingPrescriptionUrl("/uploads/shop-images/x.jpg"), null)
  const ok = parsePendingPrescriptionUrl(
    "/uploads/prescriptions/pending/abc123/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg",
  )
  assert.ok(ok)
  assert.equal(ok?.pendingKey, "abc123")
})

test("createOrder catch cancels orphan when Rx UPDATE fails (Java source guard)", () => {
  const java = readFileSync(
    new URL("../../kaos/src/java/Kaos/OrdersServlet.java", import.meta.url),
    "utf8",
  )
  assert.ok(java.includes("cancelOrphanOrderBestEffort"))
  assert.ok(java.includes("Failed to save prescription on order"))
  assert.ok(java.includes("isTrustedPrescriptionImageUrl"))
  assert.ok(java.includes("prescription UPDATE failed for order"))
  assert.ok(java.includes("sellerOrderRequiresPrescription"))
})

test("WhatsApp message includes Prescription section only when URL set", async () => {
  const {
    buildOrderWhatsAppMessage,
  } = await import("./table-command-whatsapp")
  const without = buildOrderWhatsAppMessage({
    shop: "Test Pharmacy",
    orderId: 1,
    items: [{ name: "Item", qty: 1, unitPrice: 100 }],
    total: 100,
    paid: 0,
  })
  assert.ok(!without.includes("Prescription"))
  const withRx = buildOrderWhatsAppMessage({
    shop: "Test Pharmacy",
    orderId: 1,
    items: [{ name: "Item", qty: 1, unitPrice: 100 }],
    total: 100,
    paid: 0,
    prescriptionImageUrl: "https://ihute.rw/uploads/prescriptions/1/abc.jpg",
  })
  assert.ok(withRx.includes("Prescription"))
  assert.ok(withRx.includes("https://ihute.rw/uploads/prescriptions/1/abc.jpg"))
})

test("resolveOrderPrescriptionPublicUrl includes URL even when required flag false", async () => {
  const { resolveOrderPrescriptionPublicUrl } = await import("./table-command-whatsapp")
  const url = resolveOrderPrescriptionPublicUrl({
    PRESCRIPTION_REQUIRED: false,
    prescriptionRequired: false,
    PRESCRIPTION_IMAGE_URL: "/uploads/prescriptions/3964/abc.png",
  })
  assert.equal(url, "https://ihute.rw/uploads/prescriptions/3964/abc.png")
})

test("absolutePublicAssetUrl rewrites localhost to public site base", async () => {
  const { absolutePublicAssetUrl, publicSiteBaseUrl } = await import("./table-command-whatsapp")
  assert.equal(publicSiteBaseUrl(), "https://ihute.rw")
  assert.equal(
    absolutePublicAssetUrl("/uploads/prescriptions/3963/abc.png"),
    "https://ihute.rw/uploads/prescriptions/3963/abc.png",
  )
  assert.equal(
    absolutePublicAssetUrl("http://localhost:3000/uploads/prescriptions/3963/abc.png"),
    "https://ihute.rw/uploads/prescriptions/3963/abc.png",
  )
})
