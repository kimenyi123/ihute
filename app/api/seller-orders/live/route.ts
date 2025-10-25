// app/api/seller-orders/live/route.ts
import { NextRequest } from "next/server"
import { getRedis } from "@/lib/redis.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sellerAccount = String(searchParams.get("sellerAccount") || "").trim()
  if (!sellerAccount) {
    return new Response(JSON.stringify({ ok: false, error: "sellerAccount required" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    })
  }

  // Never throw if redis isn’t configured
  const baseRedis = (() => { try { return getRedis() } catch { return null } })()
  let closeRef: (() => void) | null = null

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder()
      let closed = false
      let hb: NodeJS.Timeout | null = null
      let sub: any = null
      const channel = `orders:${sellerAccount}`

      const safeEnqueue = (chunk: string) => {
        if (closed) return
        try { controller.enqueue(enc.encode(chunk)) } catch { closed = true }
      }
      const send = (data: any) => safeEnqueue(`data: ${JSON.stringify(data)}\n\n`)
      const sendEvent = (name: string, data: any) =>
        safeEnqueue(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`)

      const close = () => {
        if (closed) return
        closed = true
        if (hb) { clearInterval(hb); hb = null }
        if (sub) {
          try { sub.removeAllListeners?.() } catch {}
          try { sub.unsubscribe?.(channel).catch?.(() => {}) } catch {}
          try { sub.quit?.().catch?.(() => {}) } catch {}
          try { sub.disconnect?.() } catch {}
          sub = null
        }
        try { controller.close() } catch {}
      }
      closeRef = close

      sendEvent("open", { ok: true })
      hb = setInterval(() => { if (!closed) sendEvent("ping", {}) }, 25_000)

      if (!baseRedis) {
        send({ type: "NO_REDIS" })
        // @ts-ignore
        req.signal?.addEventListener?.("abort", close)
        return
      }

      ;(async () => {
        try {
          const conn = baseRedis.duplicate ? baseRedis.duplicate() : baseRedis
          sub = conn
          sub?.on?.("error", () => send({ type: "NO_REDIS" }))

          if (sub?.connect) {
            try { await sub.connect() } catch { send({ type: "NO_REDIS" }); return }
          }

          await sub.subscribe(channel, (message: string) => {
            if (closed) return
            try {
              const evt = JSON.parse(message)
              if (evt?.type === "NEW_ORDER") send(evt)
            } catch {}
          })
        } catch {
          send({ type: "NO_REDIS" })
        }
      })()

      // @ts-ignore
      req.signal?.addEventListener?.("abort", close)
    },
    cancel() { try { closeRef?.() } catch {} },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
