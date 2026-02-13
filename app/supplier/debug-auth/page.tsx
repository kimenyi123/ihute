'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/auth-store';

export default function DebugAuth() {
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [backendTest, setBackendTest] = useState<any>(null);
  const { user, isAuthenticated, hasHydrated } = useAuthStore();

  useEffect(() => {
    if (hasHydrated) {
      setSessionInfo({
        isAuthenticated,
        user,
        hasHydrated,
        timestamp: new Date().toISOString()
      });
    }
  }, [hasHydrated, isAuthenticated, user]);

  const testBackendAuth = async () => {
    try {
      // Test direct backend call
      const response = await fetch('http://localhost:8080/Trading/supplier/stock/api?action=test', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const data = await response.json();
      setBackendTest({
        status: response.status,
        data,
        cookies: document.cookie,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      setBackendTest({
        error: error instanceof Error ? error.message : 'Unknown error',
        cookies: document.cookie,
        timestamp: new Date().toISOString()
      });
    }
  };

  const testProxyAuth = async () => {
    try {
      // Test through Next.js API proxy
      const response = await fetch('/supplier/stock/api?action=test', {
        method: 'GET',
        credentials: 'include',
      });
      
      const data = await response.json();
      setBackendTest({
        type: 'proxy',
        status: response.status,
        data,
        cookies: document.cookie,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      setBackendTest({
        type: 'proxy',
        error: error instanceof Error ? error.message : 'Unknown error',
        cookies: document.cookie,
        timestamp: new Date().toISOString()
      });
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Authentication Debug</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Frontend Auth State */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Frontend Auth State</h2>
          <pre className="text-sm bg-gray-100 p-4 rounded overflow-auto">
            {JSON.stringify(sessionInfo, null, 2)}
          </pre>
        </div>

        {/* Backend Test */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Backend Test</h2>
          <div className="space-y-2 mb-4">
            <button
              onClick={testBackendAuth}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 mr-2"
            >
              Test Direct Backend
            </button>
            <button
              onClick={testProxyAuth}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Test Proxy
            </button>
          </div>
          {backendTest && (
            <pre className="text-sm bg-gray-100 p-4 rounded overflow-auto">
              {JSON.stringify(backendTest, null, 2)}
            </pre>
          )}
        </div>
      </div>

      {/* Browser Info */}
      <div className="mt-6 bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-4">Browser Info</h2>
        <div className="text-sm space-y-2">
          <div><strong>User Agent:</strong> {navigator.userAgent}</div>
          <div><strong>Cookies:</strong> {document.cookie || 'None'}</div>
          <div><strong>Current URL:</strong> {window.location.href}</div>
        </div>
      </div>
    </div>
  );
}