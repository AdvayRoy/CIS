# CounterSign acceptance results (worker E, independent verification)

Last updated: 2026-11-21 08:30 UTC. `main` tested: `dd3801b` (base commit, stubs only).

No run against an implementation yet: at `dd3801b` every port is a `NOT_IMPLEMENTED` stub, so all checks are NOT RUN.

| # | Check | Result | Evidence | main SHA |
|---|---|---|---|---|
| 1 | Approved legitimate bank transfer settles once | NOT RUN | stubs only | dd3801b |
| 2 | Recipient/amount mutations move no money | NOT RUN | stubs only | dd3801b |
| 3 | Expired authorization rejected | NOT RUN | stubs only | dd3801b |
| 4 | Replay/concurrent → one debit | NOT RUN | stubs only | dd3801b |
| 5 | Merchant/lab capability cannot approve | NOT RUN | stubs only | dd3801b |
| 6 | Protected crypto purchase completes for agreed amount | NOT RUN | stubs only | dd3801b |
| 7 | Residual allowance 0; later drain fails | NOT RUN | stubs only | dd3801b |
| 8 | Vulnerable comparison: same attack succeeds | NOT RUN | stubs only | dd3801b |
| 9 | Phone/desktop agree with receipts and balances | NOT RUN | placeholder pages | dd3801b |
| 10 | Failed/pending/disconnected never shown as success | NOT RUN | placeholder pages | dd3801b |
| 11 | Reset restores deterministic state | NOT RUN | stubs only | dd3801b |
| 12 | Journey at 1440x900, 1280x800, 390x844, 375 wide without overflow | NOT RUN | placeholder pages | dd3801b |
