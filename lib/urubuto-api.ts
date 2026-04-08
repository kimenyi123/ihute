import { 
    PaymentInitiationRequest, 
    PaymentInitiationResponse,
    PaymentVerificationRequest,
    PaymentVerificationResponse,
    ReversalRequest 
  } from './payment-types';
  
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ihute.rw';
  
  export class UrubutoApi {
    private static async fetchWithAuth(endpoint: string, options: RequestInit = {}) {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });
  
      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }
  
      return response.json();
    }
  
    // Get auth token from UrubutoPay
    static async getAuthToken(): Promise<any> {
      return this.fetchWithAuth('/api/urubuto/auth', {
        method: 'POST',
      });
    }
  
    // Initiate payment
    static async initiatePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResponse> {
      return this.fetchWithAuth('/api/payment/initiate', {
        method: 'POST',
        body: JSON.stringify(request),
      });
    }
  
    // Verify payment status
    static async verifyPayment(request: PaymentVerificationRequest): Promise<PaymentVerificationResponse> {
      const params = new URLSearchParams({
        transaction_id: request.transaction_id,
        ...(request.merchant_code && { merchant_code: request.merchant_code }),
      });
  
      return this.fetchWithAuth(`/api/payment/verify?${params}`, {
        method: 'GET',
      });
    }
  
    // Get receipt as PDF
    static async getReceipt(transactionId: string): Promise<Blob> {
      const response = await fetch(`${API_BASE_URL}/api/payment/receipt?transaction_id=${transactionId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch receipt');
      }
  
      return response.blob();
    }
  
    // Request payment reversal
    static async requestReversal(request: ReversalRequest): Promise<any> {
      return this.fetchWithAuth('/api/payment/reversal', {
        method: 'POST',
        body: JSON.stringify(request),
      });
    }
  
    // Validate payer
    static async validatePayer(payerCode: string, merchantCode?: string): Promise<any> {
      const params = new URLSearchParams({
        payer_code: payerCode,
        ...(merchantCode && { merchant_code: merchantCode }),
      });
  
      return this.fetchWithAuth(`/api/payment/validate?${params}`, {
        method: 'GET',
      });
    }
  }