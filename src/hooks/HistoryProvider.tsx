import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAccount } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import type { Address } from 'viem'
import { RECENT_LOGS_DEPTH, publicClient } from '@/lib/arc'
import { blockTimestamps, scanRange, scanStepBackward, sortItems, type HistoryItem } from '@/lib/history'
import { loadLocalTxs, saveLocalTxs, type LocalTx } from '@/lib/localTx'

const TARGET_PER_LOAD = 10
/** How long one press of Load More keeps searching before it hands control back. */
const LOAD_BUDGET_MS = 40_000
const REFRESH_MS = 15_000
const POLL_PENDING_MS = 2_500
const DROPPED_AFTER_MS = 15 * 60_000
const FULL_RESET_GAP = 100_000n

interface HistoryContextValue {
  items: HistoryItem[]
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  error: string | null
  /** Unix seconds of the oldest block searched so far, when known. */
  searchedBackTo: number | null
  loadMore: () => Promise<void>
  refresh: () => Promise<void>
  trackTx: (tx: LocalTx) => void
}

const HistoryContext = createContext<HistoryContextValue | null>(null)

export function useHistory(): HistoryContextValue {
  const ctx = useContext(HistoryContext)
  if (!ctx) throw new Error('useHistory must be used inside HistoryProvider')
  return ctx
}

function mergeById(existing: HistoryItem[], incoming: HistoryItem[]): HistoryItem[] {
  const map = new Map(existing.map((i) => [i.id, i]))
  for (const item of incoming) map.set(item.id, item)
  return sortItems([...map.values()])
}

function describeError(err: unknown): string {
  const message = err instanceof Error ? err.message.toLowerCase() : ''
  if (message.includes('rate limit') || message.includes('429')) return 'The network is busy. Try again in a moment.'
  return 'Could not reach Arc Mainnet. Check your connection and try again.'
}

/** Remounts the provider per wallet so every piece of history state starts clean for a new address. */
export function HistoryProvider({ children }: { children: ReactNode }) {
  const { address } = useAccount()
  return (
    <HistoryInner key={address ?? 'disconnected'} address={address}>
      {children}
    </HistoryInner>
  )
}

