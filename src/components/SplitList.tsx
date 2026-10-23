import { useReadContract } from 'wagmi'
import { ChevronRight, Users, DollarSign } from 'lucide-react'
import { TEAM_SPLIT_ABI, TARGET_CHAIN_ID, TARGET_CHAIN_NAME } from '@/contract-config'
import { useContractAddress } from '@/hooks/useContractAddress'
import { Amount, usdcDecimalsFor } from '@/onchain-money'

interface SplitData {
  name: string
  members: string[]
  shares: bigint[]
  totalPaid: bigint
}

function formatUsdc(raw: bigint): string {
  return Amount.fromRaw(raw, usdcDecimalsFor(TARGET_CHAIN_ID)).toFixed(2)
}

function SplitCard({ splitId, onClick }: { splitId: bigint; onClick: () => void }) {
  const contractAddress = useContractAddress()
  const { data } = useReadContract({
    address: contractAddress,
    abi: TEAM_SPLIT_ABI,
    functionName: 'getSplit',
    args: [splitId],
    chainId: TARGET_CHAIN_ID,
    query: { enabled: !!contractAddress },
  })
  const split = data as SplitData | undefined

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-2xl p-4 text-left transition-all hover:scale-[1.005]"
      style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}
    >
      <div className="min-w-0 flex-1">
        <p className="display truncate text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          {split?.name ?? `Split #${splitId}`}
        </p>
        <div className="mt-1 flex items-center gap-3">
          <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--muted)' }}>
            <Users className="size-3" />
            {split?.members.length ?? '-'} members
          </span>
          <span className="flex items-center gap-1 text-xs tabular-nums" style={{ color: 'var(--muted)' }}>
            <DollarSign className="size-3" />
            {split ? formatUsdc(split.totalPaid) : '-'} USDC in
          </span>
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0" style={{ color: 'var(--subtle)' }} />
    </button>
  )
}

export default function SplitList({ onSelect }: { onSelect: (id: bigint) => void }) {
  const contractAddress = useContractAddress()
  const { data: countRaw } = useReadContract({
    address: contractAddress,
    abi: TEAM_SPLIT_ABI,
    functionName: 'splitCount',
    chainId: TARGET_CHAIN_ID,
    query: { enabled: !!contractAddress, refetchInterval: 5000 },
  })
  const count = countRaw as bigint | undefined

  if (!contractAddress) {
    return (
      <p className="text-center text-sm py-6" style={{ color: 'var(--muted)' }}>
        Connect your wallet to {TARGET_CHAIN_NAME} to get started.
      </p>
    )
  }

  if (count === undefined) {
    return (
      <div className="space-y-3">
        {[0, 1].map(i => (
          <div key={i} className="h-16 animate-pulse rounded-2xl" style={{ background: 'var(--surface-muted)' }} />
        ))}
      </div>
    )
  }

  if (count === 0n) {
    return (
      <div className="rounded-2xl py-10 text-center" style={{ background: 'var(--surface-muted)' }}>
        <p className="text-sm font-medium" style={{ color: 'var(--muted)' }}>No splits yet</p>
        <p className="mt-1 text-xs" style={{ color: 'var(--subtle)' }}>Create the first one above</p>
      </div>
    )
  }

  const splitIds = Array.from({ length: Number(count) }, (_, i) => BigInt(i + 1))

  return (
    <div className="space-y-3">
      {splitIds.map(id => (
        <SplitCard key={id.toString()} splitId={id} onClick={() => onSelect(id)} />
      ))}
    </div>
  )
}
