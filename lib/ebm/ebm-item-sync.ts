import type { AdminOrderLine } from "@/lib/ebm/types"
import type { EbmConfig } from "@/lib/ebm/config"
import { EbmHttpClient } from "@/lib/ebm/client/ebm.client"
import { getItemSyncPath } from "@/lib/ebm/ebm-registration-paths"
import { parseEbmRegistrationResponse } from "@/lib/ebm/ebm-registration-parser"

function str(v: unknown): string {
  if (v == null) return ""
  return String(v).trim()
}

/** Register order line items on VSDC — required on some servers before invoice. */
export async function syncOrderItemsOnVsdc(args: {
  cfg: EbmConfig
  companyTin: string
  userName: string
  orderId: number
  items: AdminOrderLine[]
}): Promise<{ ok: boolean; error?: string; rawText?: string; debug?: unknown }> {
  const { cfg, companyTin, userName, orderId, items } = args
  const tin = companyTin.trim()
  const itemSyncPath = getItemSyncPath(cfg)

  if (!itemSyncPath) {
    return { ok: false, error: "EBM_ITEM_SYNC_PATH is not configured" }
  }
  if (!tin || items.length === 0) {
    return { ok: false, error: "No items to sync" }
  }

  const itemClass = process.env.EBM_DEFAULT_ITEM_CLASS?.trim()
  if (!itemClass) {
    return { ok: false, error: "EBM_DEFAULT_ITEM_CLASS is not configured" }
  }

  const mapped = items.map((line, idx) => ({
    description: str(line.itemName) || `Item ${idx + 1}`,
    itemClsCd: itemClass,
    itemCd: str(line.itemCode) || `ITEM-${orderId}-${idx + 1}`,
    taxCode: Number(line.vatRate) > 0 ? "B" : "A",
  }))

  const defaultUsername = process.env.EBM_DEFAULT_USERNAME?.trim() || userName
  const payload = {
    companyTin: tin,
    reference: `EBM-ITEMS-${orderId}-${Date.now()}`,
    userName: defaultUsername,
    requestDate: new Date().toISOString().slice(0, 10),
    items: mapped,
  }

  const client = new EbmHttpClient(cfg)
  const res = await client.send({
    path: itemSyncPath,
    method: "POST",
    body: payload,
    companyTin: tin,
  })

  const parsed = parseEbmRegistrationResponse(res.body, res.rawText)
  if (parsed.ok) {
    return { ok: true, rawText: res.rawText, debug: res.body }
  }

  return {
    ok: false,
    error: parsed.error || res.error || `Item sync HTTP ${res.httpStatus}`,
    rawText: res.rawText,
    debug: res.body,
  }
}
