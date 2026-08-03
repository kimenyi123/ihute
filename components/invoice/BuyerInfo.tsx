import type { TaxInvoiceBuyer } from "@/lib/invoice/tax-invoice-types"

type BuyerInfoProps = {
  buyer: TaxInvoiceBuyer
}

export function BuyerInfo({ buyer }: BuyerInfoProps) {
  return (
    <section className="tax-invoice-section">
      <h3 className="tax-invoice-section-title">Buyer Information</h3>
      <dl className="tax-invoice-dl">
        <div>
          <dt>Buyer Name</dt>
          <dd>{buyer.name}</dd>
        </div>
      </dl>
    </section>
  )
}
