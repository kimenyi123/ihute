import {
  buildTableCommandView,
  formatTableRoundTimestamp,
  type TableCommandLineItem,
} from "@/lib/table-command-whatsapp"

/** Desktop column layout — header + data rows share this */
const ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_2.75rem_4.5rem_minmax(5.5rem,auto)] gap-x-3 items-center px-4"

type LineMeta = {
  servedQty: number
  requestedPrice: number
  servedPrice: number
  code: string
}

type Props = {
  items: TableCommandLineItem[]
  lineMetaById: Map<number, LineMeta>
  currency: string
  formatAmount: (n: number) => string
}

function RoundDivider({
  roundNumber,
  startedAtLabel,
}: {
  roundNumber: number
  startedAtLabel?: string
}) {
  return (
    <div className="border-t border-dashed border-slate-200 bg-slate-50/80 px-4 py-2">
      {roundNumber > 1 ? (
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="shrink-0 rounded-full bg-white px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-600 ring-1 ring-slate-200">
            Round {roundNumber}
          </span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>
      ) : null}
      {startedAtLabel ? (
        <div className="mt-1 text-center text-[10px] font-medium tracking-wide text-slate-500">
          {startedAtLabel}
        </div>
      ) : null}
    </div>
  )
}

function LineRowMobile(props: {
  line: { name: string; qty: number; total: number; lineId?: number | null }
  meta?: LineMeta
  currency: string
  formatAmount: (n: number) => string
  showBorder: boolean
}) {
  const { line, meta, currency, formatAmount, showBorder } = props
  const servedQty = meta?.servedQty ?? 0
  const totalServed = servedQty * (meta?.servedPrice ?? 0)

  return (
    <div className={`px-3 py-3 space-y-2 ${showBorder ? "border-t border-slate-100" : ""}`}>
      <div>
        <div className="font-medium text-slate-900">{line.name}</div>
        {meta?.code ? <div className="text-xs text-slate-500 break-all">{meta.code}</div> : null}
      </div>
      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-xs text-slate-500 uppercase">Qty</dt>
          <dd className="font-mono tabular-nums">{formatAmount(line.qty)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500 uppercase">Served</dt>
          <dd className="font-mono tabular-nums text-slate-600">{formatAmount(servedQty)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500 uppercase">Total</dt>
          <dd className="font-mono tabular-nums font-medium">
            {formatAmount(line.total)} {currency}
          </dd>
        </div>
      </dl>
      {servedQty > 0 && totalServed !== line.total ? (
        <div className="text-xs text-slate-500 text-right">
          Served total: {formatAmount(totalServed)} {currency}
        </div>
      ) : null}
    </div>
  )
}

export function TableCommandOrderItems({ items, lineMetaById, currency, formatAmount }: Props) {
  const view = buildTableCommandView(items)

  if (!view.length) {
    return <p className="text-sm text-slate-500">No items on this table order.</p>
  }

  return (
    <div className="text-sm">
      <div
        className={`${ROW_GRID} hidden md:grid border-b py-2 text-xs font-medium uppercase tracking-wide text-slate-500`}
      >
        <span>Item</span>
        <span className="text-right whitespace-nowrap">Qty</span>
        <span className="text-right whitespace-nowrap">Served</span>
        <span className="text-right whitespace-nowrap">Total</span>
      </div>

      <div className="space-y-4 md:pt-2">
        {view.map((guest) => (
          <div key={guest.person} className="rounded-lg border bg-white overflow-hidden">
            <div className="border-b bg-slate-50 px-3 sm:px-4 py-2">
              <h3 className="font-semibold uppercase tracking-wide text-slate-900">{guest.person}</h3>
            </div>

            {guest.rounds.map((round) => (
              <div key={`${guest.person}-round-${round.roundNumber}`}>
                {round.roundNumber > 1 || round.roundStartedAt ? (
                  <RoundDivider
                    roundNumber={round.roundNumber}
                    startedAtLabel={formatTableRoundTimestamp(round.roundStartedAt)}
                  />
                ) : null}

                {round.items.map((line, lineIdx) => {
                  const meta = line.lineId != null ? lineMetaById.get(Number(line.lineId)) : undefined
                  const servedQty = meta?.servedQty ?? 0
                  const totalServed = servedQty * (meta?.servedPrice ?? line.unitPrice)
                  const showBorder = round.roundNumber > 1 ? false : lineIdx > 0

                  return (
                    <div key={`${guest.person}-${line.lineId ?? line.name}-${round.roundNumber}-${lineIdx}`}>
                      <div className="md:hidden">
                        <LineRowMobile
                          line={line}
                          meta={meta}
                          currency={currency}
                          formatAmount={formatAmount}
                          showBorder={showBorder || round.roundNumber > 1}
                        />
                      </div>

                      <div
                        className={`${ROW_GRID} hidden md:grid py-2.5 ${
                          showBorder && round.roundNumber === 1 ? "border-t border-slate-100" : ""
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900">{line.name}</div>
                          {meta?.code ? (
                            <div className="text-xs text-slate-500 break-all">{meta.code}</div>
                          ) : null}
                        </div>
                        <div className="text-right font-mono tabular-nums">{formatAmount(line.qty)}</div>
                        <div className="text-right font-mono tabular-nums text-slate-600">
                          {formatAmount(servedQty)}
                        </div>
                        <div className="text-right font-mono tabular-nums whitespace-nowrap">
                          <div>
                            {formatAmount(line.total)} {currency}
                          </div>
                          {servedQty > 0 && totalServed !== line.total ? (
                            <div className="text-xs text-slate-500">
                              Served: {formatAmount(totalServed)}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
