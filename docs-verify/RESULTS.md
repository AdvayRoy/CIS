# CounterSign acceptance results (worker E, independent verification)

**Lead re-run on integrated `main` `1fe6cae`, 2026-11-21 08:53 UTC, production build (`pnpm demo`): V 37 passed / 0 failed; P 16 passed / 0 failed (the 12 below plus 4 localization flows in `e2e/i18n.e2e.ts`); `pnpm test` 235 passed, 52 skipped (absent `lab` dictionaries); `forge test` 21 passed. (Paragraph added by the lead, not by worker E.)**

Last updated: 2026-11-21 09:40 UTC. `main` tested: `4d81075` (merged into `w/verify`; earlier runs on 316138b, 1fe6cae, f352aff and 9f86af6 had the same 12 PASS).

Server: `pnpm demo` via `bash docs-verify/run.sh` (`next build` + `next start` on :3000, Anvil on :8545, health `chain.available=true, chainId=31337`).

Commands:

- V = `ACCEPTANCE=1 CS_BASE_URL=http://localhost:3000 pnpm exec vitest run tests/acceptance` → 37 passed, 0 failed, 0 skipped
- P = `BASE_URL=http://localhost:3000 pnpm exec playwright test` → 17 passed (1.5m): 12 from this suite + 5 from `e2e/i18n.e2e.ts` and `e2e/shop.e2e.ts` (not worker E, not mapped to a check)
- `pnpm typecheck` → clean

| # | Check | Result | Evidence | main SHA |
|---|---|---|---|---|
| 1 | Approved legitimate bank transfer settles once | PASS | V, 4/4: ledger receipt persisted, customer 100000→90000, merchant +10000, executionCount 1 | 4d81075 |
| 2 | Recipient/amount mutations move no money | PASS | V, 9/9: recipient, amount, operation, continuing-permission mutations rejected with field diffs; balances unchanged; no receipt | 4d81075 |
| 3 | Expired authorization rejected | PASS | V, 2/2: ttlSeconds 5 waited out, approved and unapproved; no debit | 4d81075 |
| 4 | Replay/concurrent → one debit | PASS | V, 3/3: 20 concurrent executes and replay after settlement → one ledger transfer, balance 90000 | 4d81075 |
| 5 | Merchant/lab capability cannot approve | PASS | V, 8/8 (merchant/operator/anonymous cookies, body/query/header role claims, forged cookies, forged/absent/tampered/cross-agreement pairing tokens); P, 1/1 (phone without token, forged token, merchant cookies) | 4d81075 |
| 6 | Protected crypto purchase completes for agreed amount | PASS | V, 3/3: viem-read customer balance 900 CSUSD, shop +100, on-chain tx receipt status success | 4d81075 |
| 7 | Residual allowance 0; later drain fails | PASS | V, 1/1: viem-read allowance 0; drain executed and reverted; balance still 900 | 4d81075 |
| 8 | Vulnerable comparison: same attack succeeds | PASS | V, 1/1: vulnerable account left with standing allowance; drain succeeds, balance read from EVM drops | 4d81075 |
| 9 | Phone/desktop agree with receipts and balances | PASS | P, 3/3 (bank at 1440x900+390x844 and 1280x800+375x667, crypto at 1440x900+390x844): both views show the persisted ledger transfer id / tx hash and balances from `/api/state`, also after reload | 4d81075 |
| 10 | Failed/pending/disconnected never shown as success | PASS | P, 7/7: awaiting, approved-not-executed, rejected mutation, expired, declined, offline (both views), offline approve; no `/api/*` in any service-worker cache | 4d81075 |
| 11 | Reset restores deterministic state | PASS | V, 3/3: bank and chain state identical after two resets; agreements cleared | 4d81075 |
| 12 | Journey at 1440x900, 1280x800, 390x844, 375 wide without overflow | PASS | P, 4/4 (the three journeys + static pages): scrollWidth ≤ viewport, critical details unobscured, zero console/page errors. Screenshots in `docs-verify/screenshots/` | 4d81075 |

## Limits of this evidence

- Chromium only, emulated viewports. No physical iPhone, no Safari/WebKit, no installed-PWA run.
- Run against the production build on localhost, not the hosted preview.
- Screenshots opened and inspected by eye: `phone-375x667-1-awaiting`, `phone-390x844-disconnected`, `desktop-1440x900-crypto-3-settled`, `desktop-1440x900-disconnected`. The rest are only covered by the automated overflow/obscured checks.
- Crypto journey in the browser runs at one size pair only (1440x900 + 390x844).

## Observation (not a failing check)

- `phone-390x844-disconnected.png`: when Approve is tapped while offline, the button shows a "Sending approval" spinner under the Disconnected banner. It is not rendered as success and the server stays `awaiting_approval`, so check 10 passes.

## Test corrections made during verification (no assertion removed)

- `expandAll` clicked every `aria-expanded=false` control, which opened the language-selector dialog over the phone receipt. It now skips dialog triggers (`aria-haspopup`); the transfer-id assertion is unchanged.
- Success detection is sentence-aware so "Nothing is paid until you approve" is not counted as a success claim.

## Change to these tests made by the lead (9f86af6)

- The phone Approve control became press-and-hold, so five `approveBtn.click()` calls in `e2e/journey.e2e.ts` and `e2e/truthful-states.e2e.ts` became `click({ delay: 900 })`, then `delay: 1100` at 4d81075. No assertion changed. Consequence: a plain tap on "Approve this payment" no longer approves; worker E has no test for what a plain tap shows.

## Visual observation at 9f86af6 (not caught by the automated checks)

- `phone-375x667-1-awaiting.png`: the sticky action footer is now translucent, and the card text scrolling beneath it ("One-use limit ...") shows through the Decline button. The Approve label stays readable; Decline's label competes with the text behind it. Seen by eye in the screenshot; the overflow/obscured assertions still pass because the buttons themselves are on top.
