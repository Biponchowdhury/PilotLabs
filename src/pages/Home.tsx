import { ArrowDownLeft, ArrowUpRight, Loader2 } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { ConnectPrompt } from '@/components/ConnectPrompt'
import { TxList } from '@/components/TxList'
import type { Tab } from '@/components/Header'
import { useArcWallet } from '@/hooks/useArcWallet'
import { useHistory } from '@/hooks/HistoryProvider'
import { formatNative } from '@/lib/format'

export function Home({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const { address, isConnected, isOnArc, balanceRaw, balanceLoading, balanceError } = useArcWallet()
  const { items, loading, error, hasMore } = useHistory()

  if (!isConnected || !address) {
    return <ConnectPrompt message="Connect a wallet to see your Arc Mainnet balance, send USDC, and view your activity." />
  }

  const recent = items.slice(0, 5)

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-navy p-6 text-white">
        <div className="flex items-center justify-between text-sm text-white/70">
          <span>Balance on Arc Mainnet</span>
          <span className="flex items-center gap-1.5">
            <span className={`size-1.5 rounded-full ${isOnArc ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            {isOnArc ? 'Connected' : 'Wrong network'}
          </span>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <TokenUSDC variant="branded" size={36} />
          <p className="font-display text-4xl font-semibold tracking-tight tabular-nums">
            {balanceRaw !== undefined ? formatNative(balanceRaw) : balanceLoading ? '...' : '--'}
            <span className="ml-2 text-lg font-medium text-white/60">USDC</span>
          </p>
        </div>
        {balanceError && <p className="mt-2 text-sm text-amber-200">Could not load your balance. Retrying automatically.</p>}
        <p className="mt-3 break-all font-mono text-xs text-white/60">{address}</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onNavigate('send')}
            className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-white font-medium text-navy transition hover:bg-mist"
          >
            <ArrowUpRight className="size-4" /> Send
          </button>
          <button
            type="button"
            onClick={() => onNavigate('receive')}
            className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-white/10 font-medium text-white ring-1 ring-white/25 transition hover:bg-white/20"
          >
            <ArrowDownLeft className="size-4" /> Receive
          </button>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold tracking-tight">Recent transactions</h2>
          <button type="button" onClick={() => onNavigate('history')} className="min-h-11 px-1 text-sm font-medium text-navy hover:underline">
            View all
          </button>
        </div>
        {recent.length > 0 ? (
          <TxList items={recent} />
        ) : (
          <div className="rounded-3xl bg-white p-6 text-center text-sm text-ink/60 ring-1 ring-ink/5">
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Searching Arc Mainnet for your activity...
              </span>
            ) : error ? (
              error
            ) : hasMore ? (
              'No recent activity found yet. Open History to search further back.'
            ) : (
              'No transactions yet.'
            )}
          </div>
        )}
      </section>
    </div>
  )
}
