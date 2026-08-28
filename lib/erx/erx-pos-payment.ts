/**
 * Persist MoMo payment on the chosen eRx POS order row (order_transaction).
 */

import { getErxMysqlPool } from "@/lib/erx/erx-mysql"

export async function updateErxOrderPayment(input: {
  orderNumber: string
  paymentName: string
  paymentId: string
}): Promise<boolean> {
  const pool = getErxMysqlPool()
  if (!pool) return false

  const orderNumber = input.orderNumber.trim()
  const paymentName = input.paymentName.trim().toLowerCase()
  const paymentId = input.paymentId.trim()
  if (!orderNumber || !paymentName || !paymentId) return false

  const [result] = await pool.query(
    `UPDATE order_transaction
     SET PAYMENT_NAME = ?, payment_id = ?
     WHERE order_number = ?
       AND buyer_ishyiga_account = 'IHUTE'`,
    [paymentName, paymentId, orderNumber],
  )
  const affected = (result as { affectedRows?: number }).affectedRows ?? 0
  return affected > 0
}
