import { ConnectKitButton } from 'connectkit'
import { History, House, QrCode, Send, type LucideIcon } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { shortAddress } from '@/lib/format'

export type Tab = 'home' | 'send' | 'receive' | 'history'

const TABS: Array<{ id: Tab; label: string; Icon: LucideIcon }> = [
  { id: 'home', label: 'Home', Icon: House },
  { id: 'send', label: 'Send', Icon: Send },
  { id: 'receive', label: 'Receive', Icon: QrCode },
  { id: 'history', label: 'History', Icon: History },
]

export function Header({ tab, onTab }: { tab: Tab; onTab: (tab: Tab) => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-300 bg-white">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Logo />
          <span className="font-display text-lg font-bold tracking-tight text-slate-900">PilotLabs</span>
          <span className="hidden items-center gap-1.5 rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-800 sm:flex">
            <span className="size-2 rounded-full bg-emerald-600" />
            Arc Mainnet
          </span>
        </div>
        <ConnectKitButton.Custom>
          {({ isConnected, isConnecting, show, address }) => (
            <button
              type="button"
              onClick={show}
              className="min-h-11 shrink-0 rounded-full bg-blue-700 px-4 text-sm font-semibold text-white transition hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              {isConnecting ? 'Connecting...' : isConnected && address ? shortAddress(address) : 'Connect wallet'}
            </button>
          )}
        </ConnectKitButton.Custom>
      </div>
      <nav className="mx-auto max-w-2xl px-4 pb-3" aria-label="Main">
        <div className="grid grid-cols-4 gap-1 rounded-2xl border border-slate-300 bg-slate-100 p-1">
          {TABS.map(({ id, label, Icon }) => {
            const active = tab === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => onTab(id)}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-xs font-semibold transition sm:flex-row sm:gap-2 sm:text-sm ${
                  active ? 'bg-blue-700 text-white shadow-sm' : 'text-slate-800 hover:bg-slate-200'
                }`}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span>{label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </header>
  )
}
