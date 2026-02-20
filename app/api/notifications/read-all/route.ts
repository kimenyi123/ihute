import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Get userId from query params (client-side auth uses localStorage, not cookies)
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }
    
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8080/Trading';
    const response = await fetch(
      `${backendUrl}/NotificationServlet?action=markAllRead&userId=${encodeURIComponent(userId)}`,
      { method: 'POST' }
    );
    
    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Failed to mark all as read:', error);
    return NextResponse.json({ ok: false, error: 'Failed to mark all as read' }, { status: 500 });
  }
}
