'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import PaymentDashboard from '@/components/payment/payment-dashboard';

export default function PaymentDashboardPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Payment Dashboard
              </h1>
              <p className="text-gray-600">
                Monitor and manage all payment transactions
              </p>
            </div>

            <PaymentDashboard />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}


