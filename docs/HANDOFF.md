# HANDOFF

- Mission: CounterSign 150-minute build. Start 2026-11-21 12:09 GST, deadline 14:39 GST.
- Lead session: https://app.devin.ai/sessions/909e810d5e37432aab983f9f7d41b830
- Contract: docs/CONTRACT.md (frozen at base commit).
- Status (08:55 UTC, T+46): all six worker branches merged into `main`; acceptance green at `cebeaf0` (see docs/EVIDENCE.md). No PR; work is on `main` because the repository started empty.
- Run: `pnpm install`, Foundry installed, `pnpm demo` (production build, Anvil on 127.0.0.1:8545, app on :3000). `pnpm demo:reset` or the Reset button in `/lab`.
- Environment variable names: see docs/CONTRACT.md (`CS_SESSION_SECRET`, `CS_*_KEY`, `CS_SIGNER_PRIVATE_KEY`, `CS_EXECUTOR_PRIVATE_KEY`, `CS_DB_PATH`, `ANVIL_RPC_URL`, `CS_CHAIN_DEPLOYMENT`). Local defaults are demo values; nothing secret is committed.
- Preview: Devin session preview only (sign-in required, alive while the lead session is awake). No public URL; a phone on another network cannot reach it without a tunnel.
- Demo: docs/DEMO_SCRIPT.md. Business brief: docs/BUSINESS.md. Approve on the phone is press-and-hold (650 ms); Enter/Space also confirms. Evidence: docs/EVIDENCE.md, docs-verify/RESULTS.md, tests/i18n/STATUS.md.
- Next action: owner decides on a public tunnel for a physical iPhone; record the demo; native-speaker review of translations.

## Workers (Devin sessions, branches)
- A Desktop `w/desktop`: https://app.devin.ai/sessions/d4ace7385e4d45538393d129c582b910
- B Mobile `w/mobile`: https://app.devin.ai/sessions/29c981bfa0a34a85a46e4a537e43badf
- C Bank/auth `w/bank`: https://app.devin.ai/sessions/3b1821fe1e0b4686afd193eedc84b761
- D Crypto `w/crypto`: https://app.devin.ai/sessions/8f00f1e7b82f42039ef135ec4fc3696f
- E Verification `w/verify`: https://app.devin.ai/sessions/fb452151a01f4a91baf5f7339886b47b
- F Localization `w/i18n`: https://app.devin.ai/sessions/4d6dcee69f264fe381831214c47d4534

## To resume from Git
Clone, `pnpm install`, install Foundry, `pnpm demo`. Merge any unmerged `w/*` branches into `main` (lead only). Checks: `pnpm typecheck`, `pnpm build`, `pnpm test`, `cd contracts && forge test`.
