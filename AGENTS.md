# Team Split

> Built with Arc Studio - money-powered apps in minutes

## What This App Does

USDC revenue splitter on Arc Testnet. Teams create immutable splits with fixed basis-point shares; anyone pays USDC in; members withdraw their share at any time via pull accounting.

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry, OpenZeppelin SafeERC20 + ReentrancyGuard
- Chain: Arc Testnet (Chain ID: 5042002) / Arc Mainnet (Chain ID: 5042)
- Token: USDC at 0x3600000000000000000000000000000000000000 (6 decimals, same address on both networks)

## Deployed Contracts

| Network | Address | Explorer |
|---|---|---|
| Arc Testnet | 0x06bd8548e7589ee4eabdfde872d86539f1f909b0 | https://explorer.testnet.arc.io/address/0x06bd8548e7589ee4eabdfde872d86539f1f909b0 |

Deploy tx: 0x28641964d76f9f4e8fb51d240b4ca059b7100d08b90792290af33e1c06dd0165

## Key Files

- `src/App.tsx` - Root: home view (split list + new split form) and split detail view
- `src/components/WalletBar.tsx` - Sticky header with ConnectKit + USDC balance
- `src/components/NewSplitForm.tsx` - Create split form (name, members, %)
- `src/components/SplitList.tsx` - Card list of all on-chain splits
- `src/components/SplitPage.tsx` - Split detail: stats, members, pay flow (approve+pay), withdraw
- `src/contract-config.ts` - Contract addresses per chain, ABI import, explorer URL helpers
- `src/hooks/useContractAddress.ts` - Returns the TeamSplit address for the connected chain
- `contracts/TeamSplit.sol` - Main contract
- `contracts/test/TeamSplit.*.t.sol` - Foundry unit tests (50 tests, all passing)

## Contract Notes

- USDC token address is passed in the constructor (same 0x3600... on both Arc networks)
- Shares are basis points (10,000 = 100%). Dust from rounding goes to the last member.
- No owner, no admin, no upgradeability, no fees.
- Adding Arc mainnet: deploy with the same constructor arg, add an entry in CHAIN_CONFIGS in src/contract-config.ts.

## To Run

```bash
bun install
bun run dev
```
