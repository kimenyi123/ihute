import { NextResponse } from "next/server"
import {
  isOnboardingMysqlConfigured,
  persistShopOnboardingDraft,
} from "@/lib/onboarding-draft-persist"



/**

 * Optional onboarding draft — JSON only. Seller stock rows are written by Tomcat:

 * `POST {BACKEND_URL}/Api/grandma/sellers/stock` (proxied as `/api/grandma/sellers/stock`).

 *

 * Persistence (optional): in `.env.local`:

 *   ONBOARDING_MYSQL_HOST=127.0.0.1

 *   ONBOARDING_MYSQL_USER=root

 *   ONBOARDING_MYSQL_PASSWORD=...

 *   ONBOARDING_MYSQL_DATABASE=chaos_theta

 *

 * Create table when ready:

 *   CREATE TABLE shop_onboarding_draft (

 *     id BIGINT AUTO_INCREMENT PRIMARY KEY,

 *     payload_json JSON NOT NULL,

 *     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

 *   );

 */



async function tryPersistDraft(body: unknown): Promise<boolean> {
  if (!isOnboardingMysqlConfigured()) return false
  await persistShopOnboardingDraft(body)
  return true
}



export async function POST(req: Request) {

  const rid = crypto.randomUUID()

  try {

    const body = await req.json()

    if (!body || typeof body !== "object") {

      return NextResponse.json({ ok: false, error: "Invalid JSON", rid }, { status: 400 })

    }



    let persisted = false

    try {

      persisted = await tryPersistDraft(body)

    } catch (e: unknown) {

      console.warn(`[onboarding ${rid}] MySQL draft insert skipped or failed:`, (e as Error)?.message || e)

    }



    if (!process.env.ONBOARDING_MYSQL_HOST) {

      console.log(`[onboarding ${rid}] No ONBOARDING_MYSQL_* — draft not persisted (stock uses Java API)`)

    }



    return NextResponse.json({

      ok: true,

      rid,

      persisted,

      message: persisted

        ? "Stored draft (if table exists)."

        : "Received. Stock is saved via /api/grandma/sellers/stock. Set ONBOARDING_MYSQL_* to persist draft JSON.",

    })

  } catch (e: unknown) {

    console.error(`[onboarding ${rid}]`, e)

    return NextResponse.json({ ok: false, error: (e as Error)?.message || "error", rid }, { status: 500 })

  }

}

