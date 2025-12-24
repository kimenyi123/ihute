'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  XCircle, 
  Download, 
  RefreshCw,
  TrendingUp,
  DollarSign,
  Users,
  Activity,
  Trash2,
  Eye
} from 'lucide-react';
// import { PaymentDashboardDebug } from './payment-dashboard-debug';
import { WebhookMonitor } from './webhook-monitor';

import { paymentDashboardApi } from '@/lib/payment-dashboard-api';
import type { Transaction, SummaryStats, Alert, HealthStatus } from '@/lib/payment-dashboard-api';

// Types imported from payment-dashboard-api.ts

export function PaymentDashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [channelFilter, setChannelFilter] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // Ghost transactions
  const [checkingGhost, setCheckingGhost] = useState(false);
  const [deletingGhost, setDeletingGhost] = useState(false);
  const [ghostResults, setGhostResults] = useState<any>(null);

  // Bulk delete
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [deletingTransactions, setDeletingTransactions] = useState<Set<string>>(new Set());

  // Transaction details modal
  const [selectedTransactionDetails, setSelectedTransactionDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    loadDashboardData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadTransactions(),
        loadSummary(),
        loadAlerts(),
        loadHealth()
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadTransactions = async () => {
    try {
      console.log('📊 Loading transactions...');
      const offset = (currentPage - 1) * pageSize;
      const data = await paymentDashboardApi.getTransactions({
        status: statusFilter === 'all' ? undefined : statusFilter || undefined,
        channel: channelFilter === 'all' ? undefined : channelFilter || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        search: searchQuery || undefined,
        limit: pageSize,
        offset: offset,
      });
      console.log('📊 Transactions response:', data);
      if (data?.data?.transactions) {
        console.log(`✅ Loaded ${data.data.transactions.length} transactions`);
        setTransactions(data.data.transactions);
        setTotalTransactions(data.data.total || 0);
        setHasMore(data.data.has_more || false);
      } else {
        console.warn('⚠️ No transactions in response:', data);
        setTransactions([]);
        setTotalTransactions(0);
        setHasMore(false);
      }
    } catch (error: any) {
      console.error('❌ Error loading transactions:', error);
      setTransactions([]);
      setTotalTransactions(0);
      setHasMore(false);
    }
  };

  // Debounce search query (live search as you type)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 300); // 300ms debounce delay

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, channelFilter, fromDate, toDate, debouncedSearchQuery]);

  // Reload transactions when page changes or filters change
  useEffect(() => {
    const offset = (currentPage - 1) * pageSize;
    const load = async () => {
      try {
        const data = await paymentDashboardApi.getTransactions({
          status: statusFilter === 'all' ? undefined : statusFilter || undefined,
          channel: channelFilter === 'all' ? undefined : channelFilter || undefined,
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
          search: debouncedSearchQuery || undefined,
          limit: pageSize,
          offset: offset,
        });
        if (data?.data?.transactions) {
          setTransactions(data.data.transactions);
          setTotalTransactions(data.data.total || 0);
          setHasMore(data.data.has_more || false);
        } else {
          setTransactions([]);
          setTotalTransactions(0);
          setHasMore(false);
        }
      } catch (error: any) {
        console.error('❌ Error loading transactions:', error);
        setTransactions([]);
        setTotalTransactions(0);
        setHasMore(false);
      }
    };
    load();
  }, [currentPage, statusFilter, channelFilter, fromDate, toDate, debouncedSearchQuery, pageSize]);

  const loadSummary = async () => {
    try {
      const data = await paymentDashboardApi.getSummary({
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      });
      if (data?.data) {
        setSummary(data.data);
      }
    } catch (error: any) {
      console.error('Error loading summary:', error);
      // Don't set summary to null, keep previous data
    }
  };

  const loadAlerts = async () => {
    try {
      const data = await paymentDashboardApi.getAlerts();
      if (data?.data) {
        setAlerts(Array.isArray(data.data) ? data.data : []);
      } else {
        setAlerts([]);
      }
    } catch (error: any) {
      console.error('Error loading alerts:', error);
      setAlerts([]);
    }
  };

  const loadHealth = async () => {
    try {
      const data = await paymentDashboardApi.getHealth();
      if (data?.data) {
        setHealth(data.data);
      }
    } catch (error: any) {
      console.error('Error loading health:', error);
      // Set default health status on error
      setHealth({
        status: 'unhealthy' as const,
        database: 'unknown',
        configuration: 'unknown',
        failure_rate: 0,
        pending_transactions: 0,
        issues: ['Unable to connect to backend'],
        issue_count: 1,
        timestamp: new Date().toISOString(),
      });
    }
  };

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      const blob = await paymentDashboardApi.exportTransactions(format, {
        status: statusFilter === 'all' ? undefined : statusFilter || undefined,
        channel: channelFilter === 'all' ? undefined : channelFilter || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        search: searchQuery || undefined,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transactions_${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting:', error);
      alert('Failed to export transactions');
    }
  };

  const handleCheckGhost = async () => {
    setCheckingGhost(true);
    setGhostResults(null);
    try {
      const transactionIds = transactions.map(tx => tx.transaction_id);
      const result = await paymentDashboardApi.checkGhostTransactions(transactionIds);
      setGhostResults(result.data);
      console.log('Ghost check results:', result.data);
    } catch (error) {
      console.error('Error checking ghost transactions:', error);
      alert('Failed to check ghost transactions');
    } finally {
      setCheckingGhost(false);
    }
  };

  const handleDeleteGhost = async () => {
    if (!ghostResults || !ghostResults.ghost || ghostResults.ghost.length === 0) {
      alert('No ghost transactions to delete');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${ghostResults.ghost.length} ghost transaction(s)?`)) {
      return;
    }

    setDeletingGhost(true);
    try {
      const ghostIds = ghostResults.ghost.map((tx: any) => tx.transaction_id);
      const result = await paymentDashboardApi.deleteGhostTransactions(ghostIds);
      console.log('Delete results:', result.data);
      alert(`Deleted ${result.data.deleted} transaction(s). ${result.data.not_found} were not found in database.`);
      // Reload transactions
      loadTransactions();
      setGhostResults(null);
    } catch (error) {
      console.error('Error deleting ghost transactions:', error);
      alert('Failed to delete ghost transactions');
    } finally {
      setDeletingGhost(false);
    }
  };

  const totalPages = Math.ceil(totalTransactions / pageSize);

  const handleDeleteTransaction = async (transactionId: string) => {
    if (!confirm(`Are you sure you want to delete transaction ${transactionId}?`)) {
      return;
    }

    setDeletingTransactions(prev => new Set(prev).add(transactionId));
    try {
      const result = await paymentDashboardApi.deleteTransaction(transactionId);
      if (result.status === 200) {
        alert('Transaction deleted successfully');
        // Reload transactions
        loadTransactions();
      } else {
        alert(`Failed to delete transaction: ${result.data?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert('Failed to delete transaction');
    } finally {
      setDeletingTransactions(prev => {
        const newSet = new Set(prev);
        newSet.delete(transactionId);
        return newSet;
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTransactions.size === 0) {
      alert('Please select transactions to delete');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedTransactions.size} transaction(s)?`)) {
      return;
    }

    setDeletingGhost(true);
    try {
      const transactionIds = Array.from(selectedTransactions);
      const result = await paymentDashboardApi.deleteGhostTransactions(transactionIds);
      alert(`Deleted ${result.data.deleted} transaction(s). ${result.data.not_found} were not found.`);
      // Reload transactions
      loadTransactions();
      setSelectedTransactions(new Set());
    } catch (error) {
      console.error('Error deleting transactions:', error);
      alert('Failed to delete transactions');
    } finally {
      setDeletingGhost(false);
    }
  };

  const toggleSelectTransaction = (transactionId: string) => {
    setSelectedTransactions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(transactionId)) {
        newSet.delete(transactionId);
      } else {
        newSet.add(transactionId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedTransactions.size === transactions.length) {
      setSelectedTransactions(new Set());
    } else {
      setSelectedTransactions(new Set(transactions.map(tx => tx.transaction_id)));
    }
  };

  const handleViewDetails = async (transactionId: string) => {
    setLoadingDetails(true);
    setSelectedTransactionDetails(null);
    try {
      const result = await paymentDashboardApi.getTransactionDetails(transactionId);
      if (result.status === 200) {
        setSelectedTransactionDetails(result.data);
      } else {
        alert('Failed to load transaction details');
      }
    } catch (error) {
      console.error('Error loading transaction details:', error);
      alert('Failed to load transaction details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", icon: any }> = {
      'VALID': { variant: 'default', icon: CheckCircle },
      'PENDING': { variant: 'secondary', icon: Clock },
      'FAILED': { variant: 'destructive', icon: XCircle },
    };
    const config = variants[status] || { variant: 'outline' as const, icon: Activity };
    const Icon = config.icon || Activity;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'ERROR': return 'destructive';
      case 'WARNING': return 'default';
      case 'INFO': return 'secondary';
      default: return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-600">Loading dashboard...</span>
      </div>
    );
  }

  // Show error state if health check failed
  const hasConnectionError = health?.issues?.some(issue => 
    issue?.toLowerCase().includes('unable to connect') || 
    issue?.toLowerCase().includes('network error')
  ) || false;

  return (
    <div className="space-y-6">
      {/* Connection Error Alert */}
      {hasConnectionError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Connection Error</AlertTitle>
          <AlertDescription>
            Unable to connect to the payment API. Please check:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Backend server is running at {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}</li>
              <li>API URL is correctly configured in .env.local: NEXT_PUBLIC_API_URL</li>
              <li>Endpoints should be accessible at:
                <ul className="list-disc list-inside ml-4 mt-1">
                  <li>{process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/Trading/api/payment/reports/transactions</li>
                  <li>OR {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/payment/reports/transactions</li>
                </ul>
              </li>
              <li>Check browser console (F12) for detailed error messages</li>
              <li>Verify transactions exist in database: SELECT * FROM urubuto_transactions LIMIT 5;</li>
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Debug Tool - Removed per user request */}
      {/* {process.env.NODE_ENV === 'development' && (
        <PaymentDashboardDebug />
      )} */}

      {/* Tabs for Transactions and Webhook Monitor */}
      <Tabs defaultValue="transactions" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="webhook">Webhook Monitor</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="space-y-6">
          {/* Health Status & Alerts */}
      {health && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                System Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Status</span>
                  <Badge variant={health.status === 'healthy' ? 'default' : 'destructive'}>
                    {health.status.toUpperCase()}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Database</span>
                  <span className="text-sm">{health.database}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Failure Rate</span>
                  <span className="text-sm">{health.failure_rate.toFixed(2)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Pending Transactions</span>
                  <span className="text-sm">{health.pending_transactions}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {alerts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Active Alerts ({alerts.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {alerts.slice(0, 3).map((alert, idx) => (
                    <Alert key={idx} variant={getSeverityColor(alert.severity) as any}>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>{alert.type}</AlertTitle>
                      <AlertDescription>{alert.message}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Summary Statistics */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.total_transactions}</div>
              <p className="text-xs text-muted-foreground">
                {summary.success_rate.toFixed(1)}% success rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('en-RW', { 
                  style: 'currency', 
                  currency: 'RWF',
                  minimumFractionDigits: 0 
                }).format(summary.total_amount)}
              </div>
              <p className="text-xs text-muted-foreground">
                Avg: {new Intl.NumberFormat('en-RW', { 
                  style: 'currency', 
                  currency: 'RWF',
                  minimumFractionDigits: 0 
                }).format(summary.avg_amount)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Successful</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{summary.successful}</div>
              <p className="text-xs text-muted-foreground">
                {summary.failed} failed, {summary.pending} pending
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unique Payers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.unique_payers}</div>
              <p className="text-xs text-muted-foreground">
                {summary.payment_channels} payment channels
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Transactions</CardTitle>
              <CardDescription>View and manage payment transactions</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadDashboardData}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleCheckGhost}
                disabled={checkingGhost || transactions.length === 0}
              >
                <Activity className={`h-4 w-4 mr-2 ${checkingGhost ? 'animate-spin' : ''}`} />
                {checkingGhost ? 'Checking...' : 'Check Ghost'}
              </Button>
              {ghostResults && ghostResults.ghost && ghostResults.ghost.length > 0 && (
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={handleDeleteGhost}
                  disabled={deletingGhost}
                >
                  <XCircle className={`h-4 w-4 mr-2 ${deletingGhost ? 'animate-spin' : ''}`} />
                  {deletingGhost ? 'Deleting...' : `Delete ${ghostResults.ghost.length} Ghost`}
                </Button>
              )}
              {selectedTransactions.size > 0 && (
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={handleBulkDelete}
                  disabled={deletingGhost}
                >
                  <XCircle className={`h-4 w-4 mr-2 ${deletingGhost ? 'animate-spin' : ''}`} />
                  {deletingGhost ? 'Deleting...' : `Delete ${selectedTransactions.size} Selected`}
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleExport('csv')}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleExport('json')}
              >
                <Download className="h-4 w-4 mr-2" />
                Export JSON
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={statusFilter || "all"} onValueChange={(value) => setStatusFilter(value === "all" ? "" : value)}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="VALID">Valid</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="channel">Channel</Label>
              <Select value={channelFilter || "all"} onValueChange={(value) => setChannelFilter(value === "all" ? "" : value)}>
                <SelectTrigger id="channel">
                  <SelectValue placeholder="All Channels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Channels</SelectItem>
                  <SelectItem value="MOMO">MOMO</SelectItem>
                  <SelectItem value="AIRTEL_MONEY">Airtel Money</SelectItem>
                  <SelectItem value="CARD">Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="fromDate">From Date</Label>
              <Input
                id="fromDate"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="toDate">To Date</Label>
              <Input
                id="toDate"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="search">Search (Live)</Label>
              <Input
                id="search"
                placeholder="Transaction ID, Slip Number, Payer Code, or Internal ID"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
              {searchQuery && searchQuery !== debouncedSearchQuery && (
                <p className="text-xs text-gray-500 mt-1">Searching...</p>
              )}
            </div>
          </div>

          {/* Ghost Transaction Results */}
          {ghostResults && (
            <Alert className={`mb-4 ${ghostResults.ghost && ghostResults.ghost.length > 0 ? 'border-yellow-500 bg-yellow-50' : 'border-green-500 bg-green-50'}`}>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Ghost Transaction Check Results</AlertTitle>
              <AlertDescription>
                <div className="mt-2">
                  <p>Total Checked: {ghostResults.total_checked || 0}</p>
                  <p className={ghostResults.ghost && ghostResults.ghost.length > 0 ? 'text-yellow-700 font-semibold' : 'text-green-700'}>
                    {ghostResults.ghost && ghostResults.ghost.length > 0 
                      ? `⚠️ Found ${ghostResults.ghost.length} ghost transaction(s) not in database`
                      : '✅ All transactions exist in database'}
                  </p>
                  {ghostResults.ghost && ghostResults.ghost.length > 0 && (
                    <div className="mt-2 text-xs">
                      <p className="font-semibold">Ghost Transactions:</p>
                      <ul className="list-disc list-inside mt-1">
                        {ghostResults.ghost.slice(0, 5).map((tx: any, idx: number) => (
                          <li key={idx}>{tx.transaction_id}</li>
                        ))}
                        {ghostResults.ghost.length > 5 && (
                          <li>... and {ghostResults.ghost.length - 5} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Transactions Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={selectedTransactions.size === transactions.length && transactions.length > 0}
                      onChange={toggleSelectAll}
                      className="cursor-pointer"
                    />
                  </TableHead>
                  <TableHead>Transaction ID</TableHead>
                  <TableHead>Payer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      No transactions found
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((tx) => (
                    <TableRow key={tx.transaction_id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedTransactions.has(tx.transaction_id)}
                          onChange={() => toggleSelectTransaction(tx.transaction_id)}
                          className="cursor-pointer"
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {tx.transaction_id ? (tx.transaction_id.length > 20 ? tx.transaction_id.substring(0, 20) + '...' : tx.transaction_id) : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{tx.payer_names || tx.payer_code}</div>
                          <div className="text-xs text-gray-500">{tx.payer_code}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Intl.NumberFormat('en-RW', { 
                          style: 'currency', 
                          currency: tx.currency || 'RWF',
                          minimumFractionDigits: 0 
                        }).format(tx.amount)}
                      </TableCell>
                      <TableCell>{tx.payment_channel_name || tx.payment_channel}</TableCell>
                      <TableCell>{getStatusBadge(tx.status)}</TableCell>
                      <TableCell className="text-xs">
                        {tx.payment_date_time 
                          ? new Date(tx.payment_date_time).toLocaleString()
                          : tx.created_at ? new Date(tx.created_at).toLocaleString() : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(tx.transaction_id)}
                            disabled={loadingDetails}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteTransaction(tx.transaction_id)}
                            disabled={deletingTransactions.has(tx.transaction_id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="Delete"
                          >
                            <Trash2 className={`h-4 w-4 ${deletingTransactions.has(tx.transaction_id) ? 'animate-spin' : ''}`} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalTransactions > 0 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-600">
                Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalTransactions)} of {totalTransactions} transactions
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages || !hasMore}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="webhook" className="space-y-6">
          <WebhookMonitor />
        </TabsContent>
      </Tabs>

      {/* Transaction Details Modal */}
      <Dialog open={selectedTransactionDetails !== null} onOpenChange={(open) => !open && setSelectedTransactionDetails(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
            <DialogDescription>
              View raw callback data and UrubutoPay verification
            </DialogDescription>
          </DialogHeader>
          {loadingDetails ? (
            <div className="text-center py-8">Loading details...</div>
          ) : selectedTransactionDetails ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-gray-500">Transaction ID</Label>
                  <div className="font-mono text-sm">{selectedTransactionDetails.transaction_id}</div>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Status</Label>
                  <div>{getStatusBadge(selectedTransactionDetails.status)}</div>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Amount (Stored in DB)</Label>
                  <div className="font-semibold">
                    {new Intl.NumberFormat('en-RW', { 
                      style: 'currency', 
                      currency: selectedTransactionDetails.currency || 'RWF',
                      minimumFractionDigits: 0 
                    }).format(selectedTransactionDetails.amount)}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Payment DateTime (Stored in DB)</Label>
                  <div>{selectedTransactionDetails.payment_date_time || 'N/A'}</div>
                </div>
                {selectedTransactionDetails.raw_callback_data && (
                  <>
                    <div>
                      <Label className="text-xs text-gray-500">Amount (From UrubutoPay Callback)</Label>
                      <div className={`font-semibold ${
                        selectedTransactionDetails.raw_callback_amount !== selectedTransactionDetails.amount 
                          ? 'text-red-600' 
                          : 'text-green-600'
                      }`}>
                        {selectedTransactionDetails.raw_callback_amount !== undefined 
                          ? new Intl.NumberFormat('en-RW', { 
                              style: 'currency', 
                              currency: selectedTransactionDetails.currency || 'RWF',
                              minimumFractionDigits: 0 
                            }).format(selectedTransactionDetails.raw_callback_amount)
                          : 'N/A'}
                        {selectedTransactionDetails.raw_callback_amount !== selectedTransactionDetails.amount && (
                          <span className="text-xs ml-2">⚠️ MISMATCH!</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">DateTime (From UrubutoPay Callback)</Label>
                      <div className={selectedTransactionDetails.raw_callback_datetime !== selectedTransactionDetails.payment_date_time ? 'text-red-600' : ''}>
                        {selectedTransactionDetails.raw_callback_datetime || 'N/A'}
                        {selectedTransactionDetails.raw_callback_datetime !== selectedTransactionDetails.payment_date_time && (
                          <span className="text-xs ml-2">⚠️ MISMATCH!</span>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {selectedTransactionDetails.urubuto_verified && selectedTransactionDetails.urubuto_data && (
                <div className="border-t pt-4">
                  <Label className="text-xs text-gray-500 mb-2 block">✅ Verified with UrubutoPay API</Label>
                  <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto">
                    {JSON.stringify(selectedTransactionDetails.urubuto_data, null, 2)}
                  </pre>
                </div>
              )}

              {selectedTransactionDetails.raw_callback_data && (
                <div className="border-t pt-4">
                  <Label className="text-xs text-gray-500 mb-2 block">Raw Callback Data (What UrubutoPay Sent)</Label>
                  <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto">
                    {typeof selectedTransactionDetails.raw_callback_data === 'string'
                      ? selectedTransactionDetails.raw_callback_data
                      : JSON.stringify(selectedTransactionDetails.raw_callback_data, null, 2)}
                  </pre>
                </div>
              )}

              <div className="border-t pt-4">
                <Label className="text-xs text-gray-500 mb-2 block">Full Transaction Data</Label>
                <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto">
                  {JSON.stringify(selectedTransactionDetails, null, 2)}
                </pre>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

