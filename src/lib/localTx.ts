import type { Address, Hash } from 'viem'
import type { TxStatus } from '@/lib/history'

/**
 * Transactions this browser submitted. Stored so a pending or failed transfer stays visible:
 * the chain only logs transfers that succeeded. Contains public data only (hash, recipient, amount).
 */
export interface LocalTx {
  hash: Hash
  from: Address
  to: Address
  /** Native 18-decimal value as a decimal string. */
  value: string
  submittedAt: number
  status: TxStatus
  blockNumber?: string
  blockTimestamp?: number
  note?: string
}

const key = (address: string) => `pilotlabs:tx:${address.toLowerCase()}`

export function loadLocalTxs(address: string): LocalTx[] {
  try {
    const raw = localStorage.getItem(key(address))
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as LocalTx[]) : []
  } catch {
    return []
  }
}

export function saveLocalTxs(address: string, txs: LocalTx[]): void {
  try {
    localStorage.setItem(key(address), JSON.stringify(txs.slice(0, 50)))
  } catch {
    // Storage can be unavailable (private mode). History still works from chain data.
  }
}
