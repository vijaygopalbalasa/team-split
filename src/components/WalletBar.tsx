import { ConnectKitButton } from 'connectkit'
import { useAccount, useReadContract } from 'wagmi'
import { erc20Abi } from 'viem'
import { getUsdc, requireChain } from '@/onchain-facts'
import { Amount, usdcDecimalsFor } from '@/onchain-money'
import { TokenUSDC } from '@web3icons/react'
import { TARGET_CHAIN_ID } from '@/contract-config'

const usdcFact = getUsdc(TARGET_CHAIN_ID)!
const chain = requireChain(TARGET_CHAIN_ID)

export default function WalletBar() {
  const { address, chainId, isConnected } = useAccount()
  const wrongChain = isConnected && chainId !== TARGET_CHAIN_ID

  const { data: rawBalance } = useReadContract({
    address: usdcFact.address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: TARGET_CHAIN_ID,
    query: { enabled: !!address },
  })

  const balance = rawBalance != null
    ? Amount.fromRaw(rawBalance, usdcDecimalsFor(TARGET_CHAIN_ID)).toFixed(2)
    : null

  return (
    <header
      className="sticky top-0 z-20 flex items-center justify-between px-4 py-3"
      style={{
        background: 'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className="flex size-8 items-center justify-center rounded-xl"
          style={{ background: 'var(--accent)' }}
        >
          <span className="display text-xs font-bold text-white">TS</span>
        </div>
        <span className="display text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          Team Split
        </span>
      </div>

      <div className="flex items-center gap-3">
        {isConnected && !wrongChain && balance !== null && (
          <div className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5" style={{ background: 'var(--surface-muted)' }}>
            <TokenUSDC variant="branded" size={14} />
            <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>
              {balance} USDC
            </span>
          </div>
        )}
        {wrongChain && (
          <span className="rounded-xl px-2.5 py-1.5 text-xs font-semibold" style={{ background: 'rgba(186,43,76,0.1)', color: 'var(--danger)' }}>
            Wrong network, switch to {chain.name}
          </span>
        )}
        <ConnectKitButton />
      </div>
    </header>
  )
}
