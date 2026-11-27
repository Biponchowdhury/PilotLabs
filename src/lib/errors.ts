interface ErrorLike {
  name?: string
  code?: number
  message?: string
  shortMessage?: string
  cause?: unknown
}

function chain(err: unknown): ErrorLike[] {
  const out: ErrorLike[] = []
  let current: unknown = err
  for (let i = 0; i < 6 && current && typeof current === 'object'; i++) {
    out.push(current)
    current = (current as ErrorLike).cause
  }
  return out
}

export type SendErrorKind = 'rejected' | 'insufficient' | 'network' | 'reverted' | 'unknown'

export function classifySendError(err: unknown): { kind: SendErrorKind; message: string } {
  const layers = chain(err)
  const text = layers
    .map((e) => `${e.name ?? ''} ${e.shortMessage ?? ''} ${e.message ?? ''}`)
    .join(' ')
    .toLowerCase()

  if (layers.some((e) => e.code === 4001) || text.includes('user rejected') || text.includes('user denied') || text.includes('rejected the request')) {
    return { kind: 'rejected', message: 'You rejected the request in your wallet. Nothing was sent.' }
  }
  if (text.includes('insufficient funds') || text.includes('exceeds the balance') || text.includes('exceeds balance')) {
    return { kind: 'insufficient', message: 'Insufficient balance to cover the amount plus the network fee.' }
  }
  if (text.includes('reverted') || text.includes('zero address not allowed')) {
    return { kind: 'reverted', message: 'The network rejected this transfer. Check the recipient address and try again.' }
  }
  if (text.includes('timeout') || text.includes('timed out') || text.includes('network') || text.includes('fetch') || text.includes('rate limit') || text.includes('http request failed')) {
    return { kind: 'network', message: 'Network problem while talking to Arc Mainnet. Check your connection and try again.' }
  }
  return { kind: 'unknown', message: 'The transaction could not be sent. Please try again.' }
}
