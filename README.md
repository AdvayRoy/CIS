# CounterSign

**One payment. Exactly as agreed.**

CounterSign protects one narrow failure: a one-time payment that grants more authority than intended, changes destination after approval, or executes more than once. The customer approves structured facts; the infrastructure enforces exactly those facts.

Hackathon prototype. It protects its supported execution paths only: one simulated bank ledger and one known token purchase on a private local chain. It does not detect scams in general, verify merchant honesty, access real banks, or recover settled funds. What is specific here: one approval is enforced the same way on a bank ledger and on-chain, and the token purchase leaves no standing allowance.

## Run

```bash
pnpm install
pnpm demo          # private Anvil + contract deploy + production build on http://localhost:3000
DEV=1 pnpm demo    # same with the dev server
pnpm demo:reset    # restore the deterministic starting state (server must be running)
```

Requires Node 20+, pnpm, and Foundry (`anvil`) for the crypto rail. Without Anvil the crypto rail is shown as unavailable; nothing is mocked in its place.

- `/` entry page with the journey and live status
- `/shop` merchant checkout fixture: start a payment (bank or token); after phone approval it submits exactly the approved terms
- `/command` desktop product (customer view)
- `/approve/[id]` phone approval (opened from the pairing QR/link on `/command`)
- `/lab` operator-only demonstration controls and checkout fixture

Local demo role keys: `demo-customer`, `demo-merchant`, `demo-operator` (override with the env names in `docs/CONTRACT.md`).

## Architecture

One Next.js + TypeScript app (one long-running Node process) with a SQLite ledger and a private Anvil companion.

| Layer | Location |
|---|---|
| Shared schemas, EIP-712 binding, ports | `src/shared/` |
| HTTP API (REST, 1 s polling, no caching) | `src/app/api/` |
| Authorization + demo signer + sessions | `src/server/auth/` |
| Bank simulation ledger (transactional SQLite) | `src/server/bank/` |
| Chain adapter (viem) | `src/server/chain/` |
| Solidity contracts + Foundry tests | `contracts/` |
| Localization (14 languages, `next-intl`) | `src/i18n/`, `messages/` |

## Trust boundary

- The customer confirms structured facts in the approval context. Approval requires a short-lived pairing token minted with the customer capability and bound to one agreement.
- The approved facts are signed as EIP-712 typed data (viem) by an isolated server-side demo signer. This is a disclosed trusted demo component, not a hardware or biometric signature.
- The merchant/lab fixture can alter an execution proposal. It cannot mint approvals, rewrite approved facts, reach the signer, or debit the ledger directly. Capabilities are enforced on the server from signed HttpOnly cookies.
- Bank: signature and terms are validated and the authorization is consumed in the same SQLite transaction as the debit/credit. A replay returns the existing receipt and no second debit.
- Crypto: a minimal smart account verifies the signature on-chain, then performs exact approve, purchase and allowance removal atomically, and checks the debit and the zero residual allowance. Balances and allowance shown are read from the EVM.
- Trusted roots: the confirmation authority (signer), the executor and the browser. Compromise of those is out of scope.
- The recipient identifier is shown as-is. A display name is never treated as verified identity.

## Known limits

See `docs/HANDOFF.md` for current status, the evidence matrix and what is simulated, unverified or deferred.

## Built with Devin

- One lead Devin session scaffolded the empty repo, froze the shared contract (`docs/CONTRACT.md`, `src/shared/contract.ts`) and owned integration.
- Six parallel Devin worker sessions built desktop, mobile, bank/auth, crypto contracts, independent verification and localization on separate branches (`w/desktop`, `w/mobile`, `w/bank`, `w/crypto`, `w/verify`, `w/i18n`), each restricted to its own directories; the lead merged them.
- Four read-only specialist sessions then reviewed the integrated build: product structure (`docs/PRODUCT.md`), design, security red team, and demo strategy. The lead implemented their findings.
- A Devin testing agent drove the UI for the recorded run. Evidence and what is unverified: `docs/EVIDENCE.md`.
