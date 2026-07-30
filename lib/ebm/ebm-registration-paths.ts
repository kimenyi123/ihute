import type { EbmConfig } from "@/lib/ebm/config"
import { normalizeEndpointPath } from "@/lib/ebm/config/ebm.endpoints"

/** Fallback registration paths when primary EBM_REGISTER_PATH returns 404. */
export const EBM_REGISTRATION_PATH_CANDIDATES = [
  "/vsdc/post_parameter_vsdc_Json",
  "/vsdc/Send_Vsdc_parameter_lite_json",
  "/vsdc/Save_Vsdc_parameter_lite_json",
  "/vsdc/Register_Vsdc_Company_lite_json",
  "/vsdc/Send_Vsdc_Company_lite_json",
  "/vsdc/post_company_parameter_vsdc_Json",
  "/vsdc/register_parameter_vsdc_Json",
] as const

export function uniqueRegistrationPaths(configuredPath: string): string[] {
  const normalized = normalizeEndpointPath(configuredPath)
  const set = new Set<string>([normalized, ...EBM_REGISTRATION_PATH_CANDIDATES])
  return [...set]
}

export function getItemSyncPath(cfg: EbmConfig): string | undefined {
  return cfg.endpoints.itemSync
}
