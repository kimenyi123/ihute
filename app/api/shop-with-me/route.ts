import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const nickname = searchParams.get('nickname');

  console.log('[API shop-with-me] Received request for nickname:', nickname);

  if (!nickname) {
    return NextResponse.json(
      { ok: false, error: 'Nickname is required' },
      { status: 400 }
    );
  }

  try {
    const backendUrl = `http://localhost:8081/Trading/shop_with_me?nickname=${encodeURIComponent(nickname)}`;
    console.log('[API shop-with-me] Fetching from backend:', backendUrl);

    const response = await fetch(backendUrl, {
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
      },
    });

    console.log('[API shop-with-me] Backend response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API shop-with-me] Backend error:', errorText);
      return NextResponse.json(
        { ok: false, error: `Backend error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[API shop-with-me] Success! Returning data');

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[API shop-with-me] Fetch error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch shop data' },
      { status: 500 }
    );
  }
}
