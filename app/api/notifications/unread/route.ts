import { NextRequest, NextResponse } from 'next/server';
import { getServerProxyBackendBase } from "@/lib/backend-config";

export async function GET(request: NextRequest) {
  try {
    // Get userId from query params (client-side auth uses localStorage, not cookies)
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Not authenticated',
        notifications: [],
        count: 0
      }, { status: 401 });
    }
    
    const backendUrl = getServerProxyBackendBase();
    const response = await fetch(
      `${backendUrl}/NotificationServlet?action=getUnread&userId=${encodeURIComponent(userId)}`
    );

    const text = await response.text();
    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json') && response.ok;
    if (!isJson || text.trim().startsWith('<')) {
      return NextResponse.json({
        ok: true,
        notifications: [],
        count: 0,
      }, { status: 200 });
    }

    let data: { ok?: boolean; notifications?: unknown[]; count?: number };
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json({ ok: true, notifications: [], count: 0 }, { status: 200 });
    }
    return NextResponse.json(data);

  } catch (error) {
    console.error('Failed to fetch notifications:', error);
    return NextResponse.json({ 
      ok: false,
      error: 'Failed to fetch notifications',
      notifications: [],
      count: 0
    }, { status: 500 });
  }
}
