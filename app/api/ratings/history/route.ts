import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('userEmail');
    
    if (!userEmail) {
      return NextResponse.json({ ok: false, error: 'userEmail is required' }, { status: 400 });
    }
    
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8080/Trading';
    const response = await fetch(
      `${backendUrl}/Kaos/RatingServlet?action=getRatingHistory&userEmail=${encodeURIComponent(userEmail)}`
    );
    
    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Failed to fetch rating history:', error);
    return NextResponse.json({ ok: false, error: 'Failed to fetch rating history' }, { status: 500 });
  }
}
