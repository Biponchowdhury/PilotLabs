import { CheckCircle2, ExternalLink, Loader2, XCircle } from 'lucide-react'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { ARC_CHAIN_ID } from '@/lib/arc'
import { formatNative } from '@/lib/format'
import type { TxStatus } from '@/lib/history'

export interface SentTx {
  hash: `0x${string}`
  to: string
  value: bigint
}

export function SendStatus({ tx, status, note, onReset }: { tx: SentTx; status: TxStatus; note?: string; onReset: () => void }) {
  const link = buildTxExplorerUrl(ARC_CHAIN_ID, tx.hash)
  return (
    <div className="rounded-3xl bg-white p-6 ring-1 ring-ink/5" aria-live="polite">
      <div className="flex flex-col items-center text-center">
        {status === 'pending' && <Loader2 className="size-10 animate-spin text-navy" />}
        {status === 'confirmed' && <CheckCircle2 className="size-10 text-emerald-600" />}
        {status === 'failed' && <XCircle className="size-10 text-red-600" />}
        <h2 className="mt-3 font-display text-xl font-semibold tracking-tight">
          {status === 'pending' && 'Waiting for confirmation'}
          {status === 'confirmed' && 'Transfer confirmed'}
          {status === 'failed' && 'Transfer failed'}
        </h2>
        <p className="mt-1 text-sm text-ink/60">
          {status === 'pending' && 'Submitted to Arc Mainnet. You can leave this page; the status keeps updating in History.'}
          {status === 'confirmed' && `${formatNative(tx.value)} USDC was confirmed onchain.`}
          {status === 'failed' && (note ?? 'The transaction did not complete. Check the explorer for details.')}
        </p>
      </div>
      <dl className="mt-5 space-y-3 rounded-2xl bg-canvas p-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-ink/60">Amount</dt>
          <dd className="font-medium tabular-nums">{formatNative(tx.value)} USDC</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink/60">To</dt>
          <dd className="break-all text-right font-mono text-xs">{tx.to}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink/60">Transaction hash</dt>
          <dd className="break-all text-right font-mono text-xs">{tx.hash}</dd>
        </div>
      </dl>
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 flex min-h-11 items-center justify-center gap-1.5 text-sm font-medium text-navy hover:underline"
      >
        View on Arc Explorer <ExternalLink className="size-4" />
      </a>
      {status !== 'pending' && (
        <button
          type="button"
          onClick={onReset}
          className="mt-2 min-h-12 w-full rounded-full bg-navy font-medium text-white transition hover:bg-ink"
        >
          {status === 'confirmed' ? 'Send another' : 'Try again'}
        </button>
      )}
    </div>
  )
}
