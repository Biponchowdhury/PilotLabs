import { ArrowDownLeft, ArrowUpRight, ExternalLink, Loader2 } from 'lucide-react'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { ARC_CHAIN_ID } from '@/lib/arc'
import { formatDateTime, formatNative, shortAddress, shortHash } from '@/lib/format'
import type { HistoryItem, TxStatus } from '@/lib/history'

const STATUS_STYLE: Record<TxStatus, string> = {
  pending: 'bg-amber-50 text-amber-800 ring-amber-200',
  confirmed: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  failed: 'bg-red-50 text-red-800 ring-red-200',
}

const STATUS_LABEL: Record<TxStatus, string> = { pending: 'Pending', confirmed: 'Confirmed', failed: 'Failed' }

export function StatusBadge({ status }: { status: TxStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${STATUS_STYLE[status]}`}>
      {status === 'pending' && <Loader2 className="size-3 animate-spin" />}
      {STATUS_LABEL[status]}
    </span>
  )
}

export function TxRow({ item }: { item: HistoryItem }) {
  const sent = item.direction === 'sent'
  return (
    <li className="px-4 py-3.5">
      <div className="flex items-center gap-3">
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${sent ? 'bg-mist text-navy' : 'bg-emerald-50 text-emerald-700'}`}>
          {sent ? <ArrowUpRight className="size-5" /> : <ArrowDownLeft className="size-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium">{sent ? 'Sent' : 'Received'}</p>
            <p className={`font-display font-semibold tabular-nums ${sent ? 'text-ink' : 'text-emerald-700'}`}>
              {sent ? '-' : '+'}
              {formatNative(item.value)} <span className="text-xs font-medium text-ink/50">USDC</span>
            </p>
          </div>
          <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-ink/55">
            <p className="truncate font-mono">
              {sent ? 'To' : 'From'} {shortAddress(item.counterparty)}
            </p>
            <StatusBadge status={item.status} />
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pl-[52px] text-xs text-ink/50">
        <span>{item.timestamp ? formatDateTime(item.timestamp) : 'Time unavailable'}</span>
        <a
          href={buildTxExplorerUrl(ARC_CHAIN_ID, item.hash)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-6 items-center gap-1 font-mono text-navy hover:underline"
        >
          {shortHash(item.hash)}
          <ExternalLink className="size-3" />
        </a>
      </div>
      {item.note && <p className="mt-1 pl-[52px] text-xs text-red-700">{item.note}</p>}
    </li>
  )
}

export function TxList({ items }: { items: HistoryItem[] }) {
  return (
    <ul className="divide-y divide-ink/5 overflow-hidden rounded-3xl bg-white ring-1 ring-ink/5">
      {items.map((item) => (
        <TxRow key={item.id} item={item} />
      ))}
    </ul>
  )
}
