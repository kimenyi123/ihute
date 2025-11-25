interface PaymentStatusProps {
    paymentResult: any;
  }
  
  export default function PaymentStatus({ paymentResult }: PaymentStatusProps) {
    const getStatusColor = (status: string) => {
      switch (status?.toLowerCase()) {
        case 'success':
          return 'text-green-600 bg-green-100';
        case 'failed':
          return 'text-red-600 bg-red-100';
        case 'pending':
          return 'text-yellow-600 bg-yellow-100';
        default:
          return 'text-gray-600 bg-gray-100';
      }
    };
  
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h3 className="text-xl font-semibold mb-4 text-gray-800">Payment Status</h3>
        
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="font-medium">Status:</span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(paymentResult.status)}`}>
              {paymentResult.status}
            </span>
          </div>
  
          <div className="flex justify-between">
            <span className="font-medium">Message:</span>
            <span className="text-gray-700">{paymentResult.message}</span>
          </div>
  
          {paymentResult.timestamp && (
            <div className="flex justify-between">
              <span className="font-medium">Timestamp:</span>
              <span className="text-gray-700">
                {new Date(paymentResult.timestamp).toLocaleString()}
              </span>
            </div>
          )}
  
          {paymentResult.card_processing_url && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-blue-800 text-sm mb-2">
                For card payments, please complete your payment on the external page:
              </p>
              <a
                href={paymentResult.card_processing_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
              >
                Complete Card Payment
              </a>
            </div>
          )}
  
          {paymentResult.urubuto_response && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-800">
                View Detailed Response
              </summary>
              <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto">
                {JSON.stringify(paymentResult.urubuto_response, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }