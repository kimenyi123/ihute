// app/supplier/b2b/api/route.ts
// Proxy for Rekizisiyo Servlet (Java/Tomcat)

import { NextRequest, NextResponse } from "next/server";
import { getJavaSetCookieValues, rewriteForwardedSetCookie } from "@/lib/java-proxy-cookies";

// For local development (default)
const JAVA_BACKEND_BASE =
  process.env.JAVA_BACKEND_BASE || "http://localhost:8080/Trading";

// B2B servlet URL - JAVA_BACKEND_BASE already includes /Trading
const B2B_SERVLET_URL = `${JAVA_BACKEND_BASE}/supplier/b2b/api`;

// Timeout helpers
function createAbort(timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timeout };
}

/** Forward Set-Cookie from Java backend back to browser (Undici: use getSetCookie, not headers.get). */
function forwardSetCookie(javaResp: Response, nextResp: NextResponse) {
  for (const raw of getJavaSetCookieValues(javaResp.headers)) {
    nextResp.headers.append("Set-Cookie", rewriteForwardedSetCookie(raw));
  }
}

/**
 * Reads request body safely.
 * - If JSON: returns parsed object
 * - If empty: returns null
 * - If parse fails: logs warning and returns null
 * - Never throws "Unexpected end of JSON input"
 */
async function safeReadJson(req: NextRequest): Promise<any> {
  try {
    const text = await req.text();
    if (!text || !text.trim()) {
      return null;
    }
    return JSON.parse(text);
  } catch (error) {
    console.warn('[B2B-API] JSON parse failed, proceeding with null body:', error);
    return null;
  }
}

/**
 * Decide how to return the Java response:
 * - Excel (downloadTemplate): blob
 * - HTML (invoiceHtml): text/html
 * - JSON: parse safely
 * - Empty: return empty JSON {ok:true} (or empty body depending)
 */
