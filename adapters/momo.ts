/**
 * MoMo payments adapter for the eRx market flow.
 *
 * TODO(real): the MoMo rail is NOT wired yet. This stub validates the input,
 * mints a reference in the shape the flow expects ("MP" + 9 digits) and
 * resolves immediately. To go live, replace `createMomoPaymentIntent` with the
 * MTN MoMo Collections request-to-pay call (see lib/payment-utils.ts for how
 * existing order payments resolve status) and poll/webhook the intent status
 * before releasing the order to the pharmacy POS.
 */

export type MomoPaymentIntent = {
  ref: string
  status: "SIMULATED" | "PENDING"
  amountRwf: number
  phone: string
}

export async function createMomoPaymentIntent(input: {
  phone: string
  amountRwf: number
  orderId: string
  description: string
}): Promise<MomoPaymentIntent> {
  const phone = input.phone.replace(/\s+/g, "")
  if (phone.length < 8) throw new Error("MOMO_PHONE_INVALID")
  if (!Number.isFinite(input.amountRwf) || input.amountRwf <= 0) {
    throw new Error("MOMO_AMOUNT_INVALID")
  }
  // TODO(real): POST to MoMo Collections /requesttopay here.
  return {
    ref: "MP" + Math.floor(1e8 + Math.random() * 9e8),
    status: "SIMULATED",
    amountRwf: Math.round(input.amountRwf),
    phone,
  }
}
