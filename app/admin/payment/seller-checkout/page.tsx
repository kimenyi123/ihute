'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminPaymentSubnav } from '@/components/payment/admin-payment-subnav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { listUrubutoPayers } from '@/lib/admin-urubuto-payers-api';
import { cancelSellerCheckoutCode, listSellerCheckoutRows, type SellerCheckoutRow } from '@/lib/admin-seller-checkout-api';
import { cn } from '@/lib/utils';
import { RefreshCw } from 'lucide-react';

function checkoutStatusBadge(status: string) {
  const s = (status || '').toUpperCase();
  const styles: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-900 border-yellow-300',
    PAID: 'bg-green-100 text-green-800 border-green-300',
    EXPIRED: 'bg-slate-200 text-slate-700 border-slate-300',
    CANCELLED: 'bg-red-100 text-red-800 border-red-300',
  };
  return (
    <Badge variant="outline" className={cn('font-medium', styles[s] || 'bg-gray-100 text-gray-800 border-gray-300')}>
      {status}
    </Badge>
  );
}

export default function AdminSellerCheckoutPage() {
  const [sellerOptions, setSellerOptions] = useState<{ code: string; name: string }[]>([]);
  const [seller, setSeller] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [rows, setRows] = useState<SellerCheckoutRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelBusy, setCancelBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await listUrubutoPayers({ limit: 500, offset: 0 });
        const opts = (res.data.payers || []).map((p) => ({
          code: p.payer_code,
          name: p.payer_names || p.payer_code,
        }));
        if (!cancelled) setSellerOptions(opts);
      } catch {
        if (!cancelled) setSellerOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchRows = useCallback(async () => {
    if (!seller) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await listSellerCheckoutRows({
        seller,
        status: statusFilter === 'all' ? undefined : statusFilter,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        limit: 200,
        offset: 0,
      });
      setRows(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [seller, statusFilter, fromDate, toDate]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const hasPending = useMemo(() => rows.some((r) => (r.status || '').toUpperCase() === 'PENDING'), [rows]);

  useEffect(() => {
    if (!seller || !hasPending) return;
    const id = setInterval(() => {
      void fetchRows();
    }, 15_000);
    return () => clearInterval(id);
  }, [seller, hasPending, fetchRows]);

  async function onCancel(row: SellerCheckoutRow) {
    setCancelBusy(row.payer_code);
    setError(null);
    try {
      await cancelSellerCheckoutCode(row.payer_code);
      await fetchRows();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cancel failed');
    } finally {
      setCancelBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <AdminPaymentSubnav />

      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Seller checkout (BUY…)</h1>
        <p className="text-gray-600">
          Walk-in Urubuto payments minted by seller POS. Read-only listing and cancel for stuck PENDING codes. Refreshes every 15s while any
          PENDING row is visible.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {hasPending && seller && (
        <Alert>
          <AlertTitle>Live watch</AlertTitle>
          <AlertDescription>PENDING checkouts detected — auto-refresh every 15 seconds.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>GET /api/seller-payers — seller is required.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="grid gap-2 min-w-[220px] flex-1">
            <Label>Seller (ALG…)</Label>
            <Select value={seller || undefined} onValueChange={setSeller}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose subscription seller" />
              </SelectTrigger>
              <SelectContent>
                {sellerOptions.map((o) => (
                  <SelectItem key={o.code} value={o.code}>
                    {o.code} — {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 min-w-[160px]">
            <Label>Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="PENDING">PENDING</SelectItem>
                <SelectItem value="PAID">PAID</SelectItem>
                <SelectItem value="EXPIRED">EXPIRED</SelectItem>
                <SelectItem value="CANCELLED">CANCELLED</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 min-w-[160px]">
            <Label htmlFor="from">From (created_at date)</Label>
            <Input id="from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="grid gap-2 min-w-[160px]">
            <Label htmlFor="to">To</Label>
            <Input id="to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <Button type="button" variant="outline" onClick={() => void fetchRows()} disabled={loading || !seller}>
            <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
            Refresh
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Buyer codes</CardTitle>
          <CardDescription>{rows.length} row(s) for selected filters</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>payer_code</TableHead>
                <TableHead>seller</TableHead>
                <TableHead>cart_id</TableHead>
                <TableHead>amount</TableHead>
                <TableHead>status</TableHead>
                <TableHead>expires_at</TableHead>
                <TableHead>paid_at</TableHead>
                <TableHead>transaction_id</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const pending = (row.status || '').toUpperCase() === 'PENDING';
                return (
                  <TableRow key={row.payer_code}>
                    <TableCell className="font-mono text-xs">{row.payer_code}</TableCell>
                    <TableCell className="font-mono text-xs">{row.seller_payer_code || seller}</TableCell>
                    <TableCell className="max-w-[140px] truncate" title={row.cart_id}>
                      {row.cart_id}
                    </TableCell>
                    <TableCell>
                      {row.amount} {row.currency}
                    </TableCell>
                    <TableCell>{checkoutStatusBadge(row.status)}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{row.expires_at || '—'}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{row.paid_at || '—'}</TableCell>
                    <TableCell className="font-mono text-xs max-w-[120px] truncate" title={row.transaction_id || ''}>
                      {row.transaction_id || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!pending || cancelBusy === row.payer_code}
                        onClick={() => void onCancel(row)}
                      >
                        {cancelBusy === row.payer_code ? 'Cancelling…' : 'Cancel'}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!loading && seller && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    No rows. Adjust filters or pick another seller.
                  </TableCell>
                </TableRow>
              )}
              {!seller && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    Select a seller to load BUY… checkout rows.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