async function buildResponseFromJava(javaResp: Response, action: string) {
  const contentType = (javaResp.headers.get("content-type") || "").toLowerCase();

  // 1) Excel template download
  if (action === "downloadTemplate") {
    const blob = await javaResp.blob();
    const nextResp = new NextResponse(blob, {
      status: javaResp.status,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="b2b_template.xlsx"`,
      },
    });
    forwardSetCookie(javaResp, nextResp);
    return nextResp;
  }

  // 2) Invoice HTML
  if (action === "invoiceHtml" || contentType.includes("text/html")) {
    const html = await javaResp.text();
    const nextResp = new NextResponse(html, {
      status: javaResp.status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
    forwardSetCookie(javaResp, nextResp);
    return nextResp;
  }

  // 3) JSON (normal path)
  if (contentType.includes("application/json")) {
    const text = await javaResp.text();

    // Empty JSON body from backend (happens sometimes) => avoid crashing
    if (!text || !text.trim()) {
      const nextResp = NextResponse.json(
        { ok: javaResp.ok, error: javaResp.ok ? undefined : "Empty response from backend" },
        { status: javaResp.status }
      );
      forwardSetCookie(javaResp, nextResp);
      return nextResp;
    }

    try {
      const data = JSON.parse(text);
      const nextResp = NextResponse.json(data, { status: javaResp.status });
      forwardSetCookie(javaResp, nextResp);
      return nextResp;
    } catch {
      // Backend claimed JSON but returned non-JSON
      const nextResp = NextResponse.json(
        {
          ok: false,
          error: "Invalid JSON response from backend",
          debug: text.substring(0, 300),
        },
        { status: 500 }
      );
      forwardSetCookie(javaResp, nextResp);
      return nextResp;
    }
  }

  // 4) Fallback: treat as text (sometimes backend returns plain text)
  const text = await javaResp.text();
  if (!text || !text.trim()) {
    const nextResp = NextResponse.json(
      { ok: javaResp.ok, error: javaResp.ok ? undefined : "Empty response from backend" },
      { status: javaResp.status }
    );
    forwardSetCookie(javaResp, nextResp);
    return nextResp;
  }

  // If backend gave text error, wrap it
  const nextResp = NextResponse.json(
    {
      ok: javaResp.ok,
      error: javaResp.ok ? undefined : text.substring(0, 500),
      raw: javaResp.ok ? text : undefined,
    },
    { status: javaResp.status }
  );
  forwardSetCookie(javaResp, nextResp);
  return nextResp;
}

/**
 * GET handler for B2B read operations
 * Examples: search, getDraft, listOutgoing, listIncoming, getOrderDetails, supplierOptions, invoiceHtml, downloadTemplate
 */
export async function GET(req: NextRequest) {
  const { controller, timeout } = createAbort(
    Number(process.env.PROXY_TIMEOUT_MS ?? 15000)
  );

  try {
    const searchParams = req.nextUrl.searchParams;
    const action = searchParams.get("action");

    if (!action) {
      return NextResponse.json(
        { ok: false, error: "action parameter required" },
        { status: 400 }
      );
    }

    const queryString = searchParams.toString();
    const url = `${B2B_SERVLET_URL}?${queryString}`;

    const cookieHeader = req.headers.get("cookie") || "";

    console.log(`[B2B-API] GET action: ${action}`);
    console.log(`[B2B-API] GET -> ${url}`);
    console.log(`[B2B-API] GET cookies: ${cookieHeader ? "YES" : "NO"}`);

    const javaResp = await fetch(url, {
      method: "GET",
      headers: {
        // Do NOT force Content-Type on GET
        Accept:
          action === "downloadTemplate"
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : action === "invoiceHtml"
            ? "text/html,application/json"
            : "application/json",
        Cookie: cookieHeader,
      },
      signal: controller.signal,
      cache: "no-store",
    });

    console.log(`[B2B-API] GET backend status: ${javaResp.status}`);
    return await buildResponseFromJava(javaResp, action);
  } catch (e: any) {
    console.error("[B2B-API] GET error:", e);

    if (e?.name === "AbortError") {
      return NextResponse.json(
        { ok: false, error: "Request timeout" },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { ok: false, error: e?.message || "Request failed" },
      { status: 500 }
    );
  } finally {
    clearTimeout(timeout);
  }
}

// Actions that should not have a request body
const emptyBodyActions = [
  'updateLine',
  'removeLine',
  'submitDraft',
  'buyerAcceptChanges',
  'startNegotiation',
  'acceptOffer',
  'rejectNegotiation',
  'finalizeNegotiation'
];

/**
 * POST handler for B2B write operations
 * Examples: importExcel, updateLine, submitDraft, updateSupplierDecision, buyerAcceptChanges, removeLine
 */
export async function POST(req: NextRequest) {
  // Read action early so we can pick an appropriate timeout (uploads need more time)
  const searchParams = req.nextUrl.searchParams;
  const action = searchParams.get("action");

  // Default proxy timeout (ms)
  let timeoutMs = Number(process.env.PROXY_TIMEOUT_MS ?? 30000);
  // Increase timeout for long-running upload/import actions
  if (action === "importExcel") {
    timeoutMs = Number(process.env.PROXY_TIMEOUT_MS_IMPORT ?? 120000); // 2 minutes
  }

  const { controller, timeout } = createAbort(timeoutMs);

  try {
    // action already read above

    if (!action) {
      return NextResponse.json(
        { ok: false, error: "action parameter required" },
        { status: 400 }
      );
    }

    const queryString = searchParams.toString();
    const url = `${B2B_SERVLET_URL}?${queryString}`;

    const cookieHeader = req.headers.get("cookie") || "";
    const contentType = req.headers.get("content-type") || "";
    const isMultipart = contentType.includes("multipart/form-data");
    const isEmptyBodyAction = emptyBodyActions.includes(action);

    console.log(`[B2B-API] POST action: ${action}`);
    console.log(`[B2B-API] POST -> ${url}`);
    console.log(
      `[B2B-API] POST cookies:`,
      cookieHeader ? "YES - " + cookieHeader.substring(0, 120) : "NONE"
    );
    console.log(`[B2B-API] POST content-type: ${contentType}`);
    console.log(`[B2B-API] POST empty-body action: ${isEmptyBodyAction}`);

    let javaResp: Response;

    if (isMultipart) {
      // For file uploads (importExcel) forward FormData
      const formData = await req.formData();

      javaResp = await fetch(url, {
        method: "POST",
        headers: {
          // Do NOT set Content-Type here (fetch sets boundary)
          Accept: "application/json",
          Cookie: cookieHeader,
        },
        body: formData,
        signal: controller.signal,
        cache: "no-store",
      });
    } else if (isEmptyBodyAction) {
      // For empty-body actions: do not parse or send a body
      javaResp = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Cookie: cookieHeader,
        },
        // No body parameter
        signal: controller.signal,
        cache: "no-store",
      });
    } else {
      // For JSON requests (makeOffer, updateSupplierDecision, etc.)
      // Use safeReadJson() so empty body doesn't crash.
      const bodyObj = await safeReadJson(req);
      
      // If bodyObj is null (empty or parse failed), send empty object
      const bodyStr = bodyObj !== null ? JSON.stringify(bodyObj) : JSON.stringify({});

      javaResp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: action === "invoiceHtml" ? "text/html,application/json" : "application/json",
          Cookie: cookieHeader,
        },
        body: bodyStr,
        signal: controller.signal,
        cache: "no-store",
      });
    }

    console.log(`[B2B-API] POST backend status: ${javaResp.status}`);
    return await buildResponseFromJava(javaResp, action);
  } catch (e: any) {
    console.error("[B2B-API] POST error:", e);

    if (e?.name === "AbortError") {
      return NextResponse.json(
        { ok: false, error: "Request timeout" },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { ok: false, error: e?.message || "Request failed" },
      { status: 500 }
    );
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Optional HEAD handler
 */
export async function HEAD() {
  return NextResponse.json({ ok: true });
}
