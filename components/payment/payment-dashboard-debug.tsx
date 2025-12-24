'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Terminal } from 'lucide-react';

// Get base URL and normalize it (remove trailing slashes)
let API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080').trim();
if (API_BASE_URL.endsWith('/')) {
  API_BASE_URL = API_BASE_URL.slice(0, -1);
}

// Helper to build URL - ensures we don't double-add /Trading
function buildTestUrl(endpoint: string): string[] {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
  const hasTrading = API_BASE_URL.includes('/Trading');
  
  if (hasTrading) {
    return [`${API_BASE_URL}${cleanEndpoint}`];
  } else {
    return [
      `${API_BASE_URL}/Trading${cleanEndpoint}`,
      `${API_BASE_URL}${cleanEndpoint}`
    ];
  }
}

export function PaymentDashboardDebug() {
  const [testResults, setTestResults] = useState<any[]>([]);
  const [testing, setTesting] = useState(false);

  const testEndpoints = async () => {
    setTesting(true);
    setTestResults([]);
    
    const endpoints = [
      '/api/payment/reports/transactions',
      '/api/payment/reports/summary',
      '/api/payment/monitoring/health',
    ];

    const results: any[] = [];

    for (const endpoint of endpoints) {
      // Get URLs to test (handles /Trading prefix)
      const urlsToTest = buildTestUrl(endpoint);
      
      for (const url of urlsToTest) {
      try {
        console.log(`Testing: ${url}`);
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        const status = response.status;
        const ok = response.ok;
        let data = null;
        let error = null;

        try {
          data = await response.json();
        } catch (e) {
          error = 'Failed to parse JSON';
        }

        results.push({
          url,
          status,
          ok,
          data: data ? 'Success' : null,
          error,
        });
      } catch (error: any) {
        results.push({
          url,
          status: 'ERROR',
          ok: false,
          error: error.message,
        });
      }
      }
    }

    setTestResults(results);
    setTesting(false);
  };

  return (
    <Card className="border-yellow-200 bg-yellow-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Terminal className="h-4 w-4" />
          Endpoint Diagnostic Tool
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Button 
          onClick={testEndpoints} 
          disabled={testing}
          size="sm"
          variant="outline"
          className="mb-4"
        >
          {testing ? 'Testing...' : 'Test All Endpoints'}
        </Button>

        {testResults.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold">Test Results:</p>
            {testResults.map((result, idx) => (
              <Alert 
                key={idx} 
                variant={result.ok ? 'default' : 'destructive'}
                className="text-xs"
              >
                <AlertDescription>
                  <div className="font-mono text-xs">
                    <div className="font-semibold">{result.url}</div>
                    <div>Status: {result.status} {result.ok ? '✅' : '❌'}</div>
                    {result.data && <div>Response: {result.data}</div>}
                    {result.error && <div className="text-red-600">Error: {result.error}</div>}
                  </div>
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        <div className="mt-4 text-xs text-gray-600">
          <p className="font-semibold mb-2">Quick Checks:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>API Base URL: <code className="bg-gray-100 px-1 rounded">{API_BASE_URL}</code></li>
            <li>Check browser console (F12) for detailed logs</li>
            <li>Verify backend is running: <code className="bg-gray-100 px-1 rounded">curl {API_BASE_URL}/Trading/api/payment/monitoring/health</code></li>
            <li>Check database has transactions: <code className="bg-gray-100 px-1 rounded">SELECT COUNT(*) FROM urubuto_transactions;</code></li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

