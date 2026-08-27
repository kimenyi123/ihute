import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  assertGrandmaOrderPayloadHasMomoPhone,
  attachPhoneRegisteredOnOrder,
  grandmaCheckoutSendLockReason,
  grandmaCourierDisplayState,
  guardGrandmaMobileMoneyPhone,
  isGrandmaMobileMoneyPayment,
  isGrandmaMobileMoneyPhoneRequiredError,
} from "./grandma-checkout-order-guard"

const PASTED_SMS =
  "Your payment of 1750 RWF to vestine 585310 was completed at 2026-08-26 14:56:21 BALANCE:8000 RWF fee 0 RWF."

test("MoMo order + empty phoneRegisteredOnOrder does not submit", () => {
  const g = guardGrandmaMobileMoneyPhone({
    paymentId: "momo",
    accountPhone: "",
    inputPhone: "",
  })
  assert.equal(g.ok, false)
  if (!g.ok) assert.equal(g.submit, false)

  const boundary = assertGrandmaOrderPayloadHasMomoPhone({
    paymentName: "MOMO",
    phoneRegisteredOnOrder: "",
  })
  assert.equal(boundary.ok, false)
  if (!boundary.ok) assert.equal(boundary.submit, false)
})

test("Airtel order + empty phoneRegisteredOnOrder does not submit", () => {
  const g = guardGrandmaMobileMoneyPhone({
    paymentId: "airtel",
    accountPhone: "",
    inputPhone: "",
  })
  assert.equal(g.ok, false)
  if (!g.ok) assert.equal(g.submit, false)

  const boundary = assertGrandmaOrderPayloadHasMomoPhone({
    paymentName: "AIRTEL_MONEY",
    phoneRegisteredOnOrder: "   ",
  })
  assert.equal(boundary.ok, false)
})

test("valid phone reaches payload as phoneRegisteredOnOrder", () => {
  const g = guardGrandmaMobileMoneyPhone({
    paymentId: "momo",
    accountPhone: "",
    inputPhone: "0788123456",
  })
  assert.equal(g.ok, true)
  if (!g.ok) return
  assert.equal(g.phoneRegisteredOnOrder, "250788123456")
  assert.equal(g.buyerPhone, "250788123456")

  const payload = attachPhoneRegisteredOnOrder(
    { paymentName: "MOMO", buyerPhone: g.buyerPhone },
    g.phoneRegisteredOnOrder,
  )
  assert.equal(payload.phoneRegisteredOnOrder, "250788123456")
  assert.equal(payload.PHONE_REGISTERED_ON_ORDER, "250788123456")
  assert.equal(assertGrandmaOrderPayloadHasMomoPhone(payload).ok, true)

  const airtel = guardGrandmaMobileMoneyPhone({
    paymentId: "airtel",
    accountPhone: "+250728123456",
    inputPhone: "",
  })
  assert.equal(airtel.ok, true)
  if (airtel.ok) assert.equal(airtel.phoneRegisteredOnOrder, "250728123456")
})

test("pasted payment SMS alone does not become the buyer phone", () => {
  const g = guardGrandmaMobileMoneyPhone({
    paymentId: "momo",
    accountPhone: "",
    inputPhone: "",
    smsBody: PASTED_SMS,
  })
  assert.equal(g.ok, false)
  if (!g.ok) assert.equal(g.code, "MISSING_PHONE")

  const withInput = guardGrandmaMobileMoneyPhone({
    paymentId: "momo",
    accountPhone: "",
    inputPhone: "0791112233",
    smsBody: PASTED_SMS,
  })
  assert.equal(withInput.ok, true)
  if (!withInput.ok) return
  assert.equal(withInput.phoneRegisteredOnOrder, "250791112233")
  assert.equal(withInput.phoneRegisteredOnOrder.includes("585310"), false)
})

