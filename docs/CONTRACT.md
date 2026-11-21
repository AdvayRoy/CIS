# CounterSign — frozen contract (base commit)

Deadline: 2026-11-21 14:39 GST (T0 = 12:09). Only the lead edits shared files; propose changes by message, never by rewriting.

## Shared, lead-owned (do NOT edit in worker branches)
`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `next.config.ts`, `tsconfig.json`, `src/shared/**`, `src/app/api/**`,
`src/server/http.ts`, `src/lib/**`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`, `src/app/lab/**`, `docs/**`, `README.md`.
Need a dependency? Use what is installed (zod, viem, better-sqlite3, motion, lucide-react, geist, clsx, tailwind-merge, cva,
@radix-ui/react-{slot,dialog,collapsible}, qrcode.react, next-intl, vitest, @playwright/test, tsx). If truly blocked, say so in your final report.

## Ownership
| Worker | Branch | Files |
|---|---|---|
| A Desktop | `w/desktop` | `src/app/command/**`, `src/components/desktop/**`, `messages/en/desktop.json` |
| B Mobile | `w/mobile` | `src/app/approve/**`, `src/components/mobile/**`, `public/manifest.webmanifest`, `public/icons/**`, `messages/en/mobile.json` |
| C Bank/auth | `w/bank` | `src/server/auth/**`, `src/server/bank/**`, `src/server/db/**`, `tests/bank/**` |
| D Crypto | `w/crypto` | `contracts/**`, `src/server/chain/**`, `scripts/chain/**`, `tests/chain/**` |
| E Verification | `w/verify` | `e2e/**`, `tests/acceptance/**`, `playwright.config.ts`, `docs-verify/**` |
| F Localization | `w/i18n` | `src/i18n/**`, `src/components/i18n/**`, `messages/**` except `messages/en/{desktop,mobile,lab}.json`, `tests/i18n/**` |

## Types
`src/shared/contract.ts` (zod schemas: PaymentAgreement, PaymentAttempt, Decision, ExecutionEvidence, AgreementView, Overview, states, reasons),
`src/shared/typedData.ts` (EIP-712 binding), `src/shared/ports.ts` (AuthPort, BankPort, ChainPort). Amounts are integer base units as decimal strings.

## HTTP API (all JSON, `cache-control: no-store`; errors `{error:{code,message}}`)
| Method + path | Capability | Body → Result |
|---|---|---|
| GET `/api/health` | none | `{ok, serverTime, chain}` |
| GET `/api/session` | none | `{caps:{customer,merchant,operator}}` |
| POST `/api/session` | role key | `{role,key}` → sets signed HttpOnly cookie |
| GET `/api/state` | none | `Overview` (bank accounts, chain scenarios, all agreements) |
| POST `/api/agreements` | merchant | `AgreementDraft` → `AgreementView` (201). Returns no approval capability. |
| GET `/api/agreements/:id` | none | `AgreementView` |
| POST `/api/agreements/:id/pairing` | customer | → `{token, expiresAt, approvePath}` (`/approve/:id#t=TOKEN`) |
| GET `/api/agreements/:id/pairing/check` | header `x-cs-pairing` | `{valid}` |
| POST `/api/agreements/:id/approve` | header `x-cs-pairing` | → `AgreementView` (signed) |
| POST `/api/agreements/:id/decline` | header `x-cs-pairing` | → `AgreementView` |
| POST `/api/agreements/:id/execute` | merchant | `PaymentAttempt` (sans agreementId) → `{decision,evidence,state,view}`; 200 accepted, 409 rejected |
| POST `/api/lab/reset` | operator | → `{ok, chainReset}` |
| POST `/api/lab/vulnerable-purchase` | operator | → `TokenScenario` (intentionally vulnerable comparison) |
| POST `/api/lab/drain` | operator | `{which:"protected"|"vulnerable"}` → `TokenScenario` |

UI code uses `src/lib/api.ts` (`api.*`) and `src/lib/usePoll.ts` (1 s polling, `connected` flag). Never cache these in a service worker.

## Trust boundary
- Capabilities come only from signed HttpOnly cookies (`cs_customer`, `cs_merchant`, `cs_operator`) issued by `POST /api/session` against env role keys. Disclosed demo sign-in, not real authentication.
- Approval needs a pairing token minted with the customer capability, bound to one agreement, short-lived. Merchant/operator cookies can never approve.
- The demo signer key lives only in `src/server/auth`; it signs EIP-712 typed data (viem) over the immutable agreement. Bank verifies with viem; the crypto adapter verifies on-chain.
- Attempts are untrusted. Rails compare attempt vs approved facts and return field-level diffs.

## Environment variable NAMES (defaults are local-demo only)
`CS_SESSION_SECRET`, `CS_CUSTOMER_KEY`, `CS_MERCHANT_KEY`, `CS_OPERATOR_KEY`, `CS_SIGNER_PRIVATE_KEY`, `CS_EXECUTOR_PRIVATE_KEY`,
`CS_DB_PATH` (default `./data/countersign.db`), `ANVIL_RPC_URL` (default `http://127.0.0.1:8545`), `CS_CHAIN_DEPLOYMENT` (default `./data/deployment.json`).
Local-demo defaults: role keys `demo-customer` / `demo-merchant` / `demo-operator`; signer = Anvil account #1, executor/deployer = Anvil account #0 (public test keys, local chain only).

## Fixed scenario values
Bank: `ACC-CUSTOMER-001` starts 1,000.00 AED (`"100000"`), `ACC-MERCHANT-001` 0, `ACC-UNKNOWN-777` 0; purchase 100.00 AED (`"10000"`).
Crypto: token `CSUSD` 18 decimals; protected smart account and vulnerable account each start 1,000 CSUSD; purchase 100 CSUSD; after protected purchase: balance 900, allowance 0, later drain reverts; vulnerable: drain succeeds.

## Design tokens
Tailwind names from `globals.css`: `bg-bg` #0B0F17, `bg-surface` #141B26, `border-line` #273142, `text-fg` #F3F5F7, `text-muted` #A8B4C5, `text-mint` #B7F5D5 (confirmed), `text-amber` #FFB46C (review), `text-coral` #EB6D76 (violation).
Geist Sans; Geist Mono only for identifiers (`.ident` class keeps them LTR). `.tabular` for amounts. Radii 12–20px, fine borders, restrained shadows, 180–300 ms motion driven only by authoritative state.

## i18n
All customer-facing strings go through `useTranslations("<namespace>")` from `next-intl` with keys in `messages/en/<namespace>.json`.
`common` holds states, decision reasons (`common.reason.<CODE>`), field labels. Backend returns codes only. Identifiers/hashes use `.ident` and are never translated.

## Acceptance checks (fixed)
1 legit bank transfer settles once · 2 recipient/amount mutation moves no money · 3 expired rejected · 4 replay/concurrent → one debit ·
5 merchant/lab capability cannot approve · 6 protected crypto purchase completes for agreed amount · 7 residual allowance 0 and later drain fails ·
8 vulnerable comparison: same attack succeeds · 9 phone/desktop agree with receipts and balances · 10 failed/pending/disconnected never shown as success ·
11 reset restores deterministic state · 12 journey works at 1440x900, 1280x800, 390x844, 375 wide without overflow.
