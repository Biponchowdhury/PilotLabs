import type { Address, Hash } from 'viem'
import { LOG_WINDOW_BLOCKS, RECENT_LOGS_WINDOW, SYSTEM_EMITTER, TRANSFER_EVENT, publicClient, recentLogsClient, scanClient } from '@/lib/arc'

export type TxStatus = 'pending' | 'confirmed' | 'failed'

export interface HistoryItem {
  id: string
  hash: Hash
  direction: 'sent' | 'received'
  counterparty: Address
  /** Native 18-decimal USDC value, as emitted by the system emitter. */
  value: bigint
  blockNumber?: bigint
  /** Unix seconds. Undefined until the block is known. */
  timestamp?: number
  status: TxStatus
  note?: string
}

export interface ScanResult {
  items: HistoryItem[]
  /** Next toBlock to scan from, or -1n once genesis has been reached. */
  nextCursor: bigint
}

/**
 * The primary endpoint allows a short burst and then a much lower sustained rate, so calls are spaced out and
 * the spacing widens every time the endpoint pushes back.
 */
const MIN_MS_PER_CALL = 500
const MAX_MS_PER_CALL = 4_000
let msPerCall = MIN_MS_PER_CALL
let nextSlot = 0
async function pace(calls: number): Promise<void> {
  const now = Date.now()
  const start = Math.max(now, nextSlot)
  nextSlot = start + msPerCall * calls
  if (start > now) await new Promise((resolve) => setTimeout(resolve, start - now))
}

function isRateLimit(err: unknown): boolean {
  const text = err instanceof Error ? `${err.message} ${(err as { details?: string }).details ?? ''}`.toLowerCase() : ''
  return text.includes('rate limit') || text.includes('exceeds defined limit') || text.includes('429')
}

/** Runs one paced primary-endpoint request, backing off and retrying when it is rate limited. */
async function withBackoff<T>(calls: number, run: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    await pace(calls)
    try {
      const result = await run()
      msPerCall = Math.max(MIN_MS_PER_CALL, Math.floor(msPerCall * 0.95))
      return result
    } catch (err) {
      if (!isRateLimit(err) || attempt >= 6) throw err
      msPerCall = Math.min(MAX_MS_PER_CALL, Math.ceil(msPerCall * 1.6))
      nextSlot = Math.max(nextSlot, Date.now() + 1_500 * (attempt + 1))
    }
  }
}

/** Rows kept from one step. A busy wallet is read newest first, a page at a time. */
const MAX_ITEMS_PER_STEP = 25

let recentDisabled = false

type Client = typeof publicClient
type TransferLog = Awaited<ReturnType<typeof scanWindow>>[number]

async function scanWindow(client: Client, address: Address, from: bigint, to: bigint) {
  const [sent, received] = await Promise.all([
    client.getLogs({ address: SYSTEM_EMITTER, event: TRANSFER_EVENT, args: { from: address }, fromBlock: from, toBlock: to }),
    client.getLogs({ address: SYSTEM_EMITTER, event: TRANSFER_EVENT, args: { to: address }, fromBlock: from, toBlock: to }),
  ])
  return [...sent, ...received]
}

/**
 * Scans one window ending at `toBlock`, walking backwards. Recent blocks use the large-range provider when
 * available; older blocks (or any provider failure) use the primary endpoint in paced 9,000 block windows.
 */
