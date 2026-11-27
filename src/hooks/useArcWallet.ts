import { useAccount, useBalance, useSwitchChain } from 'wagmi'
import { ARC_CHAIN_ID } from '@/lib/arc'

/** Connected wallet state scoped to Arc Mainnet. Balance is the single USDC pool (native 18-decimal view). */
export function useArcWallet() {
  const { address, chainId, isConnected, isConnecting, isReconnecting } = useAccount()
  const { switchChain, isPending: isSwitching, error: switchError } = useSwitchChain()
  const isOnArc = chainId === ARC_CHAIN_ID

  const balance = useBalance({
    address,
    chainId: ARC_CHAIN_ID,
    query: { enabled: Boolean(address), refetchInterval: 15_000 },
  })

  return {
    address,
    chainId,
    isConnected,
    isConnecting: isConnecting || isReconnecting,
    isOnArc,
    isSwitching,
    switchError,
    switchToArc: () => switchChain({ chainId: ARC_CHAIN_ID }),
    /** Native 18-decimal raw balance, or undefined while loading. */
    balanceRaw: balance.data?.value,
    balanceLoading: balance.isLoading,
    balanceError: balance.isError,
    refetchBalance: balance.refetch,
  }
}
