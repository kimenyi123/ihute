interface PaymentStatusProps {
  paymentResult: unknown
}

export default function PaymentStatus({ paymentResult }: PaymentStatusProps) {
  const pr =
    paymentResult && typeof paymentResult === "object"
      ? (paymentResult as Record<string, unknown>)
      : {}
  const status = String(pr.status ?? "UNKNOWN")
  const message = String(pr.message ?? pr.error ?? "—")

  const getStatusColor = (s: string) => {
    switch (s.toLowerCase()) {
      case "success":
        return "text-green-600 bg-green-100"
      case "failed":
        return "text-red-600 bg-red-100"
      case "pending":
        return "text-yellow-600 bg-yellow-100"
      default:
        return "text-gray-600 bg-gray-100"
    }
  }

  const ts = pr.timestamp
  const cardUrl = typeof pr.card_processing_url === "string" ? pr.card_processing_url : ""

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-xl font-semibold text-gray-800">Payment status</h3>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-medium">Status:</span>
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(status)}`}>{status}</span>
        </div>

        <div className="flex justify-between gap-2">
          <span className="shrink-0 font-medium">Message:</span>
          <span className="text-right text-sm text-gray-700">{message}</span>
        </div>

        {ts != null && (typeof ts === "string" || typeof ts === "number") ? (
          <div className="flex justify-between">
            <span className="font-medium">Timestamp:</span>
            <span className="text-gray-700">{new Date(ts as string | number).toLocaleString()}</span>
          </div>
        ) : null}

        {cardUrl ? (
          <div className="mt-4 rounded-lg bg-blue-50 p-4">
            <p className="mb-2 text-sm text-blue-800">Complete your payment on the secure card page:</p>
            <a
              href={cardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
            >
              Complete card payment
            </a>
          </div>
        ) : null}

        {pr.urubuto_response != null ? (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-800">View detailed response</summary>
            <pre className="mt-2 max-h-64 overflow-auto rounded bg-gray-100 p-3 text-xs">
              {JSON.stringify(pr.urubuto_response, null, 2)}
            </pre>
          </details>
        ) : null}
      </div>
    </div>
  )
}
