import { Loader2, RefreshCw } from 'lucide-react'
import { ConnectPrompt } from '@/components/ConnectPrompt'
import { TxList } from '@/components/TxList'
import { useArcWallet } from '@/hooks/useArcWallet'
import { useHistory } from '@/hooks/HistoryProvider'
import { formatDateTime } from '@/lib/format'

export function History() {
  const { isConnected } = useArcWallet()
  const { items, loading, loadingMore, hasMore, error, searchedBackTo, loadMore, refresh } = useHistory()

  if (!isConnected) {
    return <ConnectPrompt message="Connect a wallet to see the transactions sent from and received by your address." />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold tracking-tight">History</h1>
        <button
          type="button"
          onClick={() => void refresh()}
          className="flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-navy hover:bg-mist"
        >
          <RefreshCw className="size-4" /> Refresh
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {items.length > 0 && <TxList items={items} />}

      {loading && (
        <div className="flex items-center justify-center gap-2 rounded-3xl bg-white p-8 text-sm text-ink/60 ring-1 ring-ink/5">
          <Loader2 className="size-4 animate-spin" /> Searching Arc Mainnet for your activity...
        </div>
      )}

      {!loading && items.length === 0 && !error && (
        <div className="rounded-3xl bg-white p-8 text-center ring-1 ring-ink/5">
          <p className="font-medium">{hasMore ? 'No recent transactions found' : 'No transactions yet'}</p>
          <p className="mt-1 text-sm text-ink/60">
            {hasMore
              ? `Searched back to ${searchedBackTo ? formatDateTime(searchedBackTo) : 'recent blocks'}. Older activity may exist.`
              : 'Transactions you send or receive on Arc Mainnet will appear here.'}
          </p>
        </div>
      )}

      {!loading && hasMore && (
        <div className="space-y-2 text-center">
          {items.length > 0 && searchedBackTo && (
            <p className="text-xs text-ink/50">Searched back to {formatDateTime(searchedBackTo)}</p>
          )}
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="min-h-12 rounded-full bg-white px-6 text-sm font-medium text-navy ring-1 ring-ink/10 transition hover:bg-mist disabled:opacity-60"
          >
            {loadingMore ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Searching...
              </span>
            ) : (
              'Load more'
            )}
          </button>
        </div>
      )}

      {!loading && !hasMore && items.length > 0 && (
        <p className="text-center text-xs text-ink/50">You have reached the start of Arc Mainnet history.</p>
      )}
    </div>
  )
}
