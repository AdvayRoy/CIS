# Evidence matrix

Integrated `main` at `cebeaf0` (after the OKX-style redesign and `/shop` flow), production build started with `pnpm demo`, run 2026-11-21 09:06 UTC on the build VM (macOS, Chromium headless).

| Command | Result |
|---|---|
| `pnpm typecheck` | pass |
| `pnpm test` (bank/auth, chain adapter, i18n dictionaries) | 235 passed, 52 skipped (per-locale `lab` dictionaries do not exist; operator page is English only) |
| `cd contracts && forge test` | 21 passed |
| `ACCEPTANCE=1 CS_BASE_URL=http://localhost:3000 pnpm exec vitest run tests/acceptance` | 37 passed |
| `BASE_URL=http://localhost:3000 pnpm exec playwright test` | 17 passed (includes `e2e/shop.e2e.ts`: checkout → phone approval → shop-submitted payment → one execution) |

| # | Acceptance check | Result | Where proven |
|---|---|---|---|
| 1 | Legitimate bank transfer settles once | PASS | acceptance suite; `tests/bank` |
| 2 | Recipient/amount mutation moves no money | PASS | acceptance suite; `tests/bank` |
| 3 | Expired authorization rejected | PASS | acceptance suite |
| 4 | Replay / 20 concurrent executes give one debit | PASS | acceptance suite; `tests/bank` (also 20 OS processes) |
| 5 | Merchant/lab capability cannot approve | PASS | acceptance suite; Playwright |
| 6 | Protected crypto purchase for agreed amount | PASS | acceptance suite reads the EVM directly; Foundry |
| 7 | Residual allowance 0, later drain reverts | PASS | acceptance suite; Foundry |
| 8 | Vulnerable comparison: same drain succeeds | PASS | acceptance suite; Foundry |
| 9 | Phone and desktop agree with receipts/balances | PASS | Playwright journeys |
| 10 | Pending/failed/disconnected never shown as success | PASS | Playwright truthful-states |
| 11 | Reset is deterministic | PASS | acceptance suite |
| 12 | No overflow at 1440x900, 1280x800, 390x844, 375 wide | PASS | Playwright |
| L | Live approval flow in English, Russian, Arabic (RTL, 390x844), instant switch keeps state and persists | PASS | `e2e/i18n.e2e.ts` |

Screenshots: `docs-verify/screenshots/`. Per-check detail: `docs-verify/RESULTS.md`. Locale status: `tests/i18n/STATUS.md`.

## Working, simulated, unverified, deferred

**Working (observed in the runs above):** bank simulation ledger with exact-once settlement; real local-EVM token purchase with on-chain signature check, exact approval and allowance removal; vulnerable comparison; phone/desktop on one authoritative state; reset; 14-language UI with Arabic RTL.

**Simulated / disclosed demo components:** the bank is a SQLite ledger, not a bank. The chain is a private Anvil node with a mock ERC-20. Role keys stand in for real sign-in. The customer signature comes from an isolated server-side demo signer gated by the paired approval session, not from a device key or biometrics.

**Unverified:** any physical iPhone, Safari/WebKit, installed PWA; a public HTTPS URL; any translation by a native speaker (all 13 non-English locales are model-written); crypto flow in languages other than English; `DEV=1 pnpm demo` (the dev server reloaded pages continuously during browser tests on this VM, so use the production mode).

**Deferred:** recorded video; native-speaker review; `lab` page translation; lint cleanup beyond errors.
