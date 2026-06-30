import type { OrderReceiptViewModel } from "@/lib/table-command-whatsapp"

function MoneyRow({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-mono tabular-nums font-medium text-slate-900">
        {amount.toLocaleString()} RWF
      </span>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
      {children}
    </div>
  )
}

export function OrderReceiptPreview({ receipt }: { receipt: OrderReceiptViewModel }) {
  return (
    <div className="space-y-5 text-sm text-slate-800">
      <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
        <SectionTitle>Order details</SectionTitle>
        <div className="space-y-2">
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Shop</span>
            <span className="text-right font-medium">{receipt.shop}</span>
          </div>
          {receipt.location ? (
            <div className="flex justify-between gap-4">
              <span className="text-slate-500 shrink-0">
                {receipt.location.startsWith("Table:") ? "Table" : "Location"}
              </span>
              <span className="text-right font-mono font-medium">
                {receipt.location.replace(/^Table:\s*/i, "")}
              </span>
            </div>
          ) : null}
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Order ID</span>
            <span className="font-mono font-semibold">{receipt.orderId}</span>
          </div>
          {receipt.momoTxId ? (
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">MoMo TxId</span>
              <span className="font-mono text-right break-all">{receipt.momoTxId}</span>
            </div>
          ) : null}
        </div>
        {receipt.description ? (
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-xs font-medium text-slate-500">Order note</div>
            <p className="mt-1 text-slate-800">{receipt.description}</p>
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        <SectionTitle>Items</SectionTitle>
        {receipt.isTableCommand && receipt.guestGroups.length > 0 ? (
          <div className="space-y-4">
            {receipt.guestGroups.map((group) => (
              <div
                key={group.guest}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white"
              >
                <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Ordered by: {group.guest}
                </div>
                <div className="divide-y divide-slate-100">
                  {group.rounds.map((round, roundIdx) => (
                    <div key={`${group.guest}-${roundIdx}`}>
                      {round.roundLabel ? (
                        <div className="bg-amber-50/80 px-4 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-amber-800">
                          {round.roundLabel}
                        </div>
                      ) : null}
                      {round.startedAtLabel ? (
                        <div className="border-b border-slate-100 bg-slate-50/90 px-4 py-1 text-center text-[10px] font-medium tracking-wide text-slate-500">
                          {round.startedAtLabel}
                        </div>
                      ) : null}
                      {round.lines.map((line, lineIdx) => (
                        <div
                          key={`${line.name}-${lineIdx}`}
                          className="flex items-center justify-between gap-3 px-4 py-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-slate-900">{line.name}</div>
                            <div className="text-xs text-slate-500">Qty {line.qty}</div>
                          </div>
                          <div className="shrink-0 font-mono tabular-nums font-medium">
                            {line.total.toLocaleString()} RWF
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
            {receipt.flatItems.map((line, idx) => (
              <div
                key={`${line.name}-${idx}`}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-900">{line.name}</div>
                  <div className="text-xs text-slate-500">Qty {line.qty}</div>
                </div>
                <div className="shrink-0 font-mono tabular-nums font-medium">
                  {line.total.toLocaleString()} RWF
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
        <SectionTitle>Summary</SectionTitle>
        <div className="space-y-2 pt-1">
          {typeof receipt.subtotal === "number" ? (
            <MoneyRow label="Subtotal" amount={receipt.subtotal} />
          ) : null}
          {typeof receipt.logisticsFee === "number" ? (
            <MoneyRow label="Logistics fee" amount={receipt.logisticsFee} />
          ) : null}
          <MoneyRow label="Discount" amount={receipt.discount} />
          <div className="border-t border-slate-100 pt-2">
            <MoneyRow label="Total" amount={receipt.total} />
          </div>
          <MoneyRow label="Paid" amount={receipt.paid} />
        </div>
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          <div className="flex justify-between gap-4 text-sm">
            <span className="text-slate-500">Paid at</span>
            <span className="font-medium text-right">{receipt.paidAt}</span>
          </div>
          {receipt.reference ? (
            <div className="flex justify-between gap-4 text-sm">
              <span className="text-slate-500">Message</span>
              <span className="font-mono text-right">{receipt.reference}</span>
            </div>
          ) : null}
          {receipt.myPhone ? (
            <div className="flex justify-between gap-4 text-sm">
              <span className="text-slate-500">My phone</span>
              <span className="font-mono tabular-nums text-right">{receipt.myPhone}</span>
            </div>
          ) : null}
        </div>
      </div>

      {receipt.followLink ? (
        <div className="rounded-xl bg-slate-100 p-4">
          <SectionTitle>Track order</SectionTitle>
          <a
            href={receipt.followLink}
            target="_blank"
            rel="noreferrer"
            className="mt-2 block break-all text-sm font-medium text-slate-900 underline underline-offset-2"
          >
            {receipt.followLink}
          </a>
        </div>
      ) : null}
    </div>
  )
}
