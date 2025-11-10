'use client';

import { useState } from 'react';
import { UrubutoApi } from '@/lib/urubuto-api';
import { PaymentInitiationRequest } from '@/lib/payment-types';
import { 
  PAYMENT_METHODS, 
  mapToUrubutoChannel, 
  isUrubutoPaySupported,
  getPaymentMethodInfo,
  formatPaymentMethod 
} from '@/lib/payment-utils';

interface PaymentFormProps {
  onPaymentInitiated?: (response: any) => void;
  defaultPayerCode?: string;
  defaultAmount?: number;
  defaultMethod?: string;
}

export default function PaymentForm({ 
  onPaymentInitiated, 
  defaultPayerCode = '',
  defaultAmount = 0,
  defaultMethod = PAYMENT_METHODS.MOMO 
}: PaymentFormProps) {
  const [formData, setFormData] = useState({
    payer_code: defaultPayerCode,
    amount: defaultAmount,
    internal_method: defaultMethod,
    phone_number: '',
    payer_names: '',
    payer_email: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Check if method is supported by UrubutoPay
      if (!isUrubutoPaySupported(formData.internal_method)) {
        throw new Error(`Payment method ${formatPaymentMethod(formData.internal_method)} is not supported for online payments`);
      }

      // Convert to UrubutoPay request
      const urubutoRequest: PaymentInitiationRequest = {
        payer_code: formData.payer_code,
        amount: formData.amount,
        channel_name: mapToUrubutoChannel(formData.internal_method),
        phone_number: formData.phone_number,
        payer_names: formData.payer_names,
        payer_email: formData.payer_email,
        card_type_to_be_used: formData.internal_method === PAYMENT_METHODS.CARD ? 'VISA' : 'NOT_APPLICABLE',
      };

      const response = await UrubutoApi.initiatePayment(urubutoRequest);
      onPaymentInitiated?.(response);
      
      // Redirect to card processing URL if available
      if (response.card_processing_url) {
        window.open(response.card_processing_url, '_blank');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment initiation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'amount' ? parseFloat(value) || 0 : value,
    }));
  };

  const paymentMethodInfo = getPaymentMethodInfo(formData.internal_method);

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Initiate Payment</h2>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="payer_code" className="block text-sm font-medium text-gray-700">
            Payer Code *
          </label>
          <input
            type="text"
            id="payer_code"
            name="payer_code"
            value={formData.payer_code}
            onChange={handleChange}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
            Amount (RWF) *
          </label>
          <input
            type="number"
            id="amount"
            name="amount"
            value={formData.amount}
            onChange={handleChange}
            min="0"
            step="0.01"
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label htmlFor="internal_method" className="block text-sm font-medium text-gray-700">
            Payment Method *
          </label>
          <select
            id="internal_method"
            name="internal_method"
            value={formData.internal_method}
            onChange={handleChange}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value={PAYMENT_METHODS.MOMO}>Mobile Money (MoMo)</option>
            <option value={PAYMENT_METHODS.CARD}>Credit/Debit Card</option>
            <option value={PAYMENT_METHODS.BANK}>Bank Transfer</option>
            <option value={PAYMENT_METHODS.COD}>Cash on Delivery</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Selected: <span className={paymentMethodInfo.color}>{paymentMethodInfo.icon} {paymentMethodInfo.name}</span>
            {!isUrubutoPaySupported(formData.internal_method) && (
              <span className="text-orange-600 ml-2">(Not available for online payment)</span>
            )}
          </p>
        </div>

        {formData.internal_method !== PAYMENT_METHODS.COD && formData.internal_method !== PAYMENT_METHODS.CARD && (
          <div>
            <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700">
              Phone Number *
            </label>
            <input
              type="tel"
              id="phone_number"
              name="phone_number"
              value={formData.phone_number}
              onChange={handleChange}
              required={formData.internal_method !== PAYMENT_METHODS.CARD}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        )}

        <div>
          <label htmlFor="payer_names" className="block text-sm font-medium text-gray-700">
            Payer Names
          </label>
          <input
            type="text"
            id="payer_names"
            name="payer_names"
            value={formData.payer_names}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label htmlFor="payer_email" className="block text-sm font-medium text-gray-700">
            Payer Email
          </label>
          <input
            type="email"
            id="payer_email"
            name="payer_email"
            value={formData.payer_email}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !isUrubutoPaySupported(formData.internal_method)}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Processing...' : `Pay ${formData.amount.toLocaleString()} RWF`}
        </button>

        {!isUrubutoPaySupported(formData.internal_method) && (
          <p className="text-sm text-orange-600 text-center">
            This payment method requires manual processing
          </p>
        )}
      </form>
    </div>
  );
}