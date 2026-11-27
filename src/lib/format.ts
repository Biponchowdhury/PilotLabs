import { Amount, gasTokenDecimalsFor, gasTokenToUsdc } from '@/onchain-money'
import { ARC_CHAIN_ID } from '@/lib/arc'

export const shortAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`
export const shortHash = (hash: string) => `${hash.slice(0, 10)}...${hash.slice(-6)}`

/** Native (18 decimal) value as a USDC string with up to `digits` decimals, truncated, never rounded up. */
export function formatNative(raw: bigint, digits = 6): string {
  const usdc = gasTokenToUsdc(ARC_CHAIN_ID, Amount.fromRaw(raw, gasTokenDecimalsFor(ARC_CHAIN_ID)))
  const fixed = usdc.toFixed(digits)
  const [whole, frac = ''] = fixed.split('.')
  const trimmed = frac.replace(/0+$/, '').padEnd(2, '0')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${grouped}.${trimmed}`
}

/** Fee display: always shows enough digits that a tiny non-zero fee never reads as zero. */
export function formatFee(raw: bigint): string {
  if (raw === 0n) return '0.00'
  const full = Amount.fromRaw(raw, gasTokenDecimalsFor(ARC_CHAIN_ID))
  const six = full.toFixed(6)
  return Number(six) === 0 ? '< 0.000001' : six
}

export function formatDateTime(seconds: number): string {
  return new Date(seconds * 1000).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
