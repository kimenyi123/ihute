import type { TaxInvoiceSdc } from "@/lib/invoice/tax-invoice-types"

type SDCInformationProps = {
  sdc: TaxInvoiceSdc
}

export function SDCInformation({ sdc }: SDCInformationProps) {
  if (!sdc.showSdc) return null

  return (
    <section className="tax-invoice-section">
      <h3 className="tax-invoice-section-title">SDC Information</h3>
      <dl className="tax-invoice-dl tax-invoice-sdc-dl">
        <div>
          <dt>TIME SDC</dt>
          <dd className="font-mono text-xs break-all">{sdc.timeSdc}</dd>
        </div>
        <div>
          <dt>SDC ID</dt>
          <dd className="font-mono text-xs break-all">{sdc.sdcId}</dd>
        </div>
        <div>
          <dt>RECEIPT NUMBER</dt>
          <dd className="font-mono text-xs break-all">{sdc.receiptNumber}</dd>
        </div>
        <div>
          <dt>Internal Data</dt>
          <dd className="font-mono text-xs break-all">{sdc.internalData}</dd>
        </div>
        <div>
          <dt>Receipt Signature</dt>
          <dd className="font-mono text-xs break-all">{sdc.receiptSignature}</dd>
        </div>
        <div>
          <dt>MRC</dt>
          <dd className="font-mono text-xs break-all">{sdc.mrc}</dd>
        </div>
      </dl>
    </section>
  )
}
