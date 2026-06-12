import test from 'node:test'
import assert from 'node:assert/strict'

import { matchMoMoSmsToOrderTotal } from './momo-payment-sms-match'

function makeFreshSms(amount: number, txId = '28066831087') {
  const now = new Date()
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
  return `MTN MoMo confirmation. TxId:${txId}. Your payment of ${amount} RWF was successful on ${stamp}. Merchant 547255.`
}

test('accepts a recent MoMo SMS that matches the order total', () => {
  const sms = makeFreshSms(15000)
  const result = matchMoMoSmsToOrderTotal(sms, 15000, 2, '547255', 15)

  assert.equal(result.matched, true)
  assert.equal(result.rejectReason, 'none')
  assert.equal(result.dateValid, true)
})

test('rejects an SMS with no transaction timestamp', () => {
  const sms = 'MTN MoMo confirmation. TxId:28066831087. Your payment of 15000 RWF was successful. Merchant 547255.'

  const result = matchMoMoSmsToOrderTotal(sms, 15000, 2, '547255', 15)

  assert.equal(result.matched, false)
  assert.equal(result.rejectReason, 'expired_sms')
  assert.equal(result.dateValid, false)
})

test('rejects an old SMS that is outside the 15-minute window', () => {
  const old = 'MTN MoMo confirmation. TxId:28066831087. Your payment of 15000 RWF was successful on 2024-01-01 10:00:00. Merchant 547255.'

  const result = matchMoMoSmsToOrderTotal(old, 15000, 2, '547255', 15)

  assert.equal(result.matched, false)
  assert.equal(result.rejectReason, 'expired_sms')
  assert.equal(result.dateValid, false)
})
