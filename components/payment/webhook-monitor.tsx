'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  RefreshCw,
  Activity,
  Server,
  Database,
  Shield,
  Globe
} from 'lucide-react';
import { paymentDashboardApi } from '@/lib/payment-dashboard-api';

export function WebhookMonitor() {
  const [testResult, setTestResult] = useState<any>(null);
  const [recentCallbacks, setRecentCallbacks] = useState<any[]>([]);
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadWebhookData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadWebhookData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadWebhookData = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        testWebhook(),
        loadRecentCallbacks(),
        loadStatus()
      ]);
    } catch (error) {
      console.error('Error loading webhook data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const testWebhook = async () => {
    try {
      const result = await paymentDashboardApi.testWebhook();
      setTestResult(result.data);
    } catch (error) {
      console.error('Error testing webhook:', error);
    }
  };

  const loadRecentCallbacks = async () => {
    try {
      const result = await paymentDashboardApi.getRecentCallbacks(20);
      // Backend now returns: { status: 200, data: { count: X, callbacks: [...], timestamp: ... } }
      setRecentCallbacks(result.data?.callbacks || []);
    } catch (error) {
      console.error('Error loading recent callbacks:', error);
      setRecentCallbacks([]);
    }
  };

  const loadStatus = async () => {
    try {
      const result = await paymentDashboardApi.getWebhookStatus();
      setStatus(result.data);
    } catch (error) {
      console.error('Error loading webhook status:', error);
    }
  };

  const getCheckIcon = (value: string) => {
    if (value.includes('✅')) {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    } else if (value.includes('❌')) {
      return <XCircle className="h-4 w-4 text-red-600" />;
    } else {
      return <AlertCircle className="h-4 w-4 text-yellow-600" />;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Webhook Endpoint Test</CardTitle>
              <CardDescription>Verify webhook configuration and connectivity</CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={loadWebhookData}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {testResult ? (
            <div className="space-y-4">
              <Alert className={testResult.status === 'ready' ? 'border-green-500' : 'border-yellow-500'}>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Webhook Status: {testResult.status === 'ready' ? 'Ready ✅' : 'Not Ready ⚠️'}</AlertTitle>
                <AlertDescription>{testResult.message}</AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Endpoint Configuration
                  </h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span>Webhook URL:</span>
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded">{testResult.webhook_url_for_urubuto}</code>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Auth Endpoint:</span>
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded">{testResult.checks?.auth_endpoint}</code>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Security Checks
                  </h4>
                  <div className="space-y-1 text-sm">
                    {Object.entries(testResult.checks || {}).map(([key, value]: [string, any]) => {
                      if (key.includes('url') || key === 'auth_endpoint') return null;
                      return (
                        <div key={key} className="flex items-center justify-between">
                          <span className="capitalize">{key.replace(/_/g, ' ')}:</span>
                          <div className="flex items-center gap-2">
                            {getCheckIcon(String(value))}
                            <span className="text-xs">{String(value).replace(/[✅❌⚠️]/g, '').trim()}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">Loading webhook test...</div>
          )}
        </CardContent>
      </Card>

      {status && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{status.total_transactions || 0}</div>
              <p className="text-xs text-gray-500 mt-1">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Last 24 Hours</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{status.last_24_hours || 0}</div>
              <p className="text-xs text-gray-500 mt-1">Recent activity</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">By Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {Object.entries(status.by_status || {}).map(([status, count]: [string, any]) => (
                  <div key={status} className="flex justify-between text-sm">
                    <span>{status}:</span>
                    <span className="font-semibold">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Failed Retries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{status.failed_retries || 0}</div>
              <p className="text-xs text-gray-500 mt-1">Requires attention</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent Webhook Callbacks</CardTitle>
          <CardDescription>Last 20 callbacks received from UrubutoPay</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transaction ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Received At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentCallbacks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                      No callbacks received yet
                    </TableCell>
                  </TableRow>
                ) : (
                  recentCallbacks.map((callback, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-xs">
                        {callback.transaction_id?.substring(0, 20)}...
                      </TableCell>
                      <TableCell>
                        <Badge variant={callback.status === 'VALID' ? 'default' : 'secondary'}>
                          {callback.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Intl.NumberFormat('en-RW', { 
                          style: 'currency', 
                          currency: callback.currency || 'RWF',
                          minimumFractionDigits: 0 
                        }).format(callback.amount)}
                      </TableCell>
                      <TableCell>{callback.payment_channel}</TableCell>
                      <TableCell className="text-xs">
                        {callback.received_at ? new Date(callback.received_at).toLocaleString() : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

