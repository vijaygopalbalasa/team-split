import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'
import { erc20Abi } from 'viem'
import { config } from '@/config'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, ExternalLink, Users, DollarSign } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { TEAM_SPLIT_ABI, TARGET_CHAIN_ID, TARGET_CHAIN_NAME, getTxUrl } from '@/contract-config'
import { useContractAddress } from '@/hooks/useContractAddress'
import { getUsdc } from '@/onchain-facts'
import { parseAmount, Amount, usdcDecimalsFor } from '@/onchain-money'
import { usdcText } from '@/format'
import { parseOnchainError } from '@/utils/errors'

const usdcFact = getUsdc(TARGET_CHAIN_ID)!

interface SplitData {
  name: string
  members: readonly `0x${string}`[]
  shares: readonly bigint[]
  totalPaid: bigint
}

function fmtUsdc(raw: bigint): string {
  return usdcText(Amount.fromRaw(raw, usdcDecimalsFor(TARGET_CHAIN_ID)))
}

function shortAddr(addr: string) {
  return addr.slice(0, 6) + '...' + addr.slice(-4)
}

export default function SplitPage({ splitId, onBack }: { splitId: bigint; onBack: () => void }) {
  const { address, chainId, isConnected } = useAccount()
  const { switchChain } = useSwitchChain()
  const contractAddress = useContractAddress()
  const wrongChain = isConnected && chainId !== TARGET_CHAIN_ID

  const { data: splitRaw, refetch: refetchSplit } = useReadContract({
    address: contractAddress,
    abi: TEAM_SPLIT_ABI,
    functionName: 'getSplit',
    args: [splitId],
    chainId: TARGET_CHAIN_ID,
    query: { enabled: !!contractAddress },
  })
  const split = splitRaw as SplitData | undefined

  const { data: myClaimableRaw, refetch: refetchClaimable } = useReadContract({
    address: contractAddress,
    abi: TEAM_SPLIT_ABI,
    functionName: 'claimable',
    args: address ? [splitId, address] : undefined,
    chainId: TARGET_CHAIN_ID,
    query: { enabled: !!contractAddress && !!address },
  })
  const myClaimable = myClaimableRaw as bigint | undefined

  // Pay flow
  const [payAmount, setPayAmount] = useState('')
  const [payMemo, setPayMemo] = useState('')
  const [payStep, setPayStep] = useState<'idle' | 'approving' | 'paying'>('idle')

  const { writeContractAsync: approveAsync, data: approveHash, isPending: isApprovePending, reset: resetApprove } = useWriteContract()
  const { isLoading: isApproveConfirming } = useWaitForTransactionReceipt({ hash: approveHash })

  const { writeContractAsync: payAsync, data: payHash, isPending: isPayPending, reset: resetPay } = useWriteContract()
  const { isSuccess: isPaySuccess, isLoading: isPayConfirming } = useWaitForTransactionReceipt({ hash: payHash })

  const { writeContractAsync: withdrawAsync, data: withdrawHash, isPending: isWithdrawPending, reset: resetWithdraw } = useWriteContract()
  const { isSuccess: isWithdrawSuccess, isLoading: isWithdrawConfirming } = useWaitForTransactionReceipt({ hash: withdrawHash })

  const queryClient = useQueryClient()

  // Approve, wait for it to land, then pay. Sequenced here in the click handler so each click sends one pay.
  async function runPay(raw: bigint) {
    if (!contractAddress) return
    try {
      setPayStep('approving')
      const approveTx = await approveAsync({
        address: usdcFact.address as `0x${string}`,
        abi: erc20Abi,
        functionName: 'approve',
        args: [contractAddress, raw],
        chainId: TARGET_CHAIN_ID,
      })
      await waitForTransactionReceipt(config, { hash: approveTx, chainId: TARGET_CHAIN_ID })
      setPayStep('paying')
      const payTx = await payAsync({
        address: contractAddress,
        abi: TEAM_SPLIT_ABI,
        functionName: 'pay',
        args: [splitId, raw, payMemo],
        chainId: TARGET_CHAIN_ID,
      })
      await waitForTransactionReceipt(config, { hash: payTx, chainId: TARGET_CHAIN_ID })
      // every member's row, the balance in the header and this split all change: refresh every read
      void queryClient.invalidateQueries()
      void refetchSplit()
      void refetchClaimable()
    } catch (err) {
      toast.error(parseOnchainError(err))
      setPayStep('idle')
      resetApprove()
    }
  }

  function handlePay(e: React.FormEvent) {
    e.preventDefault()
    if (wrongChain) { switchChain({ chainId: TARGET_CHAIN_ID }); return }
    void runPay(parseAmount(TARGET_CHAIN_ID, payAmount).raw)
  }

  async function runWithdraw() {
    if (!contractAddress) return
    try {
      const tx = await withdrawAsync({
        address: contractAddress,
        abi: TEAM_SPLIT_ABI,
        functionName: 'withdraw',
        args: [splitId],
        chainId: TARGET_CHAIN_ID,
      })
      await waitForTransactionReceipt(config, { hash: tx, chainId: TARGET_CHAIN_ID })
      void queryClient.invalidateQueries()
      void refetchClaimable()
      void refetchSplit()
    } catch (err) {
      toast.error(parseOnchainError(err))
      resetWithdraw()
    }
  }

  function handleWithdraw() {
    if (wrongChain) { switchChain({ chainId: TARGET_CHAIN_ID }); return }
    void runWithdraw()
  }

  const isMember = split && address && split.members.some(m => m.toLowerCase() === address.toLowerCase())
  const hasClaimable = myClaimable != null && (myClaimable) > 0n

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex size-9 items-center justify-center rounded-xl transition-colors hover:bg-black/5"
          style={{ color: 'var(--muted)' }}
        >
          <ArrowLeft className="size-4" />
        </button>
        <div>
          <h1 className="display text-xl font-semibold" style={{ color: 'var(--ink)' }}>
            {split?.name ?? 'Loading...'}
          </h1>
          <p className="text-xs tabular-nums" style={{ color: 'var(--muted)' }}>
            Split #{splitId.toString()}
          </p>
        </div>
      </div>

      {split && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl p-4" style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}>
            <div className="mb-1 flex items-center gap-1.5">
              <DollarSign className="size-3.5" style={{ color: 'var(--muted)' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Total paid in</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="display text-2xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
                {fmtUsdc(split.totalPaid)}
              </span>
              <span className="text-sm" style={{ color: 'var(--subtle)' }}>USDC</span>
            </div>
          </div>
          <div className="rounded-2xl p-4" style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}>
            <div className="mb-1 flex items-center gap-1.5">
              <Users className="size-3.5" style={{ color: 'var(--muted)' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Members</span>
            </div>
            <span className="display text-2xl font-bold" style={{ color: 'var(--ink)' }}>
              {split.members.length}
            </span>
          </div>
        </div>
      )}

      {split && (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <div className="px-4 py-3" style={{ background: 'var(--surface-muted)' }}>
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)', letterSpacing: '0.07em' }}>
              Member shares
            </span>
          </div>
          {split.members.map((member, i) => (
            <MemberRow
              key={member}
              member={member}
              share={split.shares[i]}
              splitId={splitId}
              isMe={address?.toLowerCase() === member.toLowerCase()}
              contractAddress={contractAddress}
            />
          ))}
        </div>
      )}

      {isMember && (
        <div className="rounded-2xl p-4" style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Your claimable</span>
            <div className="flex items-center gap-1.5">
              <TokenUSDC variant="branded" size={14} />
              <span className="display text-lg font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
                {myClaimable != null ? fmtUsdc(myClaimable) : '-'}
              </span>
              <span className="text-sm" style={{ color: 'var(--subtle)' }}>USDC</span>
            </div>
          </div>

          <button
            onClick={handleWithdraw}
            disabled={!hasClaimable || isWithdrawPending || isWithdrawConfirming || wrongChain}
            className="w-full rounded-2xl py-3 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: 'var(--success)' }}
          >
            {wrongChain ? `Switch to ${TARGET_CHAIN_NAME}` :
              isWithdrawPending ? <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" /> Confirm in wallet...</span> :
              isWithdrawConfirming ? <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" /> Confirming...</span> :
              isWithdrawSuccess ? 'Withdrawn!' :
              'Withdraw'}
          </button>

          {isWithdrawSuccess && withdrawHash && (
            <a
              href={getTxUrl(TARGET_CHAIN_ID, withdrawHash)}
              target="_blank"
              rel="noreferrer"
              className="mt-2 flex items-center justify-center gap-1 text-xs"
              style={{ color: 'var(--success)' }}
              onClick={() => resetWithdraw()}
            >
              View withdrawal transaction <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      )}

      {/* Pay */}
      <div className="rounded-2xl p-4" style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}>
        <h3 className="mb-4 text-sm font-semibold" style={{ color: 'var(--ink)' }}>Pay into this split</h3>
        <form onSubmit={handlePay} className="space-y-3">
          <div className="rounded-xl p-3" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2">
              <TokenUSDC variant="branded" size={18} />
              <input
                inputMode="decimal"
                value={payAmount}
                onChange={e => setPayAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="0.00"
                className="display min-w-0 flex-1 bg-transparent text-2xl font-bold tabular-nums outline-none placeholder:text-slate-300"
                style={{ color: 'var(--ink)' }}
              />
              <span className="text-sm font-medium" style={{ color: 'var(--subtle)' }}>USDC</span>
            </div>
          </div>

          <input
            value={payMemo}
            onChange={e => setPayMemo(e.target.value)}
            placeholder="Memo (optional)"
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            style={{ background: 'var(--surface-muted)', color: 'var(--ink)', border: '1px solid var(--border)' }}
            maxLength={200}
          />

          <button
            type="submit"
            disabled={!isConnected || !payAmount || parseFloat(payAmount) <= 0 ||
              (payStep !== 'idle') || isPayConfirming || wrongChain}
            className="w-full rounded-2xl py-3 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: 'var(--accent)' }}
          >
            {!isConnected ? 'Connect wallet' :
              wrongChain ? `Switch to ${TARGET_CHAIN_NAME}` :
              payStep === 'approving' && isApprovePending ? <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" /> Approve USDC...</span> :
              payStep === 'approving' && isApproveConfirming ? <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" /> Confirming approval...</span> :
              payStep === 'paying' && isPayPending ? <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" /> Confirm payment...</span> :
              payStep === 'paying' && isPayConfirming ? <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" /> Confirming...</span> :
              isPaySuccess ? 'Paid!' :
              'Approve + Pay'}
          </button>

          {payStep === 'approving' && (
            <p className="text-center text-xs" style={{ color: 'var(--muted)' }}>Step 1 of 2: approve USDC spending</p>
          )}
          {payStep === 'paying' && !isPaySuccess && (
            <p className="text-center text-xs" style={{ color: 'var(--muted)' }}>Step 2 of 2: sending payment to split</p>
          )}

          {isPaySuccess && payHash && (
            <a
              href={getTxUrl(TARGET_CHAIN_ID, payHash)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1 text-xs"
              style={{ color: 'var(--success)' }}
              onClick={() => { setPayStep('idle'); resetApprove(); resetPay(); setPayAmount(''); setPayMemo('') }}
            >
              Payment confirmed <ExternalLink className="size-3" />
            </a>
          )}
        </form>
      </div>
    </div>
  )
}

interface MemberRowProps {
  member: string
  share: bigint
  splitId: bigint
  isMe: boolean
  contractAddress: `0x${string}` | undefined
}

function MemberRow({ member, share, splitId, isMe, contractAddress }: MemberRowProps) {
  const { data: claimableRaw } = useReadContract({
    address: contractAddress,
    abi: TEAM_SPLIT_ABI,
    functionName: 'claimable',
    args: [splitId, member as `0x${string}`],
    chainId: TARGET_CHAIN_ID,
    query: { enabled: !!contractAddress },
  })
  const claimable = claimableRaw as bigint | undefined

  const pct = (Number(share) / 100).toFixed(2)

  return (
    <div
      className="flex items-center justify-between px-4 py-3"
      style={{ borderTop: '1px solid var(--border)', background: isMe ? 'rgba(26,128,71,0.04)' : 'transparent' }}
    >
      <div>
        <p className="mono text-xs font-medium" style={{ color: 'var(--ink)' }}>
          {shortAddr(member)}
          {isMe && (
            <span className="ml-1.5 rounded-md px-1.5 py-0.5 text-xs" style={{ background: 'rgba(26,128,71,0.12)', color: 'var(--success)' }}>
              You
            </span>
          )}
        </p>
        <p className="text-xs tabular-nums" style={{ color: 'var(--muted)' }}>{pct}%</p>
      </div>
      <div className="text-right">
        <p className="text-xs" style={{ color: 'var(--muted)' }}>Claimable</p>
        <p className="text-sm font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>
          {claimable != null ? fmtUsdc(claimable) : '-'} USDC
        </p>
      </div>
    </div>
  )
}
