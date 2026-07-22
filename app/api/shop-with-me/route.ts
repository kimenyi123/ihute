import { NextRequest, NextResponse } from 'next/server';
import { getShopWithMeUrl, getFetchSuggestionsUrl } from '@/lib/backend-config';
import { buildCacheKey, getCached, setCached, DATA_TTL_SEC } from '@/lib/redis-cache';
import { stripExpiredFromShopWithMeBody } from '@/lib/catalog-expiry-filter';
import { recordSearchEvent } from '@/lib/mysql-search-analytics';
import {
  buildResponseFromTierCache,
  writeTierCachesFromJavaResponse,
  warmTier1FromProducts,
  hydrateProductsWithTier1Sync,
  hasTier2ShopIndex,
  countTier1HitsForProducts,
} from '@/lib/shop-with-me-tier-cache';
import { shouldRunTextSearch } from '@/lib/search-query-min';
import { enrichShopProductsWithOrderSales } from '@/lib/shop-item-order-sales';

/** Shorter Redis TTL when productSearch is present (fresh search results). */
const SEARCH_CACHE_TTL_SEC = 30;

function safeLogTerm(term: string | null | undefined): string {
  if (!term || !term.trim()) return 'null';
  return `"${term.trim().replace(/"/g, "'")}"`;
}

function logCacheShopWithMe(
  nickname: string,
  searchTerm: string,
  detail: string,
): void {
  const nick = (nickname ?? '').trim() || 'unknown';
  const search = searchTerm.trim() ? safeLogTerm(searchTerm) : 'null';
  console.log(`[cache][shopwithme] nickname=${nick} search=${search} ${detail}`);
}

function logResponseShopWithMe(
  nickname: string,
  searchTerm: string,
  productCount: number,
  routeStartMs: number,
): void {
  const nick = (nickname ?? '').trim() || 'unknown';
  const search = searchTerm.trim() ? safeLogTerm(searchTerm) : 'null';
  const elapsed = Date.now() - routeStartMs;
  console.log(
    `[response][shopwithme] nickname=${nick} term=${search} products=${productCount} elapsed_ms=${elapsed}`,
  );
}

function fireSearchEvent(
  request: NextRequest,
  term: string,
  nickname: string,
  resultsCount: number,
): void {
  void recordSearchEvent({
    term,
    source: 'shopwithme',
    shop_nickname: nickname,
    results_count: resultsCount,
    session_id: request.cookies.get('ihute_sid')?.value ?? null,
  }).catch(() => {});
}

function countProducts(data: { sellers?: Array<{ products?: unknown[] }> }): number {
  let n = 0;
  for (const s of data.sellers ?? []) {
    n += s.products?.length ?? 0;
  }
  return n;
}

async function finalizeShopResponse(
  request: NextRequest,
  data: Record<string, unknown>,
  winningVariant: string,
  productSearch: string,
  cacheKey: string,
  cacheTtl: number,
  routeStartMs: number,
): Promise<NextResponse> {
  normalizeBrandAndCategory(data);
  await enrichShopProductsWithOrderSales(data);
  await enrichWithImages(data);

  if (!productSearch.trim()) {
    writeTierCachesFromJavaResponse(winningVariant, data);
    const allProducts: Record<string, unknown>[] = [];
    for (const seller of (data.sellers as Array<{ products?: unknown[] }> | undefined) ?? []) {
      for (const p of seller.products ?? []) {
        if (p && typeof p === 'object') allProducts.push(p as Record<string, unknown>);
      }
    }
    warmTier1FromProducts(allProducts);
  } else {
    for (const seller of (data.sellers as Array<{ products?: unknown[] }> | undefined) ?? []) {
      const products = (seller.products ?? []).filter(
        (p): p is Record<string, unknown> => p != null && typeof p === 'object',
      );
      await hydrateProductsWithTier1Sync(products);
    }
    fireSearchEvent(request, productSearch.trim(), winningVariant, countProducts(data));
  }

  await setCached(cacheKey, JSON.stringify(data), cacheTtl);
  console.log('[API shop-with-me] Success! Cached in Redis', productSearch.trim() ? `(search TTL ${cacheTtl}s)` : '');
  const count = countProducts(data);
  logResponseShopWithMe(winningVariant, productSearch, count, routeStartMs);
  return NextResponse.json(data);
}

