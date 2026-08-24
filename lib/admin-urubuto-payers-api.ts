import { tradingProxyFetchJson } from '@/lib/trading-proxy-fetch';

export interface UrubutoPayerRow {
  payer_code: string;
  payer_names: string;
  payer_phone: string;
  payer_email: string;
  amount: number;
  currency: string;
  must_pay_total: string;
  comment: string;
  created_at: string;
  updated_at: string;
  paid?: number;
  paid_amount?: number;
  paid_date?: string;
}

export interface PayersListResponse {
  data: {
    payers: UrubutoPayerRow[];
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
  status: number;
}

export interface SinglePayerResponse {
  data: UrubutoPayerRow;
  status: number;
}

export interface CreatePayerBody {
  payer_code: string;
  payer_names: string;
  payer_phone: string;
  payer_email?: string;
  amount: number;
  currency?: string;
  must_pay_total?: string;
  comment?: string;
}

export async function listUrubutoPayers(params: {
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<PayersListResponse> {
  const q = new URLSearchParams();
  if (params.search) q.set('search', params.search);
  q.set('limit', String(params.limit ?? 100));
  q.set('offset', String(params.offset ?? 0));
  return tradingProxyFetchJson<PayersListResponse>(`/api/payers?${q}`);
}

export async function getUrubutoPayer(payerCode: string): Promise<SinglePayerResponse> {
  const enc = encodeURIComponent(payerCode);
  return tradingProxyFetchJson<SinglePayerResponse>(`/api/payers/${enc}`);
}

export async function createUrubutoPayer(body: CreatePayerBody): Promise<unknown> {
  return tradingProxyFetchJson(`/api/payers`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateUrubutoPayer(
  payerCode: string,
  body: Partial<{
    payer_names: string;
    payer_phone: string;
    payer_email: string;
    amount: number;
    currency: string;
    must_pay_total: string;
    comment: string;
  }>
): Promise<unknown> {
  const enc = encodeURIComponent(payerCode);
  return tradingProxyFetchJson(`/api/payers/${enc}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function deleteUrubutoPayer(payerCode: string): Promise<unknown> {
  const enc = encodeURIComponent(payerCode);
  return tradingProxyFetchJson(`/api/payers/${enc}`, {
    method: 'DELETE',
  });
}
