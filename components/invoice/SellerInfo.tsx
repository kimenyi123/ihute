import type { TaxInvoiceSeller } from "@/lib/invoice/tax-invoice-types"

type SellerInfoProps = {
  seller: TaxInvoiceSeller
}

export function SellerInfo({ seller }: SellerInfoProps) {
  return (
    <section className="tax-invoice-section">
      <h3 className="tax-invoice-section-title">Seller Information</h3>
      <dl className="tax-invoice-dl">
        <div>
          <dt>Company Name</dt>
          <dd>{seller.companyName}</dd>
        </div>
        <div>
          <dt>Address</dt>
          <dd>{seller.address}</dd>
        </div>
        <div>
          <dt>Phone</dt>
          <dd>{seller.phone}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{seller.email}</dd>
        </div>
      </dl>
    </section>
  )
}
