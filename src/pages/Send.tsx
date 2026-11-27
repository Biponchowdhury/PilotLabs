import { useMemo, useRef, useState } from 'react'
import { useSendTransaction } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import { getAddress, isAddress, zeroAddress, type Address } from 'viem'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { ConnectPrompt } from '@/components/ConnectPrompt'
import { SendStatus, type SentTx } from '@/components/SendStatus'
import { useArcWallet } from '@/hooks/useArcWallet'
import { useFeeQuote, type FeeQuote } from '@/hooks/useFeeQuote'
import { useHistory } from '@/hooks/HistoryProvider'
import { ARC_CHAIN_ID, ARC_USDC, SYSTEM_EMITTER, publicClient } from '@/lib/arc'
import { classifySendError } from '@/lib/errors'
import { formatFee, formatNative, shortAddress } from '@/lib/format'
import { Amount, gasTokenDecimalsFor, gasTokenToUsdc, parseGasAmount } from '@/onchain-money'

type Phase = 'form' | 'review' | 'wallet' | 'submitted'

const AMOUNT_PATTERN = /^(\d+\.?\d{0,6}|\.\d{1,6})$/

function parseAmountInput(input: string): { raw?: bigint; error?: string } {
  const value = input.trim()
  if (!value) return {}
  if (!AMOUNT_PATTERN.test(value)) return { error: 'Enter a valid amount with up to 6 decimal places.' }
  const normalized = (value.startsWith('.') ? `0${value}` : value).replace(/\.$/, '')
  const raw = parseGasAmount(ARC_CHAIN_ID, normalized).raw
  if (raw <= 0n) return { error: 'Amount must be greater than zero.' }
  return { raw }
}

function checkRecipient(input: string, self: Address | undefined): string | undefined {
  const value = input.trim()
  if (!value) return undefined
  if (!isAddress(value)) return 'Enter a valid wallet address (0x followed by 40 characters).'
  const lower = value.toLowerCase()
  if (lower === zeroAddress) return 'Sending to the zero address is not allowed on Arc.'
  if (self && lower === self.toLowerCase()) return 'You cannot send funds to your own address.'
  if (lower === SYSTEM_EMITTER.toLowerCase() || (ARC_USDC && lower === ARC_USDC.address.toLowerCase())) {
    return 'That is a protocol address, not a wallet. Funds sent there would be lost.'
  }
  return undefined
}

