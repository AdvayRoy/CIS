# CounterSign: business brief

Status: a working hypothesis written during the build. Nothing here has been validated with customers, banks or regulators; every number that would matter (prices, volumes, loss rates) is deliberately left out rather than invented.

## The product in one sentence

Infrastructure that makes a payment rail execute exactly what the payer approved (this recipient, this amount, once) and refuse everything else, with evidence either way.

## Who it is for

| Role | Who | What they get |
|---|---|---|
| Buyer | Banks, payment service providers, wallet and exchange teams | Fewer disputed and unauthorized-change payments; an evidence record per payment |
| User | Their retail and small-business customers | One clear approval screen in their own language; no standing permissions left behind |
| Beneficiary | Honest merchants | A payment that cannot later be disputed as "not what I agreed to" |

The payer does not pay. This is sold to the institution that carries the loss or the support cost.

## Wedge

Start where the gap between "what I approved" and "what executed" is already a known, named loss:

1. **Crypto token approvals.** Unlimited allowances that are drained later are a documented pattern, and the fix (exact approval, removed in the same transaction) is enforceable on-chain today, as the demo shows. Wallets and exchanges can adopt it without a regulator in the loop.
2. **Bank payment initiation** (open-banking style pay-by-bank, merchant-initiated transfers). Slower to sell, larger if it lands. Needs a bank or licensed provider as the partner.

Dubai is a reasonable first market: a multilingual customer base (the 14 languages in the product), active virtual-asset regulation, and banks competing on digital experience. That is an assumption about fit, not evidence of demand.

## How it could make money (options, not decisions)

| Model | Fits | Risk |
|---|---|---|
| Per protected payment fee | Payment providers with volume | Hard to price before loss data exists |
| Platform licence per institution | Banks | Long sales cycle |
| Free open contract + paid hosted approval and evidence service | Wallets, exchanges | Contract is easy to copy; value must be in the service |

## What must be true for adoption

- The approval must be signed by a key the customer holds (device key or passkey). The demo uses a disclosed server-side signer; that is the largest gap to a real product.
- The rail must enforce, not just display. On-chain this is a contract; in a bank it is a change to the payment-execution path, which only the bank can make.
- Loss data: a partner has to share how much they lose to changed-recipient, changed-amount and repeated execution today. Without it there is no price.
- Audit and regulatory review of the evidence record as a dispute artefact.

## What it does not do

It does not detect scams, verify that a merchant is honest, or recover settled funds. If a customer knowingly approves a payment to a fraudster, CounterSign executes it exactly. Selling it as fraud prevention in general would be false.

## Next three steps

1. Five conversations with wallet/exchange product teams about allowance-drain losses and support cost.
2. Replace the demo signer with passkey (WebAuthn) signing on the phone.
3. Independent review of the contract and of the translations by native speakers.
