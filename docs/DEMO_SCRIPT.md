# Five-minute demo script

Setup (before the audience): `pnpm demo`, then open `/command` in one window, `/lab` in a second (sign in with `demo-operator`, which also grants the merchant fixture), and keep a phone or a 390 px wide window ready. Press **Reset demonstration** in `/lab`.

**0:00 The problem (30 s).** "You agree to pay 100 once. What actually executes can differ: another recipient, another amount, a standing permission, or twice. CounterSign makes the infrastructure enforce exactly what you approved." Say what it is not: no scam detection, no real bank.

**0:30 Bank: approve (60 s).** `/lab`: **Propose 100.00 AED transfer** (to `ACC-MERCHANT-001`). `/command`: sign in as customer, select it, **Pair phone**, open the QR/link on the phone. Read the card aloud: recipient identifier, amount, one use, expiry. Approve. Desktop turns Approved within a second.

**1:30 Bank: attack (60 s).** `/lab`: **Substitute recipient**. Desktop and phone show Stopped, the differing field highlighted, balance still 1,000.00. **Inflate amount ×5**: stopped again. Point at the evidence inspector: approved vs attempted, no receipt.

**2:30 Bank: honest execution and replay (45 s).** `/lab`: **Execute as approved**. Completed, ledger receipt, balance 900.00, times executed 1. **Replay** (and the concurrent burst, if shown): still one debit.

**3:15 Crypto: protected (60 s).** `/lab`: **Propose 100 CSUSD purchase**. Pair, approve on the phone, **Execute as approved**. Show transaction hash, balance 900, allowance 0, all read from the chain. **Send later drain → protected**: the transaction reverts; balance unchanged.

**4:15 Crypto: vulnerable comparison (30 s).** `/lab`: **Run vulnerable purchase**, then **Send later drain → vulnerable**. Same purchase, standing allowance, the remaining 900 leaves. Labeled intentional.

**4:45 Close (15 s).** Switch the phone to Arabic or Russian from the globe: same facts, same identifiers, no reload. "People should understand exactly what they are agreeing to." State the limits: simulation ledger, private chain, demo signer.

If the chain is unavailable the crypto panels say so; run the bank half only and say that.