test("cash / pickup-style payments do not require phoneRegisteredOnOrder", () => {
  assert.equal(isGrandmaMobileMoneyPayment("cash"), false)
  assert.equal(isGrandmaMobileMoneyPayment("bk"), false)
  const cash = guardGrandmaMobileMoneyPhone({
    paymentId: "cash",
    accountPhone: "",
    inputPhone: "",
  })
  assert.equal(cash.ok, true)
  assert.equal(assertGrandmaOrderPayloadHasMomoPhone({ paymentName: "PAY_ON_DELIVERY" }).ok, true)
  assert.equal(assertGrandmaOrderPayloadHasMomoPhone({ paymentName: "BANK_TRANSFER" }).ok, true)
})

test("MoMo Send lock distinguishes missing phone from missing SMS", () => {
  assert.equal(
    grandmaCheckoutSendLockReason({
      hasStockBlock: false,
      paymentId: "momo",
      smsPaymentReady: true,
      payerPhoneOk: false,
      cashConfirm: false,
    }),
    "phone",
  )
  assert.equal(
    grandmaCheckoutSendLockReason({
      hasStockBlock: false,
      paymentId: "airtel",
      smsPaymentReady: false,
      payerPhoneOk: true,
      cashConfirm: false,
    }),
    "sms",
  )
  assert.equal(
    grandmaCheckoutSendLockReason({
      hasStockBlock: false,
      paymentId: "momo",
      smsPaymentReady: true,
      payerPhoneOk: true,
      cashConfirm: false,
    }),
    "none",
  )
})

test("backend Mobile Money phone error is recognized without treating SMS as the phone", () => {
  assert.equal(
    isGrandmaMobileMoneyPhoneRequiredError("The phone number used for Mobile Money is required"),
    true,
  )
  assert.equal(isGrandmaMobileMoneyPhoneRequiredError(PASTED_SMS), false)
})

test("empty COURIER_POOL is not treated as an assigned courier", () => {
  const empty = grandmaCourierDisplayState(0)
  assert.equal(empty.hasAssignableCouriers, false)
  assert.equal(empty.showFakeAssignedCourier, false)
  const live = grandmaCourierDisplayState(3)
  assert.equal(live.hasAssignableCouriers, true)
  assert.equal(live.showFakeAssignedCourier, false)
})

test("Grandma checkout no longer treats empty courier pool as an assigned rider", () => {
  const page = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "app", "grandma", "page.tsx"),
    "utf8",
  )
  assert.equal(page.includes('name: "No couriers available"'), false)
  assert.equal(page.includes("courierAssignmentUnavailable"), true)
  assert.equal(page.includes("phoneRegisteredOnOrder"), true)
  assert.equal(page.includes("guardGrandmaMobileMoneyPhone"), true)
  assert.equal(page.includes("attachPhoneRegisteredOnOrder"), true)
  assert.equal(page.includes("grandmaCheckoutSendLockReason"), true)
  assert.equal(page.includes("smsBody: grandmaMomoSmsPaste"), true)
})

test("Grandma order API forwards phoneRegisteredOnOrder and does not invent it from SMS", () => {
  const route = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "app", "api", "grandma", "order", "route.ts"),
    "utf8",
  )
  assert.equal(route.includes("phoneRegisteredOnOrder"), true)
  assert.equal(route.includes("PHONE_REGISTERED_ON_ORDER"), true)
  assert.equal(route.includes("assertGrandmaOrderPayloadHasMomoPhone"), true)
  assert.equal(/smsBody|matchMoMoSms/.test(route), false)
})

test("Java OrdersServlet still requires phoneRegisteredOnOrder for mobile money", () => {
  const servlet = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "java-maputo-search",
    "src",
    "java",
    "Kaos",
    "OrdersServlet.java",
  )
  if (!fs.existsSync(servlet)) {
    assert.ok(true, "OrdersServlet not in this checkout; skip source assertion")
    return
  }
  const text = fs.readFileSync(servlet, "utf8")
  assert.equal(text.includes("The phone number used for Mobile Money is required"), true)
  assert.equal(text.includes("phoneRegisteredOnOrder.isEmpty()"), true)
  assert.match(text, /isMobileMoneyPayment && phoneRegisteredOnOrder\.isEmpty\(\)/)
})
