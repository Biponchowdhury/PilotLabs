import { createPublicClient, defineChain, http, parseAbiItem } from 'viem'
import { requireChain, getUsdc } from '@/onchain-facts'

/** Arc Mainnet. Every fact is read from the generated onchain facts module. */
export const ARC_CHAIN_ID = 5042

const facts = requireChain(ARC_CHAIN_ID)

if (facts.isTestnet) {
  throw new Error('PilotLabs is configured for Arc Mainnet only')
}

export const ARC_RPC_URL = facts.rpcUrls[0]
export const ARC_EXPLORER_URL = facts.explorerBase

export const arcMainnet = defineChain({
  id: ARC_CHAIN_ID,
  name: 'Arc Mainnet',
  nativeCurrency: { name: 'USDC', symbol: facts.nativeCurrency.symbol, decimals: facts.nativeCurrency.decimals },
  rpcUrls: { default: { http: [...facts.rpcUrls] } },
  blockExplorers: { default: { name: 'Arc Explorer', url: facts.explorerBase } },
})

export const ARC_USDC = getUsdc(ARC_CHAIN_ID)

/** EIP-7708 system emitter: logs a Transfer for every native USDC movement (18 decimals). */
export const SYSTEM_EMITTER = '0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE' as const

export const TRANSFER_EVENT = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)')

/** Arc drops transactions whose maxFeePerGas is under 20 gwei. */
export const MIN_MAX_FEE_PER_GAS = 20_000_000_000n

/** The primary endpoint rejects getLogs ranges of roughly 10,000 blocks or more. */
export const LOG_WINDOW_BLOCKS = 9_000n

/** Batched JSON-RPC client used for history and receipts. */
export const publicClient = createPublicClient({
  chain: arcMainnet,
  transport: http(ARC_RPC_URL, { batch: { batchSize: 40, wait: 25 }, retryCount: 4, retryDelay: 400, timeout: 20_000 }),
})

/**
 * Optional second node provider that accepts much larger log ranges but only keeps recent blocks.
 * Used for the newest part of the history scan; everything older (or any failure) uses the primary endpoint.
 */
const historyRpc = import.meta.env.VITE_ARC_HISTORY_RPC_URL as string | undefined

export const recentLogsClient = historyRpc
  ? createPublicClient({ chain: arcMainnet, transport: http(historyRpc, { retryCount: 1, retryDelay: 500, timeout: 20_000 }) })
  : null

/** Largest getLogs range the recent-logs provider accepts, and how far back it keeps data (kept conservative). */
export const RECENT_LOGS_WINDOW = 99_000n
export const RECENT_LOGS_DEPTH = 400_000n
