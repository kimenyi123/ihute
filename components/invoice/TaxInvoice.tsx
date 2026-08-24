import { BuyerInfo } from "@/components/invoice/BuyerInfo"
import { InvoiceQRCode } from "@/components/invoice/InvoiceQRCode"
import { ItemsTable } from "@/components/invoice/ItemsTable"
import { SDCInformation } from "@/components/invoice/SDCInformation"
import { SellerInfo } from "@/components/invoice/SellerInfo"
import { TotalsSection } from "@/components/invoice/TotalsSection"
import type { TaxInvoiceViewModel } from "@/lib/invoice/tax-invoice-types"

import "./tax-invoice.css"

type TaxInvoiceProps = {
  invoice: TaxInvoiceViewModel
  className?: string
}

export function TaxInvoice({ invoice, className }: TaxInvoiceProps) {
  return (
    <article
      id="tax-invoice-root"
      className={`tax-invoice ${className ?? ""}`.trim()}
      aria-label={`Tax invoice ${invoice.meta.invoiceNumber}`}
    >
      <header className="tax-invoice-header">
        <h1 className="tax-invoice-title">TAX INVOICE</h1>
        <div className="tax-invoice-meta-block">
          <span className="tax-invoice-meta-label">Invoice Number</span>
          <span className="tax-invoice-meta-value font-mono">{invoice.meta.invoiceNumber}</span>
        </div>
      </header>

      <div className="tax-invoice-parties">
        <SellerInfo seller={invoice.seller} />
        <div className="tax-invoice-buyer-col">
          <BuyerInfo buyer={invoice.buyer} />
          <div className="tax-invoice-date-block">
            <span className="tax-invoice-meta-label">Invoice Date</span>
            <span className="tax-invoice-meta-value">{invoice.meta.invoiceDate}</span>
          </div>
        </div>
      </div>

      <ItemsTable items={invoice.items} currency={invoice.currency} />
      <TotalsSection totals={invoice.totals} currency={invoice.currency} />

      <div className="tax-invoice-sdc-row">
        <SDCInformation sdc={invoice.sdc} />
        <InvoiceQRCode value={invoice.sdc.qrContent} show={invoice.sdc.showQr} />
      </div>

      {!invoice.isFiscalized ? (
        <p className="tax-invoice-note">
          This is a provisional invoice. SDC information and QR code appear after successful EBM
          fiscalization.
        </p>
      ) : null}

      <footer className="tax-invoice-footer">
        Powered by {invoice.appName}
      </footer>
    </article>
  )
}
