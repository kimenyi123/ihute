// app/api/orders/route.ts
import { NextResponse } from "next/server"
import { getOrdersUrl, getFetchSuggestionsUrl, getProxyTimeoutMs } from "@/lib/backend-config"

const DEBUG = process.env.DEBUG_ORDERS === 'true'
const TIMEOUT_MS = getProxyTimeoutMs()

/**
 * Smart routing: Determines which servlet to use based on request
 */
function determineServlet(body: any): { url: string; payload: any; mode: string } {
  const { email, action } = body

  // If action is explicitly provided → Use OrdersServlet
  if (action) {
    console.log('🎯 Mode: ACTION-BASED → OrdersServlet')
    return {
      url: getOrdersUrl(),
      payload: body, // Send entire body
      mode: 'action-based'
    }
  }

  // If only email (no action) → Use fetchSuggestions (legacy)
  if (email && !action) {
    console.log('🎯 Mode: LEGACY → fetchSuggestions')
    return {
      url: getFetchSuggestionsUrl(),
      // Forward full body so pagination and any extra flags reach Java; do not strip fields.
      payload: body,
      mode: 'legacy'
    }
  }

  // Invalid request
  throw new Error('Request must include either "action" or "email"')
}

export async function POST(req: Request) {
  const requestId = Math.random().toString(36).substring(7)
  const startTime = Date.now()

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`📥 [POST /api/orders] Request ID: ${requestId}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('⏰ Start time:', new Date().toISOString())

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    // Parse request body
    const bodyText = await req.text()
    console.log('\n📦 Request Body (raw):')
    console.log('   Length:', bodyText.length, 'bytes')
    console.log('   Content:', bodyText.substring(0, 200))

    const requestBody = JSON.parse(bodyText)
    console.log('✅ Body parsed successfully')
    console.log('   Keys:', Object.keys(requestBody))

    // Determine which servlet to use
    const { url, payload, mode } = determineServlet(requestBody)

    console.log('\n🎯 Backend Request:')
    console.log('   Mode:', mode)
    console.log('   URL:', url)
    console.log('   Payload:', JSON.stringify(payload))

    const fetchStart = Date.now()
    console.log('\n📡 Calling backend servlet...')

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: "no-store",
    })

    const fetchDuration = Date.now() - fetchStart
    console.log(`✅ Backend responded in ${fetchDuration}ms`)
    console.log('   Status:', resp.status, resp.statusText)
    console.log('   Content-Type:', resp.headers.get('content-type'))

    // Get response
    const text = await resp.text()
    console.log('\n📦 Backend Response:')
    console.log('   Length:', text.length, 'bytes')
    console.log('   First 500 chars:', text.substring(0, 500))

    // Parse response
    let data: any
    try {
      data = JSON.parse(text)
      console.log('✅ Response parsed successfully')
      if (DEBUG) {
        console.log('   Full data:', JSON.stringify(data, null, 2))
      }
    } catch (parseError) {
      console.error('❌ Failed to parse response as JSON')
      console.error('   Error:', parseError)
      return NextResponse.json({ transactions: [] }, { status: 200 })
    }

    // Handle response based on mode
    let result: any

    if (mode === 'legacy') {
      // Legacy mode: Extract transactions array
      console.log('\n🔄 Processing LEGACY response...')
      let transactions: any[] = []

      if (Array.isArray(data)) {
        transactions = data
      } else if (Array.isArray(data?.transactions)) {
        transactions = data.transactions
      } else if (typeof data?.transactions === "string") {
        transactions = []
      } else {
        transactions = []
      }

      console.log('   Transactions count:', transactions.length)
      result = { transactions }

    } else {
      // Action-based mode: Return raw response from OrdersServlet
      console.log('\n🔄 Processing ACTION-BASED response...')
      console.log('   Response OK:', data.ok)
      result = data
    }

    const totalDuration = Date.now() - startTime
    console.log('\n⏱️  Performance:')
    console.log('   Backend call:', fetchDuration, 'ms')
    console.log('   Total time:', totalDuration, 'ms')

    console.log('\n✅ Success')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    return NextResponse.json(result, { status: 200 })

  } catch (e: any) {
    const totalDuration = Date.now() - startTime

    console.error('\n❌ ERROR in POST /api/orders')
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.error('⏱️  Time before error:', totalDuration, 'ms')
    console.error('🔴 Error:', e?.message || 'Unknown error')

    if (e?.stack) {
      console.error('📚 Stack:', e.stack)
    }

    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    return NextResponse.json({
      transactions: [],
      error: e?.message || 'Unknown error'
    }, { status: 200 })

  } finally {
    clearTimeout(timeout)
    console.log(`🏁 Request ${requestId} completed in ${Date.now() - startTime}ms\n`)
  }
}