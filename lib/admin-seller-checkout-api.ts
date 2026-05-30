import { tradingProxyFetchJson, buildTradingApiUrls } from '@/lib/trading-proxy-fetch';

export type SellerCheckoutStatus = 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED';

export interface SellerCheckoutRow {
  payer_code: string;
  seller_payer_code: string;
  cart_id: string;
  status: SellerCheckoutStatus | string;
  amount: number;
  currency: string;
  id_client: string | null;
  expires_at: string | null;
  paid_at: string | null;
  transaction_id: string | null;
  created_at: string | null;
}

export async function listSellerCheckoutRows(params: {
  seller: string;
  status?: string;
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
}): Promise<SellerCheckoutRow[]> {
  const q = new URLSearchParams();
  q.set('seller', params.seller);
  if (params.status) q.set('status', params.status);
  if (params.from_date) q.set('from_date', params.from_date);
  if (params.to_date) q.set('to_date', params.to_date);
  q.set('limit', String(params.limit ?? 200));
  q.set('offset', String(params.offset ?? 0));

  const endpoint = `/api/seller-payers?${q}`;
  const urls = buildTradingApiUrls(endpoint);
  let lastError: Error | null = null;

  for (const url of urls) {
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || response.statusText);
      }
      return (await response.json()) as SellerCheckoutRow[];
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastError || new Error('Failed to load seller checkout rows');
}

export async function cancelSellerCheckoutCode(payerCode: string): Promise<{ cancelled: boolean; previous_status?: string }> {
  const enc = encodeURIComponent(payerCode);
  return tradingProxyFetchJson<{ cancelled: boolean; previous_status?: string }>(
    `/api/seller-payers/${enc}/cancel`,
    { method: 'POST', body: '{}' }
  );
}
