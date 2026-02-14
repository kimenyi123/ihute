import { NextRequest, NextResponse } from 'next/server';
import { getShopWithMeUrl } from '@/lib/backend-config';

/**
 * Shop-with-me API: forwards to Java backend with nickname only.
 * Frontend URLs can be dynamic, e.g.:
 *   /shop-with-me?nickname=burrows&table=table%204
 *   /shop-with-me/burrows?table=table%204
 * Backend is called with nickname only: .../shop_with_me?nickname=burrows
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const nickname = searchParams.get('nickname');

  console.log('[API shop-with-me] Received request for nickname:', nickname);

  if (!nickname || !nickname.trim()) {
    return NextResponse.json(
      { ok: false, error: 'Nickname is required' },
      { status: 400 }
    );
  }

  try {
    const base = getShopWithMeUrl().replace(/\?.*$/, '').replace(/\/+$/, '');
    const normalizedNickname = nickname.trim();
    const backendUrl = `${base}?nickname=${encodeURIComponent(normalizedNickname)}`;
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
