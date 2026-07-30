import type { EbmConfig } from "@/lib/ebm/config"
import {
  getEbmRegisterCheckPath,
  getEbmRegisterPath,
  isEbmAutoRegisterEnabled,
} from "@/lib/ebm/config"
import { EbmHttpClient } from "@/lib/ebm/client/ebm.client"
import { syncOrderItemsOnVsdc } from "@/lib/ebm/ebm-item-sync"
import {
  mapCompanyRegistration,
  validateRegistrationConfig,
} from "@/lib/ebm/ebm-registration-mapper"
import { parseEbmRegistrationResponse } from "@/lib/ebm/ebm-registration-parser"
import { uniqueRegistrationPaths } from "@/lib/ebm/ebm-registration-paths"
import { EbmRegistrationRepository } from "@/lib/ebm/ebm-registration-repository"
import type { EbmRegistrationResult } from "@/lib/ebm/ebm-registration-types"
import type { AdminOrderLine } from "@/lib/ebm/types"

export type EnsureRegisteredInput = {
  cfg: EbmConfig
  companyTin: string
  userName?: string
  sellerName?: string
  orderId?: number
  items?: AdminOrderLine[]
  /** Skip DB cache and call registration API again. */
  force?: boolean
}

/**
 * Registration service — ensures company TIN exists on VSDC before invoice approval.
 *
 * Flow:
 * 1. Check local DB cache (ebm_company_registrations)
 * 2. Optional remote GET check (EBM_REGISTER_CHECK_PATH)
 * 3. POST registration payload to VSDC (with path fallback)
 * 4. Optional item sync bootstrap (EBM_ITEM_SYNC_PATH)
 */
export class EbmRegistrationService {
  private readonly repo = new EbmRegistrationRepository()

  async isRegisteredLocally(companyTin: string, cfg: EbmConfig): Promise<boolean> {
    const row = await this.repo.findRegistered({
      companyTin,
      securityKey: cfg.securityKey,
    })
    return row?.status === "registered"
  }

  async checkRegistrationRemote(companyTin: string, cfg: EbmConfig): Promise<boolean | null> {
    const checkPath = getEbmRegisterCheckPath(cfg)
    if (!checkPath) return null

    const client = new EbmHttpClient(cfg)
    const res = await client.send({
      path: checkPath,
      method: "GET",
      query: { companyTin },
      companyTin,
    })

    if (res.httpStatus === 404) return null
    if (!res.ok) return false

    const parsed = parseEbmRegistrationResponse(res.body, res.rawText)
    return parsed.ok
  }

  async registerCompany(input: EnsureRegisteredInput): Promise<EbmRegistrationResult> {
    const { cfg, companyTin, userName, sellerName, force } = input
    const tin = companyTin.trim()

    if (!tin) {
      return { ok: false, status: "failed", error: "companyTin is required" }
    }

    if (!force) {
      const cached = await this.repo.findRegistered({
        companyTin: tin,
        securityKey: cfg.securityKey,
      })
      if (cached?.status === "registered") {
        return {
          ok: true,
          status: "registered",
          vsdcId: cached.vsdcId,
          distributorTin: cached.distributorTin,
          alreadyRegistered: true,
        }
      }
    }

    const validation = validateRegistrationConfig()
    if (!validation.valid) {
      const msg = `Missing registration config: ${validation.missingFields.join(", ")}`
      return { ok: false, status: "failed", error: msg }
    }

    const payload = mapCompanyRegistration({ companyTin: tin, userName, sellerName })
    const paths = uniqueRegistrationPaths(getEbmRegisterPath(cfg))
    const client = new EbmHttpClient(cfg)

    let lastError = "Registration failed"
    let lastRaw = ""

    for (const registerPath of paths) {
      const res = await client.send({
        path: registerPath,
        method: "POST",
        body: payload,
        companyTin: tin,
      })

      if (res.httpStatus === 404) {
        lastError = `Registration endpoint not found (${registerPath})`
        lastRaw = res.rawText
        continue
      }

      const parsed = parseEbmRegistrationResponse(res.body, res.rawText)
      lastRaw = res.rawText

      if (parsed.ok) {
        await this.repo.saveRegistration({
          companyTin: tin,
          securityKey: cfg.securityKey,
          status: "registered",
          vsdcId: parsed.vsdcId,
          distributorTin: parsed.distributorTin,
          rawRequest: payload,
          rawResponse: res.body,
        })
        return parsed
      }

      lastError = parsed.error || res.error || `Registration HTTP ${res.httpStatus}`
    }

    if (input.orderId && input.items && input.items.length > 0) {
      const itemSync = await syncOrderItemsOnVsdc({
        cfg,
        companyTin: tin,
        userName: userName || process.env.EBM_DEFAULT_USERNAME?.trim() || "",
        orderId: input.orderId,
        items: input.items,
      })
      if (itemSync.ok) {
        await this.repo.saveRegistration({
          companyTin: tin,
          securityKey: cfg.securityKey,
          status: "registered",
          rawRequest: payload,
          rawResponse: itemSync.debug ?? { source: "item_sync" },
        })
        return { ok: true, status: "registered", rawText: itemSync.rawText }
      }
      lastError = itemSync.error || lastError
    }

    await this.repo.saveRegistration({
      companyTin: tin,
      securityKey: cfg.securityKey,
      status: "failed",
      rawRequest: payload,
      rawResponse: lastRaw ? parseResponseSafe(lastRaw) : null,
      errorMessage: lastError,
    })

    return { ok: false, status: "failed", error: lastError, rawText: lastRaw }
  }

  /**
   * Pre-check registration before invoice approval.
   * Uses DB cache + optional remote GET. Does not block when check endpoint is unavailable.
   */
  async ensureRegistered(input: EnsureRegisteredInput): Promise<EbmRegistrationResult> {
    if (!isEbmAutoRegisterEnabled()) {
      const local = await this.isRegisteredLocally(input.companyTin, input.cfg)
      if (local) {
        return { ok: true, status: "registered", alreadyRegistered: true }
      }
      return { ok: true, status: "unknown" }
    }

    const { companyTin, cfg } = input
    const tin = companyTin.trim()

    if (await this.isRegisteredLocally(tin, cfg)) {
      return { ok: true, status: "registered", alreadyRegistered: true }
    }

    const remote = await this.checkRegistrationRemote(tin, cfg)
    if (remote === true) {
      await this.repo.saveRegistration({
        companyTin: tin,
        securityKey: cfg.securityKey,
        status: "registered",
        rawResponse: { source: "register_check" },
      })
      return { ok: true, status: "registered" }
    }

    if (remote === false) {
      return this.registerCompany(input)
    }

    return { ok: true, status: "unknown" }
  }
}

function parseResponseSafe(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

export const ebmRegistrationService = new EbmRegistrationService()
