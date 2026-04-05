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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
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
  Eye,
  Search,
  X,
  UserCheck
} from 'lucide-react';
// import { PaymentDashboardDebug } from './payment-dashboard-debug';
import { WebhookMonitor } from './webhook-monitor';

import { paymentDashboardApi } from '@/lib/payment-dashboard-api';
import type { Transaction, SummaryStats, Alert as AlertItem, HealthStatus } from '@/lib/payment-dashboard-api';

// Types
interface PaymentDashboardFilters {
  status?: string;
  channel?: string;
  from_date?: string;
  to_date?: string;
  search?: string;
}

interface PaymentDashboardProps {
  initialFilters?: Partial<PaymentDashboardFilters>;
}

/**
 * Convert payment timestamp to local time for display.
 * UrubutoPay sends: "26/02/2026 14:33:24" (DD/MM/YYYY HH:MM:SS) or ISO "2026-01-10T08:29:33.609Z"
 */
const formatUTCTimestamp = (timestamp: string | null | undefined): string => {
  if (!timestamp) return 'N/A';

  try {
    // Handle ISO format with Z or T
    if (timestamp.includes('Z') || timestamp.includes('T')) {
      return new Date(timestamp).toLocaleString();
    }

    // UrubutoPay format: "DD/MM/YYYY HH:MM:SS" (e.g. "26/02/2026 14:33:24")
    const ddmmyyyy = timestamp.trim().split(/\s+/);
    if (ddmmyyyy.length >= 2) {
      const [datePart, timePart] = ddmmyyyy;
      const parts = datePart.split('/');
      if (parts.length === 3) {
        const [dd, mm, yyyy] = parts;
        // new Date(year, monthIndex, day, hour, minute, second) - monthIndex 0-based
        const year = parseInt(yyyy, 10);
        const month = parseInt(mm, 10) - 1;
        const day = parseInt(dd, 10);
        const time = timePart.split(':').map((n) => parseInt(n, 10));
        const hour = time[0] ?? 0;
        const minute = time[1] ?? 0;
        const second = time[2] ?? 0;
        const dateObj = new Date(year, month, day, hour, minute, second);
        if (!isNaN(dateObj.getTime())) {
          return dateObj.toLocaleString();
        }
      }
    }

    // Fallback: "YYYY-MM-DD HH:MM:SS" with Z
    const dateObj = new Date(timestamp + 'Z');
    return isNaN(dateObj.getTime()) ? timestamp : dateObj.toLocaleString();
  } catch (error) {
    console.error('Error parsing timestamp:', timestamp, error);
    return timestamp;
  }
};

const isValidTransactionId = (id: string | null | undefined): boolean => {
  if (!id) return false;
  const v = id.trim();
  return v.length > 0 && v.toLowerCase() !== 'null';
};

const toComparableEpoch = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const s = value.trim();
  if (!s) return null;

  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (m) {
    const [, dd, mm, yyyy, hh, mi, ss] = m;
    const dt = new Date(
      parseInt(yyyy, 10),
      parseInt(mm, 10) - 1,
      parseInt(dd, 10),
      parseInt(hh, 10),
      parseInt(mi, 10),
      parseInt(ss, 10)
    );
    return isNaN(dt.getTime()) ? null : dt.getTime();
  }

  const isoLike = s.replace(' ', 'T');
  const dt = new Date(isoLike);
  return isNaN(dt.getTime()) ? null : dt.getTime();
};

const isSameDateTime = (a: string | null | undefined, b: string | null | undefined): boolean => {
  const ea = toComparableEpoch(a);
  const eb = toComparableEpoch(b);
  if (ea === null || eb === null) return (a || '').trim() === (b || '').trim();
  return Math.abs(ea - eb) <= 1000;
};

