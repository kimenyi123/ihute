'use client';

import { useState } from 'react';
import PaymentForm from '@/components/payment/payment-form';
import PaymentStatus from '../payment-status';

export default function PaymentInitiationPage() {
  const [paymentResult, setPaymentResult] = useState<any>(null);

  const handlePaymentInitiated = (result: any) => {
    setPaymentResult(result);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Make a Payment
          </h1>
          <p className="text-gray-600">
            Secure payment processing via UrubutoPay
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <PaymentForm onPaymentInitiated={handlePaymentInitiated} />
          </div>
          
          <div>
            {paymentResult ? (
              <PaymentStatus paymentResult={paymentResult} />
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-blue-800 mb-2">
                  Payment Instructions
                </h3>
                <ul className="text-blue-700 space-y-2 text-sm">
                  <li>• Fill in all required fields</li>
                  <li>• Select your preferred payment method</li>
                  <li>• Ensure phone number is correct for mobile payments</li>
                  <li>• You will be redirected for card payments</li>
                  <li>• Keep your transaction ID for verification</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}