import { formatTaxMoney } from "@/lib/invoice/tax-invoice-view-model"
import type { TaxInvoiceLineItem } from "@/lib/invoice/tax-invoice-types"

type ItemsTableProps = {
  items: TaxInvoiceLineItem[]
  currency: string
}

export function ItemsTable({ items, currency }: ItemsTableProps) {
  return (
    <section className="tax-invoice-section">
      <h3 className="tax-invoice-section-title">Items</h3>
      <div className="tax-invoice-table-wrap">
        <table className="tax-invoice-table">
          <thead>
            <tr>
              <th className="text-left">Item Name</th>
              <th className="text-left">Code</th>
              <th className="text-right">Qty</th>
              <th className="text-center">Tax Code</th>
              <th className="text-right">Unit Price</th>
              <th className="text-right">Total Price</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={`${item.code}-${idx}`}>
                <td>{item.name}</td>
                <td className="font-mono text-xs">{item.code}</td>
                <td className="text-right tabular-nums">{item.qty}</td>
                <td className="text-center">{item.taxCode}</td>
                <td className="text-right tabular-nums">{formatTaxMoney(item.unitPrice, currency)}</td>
                <td className="text-right tabular-nums font-medium">
                  {formatTaxMoney(item.totalPrice, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
