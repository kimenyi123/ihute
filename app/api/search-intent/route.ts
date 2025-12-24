import { NextRequest, NextResponse } from 'next/server';

const JAVA_BACKEND_BASE = process.env.JAVA_BACKEND_BASE || 'http://localhost:8080/Trading';

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

    const backendUrl = `${JAVA_BACKEND_BASE}/SearchIntentServlet`;
    const backendParams = new URLSearchParams();
    
    // Add all params
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        backendParams.append(key, String(value));
      }
    });
    backendParams.append('action', action);

    const response = await fetch(`${backendUrl}?${backendParams.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[search-intent] Backend error (${response.status}):`, errorText);
      return NextResponse.json(
        { ok: false, error: `Backend error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[search-intent] Error:', error);
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

    const backendUrl = `${JAVA_BACKEND_BASE}/SearchIntentServlet`;
    const backendParams = new URLSearchParams();
    
    // Copy all params
    searchParams.forEach((value, key) => {
      backendParams.append(key, value);
    });

    const response = await fetch(`${backendUrl}?${backendParams.toString()}`, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[search-intent] Backend error (${response.status}):`, errorText);
      return NextResponse.json(
        { ok: false, error: `Backend error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[search-intent] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}



