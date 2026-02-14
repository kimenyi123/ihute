// app/api/personalization/recommendations/route.ts
import { NextResponse } from "next/server"

import { getBackendBase } from "@/lib/backend-config"

const JAVA_BACKEND_URL = getBackendBase()

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get("action") || "getRecommendations"
    const userId = searchParams.get("userId")
    const sessionId = searchParams.get("sessionId")
    const limit = searchParams.get("limit") || "20"
    
    const params = new URLSearchParams()
    params.set("action", action)
    if (userId) params.set("userId", userId)
    if (sessionId) params.set("sessionId", sessionId)
    params.set("limit", limit)
    
    const url = `${JAVA_BACKEND_URL}/RecommendationServlet?${params.toString()}`
    console.log("[personalization/recommendations] Calling backend:", url)
    console.log("[personalization/recommendations] Params:", { action, userId, sessionId, limit })
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    })
    
    clearTimeout(timeoutId)

    const text = await response.text()
    console.log("[personalization/recommendations] Backend response status:", response.status)
    console.log("[personalization/recommendations] Backend response (first 500 chars):", text.substring(0, 500))
    
    let json: any
    
    try {
      json = JSON.parse(text)
    } catch (parseError) {
      console.error("[personalization/recommendations] Failed to parse JSON:", parseError)
      return NextResponse.json({ 
        ok: false, 
        error: "Invalid response from backend",
        raw: text.substring(0, 500),
        status: response.status,
        url
      }, { status: 500 })
    }

    return NextResponse.json(json)
  } catch (error: any) {
    console.error("[personalization/recommendations] Error:", error?.message)
    console.error("[personalization/recommendations] Stack:", error?.stack)
    console.error("[personalization/recommendations] Backend URL:", JAVA_BACKEND_URL)
    
    if (error?.name === 'AbortError') {
      return NextResponse.json(
        { ok: false, error: "Backend request timed out after 30 seconds" },
        { status: 504 }
      )
    }
    
    return NextResponse.json(
      { 
        ok: false, 
        error: error?.message || "Failed to get recommendations",
        details: process.env.NODE_ENV === 'development' ? {
          stack: error?.stack,
          backendUrl: JAVA_BACKEND_URL,
          type: error?.name
        } : undefined
      },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const action = body.action || "getRecommendations"
    
    const params = new URLSearchParams()
    params.set("action", action)
    if (body.userId) params.set("userId", body.userId)
    if (body.sessionId) params.set("sessionId", body.sessionId)
    if (body.limit) params.set("limit", String(body.limit))
    if (body.entityId) params.set("entityId", body.entityId)
    if (body.entityType) params.set("entityType", body.entityType)
    
    const url = `${JAVA_BACKEND_URL}/RecommendationServlet?${params.toString()}`
    console.log("[personalization/recommendations] POST - Calling backend:", url)
    console.log("[personalization/recommendations] POST - Body:", body)
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    })
    
    clearTimeout(timeoutId)

    const text = await response.text()
    console.log("[personalization/recommendations] POST - Backend response status:", response.status)
    console.log("[personalization/recommendations] POST - Backend response (first 500 chars):", text.substring(0, 500))
    
    let json: any
    
    try {
      json = JSON.parse(text)
    } catch (parseError) {
      console.error("[personalization/recommendations] POST - Failed to parse JSON:", parseError)
      return NextResponse.json({ 
        ok: false, 
        error: "Invalid response from backend",
        raw: text.substring(0, 500),
        status: response.status,
        url
      }, { status: 500 })
    }

    return NextResponse.json(json)
  } catch (error: any) {
    console.error("[personalization/recommendations] POST - Error:", error?.message)
    console.error("[personalization/recommendations] POST - Stack:", error?.stack)
    
    if (error?.name === 'AbortError') {
      return NextResponse.json(
        { ok: false, error: "Backend request timed out after 30 seconds" },
        { status: 504 }
      )
    }
    
    return NextResponse.json(
      { 
        ok: false, 
        error: error?.message || "Failed to get recommendations",
        details: process.env.NODE_ENV === 'development' ? {
          stack: error?.stack,
          backendUrl: JAVA_BACKEND_URL,
          type: error?.name
        } : undefined
      },
      { status: 500 }
    )
  }
}


