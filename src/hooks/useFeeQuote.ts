import { useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'
import { MIN_MAX_FEE_PER_GAS, publicClient } from '@/lib/arc'

export interface FeeQuote {
  gasLimit: bigint
  maxFeePerGas: bigint
  /** Expected fee at the current base fee (native 18-decimal). */
  estimatedFee: bigint
  /** Worst case fee at the gas limit and max fee per gas (native 18-decimal). */
  maxFee: bigint
}

const PLAIN_TRANSFER_GAS = 21_000n

/**
 * Estimates the network fee for a native transfer. Before a recipient and amount exist it quotes a plain
 * 21,000 gas transfer. Fees are paid in USDC, the gas token on Arc.
 */
export function useFeeQuote(params: { from?: Address; to?: Address; value?: bigint; estimate: boolean }) {
  const { from, to, value, estimate } = params
  return useQuery<FeeQuote>({
    queryKey: ['pilotlabs-fee', from, estimate ? to : null, estimate ? value?.toString() : null],
    enabled: Boolean(from),
    refetchInterval: 15_000,
    staleTime: 5_000,
    queryFn: async () => {
      const block = await publicClient.getBlock()
      const baseFee = block.baseFeePerGas ?? MIN_MAX_FEE_PER_GAS
      const effective = baseFee > MIN_MAX_FEE_PER_GAS ? baseFee : MIN_MAX_FEE_PER_GAS
      // Arc silently drops transactions under a 20 gwei maxFeePerGas, so never go below it.
      const maxFeePerGas = baseFee * 2n > MIN_MAX_FEE_PER_GAS ? baseFee * 2n : MIN_MAX_FEE_PER_GAS

      let expectedGas = PLAIN_TRANSFER_GAS
      if (estimate && to && value !== undefined && value > 0n) {
        const estimated = await publicClient.estimateGas({ account: from, to, value })
        expectedGas = estimated > PLAIN_TRANSFER_GAS ? estimated : PLAIN_TRANSFER_GAS
      }
      // Headroom on the limit only. The estimate shown to the user uses the expected gas.
      const gasLimit = expectedGas === PLAIN_TRANSFER_GAS ? expectedGas : (expectedGas * 120n) / 100n
      return { gasLimit, maxFeePerGas, estimatedFee: expectedGas * effective, maxFee: gasLimit * maxFeePerGas }
    },
  })
}
