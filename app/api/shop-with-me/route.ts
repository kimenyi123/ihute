import { NextRequest, NextResponse } from 'next/server';
import { getShopWithMeUrl } from '@/lib/backend-config';
import { buildCacheKey, getCached, setCached, DATA_TTL_SEC } from '@/lib/redis-cache';

/**
 * Shop-with-me API: forwards to Java backend with nickname only.
 * Redis first: check cache, then backend (DB).
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const nickname = searchParams.get('nickname');
  const productSearch = searchParams.get('productSearch') ?? searchParams.get('q') ?? '';

  console.log('[API shop-with-me] Received request for nickname:', nickname, 'productSearch:', productSearch || '(none)');

  if (!nickname || !nickname.trim()) {
    return NextResponse.json(
      { ok: false, error: 'Nickname is required' },
      { status: 400 }
    );
  }

  const params: Record<string, string> = { nickname: nickname.trim() };
  if (productSearch.trim()) params.productSearch = productSearch.trim();
  const cacheKey = buildCacheKey('shop-with-me', params);

  const cached = await getCached(cacheKey);
  if (cached) {
    console.log('[API shop-with-me] Redis cache hit');
    try {
      const data = JSON.parse(cached);
      return NextResponse.json(data, {
        headers: { 'X-Cache': 'HIT' },
      });
    } catch {
      // invalid cache, fall through to backend
    }
  }

  try {
    const base = getShopWithMeUrl().replace(/\?.*$/, '').replace(/\/+$/, '');
    const normalizedNickname = nickname.trim();
    let backendUrl = `${base}?nickname=${encodeURIComponent(normalizedNickname)}`;
    if (productSearch.trim()) {
      backendUrl += `&productSearch=${encodeURIComponent(productSearch.trim())}`;
    }
    console.log('[API shop-with-me] Redis miss, fetching from backend:', backendUrl);

    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };
    if (productSearch.trim()) {
      headers['X-Product-Search'] = productSearch.trim();
    }
    const response = await fetch(backendUrl, {
      cache: 'no-store',
      headers,
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
    await setCached(cacheKey, JSON.stringify(data), DATA_TTL_SEC);
    console.log('[API shop-with-me] Success! Cached in Redis');

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[API shop-with-me] Fetch error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch shop data' },
      { status: 500 }
    );
  }
}
