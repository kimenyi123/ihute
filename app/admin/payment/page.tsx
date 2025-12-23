'use client';

import { PaymentDashboard } from '@/components/payment/payment-dashboard';

export default function AdminPaymentPage() {
  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Payment Dashboard
        </h1>
        <p className="text-gray-600">
          Monitor and manage all payment transactions from UrubutoPay
        </p>
      </div>

      <PaymentDashboard />
    </div>
  );
}

