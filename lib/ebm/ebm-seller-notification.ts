import type { Connection } from "mysql2/promise"
import { createOnboardingMysqlConnection } from "@/lib/onboarding-mysql"

export type EbmSellerNotification = {
  notiId: number
  orderId: number
  buyerName: string
  sellerAccount: string
  action: string
  createdAt: string
  amount: number
}

type NotificationSchema = {
  hasIsRead: boolean
  hasNotificationType: boolean
  hasMetadata: boolean
}

let schemaCache: NotificationSchema | null = null

async function loadNotificationSchema(conn: Connection): Promise<NotificationSchema> {
  if (schemaCache) return schemaCache
  const [rows] = await conn.query("SHOW COLUMNS FROM notification")
  const names = new Set(
    (Array.isArray(rows) ? rows : []).map((r) => String((r as { Field?: string }).Field ?? "")),
  )
  schemaCache = {
    hasIsRead: names.has("is_read"),
    hasNotificationType: names.has("notification_type"),
    hasMetadata: names.has("metadata"),
  }
  return schemaCache
}

function unreadSql(schema: NotificationSchema): string {
  const parts = ["(n.icyabaye IS NULL OR n.icyabaye != 'READ' OR n.icyabaye = 'UNREAD')"]
  if (schema.hasIsRead) parts.push("(n.is_read = 0 OR n.is_read IS NULL)")
  return parts.join(" AND ")
}

export class EbmSellerNotificationService {
  private async conn(): Promise<Connection> {
    return createOnboardingMysqlConnection()
  }

  async notifySellerApprovalRequest(args: {
    orderId: number
    sellerAccount: string
    buyerName: string
    buyerPhone?: string
    amount: number
    shopName?: string
  }): Promise<void> {
    const conn = await this.conn()
    try {
      const schema = await loadNotificationSchema(conn)
      const message = `${args.buyerName} requested RRA EBM invoice for order #${args.orderId}`

      if (schema.hasMetadata && schema.hasNotificationType && schema.hasIsRead) {
        await conn.query(
          `INSERT INTO notification
            (order_number, seller, buyer, action, icyabaye, is_read, notification_type, metadata, igihe)
           VALUES (?, ?, ?, 'REQUEST_EBM', 'UNREAD', 0, 'EBM',
            JSON_OBJECT('buyerName', ?, 'buyerPhone', ?, 'amount', ?, 'shopName', ?, 'message', ?, 'timestamp', NOW()), NOW())`,
          [
            args.orderId,
            args.sellerAccount,
            args.buyerName,
            args.buyerName,
            args.buyerPhone ?? "",
            args.amount,
            args.shopName ?? "",
            message,
          ],
        )
      } else {
        await conn.query(
          `INSERT INTO notification (order_number, seller, buyer, action, icyabaye, igihe)
           VALUES (?, ?, ?, 'REQUEST_EBM', 'UNREAD', NOW())`,
          [args.orderId, args.sellerAccount, args.buyerName],
        )
      }

      console.info(
        `[EbmSellerNotification] REQUEST_EBM order=${args.orderId} seller=${args.sellerAccount}`,
      )
    } finally {
      await conn.end()
    }
  }

  async listPendingForSeller(sellerAccount: string, limit = 50): Promise<EbmSellerNotification[]> {
    const conn = await this.conn()
    try {
      const schema = await loadNotificationSchema(conn)
      const metaCol = schema.hasMetadata ? "n.metadata," : ""

      const [rows] = await conn.query(
        `SELECT n.noti_id, n.order_number, n.seller, n.buyer, n.action, n.igihe, ${metaCol}
                COALESCE(ot.AMOUNT, 0) AS AMOUNT
         FROM notification n
         LEFT JOIN order_transaction ot ON n.order_number = ot.ID_ORDER
         LEFT JOIN ebm_invoices e ON e.order_id = n.order_number
         WHERE UPPER(TRIM(n.seller)) = UPPER(TRIM(?))
           AND n.action = 'REQUEST_EBM'
           AND (e.ebm_status IS NULL OR e.ebm_status NOT IN ('success', 'rejected'))
         ORDER BY n.igihe DESC
         LIMIT ?`,
        [sellerAccount.trim(), limit],
      )
      const list = Array.isArray(rows) ? rows : []
      return list.map((row) => {
        const r = row as Record<string, unknown>
        let amount = Number(r.AMOUNT) || 0
        if (schema.hasMetadata && r.metadata && typeof r.metadata === "string") {
          try {
            const meta = JSON.parse(r.metadata) as { amount?: number }
            if (meta.amount) amount = Number(meta.amount)
          } catch {
            /* ignore */
          }
        }
        return {
          notiId: Number(r.noti_id),
          orderId: Number(r.order_number),
          buyerName: String(r.buyer ?? "Customer"),
          sellerAccount: String(r.seller ?? sellerAccount),
          action: String(r.action ?? "REQUEST_EBM"),
          createdAt: r.igihe instanceof Date ? r.igihe.toISOString() : String(r.igihe ?? ""),
          amount,
        }
      })
    } finally {
      await conn.end()
    }
  }

  async markReadForOrder(sellerAccount: string, orderId: number): Promise<void> {
    const conn = await this.conn()
    try {
      const schema = await loadNotificationSchema(conn)
      if (schema.hasIsRead) {
        await conn.query(
          `UPDATE notification
           SET icyabaye = 'READ', is_read = 1
           WHERE TRIM(seller) = ? AND order_number = ? AND action = 'REQUEST_EBM'`,
          [sellerAccount.trim(), orderId],
        )
      } else {
        await conn.query(
          `UPDATE notification
           SET icyabaye = 'READ'
           WHERE TRIM(seller) = ? AND order_number = ? AND action = 'REQUEST_EBM'`,
          [sellerAccount.trim(), orderId],
        )
      }
    } finally {
      await conn.end()
    }
  }
}

export const ebmSellerNotificationService = new EbmSellerNotificationService()
