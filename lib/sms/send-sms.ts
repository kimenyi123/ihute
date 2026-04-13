/**
 * Optional SMS delivery for server routes. Configure one of:
 * - TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM_NUMBER (E.164)
 * - SMS_WEBHOOK_URL (+ optional SMS_WEBHOOK_SECRET header) POST JSON { to, body }
 */

export type SendSmsResult = { ok: boolean; error?: string; provider?: "twilio" | "webhook" | "none" }

function getTwilio(): { sid: string; token: string; from: string } | null {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM_NUMBER
  if (!sid || !token || !from) return null
  return { sid, token, from }
}

export async function sendSms(toE164: string, body: string): Promise<SendSmsResult> {
  const twilio = getTwilio()
  if (twilio) {
    const auth = Buffer.from(`${twilio.sid}:${twilio.token}`).toString("base64")
    const url = `https://api.twilio.com/2010-04-01/Accounts/${twilio.sid}/Messages.json`
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: toE164,
        From: twilio.from,
        Body: body,
      }),
    })
    if (!res.ok) {
      const t = await res.text()
      return { ok: false, error: t.slice(0, 300), provider: "twilio" }
    }
    return { ok: true, provider: "twilio" }
  }

  const hook = process.env.SMS_WEBHOOK_URL
  if (hook) {
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    const secret = process.env.SMS_WEBHOOK_SECRET
    if (secret) headers["X-Secret"] = secret
    const res = await fetch(hook, {
      method: "POST",
      headers,
      body: JSON.stringify({ to: toE164, body }),
    })
    if (!res.ok) {
      const t = await res.text()
      return { ok: false, error: t.slice(0, 300), provider: "webhook" }
    }
    return { ok: true, provider: "webhook" }
  }

  return { ok: false, error: "SMS not configured", provider: "none" }
}
