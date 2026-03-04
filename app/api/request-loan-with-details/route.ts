// app/api/request-loan-with-details/route.ts
import { NextRequest, NextResponse } from "next/server"

import { getBackendBase, getSellerOrdersUrl, getOrderStatusUrl, getSupplierStockUrl } from "@/lib/backend-config"

const JAVA_API_BASE = process.env.JAVA_API_URL || getBackendBase().replace(/\/Trading\/?$/, "") || "https://ihute.rw"
const UMUSADA_AUTH_BASE = process.env.UMUSADA_AUTH_BASE || "https://umusada-master.umusada.com/umusada-master-service"
const UMUSADA_BANK_API = process.env.UMUSADA_BANK_API || "https://bank-apis.umusada.com/api/v1"
/** Full URL for invoice submit; if set, overrides UMUSADA_BANK_API + /invoice/submit (use when bank API path differs) */
const UMUSADA_INVOICE_SUBMIT_URL = process.env.UMUSADA_INVOICE_SUBMIT_URL

export async function POST(req: NextRequest) {
  try {
    const { orderId, buyerAccount, sellerAccount, buyerTIN, supplierTIN, invoiceAmount } = await req.json()

    console.log("=== BUYER LOAN REQUEST WITH STOCK CHECK ===")
    console.log("Backend base:", getBackendBase(), "| SellerOrders:", getSellerOrdersUrl())
    console.log("Order ID:", orderId)
    console.log("Buyer Account:", buyerAccount)
    console.log("Seller Account:", sellerAccount)
    console.log("Buyer TIN:", buyerTIN)
    console.log("Supplier TIN:", supplierTIN)
    console.log("Invoice Amount:", invoiceAmount)

    // Validate required fields
    if (!buyerAccount) {
      return NextResponse.json({
        success: false,
        error: "Buyer account is required"
      }, { status: 400 })
    }

    if (!sellerAccount) {
      return NextResponse.json({
        success: false,
        error: "Seller account is required"
      }, { status: 400 })
    }

    // ================================
    // STEP 1: FETCH ORDER DETAILS
    // ================================
    console.log("\n Step 1: Fetching order details...")
    const formData = new URLSearchParams()
    formData.append("action", "listBuyerOrderItems")
    formData.append("buyerAccount", buyerAccount)
    formData.append("orderId", orderId)

    const sellerOrdersUrl = getSellerOrdersUrl()
    console.log("   URL:", sellerOrdersUrl)
    const detailsRes = await fetch(sellerOrdersUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    })

    const responseText = await detailsRes.text()
    if (!detailsRes.ok) {
      console.error("[request-loan] Order details fetch failed:", detailsRes.status, responseText.slice(0, 500))
      return NextResponse.json({
        success: false,
        error: "Failed to fetch order details",
        details: responseText.slice(0, 500)
      }, { status: 500 })
    }

    const contentType = detailsRes.headers.get("content-type")
    if (!contentType?.includes("application/json")) {
      console.error("[request-loan] Backend returned non-JSON:", responseText.slice(0, 500))
      return NextResponse.json({
        success: false,
        error: "Java API returned HTML instead of JSON",
        details: responseText.slice(0, 500)
      }, { status: 500 })
    }

    type OrderDetailItem = { ITEM_CODE?: string; niki_code?: string; quantity?: number; QUANTITY?: number; ITEM_NAME?: string; [key: string]: unknown }
    type OrderDetailsJson = { ok?: boolean; items?: OrderDetailItem[]; order?: { BUYER_TIN?: string; SELLER_TIN?: string } }
    let detailsJson: OrderDetailsJson
    try {
      detailsJson = JSON.parse(responseText) as OrderDetailsJson
    } catch (e) {
      console.error("[request-loan] Invalid JSON from order details:", e)
      return NextResponse.json({
        success: false,
        error: "Invalid JSON from order details API",
        details: responseText.slice(0, 500)
      }, { status: 500 })
    }
    if (!detailsJson.ok || !detailsJson.items || detailsJson.items.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No items found for this order",
        details: detailsJson
      }, { status: 404 })
    }

    console.log("✓ Order Items Found:", detailsJson.items.length)

    // Extract TINs from order details if not provided
    const finalBuyerTIN = buyerTIN || detailsJson.order?.BUYER_TIN || ""
    const finalSupplierTIN = supplierTIN || detailsJson.order?.SELLER_TIN || ""

    console.log("✓ Final TINs - Buyer:", finalBuyerTIN, "Supplier:", finalSupplierTIN)

    // ================================
    // STEP 2: BUILD ITEMS TO CHECK
    // ================================
    const itemsToCheck: Array<{
      itemCode: string,
      itemName: string,
      requestedQty: number,
      nikiCode?: string
    }> = []

    for (const item of detailsJson.items) {
      const code = item?.ITEM_CODE?.trim()
      const nikiCode = item?.niki_code?.trim()
      const quantity = Number(item?.quantity || item?.QUANTITY || 0)

      let finalCode: string | null = null
      if (code && code !== "" && code !== "0" && code !== "1") {
        finalCode = code
      } else if (nikiCode && nikiCode !== "" && nikiCode !== "0" && nikiCode !== "1") {
        finalCode = nikiCode
      }

      if (finalCode) {
        itemsToCheck.push({
          itemCode: finalCode,
          itemName: item?.ITEM_NAME || "Product",
          requestedQty: quantity,
          nikiCode
        })
      }
    }

    if (itemsToCheck.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No valid product codes found"
      }, { status: 400 })
    }

    console.log(`✓ Found ${itemsToCheck.length} items to verify stock`)

    // ================================
    // STEP 3: FETCH STOCK FROM SELLER (call Java backend directly so it works with Trading_beta)
    // ================================
    console.log("\n📦 Step 3: Checking stock availability from seller...")
    console.log("   Using Seller Account:", sellerAccount)

    const stockUrl = `${getSupplierStockUrl()}?account=${encodeURIComponent(sellerAccount)}`
    console.log("   URL:", stockUrl)
    const stockRes = await fetch(stockUrl, {
      method: "GET",
      headers: { "Accept": "application/json" },
      cache: "no-store",
    })

    const stockText = await stockRes.text()
    if (!stockRes.ok) {
      console.error("[request-loan] Step 3 stock fetch failed:", stockRes.status, stockText.slice(0, 300))
      return NextResponse.json({
        success: false,
        error: "Failed to fetch supplier stock",
        url: stockUrl,
        details: stockText.slice(0, 500),
      }, { status: 500 })
    }

    let stockData: { ok?: boolean; products?: unknown[] }
    try {
      stockData = JSON.parse(stockText)
    } catch {
      console.error("[request-loan] Step 3 invalid JSON from stock:", stockText.slice(0, 300))
      return NextResponse.json({
        success: false,
        error: "Invalid stock response from backend",
      }, { status: 500 })
    }

    const products = Array.isArray(stockData?.products)
      ? stockData.products
      : Array.isArray(stockData) ? stockData : []
    if (products.length === 0 && !Array.isArray(stockData?.products) && !Array.isArray(stockData)) {
      return NextResponse.json({
        success: false,
        error: "Invalid stock data from supplier (no products array)",
      }, { status: 500 })
    }
    console.log(`✓ Available products in stock: ${products.length}`)
    // Log first product keys to help debug backend response shape changes
    const firstProduct = products[0] as Record<string, unknown>
    if (firstProduct && typeof firstProduct === "object") {
      console.log("   Sample stock product keys:", Object.keys(firstProduct).join(", "))
    }

    // Helpers: backend may use item_key_words (NIKI) for code; item_packet is quantity.
    const getStockProductCode = (p: Record<string, unknown>): string | undefined => {
      const raw = (p.item_key_words ?? p.itemCode ?? p.ITEM_CODE ?? p.item_code ?? p.productCode ?? p.code ?? p.niki_code ?? p.NIKI_CODE) as string | undefined
      return raw != null ? String(raw).trim() : undefined
    }
    const getStockQuantity = (p: Record<string, unknown>): number => {
      const raw = p.item_packet ?? p.stock ?? p.STOCK ?? p.quantity ?? p.QUANTITY ?? p.qty ?? p.availableStock ?? p.available_quantity ?? p.stock_quantity ?? p.item_quantity ?? p.item_stock
      return Number(raw) || 0
    }
    // If product is in stock list but backend doesn't expose quantity, treat as sufficient
    const productFoundButNoQty = (p: Record<string, unknown>): boolean => {
      const hasQtyKey = "item_packet" in p || "stock" in p || "STOCK" in p || "quantity" in p || "QUANTITY" in p || "qty" in p || "availableStock" in p || "available_quantity" in p || "stock_quantity" in p || "item_quantity" in p || "item_stock" in p
      return !hasQtyKey
    }

    // ================================
    // STEP 4: COMPARE REQUESTED VS STOCK
    // ================================
    console.log("\n🔍 Step 4: Stock Comparison:")
    const stockComparison = itemsToCheck.map(itemToCheck => {
      const wantCode = itemToCheck.itemCode?.trim()
      const wantNiki = itemToCheck.nikiCode?.trim()
      const stockItem = products.find((p: any) => {
        const stockCode = getStockProductCode(p as Record<string, unknown>)
        if (!stockCode) return false
        return stockCode === wantCode || (!!wantNiki && stockCode === wantNiki)
      }) as Record<string, unknown> | undefined

      let availableStock = stockItem ? getStockQuantity(stockItem) : 0
      // Backend may list products without a quantity field (e.g. NIKI item_key_words format); treat "in list" as in stock
      if (stockItem && availableStock === 0 && productFoundButNoQty(stockItem)) {
        availableStock = itemToCheck.requestedQty
        console.log(`  • ${itemToCheck.itemName} (${itemToCheck.itemCode}): Requested = ${itemToCheck.requestedQty}, Available = (listed, no qty) → treating as ${availableStock}`)
      } else {
        console.log(`  • ${itemToCheck.itemName} (${itemToCheck.itemCode}): Requested = ${itemToCheck.requestedQty}, Available = ${availableStock}`)
      }

      return {
        itemCode: itemToCheck.itemCode,
        itemName: itemToCheck.itemName,
        requestedQty: itemToCheck.requestedQty,
        availableStock,
        status: availableStock >= itemToCheck.requestedQty ? "sufficient" : "insufficient"
      }
    })

    const insufficientItems = stockComparison.filter(i => i.status === "insufficient")
    if (insufficientItems.length > 0) {
      const errorMessages = insufficientItems
        .map(i => `• ${i.itemName}: Requested ${i.requestedQty}, Available ${i.availableStock}`)
        .join("\n")

      return NextResponse.json({
        success: false,
        error: "Insufficient stock for financing",
        stockComparison,
        message: `Cannot proceed with financing:\n${errorMessages}`
      }, { status: 400 })
    }

    console.log("✓ All items have sufficient stock!")
    const primaryItem = itemsToCheck[0]

    // ================================
    // STEP 5: UMUSADA LOGIN
    // ================================
    console.log("\n🔐 Step 5: Authenticating with Umusada...")
    const username = process.env.UMUSADA_USERNAME ?? process.env.UMUSADA_EXCEL_EMAIL ?? ""
    const password = process.env.UMUSADA_PASSWORD ?? process.env.UMUSADA_EXCEL_PASSWORD ?? ""
    if (!username?.trim() || !password) {
      console.error("[request-loan] Umusada credentials not set. Set UMUSADA_USERNAME and UMUSADA_PASSWORD (or UMUSADA_EXCEL_EMAIL / UMUSADA_EXCEL_PASSWORD) in .env")
      return NextResponse.json({
        success: false,
        error: "Umusada credentials not configured. Set UMUSADA_USERNAME and UMUSADA_PASSWORD in environment."
      }, { status: 500 })
    }
    const basicAuth = Buffer.from(`${username.trim()}:${password}`).toString('base64')

    const loginStep1 = await fetch(`${UMUSADA_AUTH_BASE}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${basicAuth}`
      }
    })

    if (!loginStep1.ok) {
      return NextResponse.json({
        success: false,
        error: "Umusada authentication failed (step 1)"
      }, { status: 401 })
    }

    const otpResponse = await loginStep1.json()
    if (!otpResponse.otp || !otpResponse.otpToken) {
      return NextResponse.json({
        success: false,
        error: "Failed to get OTP"
      }, { status: 401 })
    }

    const loginStep2 = await fetch(`${UMUSADA_AUTH_BASE}/auth/login-auth2`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${otpResponse.otpToken}`
      },
      body: JSON.stringify({ code: otpResponse.otp })
    })

    if (!loginStep2.ok) {
      return NextResponse.json({
        success: false,
        error: "Umusada OTP validation failed"
      }, { status: 401 })
    }

    const tokenResponse = await loginStep2.json()
    // Support common response shapes: { token }, { data: { token } }, { accessToken }, { access_token }
    const finalToken =
      tokenResponse.token ??
      tokenResponse.data?.token ??
      tokenResponse.accessToken ??
      tokenResponse.access_token
    const tokenStr = typeof finalToken === "string" ? finalToken.trim() : ""
    if (!tokenStr) {
      console.error("[request-loan] Auth response missing token. Keys:", Object.keys(tokenResponse || {}))
      return NextResponse.json({
        success: false,
        error: "Failed to get auth token from Umusada login response"
      }, { status: 401 })
    }

    console.log("✓ Successfully authenticated with Umusada (token length:", tokenStr.length, ")")
    console.log("[request-loan] TOKEN (use for invoice API):", tokenStr)

    // ================================
    // STEP 5.5: FETCH BUSINESS REGISTRATION INFO
    // ================================
    console.log("\n Step 5.5: Fetching business registration details...")

    if (!finalBuyerTIN) {
      return NextResponse.json({
        success: false,
        error: "Buyer TIN is required but not found in order data"
      }, { status: 400 })
    }

    let businessRegistrationCode = ""
    let businessMsisdn = ""
    let businessName = ""
    let businessEmail = ""
    let businessLocation = ""
    let businessCategory = ""

    const businessApiUrl = process.env.JAVA_BUSINESS_API_URL || `${getBackendBase()}/api/business`
    const businessUrl = `${businessApiUrl}?tin=${encodeURIComponent(finalBuyerTIN)}`
    console.log("   Business API URL:", businessUrl)

    try {
      const businessRes = await fetch(businessUrl, { cache: "no-store" })
      const businessText = await businessRes.text()

      if (!businessRes.ok) {
        console.error("[request-loan] Step 5.5 business API failed:", businessRes.status, businessText.slice(0, 500))
        return NextResponse.json({
          success: false,
          error: `Failed to fetch business details (HTTP ${businessRes.status})`,
          code: "BUSINESS_API_ERROR",
          details: businessRes.status === 404
            ? "Business API endpoint may not exist. Set JAVA_BUSINESS_API_URL in .env to the correct URL if the API is elsewhere."
            : businessText.slice(0, 300)
        }, { status: 500 })
      }

      let businessData: { success?: boolean; data?: Record<string, unknown> }
      try {
        businessData = JSON.parse(businessText)
      } catch {
        console.error("[request-loan] Step 5.5 business API returned non-JSON:", businessText.slice(0, 300))
        return NextResponse.json({
          success: false,
          error: "Business API returned invalid JSON",
          code: "BUSINESS_API_INVALID_JSON",
          details: businessText.slice(0, 200)
        }, { status: 500 })
      }

      if (!businessData.success || !businessData.data) {
        return NextResponse.json({
          success: false,
          error: "Business not found or invalid response from business API"
        }, { status: 404 })
      }

      const business = businessData.data as Record<string, unknown>
      businessRegistrationCode = String(business.registration_code ?? "")
      businessMsisdn = String(business.phone_number ?? "")
      businessName = String(business.name ?? "")
      businessEmail = String(business.email ?? "")
      businessLocation = String(business.location ?? "")
      businessCategory = String(business.category ?? "")

      console.log("✓ Business Details Fetched:")
      console.log("   Name:", businessName)
      console.log("   TIN:", finalBuyerTIN)
      console.log("   Registration Code:", businessRegistrationCode)

      if (!businessRegistrationCode) {
        return NextResponse.json({
          success: false,
          error: "Business registration code not found in business data"
        }, { status: 400 })
      }

      if (!businessMsisdn) {
        return NextResponse.json({
          success: false,
          error: "Business phone number not found in business data"
        }, { status: 400 })
      }

    } catch (error) {
      console.error("[request-loan] Step 5.5 error fetching business details:", error)
      return NextResponse.json({
        success: false,
        error: "Failed to fetch business registration details",
        code: "BUSINESS_FETCH_ERROR",
        details: error instanceof Error ? error.message : "Unknown error"
      }, { status: 500 })
    }

    // ================================
    // STEP 6: SUBMIT INVOICE TO BANK API
    // ================================
    console.log("\n Step 6: Submitting invoice to Umusada Bank API...")

    if (!invoiceAmount || invoiceAmount <= 0) {
      return NextResponse.json({
        success: false,
        error: "Valid invoice amount is required"
      }, { status: 400 })
    }

    const messageId = orderId.toString()

    // Bank API example uses E.164 (e.g. +25071234575). Normalize Rwandan 07/078/079 to +250.
    const normalizeMsisdn = (s: string): string => {
      const digits = (s || "").replace(/\D/g, "")
      if (digits.startsWith("250") && digits.length >= 12) return `+${digits}`
      if (digits.startsWith("0") && digits.length >= 9) return `+250${digits.slice(1)}`
      if (digits.length >= 9) return `+250${digits}`
      return (s || "").trim()
    }
    const primaryMsisdn = normalizeMsisdn(businessMsisdn)

    const invoicePayload = {
      messageId: messageId,
      financialInstitutionId: 1,
      primaryData: {
        invoiceNumber: orderId.toString(),
        businessTin: finalBuyerTIN,
        businessRegistrationCode: businessRegistrationCode,
        businessMsisdn: primaryMsisdn,
        currency: "RWF",
        invoiceAmount: invoiceAmount.toString()
      },
      additionalData: []
    }

    console.log(" Invoice Payload:", JSON.stringify(invoicePayload, null, 2))

    const invoiceSubmitUrl = UMUSADA_INVOICE_SUBMIT_URL || `${UMUSADA_BANK_API}/invoice/submit`
    console.log(" Invoice Submit URL:", invoiceSubmitUrl)

    // Umusada master (invoice/save) often expects the raw token only; bank-apis may expect "Bearer <token>". Env overrides: UMUSADA_INVOICE_AUTH_SCHEME, UMUSADA_INVOICE_AUTH_HEADER.
    const isUmusadaMasterInvoice = (invoiceSubmitUrl || "").includes("umusada-master")
    const defaultScheme = isUmusadaMasterInvoice ? "" : "Bearer"
    const authScheme = process.env.UMUSADA_INVOICE_AUTH_SCHEME !== undefined ? process.env.UMUSADA_INVOICE_AUTH_SCHEME : defaultScheme
    const authHeaderName = process.env.UMUSADA_INVOICE_AUTH_HEADER || "Authorization"
    const authValue = (authScheme && authScheme.trim()) ? `${authScheme.trim()} ${tokenStr}`.trim() : tokenStr
    const invoiceHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      [authHeaderName]: authValue
    }
    console.log(" Sending", authHeaderName, authScheme ? `(${authScheme} + token, length ${tokenStr.length})` : `(raw token, length ${tokenStr.length})`)

    const invoiceResp = await fetch(invoiceSubmitUrl, {
      method: "POST",
      headers: invoiceHeaders,
      body: JSON.stringify(invoicePayload)
    })

    console.log(" Response Status:", invoiceResp.status, invoiceResp.statusText)

    const invoiceResponseBody = await invoiceResp.text()
    let parsedData: any = invoiceResponseBody

    if (invoiceResp.headers.get("content-type")?.includes("application/json")) {
      try {
        parsedData = JSON.parse(invoiceResponseBody)
        console.log("✓ Parsed Response:", JSON.stringify(parsedData, null, 2))
      } catch (e) {
        console.log("  Failed to parse JSON response")
      }
    }

    if (invoiceResp.ok) {
      console.log("Invoice submitted successfully!")

      // ================================
      // STEP 7: UPDATE PAYMENT STATUS TO UMUSADA
      // ================================
      console.log("\nStep 7: Updating payment status to UMUSADA...")

      let paymentStatusUpdated = false
      try {
        const statusUpdatePayload = {
          orderId: orderId,
          paymentStatus: "UMUSADA"
        }

        console.log(" Status Update Payload:", JSON.stringify(statusUpdatePayload, null, 2))

        const statusUpdateRes = await fetch(getOrderStatusUrl(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(statusUpdatePayload)
        })

        console.log(" Payment Status Update Response Status:", statusUpdateRes.status)

        if (!statusUpdateRes.ok) {
          const errorText = await statusUpdateRes.text()
          console.log("   Failed to update payment status:", errorText)
        } else {
          const statusUpdateData = await statusUpdateRes.json()
          console.log("Payment status updated successfully:", JSON.stringify(statusUpdateData, null, 2))
          paymentStatusUpdated = true
        }
      } catch (statusError) {
        console.error("   Error updating payment status (non-fatal):", statusError)
      }

      return NextResponse.json({
        success: true,
        message: "Invoice financing request submitted successfully",
        messageId: messageId,
        invoiceNumber: orderId,
        businessInfo: {
          name: businessName,
          tin: finalBuyerTIN,
          registrationCode: businessRegistrationCode,
          phone: businessMsisdn,
          email: businessEmail,
          location: businessLocation,
          category: businessCategory
        },
        itemCode: primaryItem.itemCode,
        itemName: primaryItem.itemName,
        verifiedItems: itemsToCheck.length,
        stockComparison,
        sellerAccount,
        buyerAccount,
        data: parsedData,
        paymentStatusUpdated: paymentStatusUpdated
      })
    } else {
      console.log(" Invoice submission failed")

      let errorMessage = invoiceResponseBody
      const isDuplicate =
        parsedData && typeof parsedData === "object" &&
        (String(parsedData.message || "").toLowerCase().includes("duplicate") ||
         String(parsedData.error || "").toLowerCase().includes("duplicate"))
      if (parsedData && typeof parsedData === "object") {
        const firstErr = Array.isArray(parsedData.errorInfo) ? parsedData.errorInfo[0] : null
        const fromErrorInfo = firstErr ? (firstErr.errorDescription || firstErr.errorCode) : null
        errorMessage = fromErrorInfo || parsedData.messageDescription || parsedData.message || parsedData.error || parsedData.errorMessage || JSON.stringify(parsedData)
      }

      const isWrongEndpoint = String(errorMessage).toLowerCase().includes("no static resource") || String(errorMessage).toLowerCase().includes("api/v1/invoice/submit")
      const suggestion = isWrongEndpoint
        ? " The bank API endpoint may have changed. Set UMUSADA_INVOICE_SUBMIT_URL in .env to the correct invoice submit URL (contact Umusada for the current endpoint)."
        : ""

      return NextResponse.json({
        success: false,
        error: isDuplicate
          ? "This order was already submitted for financing. Duplicate invoice not allowed."
          : `Invoice submission failed (${invoiceResp.status}): ${errorMessage}${suggestion}`,
        code: isDuplicate ? "DUPLICATE_INVOICE" : isWrongEndpoint ? "WRONG_ENDPOINT" : undefined,
        details: parsedData
      }, { status: invoiceResp.status })
    }

  } catch (error) {
    console.error("Error in loan request:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}