export function Send() {
  const { address, isConnected, isOnArc, balanceRaw, balanceLoading, switchToArc, isSwitching } = useArcWallet()
  const { items, trackTx } = useHistory()
  const { sendTransactionAsync } = useSendTransaction()

  const [to, setTo] = useState('')
  const [amountInput, setAmountInput] = useState('')
  const [phase, setPhase] = useState<Phase>('form')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [frozen, setFrozen] = useState<FeeQuote | null>(null)
  const [sent, setSent] = useState<SentTx | null>(null)
  const submitLock = useRef(false)

  const amount = useMemo(() => parseAmountInput(amountInput), [amountInput])
  const recipientError = checkRecipient(to, address)
  const recipient = to.trim() && !recipientError && isAddress(to.trim()) ? getAddress(to.trim()) : undefined

  const withinBalance = balanceRaw !== undefined && amount.raw !== undefined && amount.raw <= balanceRaw
  const quote = useFeeQuote({
    from: address,
    to: recipient,
    value: amount.raw,
    estimate: Boolean(recipient && amount.raw && withinBalance),
  })
  const fee = quote.data

  const { data: recipientIsContract } = useQuery({
    queryKey: ['pilotlabs-code', recipient],
    enabled: Boolean(recipient),
    staleTime: 60_000,
    queryFn: async () => {
      const code = await publicClient.getCode({ address: recipient as Address })
      return Boolean(code && code !== '0x')
    },
  })

  const trackedStatus = sent ? items.find((i) => i.hash === sent.hash && i.direction === 'sent') : undefined

  if (!isConnected || !address) return <ConnectPrompt message="Connect a wallet to send USDC on Arc Mainnet." />

  if (phase === 'submitted' && sent) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Send</h1>
        <SendStatus
          tx={sent}
          status={trackedStatus?.status ?? 'pending'}
          note={trackedStatus?.note}
          onReset={() => {
            setSent(null)
            setFrozen(null)
            setTo('')
            setAmountInput('')
            setSubmitError(null)
            setPhase('form')
            submitLock.current = false
          }}
        />
      </div>
    )
  }

  // Validation surfaced to the form
  let amountError = amount.error
  if (!amountError && amount.raw !== undefined && balanceRaw !== undefined) {
    if (amount.raw > balanceRaw) {
      amountError = `Insufficient balance. You have ${formatNative(balanceRaw)} USDC.`
    } else if (fee && amount.raw + fee.maxFee > balanceRaw) {
      amountError = `Not enough USDC to cover the amount plus the network fee (up to ${formatFee(fee.maxFee)} USDC).`
    }
  }
  const estimateFailed = Boolean(recipient && amount.raw && withinBalance && quote.isError)

  const canReview =
    isOnArc && Boolean(recipient) && amount.raw !== undefined && !amountError && !recipientError && Boolean(fee) && !estimateFailed

  const handleMax = () => {
    if (balanceRaw === undefined) return
    const reserve = fee?.maxFee ?? 0n
    const spendable = balanceRaw > reserve ? balanceRaw - reserve : 0n
    const usdc = gasTokenToUsdc(ARC_CHAIN_ID, Amount.fromRaw(spendable, gasTokenDecimalsFor(ARC_CHAIN_ID)))
    setAmountInput(usdc.isZero() ? '' : usdc.toString())
  }

  const handleReview = () => {
    if (!canReview || !fee) return
    setFrozen(fee)
    setSubmitError(null)
    setPhase('review')
  }

  const handleConfirm = async () => {
    if (submitLock.current || !recipient || amount.raw === undefined || !frozen) return
    if (!isOnArc) {
      setSubmitError('Switch your wallet to Arc Mainnet before sending.')
      return
    }
    submitLock.current = true
    setSubmitError(null)
    setPhase('wallet')
    try {
      const hash = await sendTransactionAsync({
        chainId: ARC_CHAIN_ID,
        to: recipient,
        value: amount.raw,
        gas: frozen.gasLimit,
        maxFeePerGas: frozen.maxFeePerGas,
        maxPriorityFeePerGas: 0n,
      })
      trackTx({ hash, from: address, to: recipient, value: amount.raw.toString(), submittedAt: Date.now(), status: 'pending' })
      setSent({ hash, to: recipient, value: amount.raw })
      setPhase('submitted')
    } catch (err) {
      // The wallet call failed before a hash existed, so nothing was broadcast and another attempt is safe.
      setSubmitError(classifySendError(err).message)
      setPhase('review')
      submitLock.current = false
    }
  }

  const waiting = phase === 'wallet'
  const reviewing = phase === 'review' || waiting

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Send</h1>

      <div className="space-y-5 rounded-3xl bg-white p-5 ring-1 ring-slate-300">
        <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">
          <span className="text-slate-600">Available balance</span>
          <span className="font-display font-semibold tabular-nums">
            {balanceRaw !== undefined ? `${formatNative(balanceRaw)} USDC` : balanceLoading ? '...' : '--'}
          </span>
        </div>

        <div>
          <label htmlFor="recipient" className="mb-1.5 block text-sm font-semibold text-slate-900">
            Recipient address
          </label>
          <input
            id="recipient"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            disabled={reviewing}
            placeholder="0x..."
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-invalid={Boolean(recipientError)}
            className="min-h-12 w-full rounded-2xl border border-slate-400 bg-white px-4 font-mono text-sm text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/25 disabled:bg-slate-100 disabled:text-slate-700"
          />
          {recipientError && <p className="mt-1.5 text-sm font-medium text-red-700">{recipientError}</p>}
          {recipient && recipientIsContract && (
            <p className="mt-1.5 flex items-start gap-1.5 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              This address is a smart contract. The transfer may be rejected, or the funds may not be recoverable.
            </p>
          )}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="amount" className="text-sm font-semibold text-slate-900">
              Amount (USDC)
            </label>
            <button
              type="button"
              onClick={handleMax}
              disabled={reviewing || balanceRaw === undefined}
              className="min-h-8 px-1 text-sm font-semibold text-blue-700 hover:underline disabled:text-slate-500"
            >
              Max
            </button>
          </div>
          <input
            id="amount"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            disabled={reviewing}
            inputMode="decimal"
            placeholder="0.00"
            autoComplete="off"
            aria-invalid={Boolean(amountError)}
            className="min-h-14 w-full rounded-2xl border border-slate-400 bg-white px-4 font-display text-2xl font-semibold tabular-nums text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/25 disabled:bg-slate-100 disabled:text-slate-700"
          />
          {amountError && <p className="mt-1.5 text-sm text-red-700">{amountError}</p>}
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">Estimated network fee</span>
          <span className="font-medium tabular-nums">
            {fee ? `${formatFee(fee.estimatedFee)} USDC` : quote.isError ? 'Unavailable' : '...'}
          </span>
        </div>
        {estimateFailed && (
          <p className="text-sm text-red-700">
            Arc Mainnet reports this transfer would fail. Check the recipient and amount, or try again shortly.
          </p>
        )}
      </div>

      {reviewing && frozen && recipient && amount.raw !== undefined && (
        <div className="space-y-4 rounded-3xl bg-white p-5 ring-1 ring-slate-300">
          <h2 className="font-display text-lg font-semibold tracking-tight">Transaction summary</h2>
          <dl className="space-y-3 text-sm">
            <Row label="You send" value={`${formatNative(amount.raw)} USDC`} strong />
            <Row label="To" value={recipient} mono />
            <Row label="Network" value="Arc Mainnet" />
            <Row label="Estimated fee" value={`${formatFee(frozen.estimatedFee)} USDC`} />
            <Row label="Maximum fee" value={`${formatFee(frozen.maxFee)} USDC`} />
            <Row label="Maximum total" value={`${formatNative(amount.raw + frozen.maxFee)} USDC`} strong />
          </dl>
          <p className="text-xs text-slate-600">
            Transfers on Arc Mainnet are irreversible. Check the address ({shortAddress(recipient)}) before confirming. Your wallet will ask you to approve.
          </p>
          {submitError && (
            <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {submitError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPhase('form')}
              disabled={waiting}
              className="min-h-12 rounded-full border border-slate-300 bg-slate-100 font-semibold text-slate-900 transition hover:bg-slate-200 disabled:opacity-50"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={waiting}
              className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-blue-700 font-semibold text-white transition hover:bg-blue-800 disabled:bg-blue-500"
            >
              {waiting ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Confirm in wallet
                </>
              ) : (
                'Send'
              )}
            </button>
          </div>
        </div>
      )}

      {!reviewing && (
        <>
          {isOnArc ? (
            <button
              type="button"
              onClick={handleReview}
              disabled={!canReview}
              className="min-h-14 w-full rounded-full bg-blue-700 font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-700"
            >
              Review transfer
            </button>
          ) : (
            <button
              type="button"
              onClick={switchToArc}
              disabled={isSwitching}
              className="min-h-14 w-full rounded-full bg-amber-900 font-semibold text-white disabled:opacity-60"
            >
              {isSwitching ? 'Check your wallet...' : 'Switch to Arc Mainnet'}
            </button>
          )}
        </>
      )}
    </div>
  )
}

function Row({ label, value, mono, strong }: { label: string; value: string; mono?: boolean; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-slate-600">{label}</dt>
      <dd className={`text-right tabular-nums ${mono ? 'break-all font-mono text-xs' : ''} ${strong ? 'font-semibold' : 'font-medium'}`}>{value}</dd>
    </div>
  )
}
