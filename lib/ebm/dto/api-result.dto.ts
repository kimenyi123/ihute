/** Debug envelope returned to frontend for EBM troubleshooting. */

export type EbmDebugEnvelope = {
  requestPayload: unknown
  responsePayload: unknown
  statusCode: number
  errorMessage?: string
  endpoint?: string
  method?: string
}

export function buildEbmDebugEnvelope(args: {
  requestPayload: unknown
  responsePayload: unknown
  statusCode: number
  errorMessage?: string
  endpoint?: string
  method?: string
}): EbmDebugEnvelope {
  return {
    requestPayload: args.requestPayload,
    responsePayload: args.responsePayload,
    statusCode: args.statusCode,
    errorMessage: args.errorMessage,
    endpoint: args.endpoint,
    method: args.method,
  }
}
