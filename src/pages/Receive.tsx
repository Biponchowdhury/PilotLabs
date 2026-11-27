import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { ConnectPrompt } from '@/components/ConnectPrompt'
import { useArcWallet } from '@/hooks/useArcWallet'

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Clipboard API can be blocked inside an iframe. Fall back to a selection copy.
    const area = document.createElement('textarea')
    area.value = text
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    return ok
  }
}

export function Receive() {
  const { address, isConnected } = useArcWallet()
  const [qr, setQr] = useState<{ address: string; svg: string } | null>(null)
  const svg = qr && qr.address === address ? qr.svg : null
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!address) return
    let active = true
    void QRCode.toString(address, { type: 'svg', margin: 1, width: 220, errorCorrectionLevel: 'M', color: { dark: '#0E1B33', light: '#FFFFFF' } }).then(
      (out) => {
        if (active) setQr({ address, svg: out })
      },
    )
    return () => {
      active = false
    }
  }, [address])

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  if (!isConnected || !address) {
    return <ConnectPrompt message="Connect a wallet to show your address and QR code." />
  }

  const handleCopy = async () => {
    const ok = await copyText(address)
    if (ok) {
      setCopied(true)
      toast.success('Address copied')
    } else {
      toast.error('Could not copy. Select the address and copy it manually.')
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Receive</h1>
      <div className="rounded-3xl bg-white p-6 text-center ring-1 ring-slate-300">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-800">
          <span className="size-1.5 rounded-full bg-emerald-500" /> Arc Mainnet
        </span>
        <div className="mx-auto mt-5 size-[220px] overflow-hidden rounded-2xl ring-1 ring-slate-300">
          {svg ? (
            <div role="img" aria-label="QR code of your wallet address" className="size-full [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} />
          ) : (
            <div className="size-full animate-pulse bg-slate-100" />
          )}
        </div>
        <p className="mx-auto mt-5 max-w-xs select-all break-all rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900">{address}</p>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="mx-auto mt-5 flex min-h-12 items-center justify-center gap-2 rounded-full bg-blue-700 px-6 text-sm font-semibold text-white transition hover:bg-blue-800"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? 'Address copied' : 'Copy address'}
        </button>
        <p aria-live="polite" className="sr-only">
          {copied ? 'Address copied to clipboard' : ''}
        </p>
      </div>
      <p className="rounded-2xl border border-slate-300 bg-slate-50 p-4 text-sm text-slate-700">
        Only send USDC on Arc Mainnet to this address. Funds sent from other networks will not arrive.
      </p>
    </div>
  )
}
