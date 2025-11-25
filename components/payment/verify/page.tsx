import PaymentVerification from '@/components/payment/payment-verification';

export default function PaymentVerificationPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Verify Payment Status
          </h1>
          <p className="text-gray-600">
            Check the status of your payment transactions
          </p>
        </div>

        <PaymentVerification />
        
        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">
            Need Help?
          </h3>
          <p className="text-yellow-700 text-sm">
            If you're experiencing issues with payment verification, please contact our support team 
            with your transaction ID and payment details.
          </p>
        </div>
      </div>
    </div>
  );
}