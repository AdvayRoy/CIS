# Local-chain demo scripts

```
anvil --port 8545                      # private companion process (Foundry)
pnpm tsx scripts/chain/deploy.ts       # deploy + mint 1,000 CSUSD each + snapshot -> data/deployment.json
pnpm tsx scripts/chain/reset.ts        # evm_revert to snapshot (or redeploy)
(cd contracts && forge test)           # contract tests
(cd contracts && forge build) && pnpm tsx scripts/chain/gen-artifacts.ts   # regenerate src/server/chain/artifacts.ts
```
