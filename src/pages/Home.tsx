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
      <section className="rounded-3xl border border-slate-300 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between gap-2 text-sm font-medium text-slate-700">
          <span>Balance on Arc Mainnet</span>
          <span
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
              isOnArc ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'
            }`}
          >
            <span className={`size-2 rounded-full ${isOnArc ? 'bg-emerald-600' : 'bg-amber-600'}`} />
            {isOnArc ? 'Connected' : 'Wrong network'}
          </span>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <TokenUSDC variant="branded" size={36} />
          <p className="min-w-0 break-words font-display text-3xl font-bold tracking-tight text-slate-900 tabular-nums sm:text-4xl">
            {balanceRaw !== undefined ? formatNative(balanceRaw) : balanceLoading ? '...' : '--'}
            <span className="ml-2 text-lg font-semibold text-slate-700">USDC</span>
          </p>
        </div>
        {balanceError && <p className="mt-2 text-sm font-medium text-red-700">Could not load your balance. Retrying automatically.</p>}
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">Your wallet</p>
          <p className="mt-0.5 break-all font-mono text-sm text-slate-900">{address}</p>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onNavigate('send')}
            className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-blue-700 font-semibold text-white transition hover:bg-blue-800"
          >
            <ArrowUpRight className="size-4" /> Send
          </button>
          <button
            type="button"
            onClick={() => onNavigate('receive')}
            className="flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-blue-700 bg-white font-semibold text-blue-700 transition hover:bg-blue-50"
          >
            <ArrowDownLeft className="size-4" /> Receive
          </button>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold tracking-tight">Recent transactions</h2>
          <button type="button" onClick={() => onNavigate('history')} className="min-h-11 px-1 text-sm font-medium text-blue-700 hover:underline">
            View all
          </button>
        </div>
        {recent.length > 0 ? (
          <TxList items={recent} />
        ) : (
          <div className="rounded-3xl bg-white p-6 text-center text-sm text-slate-600 ring-1 ring-slate-300">
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
