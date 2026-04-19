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
        notifications: []
      }, { status: 401 });
    }
    
    const backendUrl = getServerProxyBackendBase();
    const response = await fetch(
      `${backendUrl}/NotificationServlet?action=getAll&userId=${encodeURIComponent(userId)}`
    );
    
    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Failed to fetch all notifications:', error);
    return NextResponse.json({ 
      ok: false,
      error: 'Failed to fetch notifications',
      notifications: []
    }, { status: 500 });
  }
}
