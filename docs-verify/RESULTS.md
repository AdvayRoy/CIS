# CounterSign acceptance results (worker E, independent verification)

Last updated: 2026-11-21 08:56 UTC. `main` tested: `1fe6cae` (`w/verify` fast-forwarded to it; previous run on 316138b had the same 12 PASS).

Server: `pnpm demo` via `bash docs-verify/run.sh` (Next dev server on :3000 + Anvil on :8545, health `chain.available=true, chainId=31337`).

Commands:

- V = `ACCEPTANCE=1 CS_BASE_URL=http://localhost:3000 pnpm exec vitest run tests/acceptance` → 37 passed, 0 failed, 0 skipped
- P = `BASE_URL=http://localhost:3000 pnpm exec playwright test` → 16 passed (1.1m): 12 from this suite + 4 from `e2e/i18n.e2e.ts` (not worker E, not mapped to a check)
- `pnpm typecheck` → clean

| # | Check | Result | Evidence | main SHA |
|---|---|---|---|---|
| 1 | Approved legitimate bank transfer settles once | PASS | V, 4/4: ledger receipt persisted, customer 100000→90000, merchant +10000, executionCount 1 | 1fe6cae |
| 2 | Recipient/amount mutations move no money | PASS | V, 9/9: recipient, amount, operation, continuing-permission mutations rejected with field diffs; balances unchanged; no receipt | 1fe6cae |
| 3 | Expired authorization rejected | PASS | V, 2/2: ttlSeconds 5 waited out, approved and unapproved; no debit | 1fe6cae |
| 4 | Replay/concurrent → one debit | PASS | V, 3/3: 20 concurrent executes and replay after settlement → one ledger transfer, balance 90000 | 1fe6cae |
| 5 | Merchant/lab capability cannot approve | PASS | V, 8/8 (merchant/operator/anonymous cookies, body/query/header role claims, forged cookies, forged/absent/tampered/cross-agreement pairing tokens); P, 1/1 (phone without token, forged token, merchant cookies) | 1fe6cae |
| 6 | Protected crypto purchase completes for agreed amount | PASS | V, 3/3: viem-read customer balance 900 CSUSD, shop +100, on-chain tx receipt status success | 1fe6cae |
| 7 | Residual allowance 0; later drain fails | PASS | V, 1/1: viem-read allowance 0; drain executed and reverted; balance still 900 | 1fe6cae |
| 8 | Vulnerable comparison: same attack succeeds | PASS | V, 1/1: vulnerable account left with standing allowance; drain succeeds, balance read from EVM drops | 1fe6cae |
| 9 | Phone/desktop agree with receipts and balances | PASS | P, 3/3 (bank at 1440x900+390x844 and 1280x800+375x667, crypto at 1440x900+390x844): both views show the persisted ledger transfer id / tx hash and balances from `/api/state`, also after reload | 1fe6cae |
| 10 | Failed/pending/disconnected never shown as success | PASS | P, 7/7: awaiting, approved-not-executed, rejected mutation, expired, declined, offline (both views), offline approve; no `/api/*` in any service-worker cache | 1fe6cae |
| 11 | Reset restores deterministic state | PASS | V, 3/3: bank and chain state identical after two resets; agreements cleared | 1fe6cae |
| 12 | Journey at 1440x900, 1280x800, 390x844, 375 wide without overflow | PASS | P, 4/4 (the three journeys + static pages): scrollWidth ≤ viewport, critical details unobscured, zero console/page errors. Screenshots in `docs-verify/screenshots/` | 1fe6cae |

## Limits of this evidence

- Chromium only, emulated viewports. No physical iPhone, no Safari/WebKit, no installed-PWA run.
- Run against the Next dev server on localhost, not a production build or the hosted preview.
- Screenshots opened and inspected by eye: `phone-375x667-1-awaiting`, `phone-390x844-disconnected`, `desktop-1440x900-crypto-3-settled`, `desktop-1440x900-disconnected`. The rest are only covered by the automated overflow/obscured checks.
- Crypto journey in the browser runs at one size pair only (1440x900 + 390x844).

## Observation (not a failing check)

- `phone-390x844-disconnected.png`: when Approve is tapped while offline, the button shows a "Sending approval" spinner under the Disconnected banner. It is not rendered as success and the server stays `awaiting_approval`, so check 10 passes.

## Test corrections made during verification (no assertion removed)

- `expandAll` clicked every `aria-expanded=false` control, which opened the language-selector dialog over the phone receipt. It now skips dialog triggers (`aria-haspopup`); the transfer-id assertion is unchanged.
- Success detection is sentence-aware so "Nothing is paid until you approve" is not counted as a success claim.
