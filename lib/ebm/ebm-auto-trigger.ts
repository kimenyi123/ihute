import { isEbmAutoFiscalizeEnabled } from "@/lib/ebm/config"
import { ebmService } from "@/lib/ebm/ebm-service"

const COMPLETED_STATUSES = new Set(["delivered", "invoice", "completed"])

/**
 * Optional fire-and-forget EBM when an order is delivered (disabled by default).
 * Buyer-requested EBM always waits for seller approval — never auto-fiscalized here.
 */
export function triggerEbmAutoFiscalize(orderId: number, status?: string): void {
  if (!isEbmAutoFiscalizeEnabled()) return

  const st = String(status ?? "").toLowerCase()
  if (!COMPLETED_STATUSES.has(st)) return

  void ebmService.maybeAutoFiscalize(orderId).then((result) => {
    if (result) {
      console.info(
        `[EbmAutoTrigger] order=${orderId} status=${st} ebm=${result.ebmStatus} ok=${result.ok}`,
      )
    }
  }).catch((e: unknown) => {
    console.error(`[EbmAutoTrigger] order=${orderId} failed:`, e)
  })
}
