/**
 * wagmi configuration: Arc Mainnet only.
 * Built with Arc Studio — https://studio.arc.io
 */

import { http, createConfig } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { registerChain } from './tracing'
import { ARC_RPC_URL, arcMainnet } from './lib/arc'

// Pre-register chain RPC URLs so trace events show correct chain names immediately
registerChain(arcMainnet.id, ARC_RPC_URL)

export const config = createConfig({
  chains: [arcMainnet],
  // MetaMask and other EIP-6963 browser wallets are discovered automatically.
  connectors: [injected()],
  transports: {
    [arcMainnet.id]: http(ARC_RPC_URL, { batch: true, retryCount: 3 }),
  },
})
