'use client';

import { useState } from 'react';

export default function TestStockAPI() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testAPI = async (action: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/supplier/stock/api?action=${action}`, {
        method: 'GET',
        credentials: 'include',
      });
      
      const data = await response.json();
      setResult({
        action,
        status: response.status,
        data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      setResult({
        action,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  const testDirectBackend = async () => {
    setLoading(true);
    try {
      const base = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8082/Trading").replace(/\/+$/, "")
      const response = await fetch(`${base}/supplier/stock/api?action=test`, {
        method: 'GET',
        credentials: 'include',
      });
      
      const data = await response.json();
      setResult({
        action: 'direct-backend',
        status: response.status,
        data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      setResult({
        action: 'direct-backend',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Stock API Test</h1>
      
      <div className="space-y-4 mb-6">
        <button
          onClick={() => testAPI('test')}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          Test Connectivity
        </button>
        
        <button
          onClick={() => testAPI('getStock')}
          disabled={loading}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
        >
          Get Stock
        </button>
        
        <button
          onClick={() => testAPI('debugRedis')}
          disabled={loading}
          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-400"
        >
          Debug Redis
        </button>
        
        <button
          onClick={() => testDirectBackend()}
          disabled={loading}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
        >
          Test Direct Backend
        </button>
      </div>

      {loading && (
        <div className="text-blue-600">Loading...</div>
      )}

      {result && (
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="font-bold mb-2">Result:</h2>
          <pre className="text-sm overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}