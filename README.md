# Team Split

A USDC revenue splitter. A team creates a split once with fixed shares, anyone pays USDC into it, and each member withdraws their share whenever they like.

Built in [Arc Studio](https://studio.arc.io) and live on Arc mainnet.

- Live app: https://team-split-arc.vercel.app
- Arc Studio project: https://studio.arc.io/app/e9d02662-32e5-43cb-8a94-e5e53bca62a3
- Contract on Arc mainnet: [`0xd6989212dbf1c7f4431a5dde20cbe08cfb3a38d5`](https://explorer.arc.io/address/0xd6989212dbf1c7f4431a5dde20cbe08cfb3a38d5), source verified on [Sourcify](https://repo.sourcify.dev/5042/0xd6989212dbf1c7f4431a5dde20cbe08cfb3a38d5) (exact match), deployed in [`0x77494bff…`](https://explorer.arc.io/tx/0x77494bff71dd5f980c1106ad03d5ea49306990fbd8c4fc2c25b59d992ffb3856)
- Contract on Arc testnet: [`0x06bd8548e7589ee4eabdfde872d86539f1f909b0`](https://testnet.arcscan.app/address/0x06bd8548e7589ee4eabdfde872d86539f1f909b0)

## First mainnet split

Split 1 (three members at 50, 30 and 20 percent), 0.05 USDC, run through the app on October 23, 2026:

| Step | Transaction |
|---|---|
| Create the split | [`0x27bc17d3…`](https://explorer.arc.io/tx/0x27bc17d32d14b7265b605d9508dd8a47c319d851d8b949341e6effecbd2048bd) |
| Payer allows 0.05 USDC | [`0x433fe384…`](https://explorer.arc.io/tx/0x433fe38467cb2a70e7cf1c88852105137283148d58ef261badcce702ce932a9f) |
| Payer pays 0.05 USDC into the split | [`0x34224fc2…`](https://explorer.arc.io/tx/0x34224fc29b41b9e7aa78843a185990c63d52d82f639edf939fa8bdcdae8d5412) |
| The 30 percent member withdraws 0.015 USDC | [`0x8294074b…`](https://explorer.arc.io/tx/0x8294074b3286e4458a27b08d45aff53155ee620b892adc8153b312f056b4378e) |

The walkthrough video shows split 3, the same flow run again after the display fixes below: [created](https://explorer.arc.io/tx/0x5470e656801824ca344226607c47f3e16a0bf4ac581c77367d0e38fba20dc5fe), [paid 0.05 USDC](https://explorer.arc.io/tx/0xd26f58a17b226a16254c331645ef78e230ed5768f24c81ed7001a5021e3b0a4d), [0.015 withdrawn](https://explorer.arc.io/tx/0x52614028219e4c551153216cb3ad1a687330d963930f9cb4e57645fc018cd160).

## How it works

- `createSplit(members, shares, name)`: 2 to 20 members, no duplicates, shares in basis points that add up to exactly 10,000.
- `pay(splitId, amount, memo)` pulls USDC in and credits every member their share. Rounding dust goes to the last member, so every unit paid in can be withdrawn.
- `withdraw(splitId)` sends the caller their balance. `withdrawFor(splitId, member)` lets anyone push a member's balance to that member, never to the caller.
- Splits cannot be changed once created. No owner, no admin keys, no fees, no upgrades.

## Run it

```bash
bun install
forge build                              # the app imports the compiled ABI from contracts/out
forge test                               # 50 Foundry tests
bun run dev                              # Arc testnet
VITE_NETWORK=ARC-MAINNET bun run build   # Arc mainnet build in dist/
```

The app picks its network from `VITE_NETWORK` (`ARC-TESTNET` by default, `ARC-MAINNET` for mainnet). USDC is Arc's ERC-20 interface at `0x3600000000000000000000000000000000000000` on both networks. The `scripts/` folder holds Arc Studio's own sandbox deploy helpers; they need its sandbox and are not used here.

## What changed after Arc Studio

Arc Studio wrote the contract, the tests and the app, and deployed the contract to Arc testnet. Running the full flow with real wallets, first on testnet and then on mainnet, found these, fixed here. The contract logic did not change.

- Paying sent the `pay` transaction twice: the step after the approval ran during render. The second one reverted and still cost gas. Approve and pay are now sequenced in the click handler, one pay per click.
- The success handlers refetched on every render, flooding the RPC. They now run once per confirmed transaction.
- The split list needed a connected wallet to find the contract. It now loads for anyone.
- Amounts were cut to two decimals, so a 0.015 share showed as 0.01. Every digit is shown now. (Found in the first mainnet run.)
- After a payment, the other members' rows and the balance in the header kept their old values until a reload. Every read now refreshes once the payment confirms. (Found in the first mainnet run.)

Also added by hand: Arc mainnet next to testnet with a `VITE_NETWORK` switch, the mainnet address, and network labels that follow the active network. Arc Studio deploys to testnet only, so the mainnet contract was deployed separately with the same compiled code and verified on Sourcify. Arc Studio's report also described a "testnet flow" that had in fact run on a local fork; the live testnet contract had no splits until the run above.

## Limits

- Not audited. Keep amounts small.
- Shares are fixed. To change them, create a new split.
- If USDC blocks a member's address, that member cannot withdraw their share. Everyone else is unaffected.

## License

MIT