/** Ensure each product in the response has brand and category for the client. */
function normalizeBrandAndCategory(data: { sellers?: Array<{ products?: any[] }> }) {
  const sellers = data.sellers || [];
  for (const seller of sellers) {
    const list = seller.products || [];
    for (const p of list) {
      // Brand: only item_fabricant or brand. Do not use item_packet (packet/unit e.g. 100 ml).
      const brand =
        (p as any).item_fabricant ??
        (p as any).brand ??
        null;
      const category =
        (p as any).famille ??
        (p as any).FAMILLE ??
        (p as any).item_department ??
        (p as any).category_id ??
        (p as any).categoryId ??
        null;
      (p as any).brand = brand != null && String(brand).trim() ? String(brand).trim() : null;
      (p as any).category = category != null && String(category).trim() ? String(category).trim() : null;
      (p as any).search_priority = (p as any).search_priority ?? null;
      (p as any).contains_ingredient = (p as any).contains_ingredient ?? false;
      const nested = (p as any).items;
      if (Array.isArray(nested)) {
        for (const item of nested) {
          item.search_priority = item.search_priority ?? null;
          item.contains_ingredient = item.contains_ingredient ?? false;
        }
      }
    }
  }
}

/** Normalize for matching: lowercase, collapse spaces. */
function norm(s: string): string {
  return (s ?? '').toString().trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Build keys to match shop-with-me product to fetchSuggestions product (code preferred, then name). Align with client getItemCode: ITEM_CODE first. */
function productKeys(p: any): { code: string; name: string } {
  const code = (p.ITEM_CODE ?? p.item_code ?? p.item_key_words ?? '').toString().trim();
  const name = norm(p.item_commercial_name ?? p.ITEM_NAME ?? p.item_name ?? '');
  return { code, name };
}

function applyEnrichedImage(
  target: any,
  imageByCode: Map<string, string>,
  imageByName: Map<string, string>
): boolean {
  const { code, name } = productKeys(target);
  const img = (code && imageByCode.get(code)) || (name && imageByName.get(name)) || null;
  if (img) {
    target.image_url = img;
    target.item_image_url = img;
    return true;
  }
  return false;
}

/** Try nicknames the way we build links in Shops list (hyphens) vs DB (often spaces). */
function nicknameLookupVariants(raw: string): string[] {
  const t = raw.trim().toLowerCase();
  if (!t) return [];
  const spaced = t.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
  const hyphenated = spaced.replace(/\s+/g, '-');
  const nospace = spaced.replace(/\s+/g, '');
  const variants = [t, spaced, hyphenated, nospace].filter(Boolean);
  // Alias support: legacy/shared links may use pangolins-burrows while backend nickname is "burrows"
  if (t.includes("pangolin") || spaced.includes("pangolin") || hyphenated.includes("pangolin")) {
    variants.push("burrows");
  }
  return [...new Set(variants)];
}

function shopWithMeResponseLooksGood(data: any): boolean {
  if (!data || data.ok === false) return false;
  const sellers = data.sellers;
  return Array.isArray(sellers) && sellers.length > 0;
}

/** Enrich shop-with-me products with image_url from same source as category_ai (Java fetchSuggestions). */
async function enrichWithImages(data: { sellers?: Array<{ products?: any[]; ISHYIGA_ACCOUNT?: string }> }) {
  const sellers = data.sellers || [];
  for (const seller of sellers) {
    const account = (seller as any).ISHYIGA_ACCOUNT ?? (seller as any).seller_account ?? (seller as any).supplier_account;
    if (!account || !String(account).trim()) continue;

    try {
      // Call Java backend directly (avoid server calling itself in dev).
      const url = `${getFetchSuggestionsUrl()}?supplierProducts=${encodeURIComponent(String(account).trim())}&limit=200&Currency=RWF`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) continue;
      const json = await res.json();
      // Java can return { products: [...] } or a raw array.
      const list = Array.isArray(json) ? json : (json?.products ?? []);
      const imageByCode = new Map<string, string>();
      const imageByName = new Map<string, string>();
      for (const p of list) {
        const img = (p as any).image_url ?? (p as any).item_image_url ?? (p as any).IMAGE_URL ?? (p as any).image;
        if (!img || !String(img).trim()) continue;
        const url = String(img).trim();
        const { code, name } = productKeys(p);
        if (code && !imageByCode.has(code)) imageByCode.set(code, url);
        if (name && !imageByName.has(name)) imageByName.set(name, url);
      }

      const products = seller.products || [];
      let matched = 0;
      for (const p of products) {
        if (applyEnrichedImage(p, imageByCode, imageByName)) matched++;
        const nested = (p as any).items;
        if (Array.isArray(nested)) {
          for (const item of nested) {
            if (applyEnrichedImage(item, imageByCode, imageByName)) matched++;
          }
        }
      }
      if (list.length > 0) {
        console.log('[API shop-with-me] Enrich images:', account, 'catalog=', list.length, 'matched=', matched, 'shop-products=', products.length);
      }
    } catch (e) {
      console.warn('[API shop-with-me] Enrich images for', account, e);
    }
  }
}

