import test from 'node:test'
import assert from 'node:assert/strict'

import {
  looksLikeBareTxId,
  looksLikeFullPaymentSms,
  matchMoMoSmsToOrderTotal,
  extractMoMoReferenceNoteFromSms,
} from './momo-payment-sms-match'

function makeFreshSms(amount: number, txId = '28066831087', note?: string) {
  const now = new Date()
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
  const notePart = note ? ` Note: ${note}.` : ''
  return `MTN MoMo confirmation. TxId:${txId}. Your payment of ${amount} RWF was successful on ${stamp}.${notePart} Merchant 547255.`
}

test('rejects a bare TxId paste', () => {
  assert.equal(looksLikeBareTxId('28066831087'), true)
  assert.equal(looksLikeBareTxId('TxId:28066831087'), true)
  assert.equal(looksLikeFullPaymentSms('28066831087'), false)

  const result = matchMoMoSmsToOrderTotal('28066831087', 15000, 2, '547255', 15)
  assert.equal(result.matched, false)
  assert.equal(result.rejectReason, 'bare_txid')
})

test('rejects incomplete paste that is not a full SMS body', () => {
  const result = matchMoMoSmsToOrderTotal('paid ok TxId:28066831087', 15000, 2, '547255', 15)
  assert.equal(result.matched, false)
  assert.equal(result.rejectReason, 'incomplete_sms')
})

test('accepts a recent full MoMo SMS that matches the order total', () => {
  const sms = makeFreshSms(15000)
  const result = matchMoMoSmsToOrderTotal(sms, 15000, 2, '547255', 15)

  assert.equal(result.matched, true)
  assert.equal(result.rejectReason, 'none')
  assert.equal(result.dateValid, true)
  assert.equal(result.txId, '28066831087')
  assert.ok(result.paidAtIso)
})

test('extracts optional reference/note from SMS', () => {
  const sms = makeFreshSms(15000, '28066831087', 'Table 4 Gilbert')
  assert.equal(extractMoMoReferenceNoteFromSms(sms), 'Table 4 Gilbert')
  const result = matchMoMoSmsToOrderTotal(sms, 15000, 2, '547255', 15)
  assert.equal(result.matched, true)
  assert.equal(result.referenceNote, 'Table 4 Gilbert')
})

test('rejects amount mismatch against order total', () => {
  const sms = makeFreshSms(9000)
  const result = matchMoMoSmsToOrderTotal(sms, 15000, 2, '547255', 15)
  assert.equal(result.matched, false)
  assert.equal(result.rejectReason, 'amount_mismatch')
})

test('rejects an SMS with no transaction timestamp', () => {
  const sms =
    'MTN MoMo confirmation. TxId:28066831087. Your payment of 15000 RWF was successful. Merchant 547255. Please keep this message for your records.'

  const result = matchMoMoSmsToOrderTotal(sms, 15000, 2, '547255', 15)

  assert.equal(result.matched, false)
  assert.equal(result.rejectReason, 'expired_sms')
  assert.equal(result.dateValid, false)
})

test('rejects an old SMS that is outside the 15-minute window', () => {
  const old =
    'MTN MoMo confirmation. TxId:28066831087. Your payment of 15000 RWF was successful on 2024-01-01 10:00:00. Merchant 547255.'

  const result = matchMoMoSmsToOrderTotal(old, 15000, 2, '547255', 15)

  assert.equal(result.matched, false)
  assert.equal(result.rejectReason, 'expired_sms')
  assert.equal(result.dateValid, false)
})

test('parses a phone-based MTN MoMo payment SMS and matches order total', () => {
  const now = new Date()
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
  const sms = `*165*S*1100 RWF transferred to Devotha IRADUKUNDA (250784991475) at ${stamp} .Fee: 100RWF.Balance: 18178RWF.Dial *182*1*3# and send money abroad *RW#,TxId:28548053516*S*`

  const result = matchMoMoSmsToOrderTotal(sms, 1100, 2)

  assert.equal(result.matched, true)
  assert.equal(result.amount, 1100)
  assert.equal(result.txId, '28548053516')
  assert.equal(result.receiverName, 'Devotha IRADUKUNDA')
  assert.equal(result.receiverPhone, '250784991475')
  assert.equal(result.receiverCode, null)
})

test('rejects phone-based SMS without TxId (TxId required for uniqueness)', () => {
  const now = new Date()
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
  const sms = `*165*S*1000 RWF transferred to Devotha IRADUKUNDA (250784991475) at ${stamp}. Fee: 100RWF. Balance: 18178RWF. Dial *182*1*3# and send money abroad *RW#`

  const result = matchMoMoSmsToOrderTotal(sms, 1000, 2)

  assert.equal(result.matched, false)
  assert.equal(result.rejectReason, 'no_txid')
  assert.equal(result.amount, 1000)
})

test('parses a code-based MTN MoMo payment SMS with TxId', () => {
  const now = new Date()
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
  const sms = `*EN#Your payment of 200 RWF to Cassien Sindayigaya 121464 was completed at ${stamp}. Balance: 1,788 RWF. Fee 0 RWF. TxId:29900112233*`

  const result = matchMoMoSmsToOrderTotal(sms, 200, 2)

  assert.equal(result.matched, true)
  assert.equal(result.amount, 200)
  assert.equal(result.receiverName, 'Cassien Sindayigaya')
  assert.equal(result.receiverCode, '121464')
  assert.equal(result.txId, '29900112233')
})

test('parses a TxId-based MTN MoMo SMS with standard confirmation format', () => {
  const now = new Date()
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
  const sms = `TxId:29535479439*S*Your payment of 10,600 RWF to John Doe 121464 was completed at ${stamp}. Balance: 5,000 RWF.`

  const result = matchMoMoSmsToOrderTotal(sms, 10600, 2)

  assert.equal(result.matched, true)
  assert.equal(result.amount, 10600)
  assert.equal(result.txId, '29535479439')
  assert.equal(result.receiverName, 'John Doe')
  assert.equal(result.receiverCode, '121464')
})
