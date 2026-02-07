/**
 * Payment Dashboard API - Client-side API utilities for payment dashboard
 */

// Get base URL and normalize it (remove trailing slashes)
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://ihute.rw").trim().replace(/\/+$/, "");

// Helper to build URL - ensures we don't double-add /Trading
function buildUrl(endpoint: string): string[] {
  // Remove leading slash from endpoint if present
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
  
  // Check if API_BASE_URL already contains /Trading
  const hasTrading = API_BASE_URL.includes('/Trading');
  
  if (hasTrading) {
    // If /Trading is already in base URL, just use it directly
    return [`${API_BASE_URL}${cleanEndpoint}`];
  } else {
    // Try with /Trading first, then without
    return [
      `${API_BASE_URL}/Trading${cleanEndpoint}`,
      `${API_BASE_URL}${cleanEndpoint}`
    ];
  }
}

export interface Transaction {
  transaction_id: string;
  internal_transaction_id: string;
  merchant_code: string;
  payer_code: string;
  payer_names?: string;
  payer_email?: string;
  payer_phone?: string;
  amount: number;
  currency: string;
  status: string;
  payment_channel: string;
  payment_channel_name: string;
  payment_date_time: string;
  slip_number: string;
  created_at: string;
  updated_at?: string;
}

export interface SummaryStats {
  total_transactions: number;
  successful: number;
  failed: number;
  pending: number;
  total_amount: number;
  avg_amount: number;
  unique_payers: number;
  payment_channels: number;
  success_rate: number;
  channel_breakdown: Record<string, { count: number; total_amount: number }>;
}

export interface Alert {
  type: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  message: string;
  value: number;
  threshold: number;
  timestamp: string;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  database: string;
  configuration: string;
  failure_rate: number;
  pending_transactions: number;
  retry_statistics?: {
    total: number;
    pending: number;
    successful: number;
    abandoned: number;
  };
  issues: string[];
  issue_count: number;
}

export interface ReconciliationIssue {
  transaction_id: string;
  status: string;
  amount: number;
  payment_date_time: string;
  created_at: string;
  issue_type: string;
}

export interface ReconciliationStats {
  total_transactions: number;
  fully_reconciled: number;
  pending_long: number;
  missing_dates: number;
  missing_slips: number;
  reconciliation_rate: number;
}

class PaymentDashboardApi {
  private async fetch(endpoint: string, options: RequestInit = {}) {
    // Build URLs to try (handles /Trading prefix intelligently)
    const urls = buildUrl(endpoint);
    
    let lastError: Error | null = null;
    
    for (const url of urls) {
      try {
        console.log(`🔍 Trying: ${url}`);
        const response = await fetch(url, {
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
          ...options,
        });

        if (!response.ok) {
          let errorMessage = response.statusText;
          try {
            const error = await response.json();
            errorMessage = error.message || error.statusText || response.statusText;
          } catch {
            // If JSON parsing fails, use status text
          }
          
          // If 404, try next URL
          if (response.status === 404) {
            console.warn(`⚠️ 404 at ${url}, trying alternative...`);
            lastError = new Error(`404: ${endpoint} not found at ${url}`);
            continue; // Try next URL
          }
          
          // For other errors, throw immediately
          throw new Error(errorMessage || `API error: ${response.status} ${response.statusText}`);
        }

        console.log(`✅ Success: ${url}`);
        return response.json();
      } catch (error) {
        // Network errors or other fetch failures
        if (error instanceof TypeError && error.message.includes('fetch')) {
          console.error(`❌ Network error at ${url}:`, error);
          lastError = new Error(`Network error: Unable to connect to ${url}`);
          continue; // Try next URL
        }
        
        // If it's not a network error and not 404, throw immediately
        if (!(error instanceof Error && error.message.includes('404'))) {
          throw error;
        }
        
        lastError = error as Error;
      }
    }
    
    // If all URLs failed, throw the last error
    throw lastError || new Error(`Failed to fetch ${endpoint} from any URL`);
  }