/**
 * Shop-with-me API: forwards to Java backend with nickname only.
 * Redis first: check cache, then backend (DB).
 * Response is normalized so each product has brand and category.
 */
export async function GET(request: NextRequest) {
  const routeStartMs = Date.now();
  const searchParams = request.nextUrl.searchParams;
  const nickname = searchParams.get('nickname');
  const rawProductSearch = searchParams.get('productSearch') ?? searchParams.get('q') ?? '';
  const productSearch = shouldRunTextSearch(rawProductSearch) ? rawProductSearch.trim() : '';

  console.log('[API shop-with-me] Received request for nickname:', nickname, 'productSearch:', productSearch || '(none)');

  if (!nickname || !nickname.trim()) {
    logResponseShopWithMe('', productSearch, 0, routeStartMs);
    return NextResponse.json(
      { ok: false, error: 'Nickname is required' },
      { status: 400 }
    );
  }

  const params: Record<string, string> = { nickname: nickname.trim() };
  if (productSearch.trim()) params.productSearch = productSearch.trim();
  const skipCache = searchParams.get('_nocache') === '1' || searchParams.get('cache') === 'no';
  const originalNickname = nickname.trim();
  const hasSearch = !!productSearch.trim();

  if (hasSearch) {
    logCacheShopWithMe(originalNickname, productSearch, 'cache=bypassed');
  }

  // v2 = responses include image_url enrichment from fetchSuggestions
  const cacheKey = buildCacheKey('shop-with-me-v2', params);

  const cached = !skipCache ? await getCached(cacheKey) : null;
  if (cached) {
    console.log('[API shop-with-me] Redis cache hit (legacy v2)');
    try {
      const data = JSON.parse(cached);
      normalizeBrandAndCategory(data);
      await enrichShopProductsWithOrderSales(data);
      if (!hasSearch) {
        const allProducts: Record<string, unknown>[] = [];
        for (const seller of data.sellers ?? []) {
          for (const p of seller.products ?? []) {
            if (p && typeof p === 'object') allProducts.push(p as Record<string, unknown>);
          }
        }
        warmTier1FromProducts(allProducts);
        const tier2Hit = await hasTier2ShopIndex(originalNickname);
        const { hits, total } = await countTier1HitsForProducts(allProducts);
        logCacheShopWithMe(
          originalNickname,
          '',
          `tier2_hit=${tier2Hit} tier1_hits=${hits}/${total} legacy_hit=true`,
        );
      }
      const count = countProducts(data);
      logResponseShopWithMe(originalNickname, productSearch, count, routeStartMs);
      return NextResponse.json(data, {
        headers: { 'X-Cache': 'HIT' },
      });
    } catch {
      // invalid cache, fall through to backend
    }
  }

  if (!skipCache && !hasSearch) {
    for (const variant of nicknameLookupVariants(originalNickname)) {
      const tierData = await buildResponseFromTierCache(variant);
      if (tierData) {
        console.log('[API shop-with-me] Two-tier cache hit for', variant);
        normalizeBrandAndCategory(tierData);
        await enrichShopProductsWithOrderSales(tierData);
        const tierProducts =
          ((tierData.sellers as Array<{ products?: Record<string, unknown>[] }>)?.[0]?.products) ?? [];
        warmTier1FromProducts(tierProducts);
        const { hits, total } = await countTier1HitsForProducts(tierProducts);
        logCacheShopWithMe(
          variant,
          '',
          `tier2_hit=true tier1_hits=${hits}/${total} legacy_hit=false`,
        );
        const count = countProducts(tierData);
        logResponseShopWithMe(variant, productSearch, count, routeStartMs);
        return NextResponse.json(tierData, { headers: { 'X-Cache': 'TIER-HIT' } });
      }
    }
    logCacheShopWithMe(originalNickname, '', 'tier2_hit=false tier1_hits=0/0 legacy_hit=false');
  }

  try {
    const base = getShopWithMeUrl().replace(/\?.*$/, '').replace(/\/+$/, '');
    const variants = nicknameLookupVariants(originalNickname);
    const headersBase: Record<string, string> = { Accept: 'application/json' };
    if (productSearch.trim()) {
      headersBase['X-Product-Search'] = productSearch.trim();
    }

    let data: any = null;
    let lastStatus = 502;
    let winningVariant = originalNickname;

    for (const variant of variants) {
      let backendUrl = `${base}?nickname=${encodeURIComponent(variant)}`;
      if (productSearch.trim()) {
        backendUrl += `&productSearch=${encodeURIComponent(productSearch.trim())}`;
      }
      console.log('[API shop-with-me] Redis miss, trying backend nickname variant:', variant);

      const response = await fetch(backendUrl, {
        cache: 'no-store',
        headers: { ...headersBase },
      });

      console.log('[API shop-with-me] Backend response status:', response.status, 'variant:', variant);

      if (!response.ok) {
        lastStatus = response.status;
        continue;
      }

      const parsed = await response.json();
      stripExpiredFromShopWithMeBody(parsed);
      if (shopWithMeResponseLooksGood(parsed)) {
        data = parsed;
        winningVariant = variant;
        break;
      }
      data = parsed;
      lastStatus = response.status;
    }

    if (!shopWithMeResponseLooksGood(data)) {
      if (data && typeof data === 'object') {
        normalizeBrandAndCategory(data);
        logResponseShopWithMe(originalNickname, productSearch, 0, routeStartMs);
        // 200 + ok:false so the client shows "Shop not found" (it treats !res.ok as a generic HTTP error).
        return NextResponse.json({
          ...data,
          ok: false,
          sellers: data.sellers ?? [],
          error: data.error ?? 'Shop not found',
        });
      }
      logResponseShopWithMe(originalNickname, productSearch, 0, routeStartMs);
      return NextResponse.json({
        ok: false,
        error: lastStatus >= 400 ? `Backend error: ${lastStatus}` : 'Shop not found',
        sellers: [],
      });
    }

    if (winningVariant !== originalNickname.toLowerCase()) {
      console.log('[API shop-with-me] Resolved nickname', originalNickname, '→', winningVariant);
    }

    const cacheTtl = hasSearch ? SEARCH_CACHE_TTL_SEC : DATA_TTL_SEC;
    return finalizeShopResponse(request, data, winningVariant, productSearch, cacheKey, cacheTtl, routeStartMs);
  } catch (error: any) {
    console.error('[API shop-with-me] Fetch error:', error);
    logResponseShopWithMe(originalNickname, productSearch, 0, routeStartMs);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch shop data' },
      { status: 500 }
    );
  }
}
