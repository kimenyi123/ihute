import { NextRequest, NextResponse } from 'next/server';
import { getShopWithMeUrl } from '@/lib/backend-config';
import { buildCacheKey, getCached, setCached, DATA_TTL_SEC } from '@/lib/redis-cache';
import { stripExpiredFromShopWithMeBody } from '@/lib/catalog-expiry-filter';

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

  const original = nickname.trim();
  const productSearchTrimmed = productSearch.trim();

  // Some nicknames are stored with/without apostrophes/spaces.
  // Example: "pangolin's burrows" vs "pangolinsburrows".
  const candidates: string[] = Array.from(
    new Set([
      original,
      original.toLowerCase(),
      original.replace(/[’']/g, ''), // remove apostrophes
      original.replace(/[’']/g, '').replace(/\s+/g, ''), // apostrophes + spaces
      original.toLowerCase().replace(/[^a-z0-9]/g, ''), // alphanumerics only
    ]),
  ).filter(Boolean);

  const base = getShopWithMeUrl().replace(/\?.*$/, '').replace(/\/+$/, '');

  for (const candidate of candidates) {
    const params: Record<string, string> = { nickname: candidate };
    if (productSearchTrimmed) params.productSearch = productSearchTrimmed;
    const cacheKey = buildCacheKey('shop-with-me', params);

    const cached = await getCached(cacheKey);
    if (cached) {
      console.log('[API shop-with-me] Redis cache hit for variant');
      try {
        const data = JSON.parse(cached);
        stripExpiredFromShopWithMeBody(data);
        const sellers = Array.isArray(data?.sellers) ? data.sellers : [];
        if (data?.ok === true && sellers.length > 0) {
          return NextResponse.json(data, { headers: { 'X-Cache': 'HIT' } });
        }
        // If cached result had 0 sellers, try next variant.
      } catch {
        // invalid cache, fall through
      }
    }

    try {
      let backendUrl = `${base}?nickname=${encodeURIComponent(candidate)}`;
      if (productSearchTrimmed) {
        backendUrl += `&productSearch=${encodeURIComponent(productSearchTrimmed)}`;
      }

      console.log('[API shop-with-me] Fetching backend for variant:', candidate, backendUrl);

      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };
      if (productSearchTrimmed) headers['X-Product-Search'] = productSearchTrimmed;

      const response = await fetch(backendUrl, {
        cache: 'no-store',
        headers,
      });

      console.log('[API shop-with-me] Backend response status:', response.status);

      if (!response.ok) {
        // Try next candidate.
        continue;
      }

      const data = await response.json();
      stripExpiredFromShopWithMeBody(data);
      const sellers = Array.isArray(data?.sellers) ? data.sellers : [];

      // Only cache successful non-empty seller results.
      if (data?.ok === true && sellers.length > 0) {
        await setCached(cacheKey, JSON.stringify(data), DATA_TTL_SEC);
        console.log('[API shop-with-me] Success! Cached sellers in Redis');
        return NextResponse.json(data);
      }

      // If no sellers for this variant, try next candidate.
    } catch {
      // Try next candidate
    }
  }

  // If all variants failed, return canonical error.
  return NextResponse.json(
    {
      ok: false,
      error: 'No sellers found with this nickname',
      sellers: [],
      count: 0,
      query: original,
    },
    { status: 200 },
  );
}