export async function scanStepBackward(address: Address, toBlock: bigint, recentFloor: bigint): Promise<ScanResult> {
  let from: bigint
  let logs: TransferLog[] | null = null
  if (recentLogsClient && !recentDisabled && toBlock > recentFloor) {
    from = toBlock - RECENT_LOGS_WINDOW > recentFloor ? toBlock - RECENT_LOGS_WINDOW : recentFloor
    try {
      logs = await scanWindow(recentLogsClient, address, from, toBlock)
    } catch {
      recentDisabled = true
    }
  }
  if (!logs) {
    from = toBlock - LOG_WINDOW_BLOCKS + 1n > 0n ? toBlock - LOG_WINDOW_BLOCKS + 1n : 0n
    logs = await withBackoff(2, () => scanWindow(scanClient, address, from!, toBlock))
  }
  let drafts = toDrafts(address, logs)
  let nextCursor = from! - 1n
  if (drafts.length > MAX_ITEMS_PER_STEP) {
    // Very busy wallet: keep only the newest rows and resume right below them on the next step.
    const sorted = sortItems(drafts)
    const cutoff = sorted[MAX_ITEMS_PER_STEP - 1].blockNumber as bigint
    drafts = sorted.filter((d) => (d.blockNumber as bigint) >= cutoff)
    nextCursor = cutoff - 1n
  }
  return { items: await withTimestamps(drafts), nextCursor }
}

/** Scans `[fromBlock, toBlock]` forward in paced windows. Used to pick up new activity. */
export async function scanRange(address: Address, fromBlock: bigint, toBlock: bigint): Promise<HistoryItem[]> {
  const logs: TransferLog[] = []
  for (let start = fromBlock; start <= toBlock; start += LOG_WINDOW_BLOCKS) {
    const end = start + LOG_WINDOW_BLOCKS - 1n < toBlock ? start + LOG_WINDOW_BLOCKS - 1n : toBlock
    logs.push(...(await withBackoff(2, () => scanWindow(scanClient, address, start, end))))
  }
  return withTimestamps(toDrafts(address, logs))
}

function toDrafts(address: Address, logs: TransferLog[]): HistoryItem[] {
  const me = address.toLowerCase()
  const seen = new Set<string>()
  const draft: HistoryItem[] = []

  for (const log of logs) {
    const { from, to, value } = log.args
    if (!from || !to || value === undefined || !log.transactionHash || log.blockNumber === null) continue
    const id = `${log.transactionHash}:${log.logIndex}`
    if (seen.has(id)) continue
    seen.add(id)
    const outgoing = from.toLowerCase() === me
    const incoming = to.toLowerCase() === me
    if (!outgoing && !incoming) continue
    draft.push({
      id,
      hash: log.transactionHash,
      direction: outgoing ? 'sent' : 'received',
      counterparty: outgoing ? to : from,
      value,
      blockNumber: log.blockNumber,
      // The system emitter only logs transfers that were executed, so a log means the transaction is final.
      status: 'confirmed',
    })
  }
  return draft
}

async function withTimestamps(draft: HistoryItem[]): Promise<HistoryItem[]> {
  const stamps = await blockTimestamps([...new Set(draft.map((d) => d.blockNumber as bigint))])
  return draft.map((d) => ({ ...d, timestamp: stamps.get(d.blockNumber as bigint) }))
}

const stampCache = new Map<bigint, number>()

export async function blockTimestamps(blocks: bigint[]): Promise<Map<bigint, number>> {
  const out = new Map<bigint, number>()
  for (const blockNumber of blocks) {
    const cached = stampCache.get(blockNumber)
    if (cached !== undefined) {
      out.set(blockNumber, cached)
      continue
    }
    try {
      const block = await withBackoff(1, () => publicClient.getBlock({ blockNumber }))
      stampCache.set(blockNumber, Number(block.timestamp))
      out.set(blockNumber, Number(block.timestamp))
    } catch {
      // A timestamp is cosmetic. The row still renders without one.
    }
  }
  return out
}

export function sortItems(items: HistoryItem[]): HistoryItem[] {
  return [...items].sort((a, b) => {
    const ba = a.blockNumber ?? BigInt(Number.MAX_SAFE_INTEGER)
    const bb = b.blockNumber ?? BigInt(Number.MAX_SAFE_INTEGER)
    if (ba !== bb) return ba > bb ? -1 : 1
    return b.id.localeCompare(a.id)
  })
}
