export { EbmClient, EbmHttpClient } from "./client/ebm.client"
export type { EbmSendOptions, EbmSendResult } from "./client/ebm.client"

/** @deprecated Use EbmSendResult from client */
export type EbmClientResult = import("./client/ebm.client").EbmSendResult & {
  parsed?: import("./types").EbmParsedResponse
  registrationRequired?: boolean
}