  /**
   * Get transaction reports with filters
   */
  async getTransactions(params: {
    status?: string;
    channel?: string;
    from_date?: string;
    to_date?: string;
    merchant_code?: string;
    payer_code?: string;
    search?: string;
    limit?: number;
    offset?: number;
    export?: 'csv' | 'json';
  }): Promise<{ data: { transactions: Transaction[]; total: number; limit: number; offset: number; has_more: boolean }; status: number }> {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, String(value));
      }
    });

    return this.fetch(`/api/payment/reports/transactions?${queryParams}`);
  }

  /**
   * Get summary statistics
   */
  async getSummary(params?: {
    from_date?: string;
    to_date?: string;
  }): Promise<{ data: SummaryStats; status: number }> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) queryParams.append(key, value);
      });
    }

    return this.fetch(`/api/payment/reports/summary?${queryParams}`);
  }

  /**
   * Get reconciliation issues
   */
  async getReconciliationIssues(params?: {
    from_date?: string;
    to_date?: string;
    transaction_id?: string;
  }): Promise<{ data: ReconciliationIssue[]; count: number; status: number }> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) queryParams.append(key, value);
      });
    }

    return this.fetch(`/api/payment/reconciliation/check?${queryParams}`);
  }

  /**
   * Get reconciliation statistics
   */
  async getReconciliationStats(params?: {
    from_date?: string;
    to_date?: string;
  }): Promise<{ data: ReconciliationStats; status: number }> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) queryParams.append(key, value);
      });
    }

    return this.fetch(`/api/payment/reconciliation/statistics?${queryParams}`);
  }

  /**
   * Sync transaction with UrubutoPay
   */
  async syncTransaction(transactionId: string): Promise<{ message: string; data: any; status: number }> {
    return this.fetch('/api/payment/reconciliation/sync', {
      method: 'POST',
      body: JSON.stringify({ transaction_id: transactionId }),
    });
  }

  /**
   * Get system health status
   */
  async getHealth(): Promise<{ data: HealthStatus; status: number }> {
    return this.fetch('/api/payment/monitoring/health');
  }

  /**
   * Get active alerts
   */
  async getAlerts(): Promise<{ data: Alert[]; count: number; status: number }> {
    return this.fetch('/api/payment/monitoring/alerts');
  }

  /**
   * Get system metrics
   */
  async getMetrics(params?: {
    from_date?: string;
    to_date?: string;
  }): Promise<{ data: any; status: number }> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) queryParams.append(key, value);
      });
    }

    return this.fetch(`/api/payment/monitoring/metrics?${queryParams}`);
  }

  /**
   * Get dashboard data (combined)
   */
  async getDashboard(params?: {
    from_date?: string;
    to_date?: string;
  }): Promise<{ data: any; status: number }> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) queryParams.append(key, value);
      });
    }

    return this.fetch(`/api/payment/monitoring/dashboard?${queryParams}`);
  }

  /**
   * Check ghost transactions (transactions not in database)
   */
  async checkGhostTransactions(transactionIds?: string[]): Promise<{ data: any; status: number }> {
    if (transactionIds && transactionIds.length > 0) {
      const queryParams = new URLSearchParams();
      queryParams.append('transaction_ids', transactionIds.join(','));
      return this.fetch(`/api/payment/ghost/check?${queryParams}`);
    } else {
      return this.fetch('/api/payment/ghost/check');
    }
  }

  /**
   * Delete ghost transactions (bulk)
   */
  async deleteGhostTransactions(transactionIds: string[]): Promise<{ data: any; status: number }> {
    return this.fetch('/api/payment/ghost/delete', {
      method: 'POST',
      body: JSON.stringify({ transaction_ids: transactionIds }),
    });
  }

  /**
   * Delete a single transaction
   */
  async deleteTransaction(transactionId: string): Promise<{ data: any; status: number }> {
    return this.fetch(`/api/payment/ghost/${transactionId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get transaction details including raw callback data and UrubutoPay verification
   */
  async getTransactionDetails(transactionId: string): Promise<{ data: any; status: number }> {
    return this.fetch(`/api/payment/transaction/details?transaction_id=${encodeURIComponent(transactionId)}`);
  }

  /**
   * Test webhook endpoint
   */
  async testWebhook(): Promise<{ data: any; status: number }> {
    return this.fetch('/api/payment/webhook/test');
  }

  /**
   * Get recent webhook callbacks
   */
  async getRecentCallbacks(limit?: number): Promise<{ data: any; status: number }> {
    const params = limit ? `?limit=${limit}` : '';
    return this.fetch(`/api/payment/webhook/recent${params}`);
  }

  /**
   * Get webhook status and statistics
   */
  async getWebhookStatus(): Promise<{ data: any; status: number }> {
    return this.fetch('/api/payment/webhook/status');
  }

  /**
   * Export transactions
   */
  async exportTransactions(
    format: 'csv' | 'json',
    params?: {
      status?: string;
      channel?: string;
      from_date?: string;
      to_date?: string;
      merchant_code?: string;
      payer_code?: string;
      search?: string;
    }
  ): Promise<Blob> {
    const queryParams = new URLSearchParams();
    queryParams.append('export', format);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) queryParams.append(key, value);
      });
    }

    // Build URL using the helper function
    const urls = buildUrl(`/api/payment/reports/transactions?${queryParams}`);
    const url = urls[0]; // Use first URL (should work)
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Export failed: ${response.statusText}`);
    }

    return response.blob();
  }
}

export const paymentDashboardApi = new PaymentDashboardApi();

