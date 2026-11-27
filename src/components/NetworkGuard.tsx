import { AlertTriangle } from 'lucide-react'
import { useArcWallet } from '@/hooks/useArcWallet'

/** Warns when the wallet is connected to a network other than Arc Mainnet. */
export function NetworkGuard() {
  const { isConnected, isOnArc, switchToArc, isSwitching, switchError } = useArcWallet()
  if (!isConnected || isOnArc) return null

  return (
    <div role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
        <div className="flex-1">
          <p className="font-medium text-amber-900">Unsupported network</p>
          <p className="mt-1 text-sm text-amber-800">
            PilotLabs works on Arc Mainnet only. Switch your wallet to Arc Mainnet to send, receive, and see activity.
          </p>
          {switchError && (
            <p className="mt-2 text-sm text-amber-900">
              Your wallet did not switch networks. Approve the request in your wallet or add Arc Mainnet manually.
            </p>
          )}
          <button
            type="button"
            onClick={switchToArc}
            disabled={isSwitching}
            className="mt-3 min-h-11 rounded-full bg-amber-900 px-4 text-sm font-medium text-white disabled:opacity-60"
          >
            {isSwitching ? 'Check your wallet...' : 'Switch to Arc Mainnet'}
          </button>
        </div>
      </div>
    </div>
  )
}
