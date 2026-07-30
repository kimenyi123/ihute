/**
 * Unit tests for EBM mapper + response parser (no network / DB).
 * Run: npm run test:ebm
 */
import assert from "node:assert/strict"
import test from "node:test"
import { mapOrderToEbmInvoice } from "../lib/ebm/ebm-invoice-mapper.ts"
import { parseEbmResponse } from "../lib/ebm/ebm-response-parser.ts"
import { isOrderEligibleForAutoEbm } from "../lib/ebm/ebm-eligibility.ts"
import { parseEbmRegistrationResponse } from "../lib/ebm/ebm-registration-parser.ts"
import { mapCompanyRegistration } from "../lib/ebm/ebm-registration-mapper.ts"
import {
  isEbmRegistrationRequiredError,
  toEbmUserFacingError,
} from "../lib/ebm/ebm-api-errors.ts"

test("mapOrderToEbmInvoice maps header and line items", () => {
  const payload = mapOrderToEbmInvoice({
    companyTin: "123456789",
    userName: "admin@test.rw",
    order: {
      id: 42,
      orderNumber: "ORD-42",
      buyerName: "Jane Doe",
      buyerTin: "987654321",
      amount: 11800,
      taxes: 1800,
      timestamp: "2026-06-23T10:00:00.000Z",
      currency: "RWF",
    },
    items: [
      {
        itemCode: "SKU-1",
        itemName: "Widget",
        quantity: 2,
        unitPrice: 5000,
        discountAmount: 0,
        vatRate: 18,
      },
    ],
  })

  assert.equal(payload.companyTin, "123456789")
  assert.equal(payload.flag, "INVOICE")
  assert.equal(payload.ComputationType, "INCLUSIVE")
  assert.equal(payload.invoiceNumber, "EBM-42")
  assert.equal(payload.businessPartnerName, "Jane Doe")
  assert.equal(payload.clientTin, "987654321")
  assert.equal(payload.totalAmount, "11800")
  assert.equal(payload.totalVat, "1800")
  assert.equal(payload.currency, "RWF")
  assert.equal(payload.items.length, 1)
  assert.equal(payload.items[0].itemCode, "SKU-1")
  assert.equal(payload.items[0].taxCode, "B")
})

test("parseEbmResponse detects SUCCESS and fiscal fields", () => {
  const parsed = parseEbmResponse({
    STATUS: "SUCCESS",
    QR_CODE: "qr-data",
    ysdcrecnum: "REC-99",
    ysdcregsig: "SIG-ABC",
    ysdcid: "VSDC-1",
  })

  assert.equal(parsed.success, true)
  assert.equal(parsed.qrCode, "qr-data")
  assert.equal(parsed.receiptNumber, "REC-99")
  assert.equal(parsed.fiscalSignature, "SIG-ABC")
  assert.equal(parsed.ysdcid, "VSDC-1")
})

test("parseEbmResponse handles nested result object", () => {
  const parsed = parseEbmResponse({
    result: {
      status: "SUCCESS",
      ysdcrecnum: "R-1",
      QR_CODE: "nested-qr",
    },
  })
  assert.equal(parsed.success, true)
  assert.equal(parsed.receiptNumber, "R-1")
  assert.equal(parsed.qrCode, "nested-qr")
})

test("parseEbmResponse handles Algorithm RESPONSE.MESSAGE shape", () => {
  const parsed = parseEbmResponse({
    RESPONSE: {
      DISTRIBUTOR_TIN: 999000025,
      STATUS: "SUCCESS",
      QR_CODE: "?DATA=abc",
      MESSAGE: {
        flag: "INVOICE",
        ysdcrecnum: "2/2 NS ISH:2",
        num: "SAP12320t01",
        ysdcid: "SDC009000057",
        ysdcintdata: "S5AU-274J-FLNW-I4E5-6QG5-7DVE-EQ",
        ysdcregsig: "HLTC-GCDF-PJEI-U7F4",
      },
    },
  })
  assert.equal(parsed.success, true)
  assert.equal(parsed.receiptNumber, "2/2 NS ISH:2")
  assert.equal(parsed.ysdcid, "SDC009000057")
  assert.equal(parsed.fiscalSignature, "HLTC-GCDF-PJEI-U7F4")
  assert.equal(parsed.qrCode, "?DATA=abc")
})

test("isEbmRegistrationRequiredError detects register first", () => {
  const body = JSON.stringify({ errors: ["No parameter found register first"] })
  assert.equal(isEbmRegistrationRequiredError(400, body), true)
  assert.equal(isEbmRegistrationRequiredError(200, body), false)
})

test("toEbmUserFacingError hides raw VSDC messages", () => {
  assert.match(
    toEbmUserFacingError("registration"),
    /Automatic registration failed/,
  )
  assert.doesNotMatch(
    toEbmUserFacingError("registration"),
    /register first/,
  )
})

test("mapCompanyRegistration builds registration payload from env", () => {
  process.env.EBM_BRANCH_ID = "00"
  process.env.EBM_DEVICE_SERIAL = "DEV-001"
  process.env.EBM_TAXPAYER_NAME = "Feels Feels"
  process.env.EBM_BUSINESS_ACTIVITY = "Retail"
  process.env.EBM_PROVINCE = "Kigali"
  process.env.EBM_DISTRICT = "Gasabo"
  process.env.EBM_SECTOR = "Remera"
  process.env.EBM_LOCATION = "Kigali"
  process.env.EBM_HQ_YN = "Y"
  process.env.EBM_MANAGER_PHONE = "0780000000"
  process.env.EBM_MANAGER_EMAIL = "shop@example.rv"

  const payload = mapCompanyRegistration({
    companyTin: "999000025",
    userName: "seller@test",
    sellerName: "Feels Feels Shop",
  })
  assert.equal(payload.companyTin, "999000025")
  assert.equal(payload.userName, "seller@test")
  assert.equal(payload.taxprNm, "Feels Feels")
  assert.equal(payload.bhfId, "00")
})

test("parseEbmRegistrationResponse handles SUCCESS", () => {
  const parsed = parseEbmRegistrationResponse({
    RESPONSE: {
      DISTRIBUTOR_TIN: "999000025",
      STATUS: "SUCCESS",
      MESSAGE: { ysdcid: "SDC009000057" },
    },
  })
  assert.equal(parsed.ok, true)
  assert.equal(parsed.status, "registered")
  assert.equal(parsed.vsdcId, "SDC009000057")
})

test("isOrderEligibleForAutoEbm requires PAID + completed status", () => {
  assert.equal(
    isOrderEligibleForAutoEbm({ paymentStatus: "PAID", orderStatus: "DELIVERED" }),
    true,
  )
  assert.equal(
    isOrderEligibleForAutoEbm({ paymentStatus: "PAID", orderStatus: "INVOICE" }),
    true,
  )
  assert.equal(
    isOrderEligibleForAutoEbm({ paymentStatus: "OPEN", orderStatus: "DELIVERED" }),
    false,
  )
  assert.equal(
    isOrderEligibleForAutoEbm({ paymentStatus: "PAID", orderStatus: "PROCESSING" }),
    false,
  )
})
