/**
 * Auto Guest User Creator - Creates individual guest users automatically
 * No environment setup required - uses existing MySQL connection
 */

import mysql from "mysql2/promise"
import { getGuestCheckoutEmail } from "./guest-checkout"

// Use same MySQL config as guest-pool
const GUEST_MYSQL = {
  host: "localhost",
  user: "root", 
  password: "Algo@12345",
  database: "chaos_test",
} as const

let pool: mysql.Pool | null = null

function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      ...GUEST_MYSQL,
      waitForConnections: true,
      connectionLimit: 4,
      queueLimit: 0,
    })
  }
  return pool
}

/**
 * Generate unique guest account name
 */
function generateGuestAccount(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 8)
  return `GUEST_${timestamp}_${random}`
}

/**
 * Auto-create a guest user with minimal required fields
 * No environment variables needed - uses hardcoded MySQL connection
 */
export async function createAutoGuestUser(buyerInfo?: {
  name?: string
  phone?: string
  location?: string
}): Promise<{
  ok: boolean
  ishyigaAccount?: string
  email?: string
  error?: string
}> {
  try {
    const email = getGuestCheckoutEmail()
    const ishyigaAccount = generateGuestAccount()
    
    const p = getPool()
    
    // Insert guest user with minimal required fields
    await p.execute(`
      INSERT INTO account_signup (
        EMAIL, 
        ISHYIGA_ACCOUNT, 
        OWNER, 
        TEL, 
        HQ_LOCATION,
        TYPE,
        STATUS,
        CREATED_AT
      ) VALUES (?, ?, ?, ?, ?, 'GUEST', 'LIVE', NOW())
    `, [
      email,
      ishyigaAccount,
      buyerInfo?.name || email.split('@')[0], // Use email prefix as name
      buyerInfo?.phone || "",
      buyerInfo?.location || "",
    ])

    console.log(`[AutoGuest] Created guest user: ${ishyigaAccount} / ${email}`)
    
    return {
      ok: true,
      ishyigaAccount,
      email,
    }
    
  } catch (e: unknown) {
    const err = e as { code?: string; errno?: number; message?: string }
    
    // Handle duplicate entry
    if (err.code === "ER_DUP_ENTRY" || err.errno === 1062) {
      console.log(`[AutoGuest] Guest user already exists, returning existing`)
      // Try to get existing account
      const email = getGuestCheckoutEmail()
      return {
        ok: true,
        email,
        ishyigaAccount: `GUEST_${email.split('_')[1]}`, // Extract from existing email
      }
    }
    
    return {
      ok: false,
      error: err.message || String(e),
    }
  }
}

/**
 * Get or create guest user automatically
 * This is the main function to call for guest checkout
 */
export async function getOrCreateAutoGuest(buyerInfo?: {
  name?: string
  phone?: string
  location?: string
}): Promise<{
  ok: boolean
  ishyigaAccount?: string
  email?: string
  isNew?: boolean
  error?: string
}> {
  const email = getGuestCheckoutEmail()
  
  // First try to find existing guest user
  try {
    const p = getPool()
    const [rows] = await p.execute(
      "SELECT ISHYIGA_ACCOUNT FROM account_signup WHERE EMAIL = ? AND TYPE = 'GUEST'",
      [email]
    ) as [any[], any]
    
    if (rows.length > 0) {
      return {
        ok: true,
        ishyigaAccount: rows[0].ISHYIGA_ACCOUNT,
        email,
        isNew: false,
      }
    }
  } catch (e) {
    console.warn("[AutoGuest] Failed to check existing guest:", e)
  }
  
  // Create new guest user
  const result = await createAutoGuestUser(buyerInfo)
  return {
    ...result,
    isNew: result.ok,
  }
}

/**
 * API endpoint wrapper for frontend calls
 */
export async function ensureAutoGuestAccount(buyerInfo?: {
  name?: string
  phone?: string
  location?: string
}) {
  return await getOrCreateAutoGuest(buyerInfo)
}
