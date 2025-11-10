// Shared types for payment system
export interface PaymentInitiationRequest {
    payer_code: string;
    amount: number;
    channel_name: 'MOMO' | 'CARD' | 'BANK';
    phone_number?: string;
    payer_names?: string;
    payer_email?: string;
    redirection_url?: string;
    card_type_to_be_used?: string;
  }
  
  export interface PaymentInitiationResponse {
    status: string;
    message: string;
    timestamp?: string;
    card_processing_url?: string;
    url_validity?: string;
    urubuto_response: any;
  }
  
  export interface PaymentVerificationRequest {
    transaction_id: string;
    merchant_code?: string;
  }
  
  export interface PaymentVerificationResponse {
    status: string;
    message: string;
    transaction_id: string;
    urubuto_response: any;
  }
  
  export interface Transaction {
    transaction_id: string;
    internal_transaction_id: string;
    status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'REVERSED';
    amount: number;
    currency: string;
    payer_code: string;
    merchant_code: string;
    payment_channel: string;
    payment_channel_name: string;
    payment_date_time: string;
    slip_number?: string;
    created_at: string;
    updated_at: string;
  }
  
  export interface ReversalRequest {
    transaction_id: string;
    reason: string;
  }