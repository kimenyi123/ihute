import { 
    PaymentInitiationRequest, 
    PaymentInitiationResponse,
    PaymentVerificationRequest,
    PaymentVerificationResponse,
    ReversalRequest 
  } from './payment-types';
  
  /**
   * Browser: same-origin `/api/...` so Next route handlers receive the request.
   * Server: fall back to site URL or public API base for rare SSR calls.
   */
  function resolveApiBaseUrl(): string {
    if (typeof window !== "undefined") return ""
    return (
      process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
      process.env.VERCEL_URL?.replace(/^(?!https?:\/\/)/, "https://").replace(/\/$/, "") ||
      process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
      "http://localhost:3000"
    )
  }

  export class UrubutoApi {
    private static async fetchWithAuth<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
      const base = resolveApiBaseUrl()
      const response = await fetch(`${base}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      })

      const data = (await response.json().catch(() => ({}))) as Record<string, unknown>
      if (!response.ok) {
        const msg =
          (typeof data.message === "string" && data.message) ||
          (typeof data.error === "string" && data.error) ||
          response.statusText
        throw new Error(msg)
      }

      return data as T
    }
  
    // Get auth token from UrubutoPay
    static async getAuthToken(): Promise<any> {
      return this.fetchWithAuth<any>("/api/urubuto/auth", {
        method: "POST",
      })
    }
  
    // Initiate payment
    static async initiatePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResponse> {
      return this.fetchWithAuth<PaymentInitiationResponse>("/api/payment/initiate", {
        method: "POST",
        body: JSON.stringify(request),
      })
    }
  
    // Verify payment status
    static async verifyPayment(request: PaymentVerificationRequest): Promise<PaymentVerificationResponse> {
      const params = new URLSearchParams({
        transaction_id: request.transaction_id,
        ...(request.merchant_code && { merchant_code: request.merchant_code }),
      });
  
      return this.fetchWithAuth<PaymentVerificationResponse>(`/api/payment/verify?${params}`, {
        method: "GET",
      })
    }
  
    // Get receipt as PDF
    static async getReceipt(transactionId: string): Promise<Blob> {
      const base = resolveApiBaseUrl()
      const response = await fetch(`${base}/api/payment/receipt?transaction_id=${encodeURIComponent(transactionId)}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch receipt');
      }
  
      return response.blob();
    }
  
    // Request payment reversal
    static async requestReversal(request: ReversalRequest): Promise<any> {
      return this.fetchWithAuth<any>("/api/payment/reversal", {
        method: "POST",
        body: JSON.stringify(request),
      })
    }
  
    // Validate payer
    static async validatePayer(payerCode: string, merchantCode?: string): Promise<any> {
      const params = new URLSearchParams({
        payer_code: payerCode,
        ...(merchantCode && { merchant_code: merchantCode }),
      });
  
      return this.fetchWithAuth<any>(`/api/payment/validate?${params}`, {
        method: "GET",
      })
    }
  }