import {
  createOnboardingMysqlConnection,
  onboardingMysqlConfigHint,
} from "@/lib/onboarding-mysql"
import type { EbmFiscalStatus, EbmParsedResponse } from "@/lib/ebm/types"

const ENSURE_EBM_INVOICES = `
CREATE TABLE IF NOT EXISTS ebm_invoices (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id INT NOT NULL,
  seller_account VARCHAR(64) DEFAULT NULL,
  invoice_number VARCHAR(100) NOT NULL,
  ebm_status ENUM('pending','success','failed','retry','rejected') NOT NULL DEFAULT 'pending',
  receipt_number VARCHAR(64) DEFAULT NULL,
  qr_code TEXT DEFAULT NULL,
  fiscal_signature TEXT DEFAULT NULL,
  vsdc_id VARCHAR(64) DEFAULT NULL,
  ysdcintdata TEXT DEFAULT NULL,
  ysdcmrc VARCHAR(128) DEFAULT NULL,
  ysdcmrctim VARCHAR(64) DEFAULT NULL,
  ysdctime VARCHAR(64) DEFAULT NULL,
  api_status VARCHAR(64) DEFAULT NULL,
  raw_request JSON DEFAULT NULL,
  raw_response JSON DEFAULT NULL,
  error_message TEXT DEFAULT NULL,
  retry_count INT NOT NULL DEFAULT 0,
  sent_at DATETIME DEFAULT NULL,
  response_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_ebm_order_invoice (order_id, invoice_number),
  KEY idx_ebm_status_retry (ebm_status, retry_count),
  KEY idx_ebm_order (order_id),
  KEY idx_ebm_seller_status (seller_account, ebm_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`

let ebmTableReady = false

function clipVarchar(value: string | null | undefined, max: number): string | null {
  if (value == null) return null
  const s = String(value).trim()
  if (!s) return null
  return s.length <= max ? s : s.slice(0, max)
}

function sellerMatchExpr(column: string): string {
  return `UPPER(TRIM(${column})) = UPPER(TRIM(?))`
}

function unreadNotificationSql(): string {
  return `(n.icyabaye IS NULL OR n.icyabaye != 'READ' OR n.icyabaye = 'UNREAD')`
}

export type EbmInvoiceRow = {
  id: number
  order_id: number
  invoice_number: string
  ebm_status: EbmFiscalStatus
  receipt_number: string | null
  qr_code: string | null
}

/** Fiscal fields for tax invoice presentation (read-only). */
export type EbmFiscalPresentation = {
  order_id: number
  invoice_number: string
  ebm_status: EbmFiscalStatus
  receipt_number: string | null
  qr_code: string | null
  fiscal_signature: string | null
  vsdc_id: string | null
  ysdcintdata: string | null
  ysdcmrc: string | null
  ysdcmrctim: string | null
  ysdctime: string | null
  raw_request: unknown
  raw_response: unknown
  sent_at: string | null
}

export type EbmRetryCandidate = {
  order_id: number
  invoice_number: string
  retry_count: number
}

