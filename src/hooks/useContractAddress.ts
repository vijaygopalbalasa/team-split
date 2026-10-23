import { getChainConfig, TARGET_CHAIN_ID } from '@/contract-config'

/** The TeamSplit address on this build's chain, so lists load before a wallet connects. */
export function useContractAddress(): `0x${string}` | undefined {
  return getChainConfig(TARGET_CHAIN_ID)?.contractAddress
}
