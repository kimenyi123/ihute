import { NextRequest, NextResponse } from 'next/server';
import { getServerProxyBackendBase } from "@/lib/backend-config";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, title, message, actionUrl, notificationType } = body;
    
    if (!userId || !title || !message) {
      return NextResponse.json({ 
        ok: false, 
        error: 'userId, title, and message are required' 
      }, { status: 400 });
    }
    
    const backendUrl = getServerProxyBackendBase();
    
    // Call the Java backend to create the notification
    const response = await fetch(
      `${backendUrl}/TestNotificationServlet`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          action: 'createTestNotification',
          userId,
          title,
          message,
          actionUrl: actionUrl || '/',
          notificationType: notificationType || 'test'
        })
      }
    );
    
    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Failed to create test notification:', error);
    return NextResponse.json({ 
      ok: false,
      error: 'Failed to create notification: ' + (error as Error).message
    }, { status: 500 });
  }
}
