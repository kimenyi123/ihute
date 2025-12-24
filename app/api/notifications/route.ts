import { NextRequest, NextResponse } from 'next/server';

const JAVA_BACKEND_BASE = process.env.JAVA_BACKEND_BASE || 'http://localhost:8080/Trading';

/**
 * Notifications API Route
 * Proxies requests to the Java NotificationServlet backend
 * 
 * Actions:
 * - subscribe: Register push subscription
 * - unsubscribe: Remove push subscription
 * - markOpened: Mark notification as opened
 * - markIgnored: Mark notification as ignored
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, ...params } = body;

    if (!action) {
      return NextResponse.json(
        { ok: false, error: 'action parameter is required' },
        { status: 400 }
      );
    }

    console.log(`[notifications] Action: ${action}`, params);

    const backendUrl = `${JAVA_BACKEND_BASE}/NotificationServlet`;
    const backendParams = new URLSearchParams();
    
    // Add action
    backendParams.append('action', action);
    
    // Add all other params
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        backendParams.append(key, String(value));
      }
    });

    console.log(`[notifications] Calling backend: ${backendUrl}?action=${action}`);

    const response = await fetch(`${backendUrl}?${backendParams.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    // Try to parse response
    let data;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      // Try to parse as JSON anyway
      try {
        data = JSON.parse(text);
      } catch {
        // If not JSON, wrap in response object
        data = { ok: response.ok, message: text };
      }
    }

    if (!response.ok) {
      console.error(`[notifications] Backend error (${response.status}):`, data);
      return NextResponse.json(
        { ok: false, error: data.error || `Backend error: ${response.status}` },
        { status: response.status }
      );
    }

    console.log(`[notifications] Success:`, data);
    return NextResponse.json({ ok: true, ...data });
  } catch (error: any) {
    console.error('[notifications] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const action = searchParams.get('action');

    if (!action) {
      return NextResponse.json(
        { ok: false, error: 'action parameter is required' },
        { status: 400 }
      );
    }

    const backendUrl = `${JAVA_BACKEND_BASE}/NotificationServlet`;
    const backendParams = new URLSearchParams();
    
    // Copy all params
    searchParams.forEach((value, key) => {
      backendParams.append(key, value);
    });

    console.log(`[notifications] GET: ${backendUrl}?${backendParams.toString()}`);

    const response = await fetch(`${backendUrl}?${backendParams.toString()}`, {
      method: 'GET',
    });

    // Try to parse response
    let data;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = { ok: response.ok, message: text };
      }
    }

    if (!response.ok) {
      console.error(`[notifications] Backend error (${response.status}):`, data);
      return NextResponse.json(
        { ok: false, error: data.error || `Backend error: ${response.status}` },
        { status: response.status }
      );
    }

    return NextResponse.json({ ok: true, ...data });
  } catch (error: any) {
    console.error('[notifications] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}














