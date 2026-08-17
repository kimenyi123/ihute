import { formatTaxMoney } from "@/lib/invoice/tax-invoice-view-model"
import type { TaxInvoiceTotals } from "@/lib/invoice/tax-invoice-types"

type TotalsSectionProps = {
  totals: TaxInvoiceTotals
  currency: string
}

export function TotalsSection({ totals, currency }: TotalsSectionProps) {
  const rows = [
    { label: "TOTAL", value: totals.total },
    { label: "TOTAL A-EX", value: totals.totalAEx },
    { label: "TOTAL B-14%", value: totals.totalB14 },
    { label: "TOTAL TAX B", value: totals.totalTaxB },
    { label: "TOTAL C-0%", value: totals.totalC0 },
    { label: "TOTAL TAX", value: totals.totalTax },
  ]

  return (
    <section className="tax-invoice-section tax-invoice-totals">
      <table className="tax-invoice-totals-table">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="font-medium">{row.label}</td>
              <td className="text-right tabular-nums">{formatTaxMoney(row.value, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