export default function PaymentDashboard({ initialFilters }: PaymentDashboardProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters - no date filter by default to show ALL transactions
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [activationFilter, setActivationFilter] = useState<string>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>('');
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('date_desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // Ghost transactions
  const [checkingGhost, setCheckingGhost] = useState(false);
  const [deletingGhost, setDeletingGhost] = useState(false);
  const [ghostResults, setGhostResults] = useState<any>(null);
  const [syncingStale, setSyncingStale] = useState(false);
  const [syncPreview, setSyncPreview] = useState<any>(null);

  // Bulk delete
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [deletingTransactions, setDeletingTransactions] = useState<Set<string>>(new Set());

  // Transaction details modal
  const [selectedTransactionDetails, setSelectedTransactionDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Activate (grant user access) for VALID payments
  const [activatingTransactionId, setActivatingTransactionId] = useState<string | null>(null);
  const [activateDialogTx, setActivateDialogTx] = useState<Transaction | null>(null);
  const [activateValidUntil, setActivateValidUntil] = useState<string>('');
  const [activateGracePeriodDays, setActivateGracePeriodDays] = useState<string>('0');

  // Alert details modal
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null);
  const [alertPendingTransactions, setAlertPendingTransactions] = useState<Transaction[]>([]);
  const [loadingAlertPendingTransactions, setLoadingAlertPendingTransactions] = useState(false);

  // Analytics charts
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);

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
        loadHealth(),
        loadAnalytics()
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadAnalytics = async () => {
    try {
      const data = await paymentDashboardApi.getAnalyticsCharts({ days: 30 });
      if (data?.data) {
        setAnalyticsData(data.data);
      }
    } catch (error: any) {
      console.error('Error loading analytics:', error);
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
        activated: activationFilter === 'all' ? undefined : activationFilter === 'activated' ? 'true' : 'false',
        limit: pageSize,
        offset: offset,
      });
      console.log('📊 Transactions response:', data);
      if (data?.data?.transactions) {
        const validTransactions = data.data.transactions.filter((tx: Transaction) =>
          isValidTransactionId(tx.transaction_id)
        );
        console.log(`✅ Loaded ${validTransactions.length} transactions`);
        setTransactions(validTransactions);
        setTotalTransactions(data.data.total || validTransactions.length);
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
  }, [statusFilter, channelFilter, activationFilter, fromDate, toDate, debouncedSearchQuery]);

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
          activated: activationFilter === 'all' ? undefined : activationFilter === 'activated' ? 'true' : 'false',
          limit: pageSize,
          offset: offset,
        });
        if (data?.data?.transactions) {
          const validTransactions = data.data.transactions.filter((tx: Transaction) =>
            isValidTransactionId(tx.transaction_id)
          );
          setTransactions(validTransactions);
          setTotalTransactions(data.data.total || validTransactions.length);
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
  }, [currentPage, statusFilter, channelFilter, activationFilter, fromDate, toDate, debouncedSearchQuery, pageSize]);

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
      const transactionIds = transactions.map(tx => tx.transaction_id).filter(isValidTransactionId);
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

  const handleSyncStale = async () => {
    setSyncingStale(true);
    try {
      const result = await paymentDashboardApi.syncStaleTransactions({
        age_minutes: 30,
        limit: 200,
      });
      const data = result?.data || {};
      setSyncPreview(data);
      alert(
        `Sync complete.\nPending total: ${data.pending_total ?? 0}\nPending with valid ID: ${data.pending_with_valid_id ?? 0}\nPending with invalid ID (skipped): ${data.pending_with_invalid_id ?? 0}\nCandidates: ${data.candidates ?? 0}\nChecked: ${data.checked ?? 0}\nUpdated: ${data.updated ?? 0}\nFailed: ${data.failed ?? 0}`
      );
      await loadDashboardData();
    } catch (error) {
      console.error('Error syncing stale transactions:', error);
      alert('Failed to sync stale transactions');
    } finally {
      setSyncingStale(false);
    }
  };

  const loadAlertPendingTransactions = async () => {
    setLoadingAlertPendingTransactions(true);
    try {
      const data = await paymentDashboardApi.getTransactions({
        status: 'PENDING',
        limit: 200,
        offset: 0,
      });
      const validTransactions = (data?.data?.transactions || []).filter((tx: Transaction) =>
        isValidTransactionId(tx.transaction_id)
      );
      setAlertPendingTransactions(validTransactions);
    } catch (error) {
      console.error('Error loading pending transactions for alert modal:', error);
      setAlertPendingTransactions([]);
    } finally {
      setLoadingAlertPendingTransactions(false);
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

  function defaultValidUntilDate(paymentDateTime?: string | null): string {
    let base = new Date();
    if (paymentDateTime && paymentDateTime.trim()) {
      const s = paymentDateTime.trim();
      if (s.length >= 10) {
        if (s[2] === '/' && s[5] === '/') {
          const [d, m, y] = s.split(/[/\s]/);
          if (d && m && y) base = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
        } else if (s[4] === '-' && s[7] === '-') {
          base = new Date(s.substring(0, 10));
        }
      }
    }
    base.setMonth(base.getMonth() + 1);
    return base.toISOString().slice(0, 10);
  }

  const openActivateDialog = (tx: Transaction) => {
    setActivateDialogTx(tx);
    setActivateValidUntil(defaultValidUntilDate(tx.payment_date_time));
    setActivateGracePeriodDays('0');
  };

  const handleActivateConfirm = async () => {
    if (!activateDialogTx) return;
    const transactionId = activateDialogTx.transaction_id;
    setActivatingTransactionId(transactionId);
    try {
      const result = await paymentDashboardApi.activateTransaction(transactionId, {
        valid_payment_time: activateValidUntil || undefined,
        grace_period_days: Math.max(0, Number(activateGracePeriodDays || '0')),
      }) as {
        status: number;
        message?: string;
        activated_until?: string;
        valid_payment_time?: string;
        ishyiga_updated?: boolean;
        ishyiga_message?: string;
      };
      if (result.status === 200) {
        setActivateDialogTx(null);
        const until = result.activated_until || result.valid_payment_time;
        let message = until
          ? `User access activated successfully. Active until ${until}.`
          : 'User access activated successfully.';
        if (result.ishyiga_updated === false && result.ishyiga_message) {
          message += '\n\n' + result.ishyiga_message;
        }
        alert(message);
        loadTransactions();
      } else {
        const msg = result.message || 'Failed to activate';
        alert(msg);
      }
    } catch (error) {
      console.error('Error activating transaction:', error);
      alert(error instanceof Error ? error.message : 'Failed to activate');
    } finally {
      setActivatingTransactionId(null);
    }
  };

  const handleActivate = (tx: Transaction) => {
    openActivateDialog(tx);
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
              <li>Backend server is running at {process.env.NEXT_PUBLIC_API_URL || "https://ihute.rw"}</li>
              <li>API URL is correctly configured in .env.local: NEXT_PUBLIC_API_URL</li>
              <li>Endpoints should be accessible at:
                <ul className="list-disc list-inside ml-4 mt-1">
                  <li>{process.env.NEXT_PUBLIC_API_URL || "https://ihute.rw"}/Trading/api/payment/reports/transactions</li>
                  <li>OR {process.env.NEXT_PUBLIC_API_URL || "https://ihute.rw"}/api/payment/reports/transactions</li>
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
                <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-orange-500" />
                      Active Alerts ({alerts.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {alerts.slice(0, 3).map((alert, idx) => (
                        <Alert
                          key={idx}
                          variant={getSeverityColor(alert.severity) as any}
                          className="cursor-pointer"
                          onClick={() => {
                            setSelectedAlert(alert);
                            if (alert.type === 'OLD_PENDING_TRANSACTIONS') {
                              loadAlertPendingTransactions();
                            }
                            setShowAlertModal(true);
                          }}
                        >
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>{alert.type}</AlertTitle>
                          <AlertDescription>{alert.message}</AlertDescription>
                        </Alert>
                      ))}
                    </div>
                    <p className="text-sm text-gray-500 mt-3">Click an alert to see details →</p>
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

          {/* Analytics Charts */}
          {analyticsData && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Transaction Analytics
                    </CardTitle>
                    <CardDescription>Visual insights and trends</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAnalytics(!showAnalytics)}
                  >
                    {showAnalytics ? 'Hide Charts' : 'Show Charts'}
                  </Button>
                </div>
              </CardHeader>
              {showAnalytics && (
                <CardContent className="space-y-6">
                  {/* Transaction Volume Trend */}
                  {analyticsData.time_series && analyticsData.time_series.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-3">Transaction Volume (Last 30 Days)</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        {analyticsData.time_series.slice(-14).map((point: any, idx: number) => (
                          <div key={idx} className="p-3 border rounded-lg bg-gray-50">
                            <div className="text-xs text-gray-500 mb-1">
                              {point.date || point.week || point.month}
                            </div>
                            <div className="text-xl font-bold">{point.count}</div>
                            <div className="text-xs text-gray-600">
                              {new Intl.NumberFormat('en-RW', {
                                style: 'currency',
                                currency: 'RWF',
                                minimumFractionDigits: 0
                              }).format(point.amount)}
                            </div>
                            <div className="text-xs text-green-600 mt-1">
                              {point.success_rate}% success
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Hourly Distribution */}
                  {analyticsData.hourly_distribution && analyticsData.hourly_distribution.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-3">Peak Hours (Last 7 Days)</h4>
                      <div className="grid grid-cols-6 md:grid-cols-12 gap-2">
                        {Array.from({ length: 24 }, (_, hour) => {
                          const data = analyticsData.hourly_distribution.find((h: any) => h.hour === hour);
                          const count = data?.count || 0;
                          const maxCount = Math.max(...analyticsData.hourly_distribution.map((h: any) => h.count));
                          const height = count > 0 ? Math.max(20, (count / maxCount) * 100) : 10;
                          return (
                            <div key={hour} className="flex flex-col items-center">
                              <div
                                className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                                style={{ height: `${height}px` }}
                                title={`${hour}:00 - ${count} transactions`}
                              />
                              <div className="text-xs text-gray-500 mt-1">{hour}</div>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">Hours (24h format)</p>
                    </div>
                  )}

                  {/* Channel Performance */}
                  {analyticsData.channel_trends && analyticsData.channel_trends.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-3">Payment Channel Performance</h4>
                      <div className="space-y-2">
                        {Object.entries(
                          analyticsData.channel_trends.reduce((acc: any, item: any) => {
                            if (!acc[item.channel]) {
                              acc[item.channel] = { count: 0, success_count: 0 };
                            }
                            acc[item.channel].count += item.count;
                            acc[item.channel].success_count += Math.round((item.count * item.success_rate) / 100);
                            return acc;
                          }, {})
                        ).map(([channel, data]: [string, any]) => {
                          const successRate = data.count > 0 ? (data.success_count / data.count) * 100 : 0;
                          return (
                            <div key={channel} className="flex items-center gap-3">
                              <div className="w-24 text-sm font-medium">{channel}</div>
                              <div className="flex-1 bg-gray-200 rounded-full h-6 overflow-hidden">
                                <div
                                  className="bg-green-500 h-full flex items-center px-2 text-xs text-white font-medium"
                                  style={{ width: `${successRate}%` }}
                                >
                                  {successRate > 10 && `${successRate.toFixed(1)}%`}
                                </div>
                              </div>
                              <div className="text-sm text-gray-600 w-20 text-right">
                                {data.success_count}/{data.count}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          )}

          {/* Payment Method Distribution */}
          {summary && summary.channel_breakdown && Object.keys(summary.channel_breakdown).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Payment Method Distribution
                </CardTitle>
                <CardDescription>Performance insights by payment channel</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {Object.entries(summary.channel_breakdown).map(([channel, data]: [string, any]) => {
                    const total = data.count || 0;
                    const totalAmount = data.total_amount || 0;
                    // Calculate success rate (this would come from backend in real scenario)
                    const percentOfTotal = summary.total_transactions > 0
                      ? (total / summary.total_transactions) * 100
                      : 0;

                    return (
                      <div key={channel} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-lg">{channel}</h4>
                          <Badge variant="outline">{total} txns</Badge>
                        </div>

                        <div className="space-y-3">
                          {/* Transaction count bar */}
                          <div>
                            <div className="flex justify-between text-xs text-gray-600 mb-1">
                              <span>Market Share</span>
                              <span>{percentOfTotal.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-500 h-2 rounded-full"
                                style={{ width: `${percentOfTotal}%` }}
                              />
                            </div>
                          </div>

                          {/* Total amount */}
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Total Amount</span>
                            <span className="font-semibold">
                              {new Intl.NumberFormat('en-RW', {
                                style: 'currency',
                                currency: 'RWF',
                                minimumFractionDigits: 0
                              }).format(totalAmount)}
                            </span>
                          </div>

                          {/* Average per transaction */}
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Avg per Transaction</span>
                            <span className="text-sm">
                              {new Intl.NumberFormat('en-RW', {
                                style: 'currency',
                                currency: 'RWF',
                                minimumFractionDigits: 0
                              }).format(total > 0 ? totalAmount / total : 0)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Filters and Actions */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Transactions</CardTitle>
                  <CardDescription>
                  {/* View and manage payment transactions. Payer code must start with ALG (e.g. ALG01000000767) and match the Ishyiga client identifier. Each payment is a new transaction—when a client pays again for the next period, activate that new transaction to extend their access. */}
                  View and manage payment transactions.
                </CardDescription>
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSyncStale}
                    disabled={syncingStale}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${syncingStale ? 'animate-spin' : ''}`} />
                    {syncingStale ? 'Syncing...' : 'KURURA TXN'}
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
              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
                {/* Status Filter */}
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1.5 block">
                    Status
                  </label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="VALID">✓ Valid</SelectItem>
                      <SelectItem value="PENDING">⏳ Pending</SelectItem>
                      <SelectItem value="FAILED">✗ Failed</SelectItem>
                      <SelectItem value="INITIATED">→ Initiated</SelectItem>
                      <SelectItem value="REVERSED">↩ Reversed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Channel Filter */}
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1.5 block">
                    Channel
                  </label>
                  <Select value={channelFilter} onValueChange={setChannelFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="All Channels" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Channels</SelectItem>
                      <SelectItem value="MOMO">📱 MOMO</SelectItem>
                      <SelectItem value="AIRTEL">📱 Airtel</SelectItem>
                      <SelectItem value="CARD">💳 Card</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Activation Filter */}
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1.5 block">
                    Activation
                  </label>
                  <Select value={activationFilter} onValueChange={setActivationFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="not_activated">Not activated</SelectItem>
                      <SelectItem value="activated">Activated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* From Date */}
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1.5 block">
                    From Date
                  </label>
                  <Input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="h-9"
                  />
                </div>

                {/* To Date */}
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1.5 block">
                    To Date
                  </label>
                  <Input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    placeholder="mm/dd/yyyy"
                    className="h-9"
                  />
                </div>

                {/* Search */}
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1.5 block">
                    Search
                  </label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="TX ID, Slip, Payer..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-9 pl-8"
                    />
                  </div>
                </div>
              </div>

              {/* Advanced Filters Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                {/* Min Amount */}
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1.5 block">
                    Min Amount (RWF)
                  </label>
                  <Input
                    type="number"
                    placeholder="Min amount"
                    value={minAmount}
                    onChange={(e) => setMinAmount(e.target.value)}
                    className="h-9"
                    min="0"
                  />
                </div>

                {/* Max Amount */}
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1.5 block">
                    Max Amount (RWF)
                  </label>
                  <Input
                    type="number"
                    placeholder="Max amount"
                    value={maxAmount}
                    onChange={(e) => setMaxAmount(e.target.value)}
                    className="h-9"
                    min="0"
                  />
                </div>

                {/* Sort By */}
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1.5 block">
                    Sort By
                  </label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date_desc">📅 Newest First</SelectItem>
                      <SelectItem value="date_asc">📅 Oldest First</SelectItem>
                      <SelectItem value="amount_desc">💰 Highest Amount</SelectItem>
                      <SelectItem value="amount_asc">💰 Lowest Amount</SelectItem>
                      <SelectItem value="status">📊 By Status</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Results per page */}
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1.5 block">
                    Show Per Page
                  </label>
                  <Select value={pageSize.toString()} onValueChange={(val) => setPageSize(parseInt(val))}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="200">200</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Clear Filters Button */}
              {(statusFilter !== 'all' || channelFilter !== 'all' || activationFilter !== 'all' || fromDate || toDate || searchQuery) && (
                <div className="mb-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStatusFilter('all');
                      setChannelFilter('all');
                      setActivationFilter('all');
                      setFromDate('');
                      setToDate('');
                      setSearchQuery('');
                    }}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear All Filters
                  </Button>
                </div>
              )}

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

              {/* Sync preview/results */}
              {syncPreview && (
                <Alert className="mb-4 border-blue-500 bg-blue-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Sync Preview (Last Run)</AlertTitle>
                  <AlertDescription>
                    <details className="mt-2">
                      <summary className="cursor-pointer font-medium text-sm text-blue-800 hover:text-blue-900">
                        Show/Hide sync details
                      </summary>
                      <div className="mt-2 text-sm space-y-1">
                        <p>Pending total: <strong>{syncPreview.pending_total ?? 0}</strong></p>
                        <p>Pending with valid ID: <strong>{syncPreview.pending_with_valid_id ?? 0}</strong></p>
                        <p>Pending with invalid ID (skipped): <strong>{syncPreview.pending_with_invalid_id ?? 0}</strong></p>
                        <p>Candidates selected (age + limit): <strong>{syncPreview.candidates ?? 0}</strong></p>
                        <p>Checked: <strong>{syncPreview.checked ?? 0}</strong> | Updated: <strong>{syncPreview.updated ?? 0}</strong> | Failed: <strong>{syncPreview.failed ?? 0}</strong></p>
                      </div>
                    </details>
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
                      <TableHead>Activated Until</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-gray-500">
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
                            {tx.transaction_id || 'N/A'}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {tx.payer_names || tx.payer_email || tx.payer_code || 'N/A'}
                              </div>
                              <div className="text-xs text-gray-500">
                                {tx.payer_code}
                              </div>
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
                            {tx.activated_until
                              ? formatUTCTimestamp(tx.activated_until)
                              : tx.activated_at
                                ? 'Activated'
                                : '-'}
                          </TableCell>
                          <TableCell className="text-xs" title={tx.payment_date_time || tx.created_at || ''}>
                            {tx.payment_date_time
                              ? formatUTCTimestamp(tx.payment_date_time)
                              : tx.created_at ? new Date(tx.created_at).toLocaleString() : 'N/A'}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
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
                              {tx.status === 'VALID' && !tx.activated_at && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleActivate(tx)}
                                  disabled={activatingTransactionId === tx.transaction_id}
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                  title="Activate – set next payment date and grant access"
                                >
                                  <UserCheck className={`h-4 w-4 mr-1 ${activatingTransactionId === tx.transaction_id ? 'animate-pulse' : ''}`} />
                                  Activate
                                </Button>
                              )}
                              {tx.status === 'VALID' && tx.activated_at && (
                                <span className="text-xs text-gray-500" title={`Activated at ${tx.activated_at}`}>
                                  Activated
                                </span>
                              )}
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
                      <div className={`font-semibold ${selectedTransactionDetails.raw_callback_amount !== selectedTransactionDetails.amount
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
                      <div className={!isSameDateTime(selectedTransactionDetails.raw_callback_datetime, selectedTransactionDetails.payment_date_time) ? 'text-red-600' : ''}>
                        {selectedTransactionDetails.raw_callback_datetime || 'N/A'}
                        {!isSameDateTime(selectedTransactionDetails.raw_callback_datetime, selectedTransactionDetails.payment_date_time) && (
                          <span className="text-xs ml-2">⚠️ MISMATCH!</span>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Collapsible Technical Details */}
              <Accordion type="multiple" className="w-full">
                {selectedTransactionDetails.urubuto_verified && selectedTransactionDetails.urubuto_data && (
                  <AccordionItem value="urubuto-verified">
                    <AccordionTrigger className="text-sm font-medium">
                      ✅ Verified with UrubutoPay API
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 p-3 bg-green-50 rounded-lg">
                        {selectedTransactionDetails.urubuto_data.data && (
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <span className="text-gray-600">Status:</span>
                              <span className="ml-2 font-medium">{selectedTransactionDetails.urubuto_data.data.transaction_status}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Slip Number:</span>
                              <span className="ml-2 font-mono text-xs">{selectedTransactionDetails.urubuto_data.data.slip_number || 'N/A'}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Channel Ref:</span>
                              <span className="ml-2 font-mono text-xs">{selectedTransactionDetails.urubuto_data.data.payment_channel_transaction_ref_number || 'N/A'}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Internal TX ID:</span>
                              <span className="ml-2 font-mono text-xs">{selectedTransactionDetails.urubuto_data.data.internal_transaction_id || 'N/A'}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Phone:</span>
                              <span className="ml-2">{selectedTransactionDetails.urubuto_data.data.phone_number || 'N/A'}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Email:</span>
                              <span className="ml-2 text-xs">{selectedTransactionDetails.urubuto_data.data.payer_email || 'N/A'}</span>
                            </div>
                          </div>
                        )}
                        <details className="mt-3">
                          <summary className="cursor-pointer text-xs text-gray-600 hover:text-gray-900">Raw JSON</summary>
                          <pre className="mt-2 bg-white p-2 rounded text-xs overflow-auto">
                            {JSON.stringify(selectedTransactionDetails.urubuto_data, null, 2)}
                          </pre>
                        </details>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {selectedTransactionDetails.raw_callback_data && (
                  <AccordionItem value="callback-data">
                    <AccordionTrigger className="text-sm font-medium">
                      📨 Raw Callback Data (What UrubutoPay Sent)
                    </AccordionTrigger>
                    <AccordionContent>
                      <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto">
                        {typeof selectedTransactionDetails.raw_callback_data === 'string'
                          ? selectedTransactionDetails.raw_callback_data
                          : JSON.stringify(selectedTransactionDetails.raw_callback_data, null, 2)}
                      </pre>
                    </AccordionContent>
                  </AccordionItem>
                )}

                <AccordionItem value="full-data">
                  <AccordionTrigger className="text-sm font-medium">
                    🔧 Full Transaction Data (Technical)
                  </AccordionTrigger>
                  <AccordionContent>
                    <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto">
                      {JSON.stringify(selectedTransactionDetails, null, 2)}
                    </pre>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Activate – set next payment date */}
      <Dialog open={activateDialogTx !== null} onOpenChange={(open) => !open && setActivateDialogTx(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Activate subscription</DialogTitle>
            <DialogDescription>
              Set the next payment date (valid until). The payer will have access until this date. You can change the suggested date.
            </DialogDescription>
          </DialogHeader>
          {activateDialogTx && (
            <div className="space-y-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="activate-valid-until">Valid until (next payment date)</Label>
                <Input
                  id="activate-valid-until"
                  type="date"
                  value={activateValidUntil}
                  onChange={(e) => setActivateValidUntil(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  className="w-full"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="activate-grace-period">GRACE PERIOD DAYS</Label>
                <Input
                  id="activate-grace-period"
                  type="number"
                  min={0}
                  max={365}
                  step={1}
                  value={activateGracePeriodDays}
                  onChange={(e) => setActivateGracePeriodDays(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setActivateDialogTx(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleActivateConfirm}
                  disabled={activatingTransactionId === activateDialogTx.transaction_id}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {activatingTransactionId === activateDialogTx.transaction_id ? 'Activating…' : 'Activate'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Alert Details Modal */}
      {showAlertModal && selectedAlert && (
        <Dialog open={showAlertModal} onOpenChange={setShowAlertModal}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                {selectedAlert.type}
              </DialogTitle>
              <DialogDescription>
                {selectedAlert.message}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4">
              {/* Show pending transactions if this is a pending alert */}
              {selectedAlert.type === 'OLD_PENDING_TRANSACTIONS' && (
                <div>
                  <h3 className="font-semibold mb-3">Pending Transactions</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Transaction ID</TableHead>
                          <TableHead>Payer</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Channel</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(loadingAlertPendingTransactions ? [] : alertPendingTransactions).map((tx) => (
                            <TableRow key={tx.transaction_id}>
                              <TableCell className="font-mono text-xs">
                                {tx.transaction_id || 'null'}
                              </TableCell>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{tx.payer_names || tx.payer_email || tx.payer_code || 'N/A'}</div>
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
                              <TableCell className="text-xs">
                                {tx.created_at ? new Date(tx.created_at).toLocaleString() : 'N/A'}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    handleViewDetails(tx.transaction_id)
                                    setShowAlertModal(false)
                                  }}
                                  className="text-blue-600 hover:text-blue-700"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>

                  {loadingAlertPendingTransactions && (
                    <p className="text-center text-gray-500 py-4">Loading pending transactions...</p>
                  )}
                  {!loadingAlertPendingTransactions && alertPendingTransactions.length === 0 && (
                    <p className="text-center text-gray-500 py-4">No pending transactions found</p>
                  )}
                </div>
              )}

              {/* For other alert types, show generic info */}
              {selectedAlert.type !== 'OLD_PENDING_TRANSACTIONS' && (
                <div className="p-4 bg-orange-50 rounded-lg">
                  <div className="space-y-1 text-sm text-gray-700">
                    <p><strong>Message:</strong> {selectedAlert.message}</p>
                    <p><strong>Severity:</strong> {selectedAlert.severity}</p>
                    <p><strong>Current value:</strong> {selectedAlert.value}</p>
                    <p><strong>Threshold:</strong> {selectedAlert.threshold}</p>
                    <p><strong>Reported at:</strong> {selectedAlert.timestamp}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <Button onClick={() => setShowAlertModal(false)}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
