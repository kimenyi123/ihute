// app/api/request-loan-with-details/route.ts
import { NextRequest, NextResponse } from "next/server"

import { getBackendBase, getSellerOrdersUrl, getOrderStatusUrl, getSupplierStockUrl } from "@/lib/backend-config"

const JAVA_API_BASE = process.env.JAVA_API_URL || getBackendBase().replace(/\/Trading\/?$/, "") || "https://ihute.rw"
const UMUSADA_AUTH_BASE = process.env.UMUSADA_AUTH_BASE || "https://umusada-master.umusada.com/umusada-master-service"
const UMUSADA_BANK_API = process.env.UMUSADA_BANK_API || "https://bank-apis.umusada.com/api/v1"

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
    console.log("\n🔍 Step 1: Fetching order details...")
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

    let detailsJson: { ok?: boolean; items?: unknown[]; order?: { BUYER_TIN?: string; SELLER_TIN?: string } }
    try {
      detailsJson = JSON.parse(responseText)
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

    // ================================
    // STEP 4: COMPARE REQUESTED VS STOCK
    // ================================
    console.log("\n🔍 Step 4: Stock Comparison:")
    const stockComparison = itemsToCheck.map(itemToCheck => {
      const stockItem = products.find((p: any) => {
        const stockCode = p.itemCode || p.ITEM_CODE
        return stockCode === itemToCheck.itemCode ||
               (itemToCheck.nikiCode && stockCode === itemToCheck.nikiCode)
      })

      const availableStock = stockItem ? Number(stockItem.stock ?? stockItem.STOCK ?? 0) : 0
      console.log(`  • ${itemToCheck.itemName} (${itemToCheck.itemCode}): Requested = ${itemToCheck.requestedQty}, Available = ${availableStock}`)

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
    const username = "pm.serge@gmail.com"
    const password = "1234"
    const basicAuth = Buffer.from(`${username}:${password}`).toString('base64')

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
    const finalToken = tokenResponse.token
    if (!finalToken) {
      return NextResponse.json({
        success: false,
        error: "Failed to get auth token"
      }, { status: 401 })
    }

    console.log("✓ Successfully authenticated with Umusada")

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

    try {
      const businessRes = await fetch(`${getBackendBase()}/api/business?tin=${finalBuyerTIN}`)

      if (!businessRes.ok) {
        return NextResponse.json({
          success: false,
          error: `Failed to fetch business details (${businessRes.status})`
        }, { status: 500 })
      }

      const businessData = await businessRes.json()

      if (!businessData.success || !businessData.data) {
        return NextResponse.json({
          success: false,
          error: "Business not found or invalid response from business API"
        }, { status: 404 })
      }

      const business = businessData.data
      businessRegistrationCode = business.registration_code
      businessMsisdn = business.phone_number
      businessName = business.name
      businessEmail = business.email
      businessLocation = business.location
      businessCategory = business.category

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
      console.error("Error fetching business details:", error)
      return NextResponse.json({
        success: false,
        error: "Failed to fetch business registration details",
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

    const invoicePayload = {
      messageId: messageId,
      financialInstitutionId: 1,
      primaryData: {
        invoiceNumber: orderId.toString(),
        businessTin: finalBuyerTIN,
        businessRegistrationCode: businessRegistrationCode,
        businessMsisdn: businessMsisdn,
        currency: "RWF",
        invoiceAmount: invoiceAmount.toString()
      },
      additionalData: []
    }

    console.log(" Invoice Payload:", JSON.stringify(invoicePayload, null, 2))

    const invoiceResp = await fetch(`${UMUSADA_BANK_API}/invoice/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${finalToken}`
      },
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
        errorMessage = parsedData.message || parsedData.error || parsedData.errorMessage || JSON.stringify(parsedData)
      }

      return NextResponse.json({
        success: false,
        error: isDuplicate
          ? "This order was already submitted for financing. Duplicate invoice not allowed."
          : `Invoice submission failed (${invoiceResp.status}): ${errorMessage}`,
        code: isDuplicate ? "DUPLICATE_INVOICE" : undefined,
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