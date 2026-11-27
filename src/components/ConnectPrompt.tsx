import { ConnectKitButton } from 'connectkit'
import { Wallet } from 'lucide-react'

export function ConnectPrompt({ message }: { message: string }) {
  return (
    <div className="rounded-3xl bg-white p-8 text-center ring-1 ring-ink/5">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-mist">
        <Wallet className="size-5 text-navy" />
      </div>
      <h2 className="mt-4 font-display text-xl font-semibold tracking-tight">Connect your wallet</h2>
      <p className="mx-auto mt-1 max-w-xs text-sm text-ink/60">{message}</p>
      <div className="mt-5 flex justify-center">
        <ConnectKitButton.Custom>
          {({ show, isConnecting }) => (
            <button
              type="button"
              onClick={show}
              className="min-h-12 rounded-full bg-navy px-6 text-sm font-medium text-white transition hover:bg-ink"
            >
              {isConnecting ? 'Connecting...' : 'Connect wallet'}
            </button>
          )}
        </ConnectKitButton.Custom>
      </div>
      <p className="mt-4 text-xs text-ink/45">PilotLabs never asks for your private key or seed phrase.</p>
    </div>
  )
}
