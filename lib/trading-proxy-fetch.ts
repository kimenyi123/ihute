/**
 * Build URLs for the Java /Trading backend. In the browser, paths listed in
 * `isProxiedPath` use relative URLs so Next.js rewrites avoid CORS.
 */

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://ihute.rw')
  .trim()
  .replace(/\/+$/, '');

function isProxiedPath(cleanEndpoint: string): boolean {
  return (
    cleanEndpoint.startsWith('/api/payment') ||
    cleanEndpoint.startsWith('/api/analytics') ||
    cleanEndpoint.startsWith('/api/payers') ||
    cleanEndpoint.startsWith('/api/seller-payers') ||
    cleanEndpoint.startsWith('/api/seller-payments')
  );
}

export function buildTradingApiUrls(endpoint: string): string[] {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  if (typeof window !== 'undefined' && isProxiedPath(cleanEndpoint)) {
    return [cleanEndpoint];
  }

  const hasTrading = API_BASE_URL.includes('/Trading');
  if (hasTrading) {
    return [`${API_BASE_URL}${cleanEndpoint}`];
  }
  return [`${API_BASE_URL}/Trading${cleanEndpoint}`, `${API_BASE_URL}${cleanEndpoint}`];
}

/**
 * JSON fetch with Trading base fallbacks (same behaviour as PaymentDashboardApi private fetch).
 */
export async function tradingProxyFetchJson<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const urls = buildTradingApiUrls(endpoint);
  let lastError: Error | null = null;

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        let errorMessage = response.statusText;
        try {
          const errBody = await response.json();
          errorMessage = (errBody as { message?: string }).message || errorMessage;
        } catch {
          /* use statusText */
        }

        if (response.status === 404) {
          const msg = (errorMessage || '').toString();
          const looksLikeEndpointMissing = !msg || msg.toLowerCase().includes('not found');
          if (!looksLikeEndpointMissing) {
            throw new Error(msg || `404 ${endpoint}`);
          }
          lastError = new Error(`404: ${endpoint} not found at ${url}`);
          continue;
        }

        throw new Error(errorMessage || `API error: ${response.status}`);
      }

      const ct = response.headers.get('content-type') || '';
      const rawText = await response.text();
      if (!rawText.trim()) {
        return {} as T;
      }
      if (ct.includes('application/json')) {
        try {
          return JSON.parse(rawText) as T;
        } catch {
          return rawText as unknown as T;
        }
      }
      try {
        return JSON.parse(rawText) as T;
      } catch {
        return rawText as unknown as T;
      }
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        lastError = new Error(`Network error: Unable to connect to ${url}`);
        continue;
      }
      if (!(error instanceof Error && error.message.includes('404'))) {
        throw error;
      }
      lastError = error as Error;
    }
  }

  throw lastError || new Error(`Failed to fetch ${endpoint}`);
}
