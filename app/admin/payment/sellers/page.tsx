'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminPaymentSubnav } from '@/components/payment/admin-payment-subnav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  createUrubutoPayer,
  deleteUrubutoPayer,
  getUrubutoPayer,
  listUrubutoPayers,
  updateUrubutoPayer,
  type UrubutoPayerRow,
} from '@/lib/admin-urubuto-payers-api';
import { Eye, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';

function payerStatusBadge(row: UrubutoPayerRow) {
  const paid = row.paid === 1;
  return paid ? (
    <Badge className="bg-green-100 text-green-900 border border-green-300 hover:bg-green-100">Paid (last tx)</Badge>
  ) : (
    <Badge className="bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-100">Awaiting payment</Badge>
  );
}

export default function AdminPaymentSellersPage() {
  const [rows, setRows] = useState<UrubutoPayerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [viewRow, setViewRow] = useState<UrubutoPayerRow | null>(null);
  const [editRow, setEditRow] = useState<UrubutoPayerRow | null>(null);
  const [deleteRow, setDeleteRow] = useState<UrubutoPayerRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const limit = 50;

  const load = useCallback(
    async (nextOffset: number, nextSearch: string, append: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const res = await listUrubutoPayers({ search: nextSearch || undefined, limit, offset: nextOffset });
        const batch = res.data.payers || [];
        setTotal(res.data.total);
        setHasMore(!!res.data.has_more);
        setOffset(nextOffset);
        setRows((prev) => (append ? [...prev, ...batch] : batch));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load payers');
        if (!append) setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [limit]
  );

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    void load(0, debouncedSearch, false);
  }, [debouncedSearch, load]);

  const [formAdd, setFormAdd] = useState({
    payer_code: '',
    payer_names: '',
    payer_phone: '',
    payer_email: '',
    amount: '',
    currency: 'RWF',
    must_pay_total: 'NO',
    comment: '',
  });

  const [formEdit, setFormEdit] = useState({
    payer_names: '',
    payer_phone: '',
    payer_email: '',
    amount: '',
    currency: 'RWF',
    must_pay_total: 'NO',
    comment: '',
  });

  useEffect(() => {
    if (!editRow) return;
    setFormEdit({
      payer_names: editRow.payer_names || '',
      payer_phone: editRow.payer_phone || '',
      payer_email: editRow.payer_email || '',
      amount: String(editRow.amount ?? ''),
      currency: editRow.currency || 'RWF',
      must_pay_total: editRow.must_pay_total || 'NO',
      comment: editRow.comment || '',
    });
  }, [editRow]);

  async function handleCreate() {
    setSubmitting(true);
    setError(null);
    try {
      const amount = parseFloat(formAdd.amount);
      if (!formAdd.payer_code.trim() || !formAdd.payer_names.trim() || !formAdd.payer_phone.trim() || !(amount > 0)) {
        throw new Error('payer_code, payer_names, payer_phone and a positive amount are required');
      }
      await createUrubutoPayer({
        payer_code: formAdd.payer_code.trim(),
        payer_names: formAdd.payer_names.trim(),
        payer_phone: formAdd.payer_phone.trim(),
        payer_email: formAdd.payer_email.trim(),
        amount,
        currency: formAdd.currency || 'RWF',
        must_pay_total: formAdd.must_pay_total,
        comment: formAdd.comment.trim(),
      });
      setAddOpen(false);
      setFormAdd({
        payer_code: '',
        payer_names: '',
        payer_phone: '',
        payer_email: '',
        amount: '',
        currency: 'RWF',
        must_pay_total: 'NO',
        comment: '',
      });
      await load(0, debouncedSearch, false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEditSave() {
    if (!editRow) return;
    setSubmitting(true);
    setError(null);
    try {
      const amount = parseFloat(formEdit.amount);
      if (!(amount > 0)) throw new Error('amount must be positive');
      await updateUrubutoPayer(editRow.payer_code, {
        payer_names: formEdit.payer_names.trim(),
        payer_phone: formEdit.payer_phone.trim(),
        payer_email: formEdit.payer_email.trim(),
        amount,
        currency: formEdit.currency,
        must_pay_total: formEdit.must_pay_total,
        comment: formEdit.comment.trim(),
      });
      setEditRow(null);
      await load(offset, debouncedSearch, false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteRow) return;
    setSubmitting(true);
    setError(null);
    try {
      await deleteUrubutoPayer(deleteRow.payer_code);
      setDeleteRow(null);
      await load(0, debouncedSearch, false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Deactivate failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function openView(row: UrubutoPayerRow) {
    try {
      const fresh = await getUrubutoPayer(row.payer_code);
      setViewRow(fresh.data);
    } catch {
      setViewRow(row);
    }
  }

  return (
    <div className="space-y-6">
      <AdminPaymentSubnav />

      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Urubuto subscription sellers</h1>
        <p className="text-gray-600">
          Onboard pharmacies and shops (ALG… payer codes). This is separate from walk-in BUY… checkout.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Sellers</CardTitle>
            <CardDescription>{total} total · showing {rows.length} loaded</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search code, name, phone (as you type)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-64 max-w-full"
              aria-label="Search payers"
            />
            <Button type="button" variant="outline" size="icon" onClick={() => void load(0, debouncedSearch, false)} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button type="button" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add seller
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payer code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Must pay total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.payer_code}>
                  <TableCell className="font-mono text-sm">{row.payer_code}</TableCell>
                  <TableCell>{row.payer_names}</TableCell>
                  <TableCell>{row.amount}</TableCell>
                  <TableCell>{row.currency}</TableCell>
                  <TableCell>{row.must_pay_total}</TableCell>
                  <TableCell>{payerStatusBadge(row)}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button type="button" variant="ghost" size="icon" onClick={() => void openView(row)} title="View">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setEditRow(row)} title="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-red-600"
                      onClick={() => setDeleteRow(row)}
                      title="Deactivate (remove)"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No payers found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {hasMore && (
            <div className="mt-4 flex justify-center">
              <Button type="button" variant="outline" disabled={loading} onClick={() => void load(offset + limit, debouncedSearch, true)}>
                Load more
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add subscription seller</DialogTitle>
            <DialogDescription>POST /api/payers — matches PayersManagementServlet fields.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label htmlFor="add-code">payer_code (ALG… / TIN)</Label>
              <Input id="add-code" value={formAdd.payer_code} onChange={(e) => setFormAdd((f) => ({ ...f, payer_code: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="add-name">payer_names</Label>
              <Input id="add-name" value={formAdd.payer_names} onChange={(e) => setFormAdd((f) => ({ ...f, payer_names: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="add-phone">payer_phone</Label>
              <Input id="add-phone" value={formAdd.payer_phone} onChange={(e) => setFormAdd((f) => ({ ...f, payer_phone: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="add-email">payer_email (optional)</Label>
              <Input id="add-email" value={formAdd.payer_email} onChange={(e) => setFormAdd((f) => ({ ...f, payer_email: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="add-amount">amount</Label>
                <Input id="add-amount" type="number" step="0.01" value={formAdd.amount} onChange={(e) => setFormAdd((f) => ({ ...f, amount: e.target.value }))} />
              </div>
              <div>
                <Label>currency</Label>
                <Input value={formAdd.currency} onChange={(e) => setFormAdd((f) => ({ ...f, currency: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>must_pay_total</Label>
              <Select value={formAdd.must_pay_total} onValueChange={(v) => setFormAdd((f) => ({ ...f, must_pay_total: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NO">NO</SelectItem>
                  <SelectItem value="YES">YES</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="add-comment">comment</Label>
              <Textarea id="add-comment" value={formAdd.comment} onChange={(e) => setFormAdd((f) => ({ ...f, comment: e.target.value }))} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreate()} disabled={submitting}>
              {submitting ? 'Saving…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewRow} onOpenChange={(o) => !o && setViewRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{viewRow?.payer_code}</DialogTitle>
            <DialogDescription>Subscription payer details</DialogDescription>
          </DialogHeader>
          {viewRow && (
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Name:</span> {viewRow.payer_names}
              </p>
              <p>
                <span className="text-muted-foreground">Phone:</span> {viewRow.payer_phone}
              </p>
              <p>
                <span className="text-muted-foreground">Email:</span> {viewRow.payer_email || '—'}
              </p>
              <p>
                <span className="text-muted-foreground">Amount / currency:</span> {viewRow.amount} {viewRow.currency}
              </p>
              <p>
                <span className="text-muted-foreground">must_pay_total:</span> {viewRow.must_pay_total}
              </p>
              <p>
                <span className="text-muted-foreground">paid flag:</span> {viewRow.paid ?? '—'}
              </p>
              <p>
                <span className="text-muted-foreground">paid_date:</span> {viewRow.paid_date || '—'}
              </p>
              <p>
                <span className="text-muted-foreground">Comment:</span> {viewRow.comment || '—'}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit {editRow?.payer_code}</DialogTitle>
            <DialogDescription>PUT /api/payers/&#123;code&#125; — amount, comment, contact fields.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label>payer_names</Label>
              <Input value={formEdit.payer_names} onChange={(e) => setFormEdit((f) => ({ ...f, payer_names: e.target.value }))} />
            </div>
            <div>
              <Label>payer_phone</Label>
              <Input value={formEdit.payer_phone} onChange={(e) => setFormEdit((f) => ({ ...f, payer_phone: e.target.value }))} />
            </div>
            <div>
              <Label>payer_email</Label>
              <Input value={formEdit.payer_email} onChange={(e) => setFormEdit((f) => ({ ...f, payer_email: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>amount</Label>
                <Input type="number" step="0.01" value={formEdit.amount} onChange={(e) => setFormEdit((f) => ({ ...f, amount: e.target.value }))} />
              </div>
              <div>
                <Label>currency</Label>
                <Input value={formEdit.currency} onChange={(e) => setFormEdit((f) => ({ ...f, currency: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>must_pay_total</Label>
              <Select value={formEdit.must_pay_total} onValueChange={(v) => setFormEdit((f) => ({ ...f, must_pay_total: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NO">NO</SelectItem>
                  <SelectItem value="YES">YES</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>comment</Label>
              <Textarea value={formEdit.comment} onChange={(e) => setFormEdit((f) => ({ ...f, comment: e.target.value }))} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={() => void handleEditSave()} disabled={submitting}>
              {submitting ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteRow} onOpenChange={(o) => !o && setDeleteRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate seller payer?</AlertDialogTitle>
            <AlertDialogDescription>
              This calls DELETE /api/payers for <span className="font-mono">{deleteRow?.payer_code}</span>. Urubuto subscription tracking for this
              code will be removed from the payers table. This cannot be undone from this UI.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={submitting}
            >
              {submitting ? 'Removing…' : 'Deactivate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
