'use client';

import { useState } from 'react';
import { UrubutoApi } from '@/lib/urubuto-api';

export default function PaymentVerification() {
  const [transactionId, setTransactionId] = useState('');
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transactionId.trim()) return;

    setLoading(true);
    setError('');

    try {
      const result = await UrubutoApi.verifyPayment({ transaction_id: transactionId });
      setVerificationResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Verify Payment Status</h2>
      
      <form onSubmit={handleVerify} className="mb-6">
        <div className="flex gap-4">
          <input
            type="text"
            value={transactionId}
            onChange={(e) => setTransactionId(e.target.value)}
            placeholder="Enter Transaction ID"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Verify'}
          </button>
        </div>
      </form>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {verificationResult && (
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3">Verification Result</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Status:</span>{' '}
              <span className={`font-bold ${
                verificationResult.urubuto_response?.status === 'SUCCESS' ? 'text-green-600' :
                verificationResult.urubuto_response?.status === 'FAILED' ? 'text-red-600' :
                'text-yellow-600'
              }`}>
                {verificationResult.urubuto_response?.status || 'Unknown'}
              </span>
            </div>
            <div>
              <span className="font-medium">Transaction ID:</span>{' '}
              {verificationResult.transaction_id}
            </div>
            {verificationResult.urubuto_response?.amount && (
              <div>
                <span className="font-medium">Amount:</span>{' '}
                {verificationResult.urubuto_response.amount} {verificationResult.urubuto_response.currency}
              </div>
            )}
            {verificationResult.urubuto_response?.payment_date_time && (
              <div>
                <span className="font-medium">Payment Date:</span>{' '}
                {new Date(verificationResult.urubuto_response.payment_date_time).toLocaleString()}
              </div>
            )}
          </div>
          
          {verificationResult.urubuto_response && (
            <details className="mt-4">
              <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                Full Response Details
              </summary>
              <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto">
                {JSON.stringify(verificationResult.urubuto_response, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}