export class EbmRepository {
  private async conn() {
    try {
      return await createOnboardingMysqlConnection()
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes("ONBOARDING_MYSQL")) throw e
      throw new Error(onboardingMysqlConfigHint())
    }
  }

  async ensureTable(): Promise<void> {
    if (ebmTableReady) return
    const conn = await this.conn()
    try {
      await conn.query(ENSURE_EBM_INVOICES)
      try {
        await conn.query(
          `ALTER TABLE ebm_invoices ADD COLUMN seller_account VARCHAR(64) DEFAULT NULL AFTER order_id`,
        )
      } catch {
        /* column exists */
      }
      try {
        await conn.query(
          `ALTER TABLE ebm_invoices ADD KEY idx_ebm_seller_status (seller_account, ebm_status)`,
        )
      } catch {
        /* index exists */
      }
      try {
        await conn.query(
          `ALTER TABLE ebm_invoices MODIFY COLUMN ebm_status
           ENUM('pending','success','failed','retry','rejected') NOT NULL DEFAULT 'pending'`,
        )
      } catch {
        /* enum already includes rejected */
      }
      ebmTableReady = true
    } finally {
      await conn.end()
    }
  }

  async findByOrderId(orderId: number): Promise<EbmInvoiceRow | null> {
    const conn = await this.conn()
    try {
      const [rows] = await conn.query(
        `SELECT id, order_id, invoice_number, ebm_status, receipt_number, qr_code
         FROM ebm_invoices WHERE order_id = ? ORDER BY id DESC LIMIT 1`,
        [orderId],
      )
      const list = Array.isArray(rows) ? rows : []
      if (!list.length) return null
      const r = list[0] as Record<string, unknown>
      return {
        id: Number(r.id),
        order_id: Number(r.order_id),
        invoice_number: String(r.invoice_number),
        ebm_status: String(r.ebm_status) as EbmFiscalStatus,
        receipt_number: r.receipt_number != null ? String(r.receipt_number) : null,
        qr_code: r.qr_code != null ? String(r.qr_code) : null,
      }
    } finally {
      await conn.end()
    }
  }

  /** Full fiscal row for buyer tax invoice display. */
  async findFiscalPresentationByOrderId(orderId: number): Promise<EbmFiscalPresentation | null> {
    const conn = await this.conn()
    try {
      const [rows] = await conn.query(
        `SELECT order_id, invoice_number, ebm_status, receipt_number, qr_code, fiscal_signature,
                vsdc_id, ysdcintdata, ysdcmrc, ysdcmrctim, ysdctime, raw_request, raw_response, sent_at
         FROM ebm_invoices WHERE order_id = ? ORDER BY id DESC LIMIT 1`,
        [orderId],
      )
      const list = Array.isArray(rows) ? rows : []
      if (!list.length) return null
      const r = list[0] as Record<string, unknown>
      let rawRequest: unknown = r.raw_request
      let rawResponse: unknown = r.raw_response
      if (typeof rawRequest === "string") {
        try {
          rawRequest = JSON.parse(rawRequest)
        } catch {
          /* keep string */
        }
      }
      if (typeof rawResponse === "string") {
        try {
          rawResponse = JSON.parse(rawResponse)
        } catch {
          /* keep string */
        }
      }
      return {
        order_id: Number(r.order_id),
        invoice_number: String(r.invoice_number ?? ""),
        ebm_status: String(r.ebm_status) as EbmFiscalStatus,
        receipt_number: r.receipt_number != null ? String(r.receipt_number) : null,
        qr_code: r.qr_code != null ? String(r.qr_code) : null,
        fiscal_signature: r.fiscal_signature != null ? String(r.fiscal_signature) : null,
        vsdc_id: r.vsdc_id != null ? String(r.vsdc_id) : null,
        ysdcintdata: r.ysdcintdata != null ? String(r.ysdcintdata) : null,
        ysdcmrc: r.ysdcmrc != null ? String(r.ysdcmrc) : null,
        ysdcmrctim: r.ysdcmrctim != null ? String(r.ysdcmrctim) : null,
        ysdctime: r.ysdctime != null ? String(r.ysdctime) : null,
        raw_request: rawRequest,
        raw_response: rawResponse,
        sent_at: r.sent_at != null ? String(r.sent_at) : null,
      }
    } finally {
      await conn.end()
    }
  }

  async saveAttempt(args: {
    orderId: number
    invoiceNumber: string
    sellerAccount?: string
    rawRequest: unknown
    status: EbmFiscalStatus
    parsed?: EbmParsedResponse
    rawResponseText?: string
    errorMessage?: string
    sentAt: Date
    responseAt?: Date
  }): Promise<number> {
    await this.ensureTable()
    const conn = await this.conn()
    try {
      const p = args.parsed
      let rawResponse: unknown = null
      if (args.rawResponseText?.trim()) {
        try {
          rawResponse = JSON.parse(args.rawResponseText)
        } catch {
          rawResponse = args.rawResponseText
        }
      } else if (p?.raw) {
        rawResponse = p.raw
      }

      const sellerAccount = args.sellerAccount?.trim() || null

      const [result] = await conn.query(
        `INSERT INTO ebm_invoices (
          order_id, seller_account, invoice_number, ebm_status, receipt_number, qr_code, fiscal_signature,
          vsdc_id, ysdcintdata, ysdcmrc, ysdcmrctim, ysdctime, api_status,
          raw_request, raw_response, error_message, sent_at, response_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          seller_account = COALESCE(VALUES(seller_account), seller_account),
          ebm_status = VALUES(ebm_status),
          receipt_number = VALUES(receipt_number),
          qr_code = VALUES(qr_code),
          fiscal_signature = VALUES(fiscal_signature),
          vsdc_id = VALUES(vsdc_id),
          ysdcintdata = VALUES(ysdcintdata),
          ysdcmrc = VALUES(ysdcmrc),
          ysdcmrctim = VALUES(ysdcmrctim),
          ysdctime = VALUES(ysdctime),
          api_status = VALUES(api_status),
          raw_request = VALUES(raw_request),
          raw_response = VALUES(raw_response),
          error_message = VALUES(error_message),
          sent_at = VALUES(sent_at),
          response_at = VALUES(response_at),
          retry_count = retry_count + 1`,
        [
          args.orderId,
          sellerAccount,
          args.invoiceNumber,
          args.status,
          clipVarchar(p?.receiptNumber, 64),
          p?.qrCode ?? null,
          clipVarchar(p?.fiscalSignature, 512),
          clipVarchar(p?.ysdcid, 64),
          p?.ysdcintdata ?? null,
          p?.ysdcmrc ?? null,
          p?.ysdcmrctim ?? null,
          p?.ysdctime ?? null,
          p?.status ?? null,
          JSON.stringify(args.rawRequest),
          rawResponse ? JSON.stringify(rawResponse) : null,
          args.errorMessage?.slice(0, 2000) ?? null,
          args.sentAt,
          args.responseAt ?? null,
        ],
      )
      const header = result as { insertId?: number }
      return Number(header.insertId) || 0
    } finally {
      await conn.end()
    }
  }

  /** Buyer requested EBM — pending seller approval (no API call yet). */
  async saveBuyerRequest(args: {
    orderId: number
    invoiceNumber: string
    buyerName: string
    sellerAccount: string
  }): Promise<void> {
    await this.ensureTable()
    const conn = await this.conn()
    const seller = args.sellerAccount.trim()
    try {
      await conn.query(
        `INSERT INTO ebm_invoices (order_id, seller_account, invoice_number, ebm_status, raw_request, sent_at)
         VALUES (?, ?, ?, 'pending', ?, NOW())
         ON DUPLICATE KEY UPDATE
           seller_account = COALESCE(VALUES(seller_account), seller_account),
           ebm_status = IF(ebm_status = 'success', ebm_status, 'pending'),
           raw_request = VALUES(raw_request),
           updated_at = CURRENT_TIMESTAMP`,
        [
          args.orderId,
          seller || null,
          args.invoiceNumber,
          JSON.stringify({
            source: "buyer_request",
            buyerName: args.buyerName,
            sellerAccount: seller,
            requestedAt: new Date().toISOString(),
          }),
        ],
      )
    } finally {
      await conn.end()
    }
  }

  async backfillSellerAccountsFromNotifications(): Promise<void> {
    await this.ensureTable()
    const conn = await this.conn()
    try {
      await conn.query(
        `UPDATE ebm_invoices e
         INNER JOIN notification n ON n.order_number = e.order_id AND n.action = 'REQUEST_EBM'
         SET e.seller_account = TRIM(n.seller)
         WHERE e.seller_account IS NULL OR TRIM(e.seller_account) = ''`,
      )
    } finally {
      await conn.end()
    }
  }

  async rejectSellerRequest(args: {
    orderId: number
    sellerAccount: string
    reason?: string
  }): Promise<boolean> {
    await this.ensureTable()
    const conn = await this.conn()
    const seller = args.sellerAccount.trim()
    const reason = (args.reason?.trim() || "Rejected by seller — suspected fake or invalid order").slice(
      0,
      2000,
    )
    try {
      const [result] = await conn.query(
        `UPDATE ebm_invoices e
         SET e.ebm_status = 'rejected',
             e.error_message = ?,
             e.response_at = NOW(),
             e.updated_at = CURRENT_TIMESTAMP
         WHERE e.order_id = ?
           AND e.ebm_status IN ('pending', 'retry')
           AND (
             ${sellerMatchExpr("COALESCE(e.seller_account, '')")}
             OR EXISTS (
               SELECT 1 FROM notification n
               WHERE n.order_number = e.order_id
                 AND n.action = 'REQUEST_EBM'
                 AND ${sellerMatchExpr("n.seller")}
             )
           )`,
        [reason, args.orderId, seller, seller],
      )
      const header = result as { affectedRows?: number }
      return Number(header.affectedRows) > 0
    } finally {
      await conn.end()
    }
  }

  async listEbmStateForSeller(
    sellerAccount: string,
    limit = 500,
  ): Promise<{ pending: number[]; success: number[]; rejected: number[] }> {
    await this.ensureTable()
    const conn = await this.conn()
    const seller = sellerAccount.trim()
    try {
      const [rows] = await conn.query(
        `SELECT e.order_id, e.ebm_status
         FROM ebm_invoices e
         WHERE e.ebm_status IN ('pending', 'retry', 'success', 'rejected')
           AND (
             ${sellerMatchExpr("COALESCE(e.seller_account, '')")}
             OR EXISTS (
               SELECT 1 FROM notification n
               WHERE n.order_number = e.order_id
                 AND n.action = 'REQUEST_EBM'
                 AND ${sellerMatchExpr("n.seller")}
             )
           )
         ORDER BY e.order_id DESC
         LIMIT ?`,
        [seller, seller, limit],
      )
      const pending: number[] = []
      const success: number[] = []
      const rejected: number[] = []
      for (const row of Array.isArray(rows) ? rows : []) {
        const r = row as { order_id: number; ebm_status: string }
        const id = Number(r.order_id)
        if (!id) continue
        if (r.ebm_status === "success") success.push(id)
        else if (r.ebm_status === "rejected") rejected.push(id)
        else pending.push(id)
      }
      return { pending, success, rejected }
    } finally {
      await conn.end()
    }
  }

  async listPendingBySeller(sellerAccount: string, limit = 100): Promise<number[]> {
    await this.ensureTable()
    const conn = await this.conn()
    const seller = sellerAccount.trim()
    try {
      const [rows] = await conn.query(
        `SELECT e.order_id
         FROM ebm_invoices e
         WHERE e.ebm_status IN ('pending', 'retry')
           AND (
             ${sellerMatchExpr("COALESCE(e.seller_account, '')")}
             OR EXISTS (
               SELECT 1 FROM notification n
               WHERE n.order_number = e.order_id
                 AND n.action = 'REQUEST_EBM'
                 AND ${sellerMatchExpr("n.seller")}
             )
           )
         ORDER BY e.order_id DESC
         LIMIT ?`,
        [seller, seller, limit],
      )
      const list = Array.isArray(rows) ? rows : []
      return list.map((row) => Number((row as { order_id: number }).order_id)).filter((id) => id > 0)
    } finally {
      await conn.end()
    }
  }

  async listSuccessBySeller(sellerAccount: string, limit = 500): Promise<number[]> {
    await this.ensureTable()
    const conn = await this.conn()
    const seller = sellerAccount.trim()
    try {
      const [rows] = await conn.query(
        `SELECT e.order_id
         FROM ebm_invoices e
         WHERE e.ebm_status = 'success'
           AND (
             ${sellerMatchExpr("COALESCE(e.seller_account, '')")}
             OR EXISTS (
               SELECT 1 FROM notification n
               WHERE n.order_number = e.order_id
                 AND n.action = 'REQUEST_EBM'
                 AND ${sellerMatchExpr("n.seller")}
             )
           )
         ORDER BY e.order_id DESC
         LIMIT ?`,
        [seller, seller, limit],
      )
      const list = Array.isArray(rows) ? rows : []
      return list.map((row) => Number((row as { order_id: number }).order_id)).filter((id) => id > 0)
    } finally {
      await conn.end()
    }
  }

  async listRetryCandidates(limit = 20, maxRetries = 10): Promise<EbmRetryCandidate[]> {
    await this.ensureTable()
    const conn = await this.conn()
    try {
      const [rows] = await conn.query(
        `SELECT order_id, invoice_number, retry_count
         FROM ebm_invoices
         WHERE ebm_status = 'retry' AND retry_count < ?
         ORDER BY updated_at ASC
         LIMIT ?`,
        [maxRetries, limit],
      )
      const list = Array.isArray(rows) ? rows : []
      return list.map((row) => {
        const r = row as Record<string, unknown>
        return {
          order_id: Number(r.order_id),
          invoice_number: String(r.invoice_number),
          retry_count: Number(r.retry_count) || 0,
        }
      })
    } finally {
      await conn.end()
    }
  }
}
