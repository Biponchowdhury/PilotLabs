import { useState } from 'react'
import { Header, type Tab } from '@/components/Header'
import { NetworkGuard } from '@/components/NetworkGuard'
import { HistoryProvider } from '@/hooks/HistoryProvider'
import { Home } from '@/pages/Home'
import { Send } from '@/pages/Send'
import { Receive } from '@/pages/Receive'
import { History } from '@/pages/History'

export default function App() {
  const [tab, setTab] = useState<Tab>('home')

  return (
    <HistoryProvider>
      <div className="min-h-dvh bg-canvas font-sans text-ink">
        <Header tab={tab} onTab={setTab} />
        <main className="mx-auto max-w-2xl space-y-4 px-4 pb-24 pt-5">
          <NetworkGuard />
          {tab === 'home' && <Home onNavigate={setTab} />}
          {tab === 'send' && <Send />}
          {tab === 'receive' && <Receive />}
          {tab === 'history' && <History />}
        </main>
      </div>
    </HistoryProvider>
  )
}
