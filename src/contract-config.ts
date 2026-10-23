/**
 * TeamSplit contract configuration.
 * Addresses per chain. The app runs on one of them: build with VITE_NETWORK=ARC-MAINNET for Arc mainnet,
 * testnet otherwise.
 */

import artifact from '../contracts/out/TeamSplit.sol/TeamSplit.json'
import { buildTxExplorerUrl, buildAddressExplorerUrl } from '@/onchain-facts'

export const TEAM_SPLIT_ABI = artifact.abi

// Arc Testnet (chain 5042002)
export const ARC_TESTNET_CHAIN_ID = 5042002

// Arc Mainnet (chain 5042)
export const ARC_MAINNET_CHAIN_ID = 5042

export interface ChainConfig {
  chainId: number
  contractAddress: `0x${string}`
  explorerBase: string
}

export const CHAIN_CONFIGS: Record<number, ChainConfig> = {
  [ARC_TESTNET_CHAIN_ID]: {
    chainId: ARC_TESTNET_CHAIN_ID,
    contractAddress: '0x06bd8548e7589ee4eabdfde872d86539f1f909b0',
    explorerBase: 'https://testnet.arcscan.app',
  },
  [ARC_MAINNET_CHAIN_ID]: {
    chainId: ARC_MAINNET_CHAIN_ID,
    contractAddress: '0xd6989212dbf1c7f4431a5dde20cbe08cfb3a38d5',
    explorerBase: 'https://explorer.arc.io',
  },
}

/** The chain this build of the app uses. */
export const TARGET_CHAIN_ID =
  import.meta.env.VITE_NETWORK === 'ARC-MAINNET' ? ARC_MAINNET_CHAIN_ID : ARC_TESTNET_CHAIN_ID

/** Its name in the UI. */
export const TARGET_CHAIN_NAME = TARGET_CHAIN_ID === ARC_MAINNET_CHAIN_ID ? 'Arc' : 'Arc Testnet'

export function getChainConfig(chainId: number): ChainConfig | undefined {
  return CHAIN_CONFIGS[chainId]
}

export function getTxUrl(chainId: number, txHash: string): string {
  return buildTxExplorerUrl(chainId, txHash)
}

export function getContractUrl(chainId: number, address: string): string {
  return buildAddressExplorerUrl(chainId, address)
}
