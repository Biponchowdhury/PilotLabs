import { ConnectKitButton } from 'connectkit'
import { Logo } from '@/components/Logo'
import { shortAddress } from '@/lib/format'

export type Tab = 'home' | 'send' | 'receive' | 'history'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'send', label: 'Send' },
  { id: 'receive', label: 'Receive' },
  { id: 'history', label: 'History' },
]

export function Header({ tab, onTab }: { tab: Tab; onTab: (tab: Tab) => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-ink/5 bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="font-display text-lg font-semibold tracking-tight">PilotLabs</span>
          <span className="hidden items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-ink/70 ring-1 ring-ink/10 sm:flex">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Arc Mainnet
          </span>
        </div>
        <ConnectKitButton.Custom>
          {({ isConnected, isConnecting, show, address }) => (
            <button
              type="button"
              onClick={show}
              className="min-h-11 rounded-full bg-navy px-4 text-sm font-medium text-white transition hover:bg-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
            >
              {isConnecting ? 'Connecting...' : isConnected && address ? shortAddress(address) : 'Connect wallet'}
            </button>
          )}
        </ConnectKitButton.Custom>
      </div>
      <nav className="mx-auto max-w-2xl px-4 pb-3" aria-label="Main">
        <div className="grid grid-cols-4 gap-1 rounded-full bg-mist p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={`min-h-10 rounded-full text-sm font-medium transition ${
                tab === t.id ? 'bg-white text-ink shadow-sm' : 'text-ink/60 hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </header>
  )
}
