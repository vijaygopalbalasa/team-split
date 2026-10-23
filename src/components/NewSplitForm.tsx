import { useEffect, useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { toast } from 'sonner'
import { Plus, Trash2, Loader2, ExternalLink } from 'lucide-react'
import { TEAM_SPLIT_ABI, TARGET_CHAIN_ID, TARGET_CHAIN_NAME, getTxUrl } from '@/contract-config'
import { useContractAddress } from '@/hooks/useContractAddress'
import { parseOnchainError } from '@/utils/errors'

interface Member {
  address: string
  pct: string
}

const EMPTY_MEMBER = (): Member => ({ address: '', pct: '' })

export default function NewSplitForm({ onCreated }: { onCreated: (splitId: bigint) => void }) {
  const [name, setName] = useState('')
  const [members, setMembers] = useState<Member[]>([EMPTY_MEMBER(), EMPTY_MEMBER()])
  const { chainId, isConnected } = useAccount()
  const { switchChain } = useSwitchChain()
  const contractAddress = useContractAddress()

  const { writeContract, data: hash, isPending, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({ hash })

  const totalPct = members.reduce((sum, m) => sum + (parseFloat(m.pct) || 0), 0)
  const totalBps = Math.round(totalPct * 100)
  const isExact = totalBps === 10_000
  const txUrl = hash ? getTxUrl(TARGET_CHAIN_ID, hash) : null

  function addMember() {
    if (members.length < 20) setMembers(prev => [...prev, EMPTY_MEMBER()])
  }

  function removeMember(i: number) {
    if (members.length > 2) setMembers(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateMember(i: number, field: keyof Member, value: string) {
    setMembers(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: value } : m))
  }

  function setRemaining(i: number) {
    const otherTotal = members.reduce((sum, m, idx) => idx === i ? sum : sum + (parseFloat(m.pct) || 0), 0)
    const remaining = Math.max(0, 100 - otherTotal)
    updateMember(i, 'pct', remaining.toFixed(2).replace(/\.?0+$/, ''))
  }

  const wrongChain = isConnected && chainId !== TARGET_CHAIN_ID

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (wrongChain) { switchChain({ chainId: TARGET_CHAIN_ID }); return }
    if (!contractAddress) return

    const addrs = members.map(m => m.address.trim() as `0x${string}`)
    const shares = members.map(m => BigInt(Math.round((parseFloat(m.pct) || 0) * 100)))

    writeContract(
      {
        address: contractAddress,
        abi: TEAM_SPLIT_ABI,
        functionName: 'createSplit',
        args: [addrs, shares, name.trim()],
        chainId: TARGET_CHAIN_ID,
      },
      {
        onError: (err) => toast.error(parseOnchainError(err)),
      }
    )
  }

  // Parse splitId from receipt logs, once per confirmed receipt
  useEffect(() => {
    if (!isSuccess || !receipt) return
    const log = receipt.logs[receipt.logs.length - 1]
    if (log?.topics[1]) onCreated(BigInt(log.topics[1]))
  }, [isSuccess, receipt, onCreated])

  const ready = isConnected && name.trim().length > 0 && isExact &&
    members.every(m => m.address.trim().length > 0) && !isPending && !isConfirming

  return (
    <div className="rounded-3xl p-6" style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', backdropFilter: 'blur(20px)' }}>
      <h2 className="display mb-5 text-xl font-semibold" style={{ color: 'var(--ink)' }}>
        New split
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)', letterSpacing: '0.07em' }}>
            Split name
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Q4 Founders"
            className="w-full rounded-2xl px-4 py-3 text-sm outline-none transition-all focus:ring-2"
            style={{ background: 'var(--surface-muted)', color: 'var(--ink)', border: '1px solid var(--border)', '--tw-ring-color': 'var(--focus)' } as React.CSSProperties}
          />
        </div>

        {/* Members */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)', letterSpacing: '0.07em' }}>
              Members
            </label>
            <span
              className="text-xs font-semibold tabular-nums"
              style={{ color: isExact ? 'var(--success)' : totalPct > 100 ? 'var(--danger)' : 'var(--muted)' }}
            >
              {totalPct.toFixed(2)}% / 100%
            </span>
          </div>

          <div className="space-y-2">
            {members.map((m, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={m.address}
                  onChange={e => updateMember(i, 'address', e.target.value)}
                  placeholder={`0x...`}
                  className="mono min-w-0 flex-1 rounded-xl px-3 py-2.5 text-xs outline-none"
                  style={{ background: 'var(--surface-muted)', color: 'var(--ink)', border: '1px solid var(--border)' }}
                />
                <div className="flex items-center gap-1 rounded-xl px-3" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
                  <input
                    value={m.pct}
                    onChange={e => updateMember(i, 'pct', e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="0"
                    className="w-14 bg-transparent text-right text-sm font-semibold tabular-nums outline-none"
                    style={{ color: 'var(--ink)' }}
                  />
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>%</span>
                  <button
                    type="button"
                    onClick={() => setRemaining(i)}
                    className="ml-1 text-xs font-semibold"
                    style={{ color: 'var(--accent-hover)' }}
                    title="Fill remaining"
                  >
                    Max
                  </button>
                </div>
                {members.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeMember(i)}
                    className="flex size-10 items-center justify-center rounded-xl transition-colors"
                    style={{ background: 'rgba(186,43,76,0.08)', color: 'var(--danger)' }}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {members.length < 20 && (
            <button
              type="button"
              onClick={addMember}
              className="mt-2 flex items-center gap-1.5 text-xs font-semibold"
              style={{ color: 'var(--accent-hover)' }}
            >
              <Plus className="size-3.5" /> Add member
            </button>
          )}
        </div>

        {/* CTA */}
        <button
          type="submit"
          disabled={!ready}
          className="mt-2 w-full rounded-2xl py-3.5 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: 'var(--accent)' }}
        >
          {!isConnected ? 'Connect wallet' :
            wrongChain ? `Switch to ${TARGET_CHAIN_NAME}` :
            isPending ? <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" /> Confirm in wallet...</span> :
            isConfirming ? <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" /> Confirming...</span> :
            'Create split'}
        </button>

        {isSuccess && txUrl && (
          <a
            href={txUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 text-xs font-medium"
            style={{ color: 'var(--success)' }}
            onClick={() => reset()}
          >
            Split created, view transaction <ExternalLink className="size-3" />
          </a>
        )}
      </form>
    </div>
  )
}
