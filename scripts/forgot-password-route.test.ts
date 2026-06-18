import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import mysql from 'mysql2/promise'

import {
  buildAuthEndpointInvalidResponse,
  buildResetFailureResponse,
  buildWrongEndpointResponse,
  isInvalidAuthEndpointResponse,
  shouldReturnControlledResetError,
} from '../app/api/auth/forgot-password/route'
import { resetPasswordViaMysql } from '../lib/forgot-password-mysql'
import { rwJavaLoginIdentifiers } from '../lib/rwanda-phone'

test('reports a controlled failure instead of fake success when the servlet returns bad JSON', () => {
  assert.equal(shouldReturnControlledResetError(null, true, 'no_db'), true)
})

test('reports a controlled failure instead of fake success when the servlet reports an unsupported action', () => {
  assert.equal(
    shouldReturnControlledResetError({ code: 'AUTH_UNKNOWN_ACTION', error: 'unknown action' }, false, null),
    true,
  )
})

test('builds a controlled reset-failure response with a clear message', async () => {
  const res = buildResetFailureResponse('rid-test')
  assert.equal(res.status, 503)
  const body = await res.json()
  assert.equal(body.ok, false)
  assert.equal(body.error, 'Password reset failed, please try again.')
})

test('wrong endpoint fails safely with an invalid-service code', async () => {
  const res = buildAuthEndpointInvalidResponse('rid-test')
  assert.equal(res.status, 503)
  const body = await res.json()
  assert.equal(body.code, 'AUTH_SERVICE_ENDPOINT_INVALID')
  assert.equal(body.message, 'Authentication service endpoint not reachable or misconfigured')
})

test('AUTH_CHANGE_PW_MISSING_CURRENT is treated as a wrong reset endpoint', async () => {
  const res = buildWrongEndpointResponse('rid-test')
  assert.equal(res.status, 503)
  const body = await res.json()
  assert.equal(body.code, 'AUTH_RESET_WRONG_ENDPOINT')
  assert.equal(body.message, 'Reset password is calling the wrong backend endpoint')
})

test('HTML responses are never treated as success and valid JSON is not flagged invalid', () => {
  assert.equal(isInvalidAuthEndpointResponse(200, 'text/html; charset=utf-8', '<html>404</html>'), true)
  assert.equal(isInvalidAuthEndpointResponse(200, 'application/json', '{"ok":true}'), false)
})

test('login identifiers normalize Rwanda phone input consistently', () => {
  const ids = rwJavaLoginIdentifiers('0788123456')
  assert.ok(ids.includes('250788123456'))
  assert.ok(ids.includes('0788123456'))
  assert.equal(new Set(ids).size, ids.length)
})

test('resetPasswordViaMysql reports success only when the DB update affects rows', async () => {
  const oldCreateConnection = mysql.createConnection
  const oldEnv = {
    host: process.env.FORGOT_PASSWORD_MYSQL_HOST,
    user: process.env.FORGOT_PASSWORD_MYSQL_USER,
    password: process.env.FORGOT_PASSWORD_MYSQL_PASSWORD,
    database: process.env.FORGOT_PASSWORD_MYSQL_DATABASE,
  }

  process.env.FORGOT_PASSWORD_MYSQL_HOST = 'localhost'
  process.env.FORGOT_PASSWORD_MYSQL_USER = 'root'
  process.env.FORGOT_PASSWORD_MYSQL_PASSWORD = 'secret'
  process.env.FORGOT_PASSWORD_MYSQL_DATABASE = 'test_db'

  const fakeConn = {
    query: async (sql: string) => {
      if (String(sql).includes('FROM test_db.account_buyer')) {
        return [[{ id: 42, tel: '+250788123456', loc_province: 'Kigali', loc_district: 'Gasabo', loc_cell: 'Kacyiru' }]]
      }
      if (String(sql).includes('UPDATE test_db.account_buyer SET pwd_hash=?')) {
        return [{ affectedRows: 1 }]
      }
      return [[]]
    },
    end: async () => {},
  }

  mock.method(mysql, 'createConnection', async () => fakeConn as never)

  try {
    const result = await resetPasswordViaMysql('0788123456', 'Kigali', 'NewPass123')
    assert.deepEqual(result, { ok: true })
  } finally {
    mock.restoreAll()
    mysql.createConnection = oldCreateConnection
    for (const [key, value] of Object.entries(oldEnv)) {
      if (value === undefined) {
        delete process.env[key === 'host' ? 'FORGOT_PASSWORD_MYSQL_HOST' : key === 'user' ? 'FORGOT_PASSWORD_MYSQL_USER' : key === 'password' ? 'FORGOT_PASSWORD_MYSQL_PASSWORD' : 'FORGOT_PASSWORD_MYSQL_DATABASE']
      } else {
        process.env[key === 'host' ? 'FORGOT_PASSWORD_MYSQL_HOST' : key === 'user' ? 'FORGOT_PASSWORD_MYSQL_USER' : key === 'password' ? 'FORGOT_PASSWORD_MYSQL_PASSWORD' : 'FORGOT_PASSWORD_MYSQL_DATABASE'] = value
      }
    }
  }
})
