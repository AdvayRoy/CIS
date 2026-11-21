# CounterSign independent acceptance verification (worker E)

These tests check the twelve fixed acceptance checks in `docs/CONTRACT.md` against the **running integrated app**.
They import nothing from `src/server`; they only speak HTTP (real signed cookies from `POST /api/session`, real pairing tokens)
and read the EVM directly through `ANVIL_RPC_URL` for independent balance/allowance evidence.

| Checks | Where | Runner |
|---|---|---|
| 1-8, 11 | `tests/acceptance/acceptance.test.ts` | vitest (HTTP) |
| 9, 10, 12 (+ browser half of 5) | `e2e/*.e2e.ts` | Playwright (Chromium), desktop + separate phone context |

## Run

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install chromium          # once

# 1. start the integrated demo (Anvil + deploy + Next). Once the lead adds it:
pnpm demo
#    until then: `anvil` in one shell, the chain deploy script from scripts/chain, then `pnpm dev`

# 2. HTTP acceptance (checks 1-8, 11). ACCEPTANCE=1 makes an unreachable server a failure instead of a skip.
ACCEPTANCE=1 BASE_URL=http://localhost:3000 pnpm exec vitest run tests/acceptance

# 3. Browser acceptance (checks 9, 10, 12). Screenshots land in docs-verify/screenshots/.
BASE_URL=http://localhost:3000 pnpm exec playwright test
```

Environment (all optional): `BASE_URL` (default `http://localhost:3000`; must be absolute, or use `CS_BASE_URL`, because vitest sets `BASE_URL=/` itself), `ANVIL_RPC_URL` (default `http://127.0.0.1:8545`),
`CS_CUSTOMER_KEY` / `CS_MERCHANT_KEY` / `CS_OPERATOR_KEY` (defaults `demo-customer` / `demo-merchant` / `demo-operator`).

## Notes

- Every scenario starts with `POST /api/lab/reset` (operator) and asserts the clean ledger, so the suite **wipes demo state**. Do not run it against a demo in front of an audience.
- Tests run sequentially (one vitest file, Playwright `workers: 1`) because ledger and chain are shared state.
- Assertions are on persisted evidence: ledger receipt, balances re-read from `/api/state`, `executionCount`, and for crypto `balanceOf` / `allowance` / transaction receipt read straight from the EVM.
- Without a reachable server `pnpm test` reports the acceptance suite as skipped (= NOT RUN, never PASS).
- Results of each run against `main` are recorded in `docs-verify/RESULTS.md`.