function HistoryInner({ address, children }: { address: Address | undefined; children: ReactNode }) {
  const queryClient = useQueryClient()

  const [chainItems, setChainItems] = useState<HistoryItem[]>([])
  const [localTxs, setLocalTxs] = useState<LocalTx[]>(() => (address ? loadLocalTxs(address) : []))
  const [loading, setLoading] = useState(Boolean(address))
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchedBackTo, setSearchedBackTo] = useState<number | null>(null)

  const cursorRef = useRef<bigint>(-1n)
  const recentFloorRef = useRef<bigint>(0n)
  const topBlockRef = useRef<bigint>(0n)
  const busyRef = useRef(false)
  const generationRef = useRef(0)
  const addressRef = useRef<Address | undefined>(undefined)

  const runLoad = useCallback(async (target: Address, generation: number) => {
    if (busyRef.current) return
    busyRef.current = true
    setError(null)
    let collected = 0
    try {
      const startedAt = Date.now()
      let lastStamp = startedAt
      while (cursorRef.current >= 0n && Date.now() - startedAt < LOAD_BUDGET_MS) {
        const result = await scanStepBackward(target, cursorRef.current, recentFloorRef.current)
        if (generation !== generationRef.current) return
        cursorRef.current = result.nextCursor
        collected += result.items.length
        if (result.items.length > 0) setChainItems((prev) => mergeById(prev, result.items))
        setHasMore(cursorRef.current >= 0n)
        if (collected >= TARGET_PER_LOAD) break
        // Keep the "searched back to" label moving while a long search runs.
        if (cursorRef.current >= 0n && Date.now() - lastStamp > 4_000) {
          lastStamp = Date.now()
          const stamps = await blockTimestamps([cursorRef.current])
          if (generation === generationRef.current) setSearchedBackTo(stamps.get(cursorRef.current) ?? null)
        }
      }
      if (cursorRef.current >= 0n) {
        const stamps = await blockTimestamps([cursorRef.current])
        if (generation === generationRef.current) setSearchedBackTo(stamps.get(cursorRef.current) ?? null)
      }
    } catch (err) {
      if (generation === generationRef.current) setError(describeError(err))
    } finally {
      busyRef.current = false
    }
  }, [])

  // First load for this wallet. The provider is keyed by address, so this runs once per wallet.
  useEffect(() => {
    const generation = generationRef.current
    addressRef.current = address
    if (!address) return
    void (async () => {
      try {
        const head = await publicClient.getBlockNumber()
        if (generation !== generationRef.current) return
        topBlockRef.current = head
        cursorRef.current = head
        recentFloorRef.current = head > RECENT_LOGS_DEPTH ? head - RECENT_LOGS_DEPTH : 0n
        await runLoad(address, generation)
      } catch (err) {
        if (generation === generationRef.current) setError(describeError(err))
      } finally {
        if (generation === generationRef.current) setLoading(false)
      }
    })()
    return () => {
      generationRef.current += 1
    }
  }, [address, runLoad])

  const loadMore = useCallback(async () => {
    const target = addressRef.current
    if (!target || busyRef.current || cursorRef.current < 0n) return
    setLoadingMore(true)
    try {
      await runLoad(target, generationRef.current)
    } finally {
      setLoadingMore(false)
    }
  }, [runLoad])

  const refresh = useCallback(async () => {
    const target = addressRef.current
    if (!target || busyRef.current) return
    const generation = generationRef.current
    try {
      const head = await publicClient.getBlockNumber()
      if (generation !== generationRef.current || head <= topBlockRef.current) return
      if (head - topBlockRef.current > FULL_RESET_GAP) {
        // Away for a long time: restart from the tip instead of scanning the whole gap.
        topBlockRef.current = head
        cursorRef.current = head
        recentFloorRef.current = head > RECENT_LOGS_DEPTH ? head - RECENT_LOGS_DEPTH : 0n
        setChainItems([])
        await runLoad(target, generation)
        return
      }
      const fresh = await scanRange(target, topBlockRef.current + 1n, head)
      if (generation !== generationRef.current) return
      topBlockRef.current = head
      if (fresh.length > 0) setChainItems((prev) => mergeById(prev, fresh))
    } catch {
      // A failed background refresh is silent. The next tick or a manual action retries.
    }
  }, [runLoad])

  // Background refresh while the tab is visible.
  useEffect(() => {
    if (!address) return
    const timer = setInterval(() => {
      if (!document.hidden) void refresh()
    }, REFRESH_MS)
    return () => clearInterval(timer)
  }, [address, refresh])

  const persistLocal = useCallback(
    (next: LocalTx[]) => {
      if (address) saveLocalTxs(address, next)
      return next
    },
    [address],
  )

  const trackTx = useCallback(
    (tx: LocalTx) => {
      setLocalTxs((prev) => persistLocal([tx, ...prev.filter((p) => p.hash !== tx.hash)]))
    },
    [persistLocal],
  )

  // Resolve pending local transactions from their real receipts.
  const hasPending = localTxs.some((t) => t.status === 'pending')
  useEffect(() => {
    if (!address || !hasPending) return
    let cancelled = false
    const poll = async () => {
      const current = loadLocalTxs(address)
      let changed = false
      let confirmedNow = false
      const next: LocalTx[] = []
      for (const tx of current) {
        if (tx.status !== 'pending') {
          next.push(tx)
          continue
        }
        try {
          const receipt = await publicClient.getTransactionReceipt({ hash: tx.hash })
          const stamps = await blockTimestamps([receipt.blockNumber])
          const ok = receipt.status === 'success'
          confirmedNow = confirmedNow || ok
          changed = true
          next.push({
            ...tx,
            status: ok ? 'confirmed' : 'failed',
            blockNumber: receipt.blockNumber.toString(),
            blockTimestamp: stamps.get(receipt.blockNumber),
            note: ok ? undefined : 'The transaction was included but reverted onchain.',
          })
        } catch {
          // No receipt yet. If it has been missing a long time and the network does not know it, call it dropped.
          if (Date.now() - tx.submittedAt > DROPPED_AFTER_MS) {
            const known = await publicClient.getTransaction({ hash: tx.hash }).catch(() => null)
            if (!known) {
              changed = true
              next.push({ ...tx, status: 'failed', note: 'The network never included this transaction.' })
              continue
            }
          }
          next.push(tx)
        }
      }
      if (cancelled || !changed) return
      saveLocalTxs(address, next)
      setLocalTxs(next)
      if (confirmedNow) {
        void queryClient.invalidateQueries()
        void refresh()
      }
    }
    const timer = setInterval(() => void poll(), POLL_PENDING_MS)
    void poll()
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [address, hasPending, queryClient, refresh])

  const items = useMemo(() => {
    const onChain = new Set(chainItems.filter((i) => i.direction === 'sent').map((i) => i.hash.toLowerCase()))
    const local: HistoryItem[] = localTxs
      .filter((t) => !(t.status === 'confirmed' && onChain.has(t.hash.toLowerCase())))
      .map((t) => ({
        id: `local:${t.hash}`,
        hash: t.hash,
        direction: 'sent' as const,
        counterparty: t.to,
        value: BigInt(t.value),
        blockNumber: t.blockNumber ? BigInt(t.blockNumber) : undefined,
        timestamp: t.blockTimestamp ?? Math.floor(t.submittedAt / 1000),
        status: t.status,
        note: t.note,
      }))
    // A transaction that failed or is pending has no onchain Transfer log, so it can never duplicate a chain row.
    return sortItems([...chainItems, ...local])
  }, [chainItems, localTxs])

  const value = useMemo<HistoryContextValue>(
    () => ({ items, loading, loadingMore, hasMore, error, searchedBackTo, loadMore, refresh, trackTx }),
    [items, loading, loadingMore, hasMore, error, searchedBackTo, loadMore, refresh, trackTx],
  )

  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>
}
