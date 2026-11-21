# CounterSign: product structure

Written against `main` at `9f86af6` on 2026-11-21. `/shop` and the assets strip on `/command` are being built by the lead in parallel and were not on `main` when this was written; they are treated here as planned. Nothing in this document changes the payment security model or any API. No metric, market size or user research is cited because none exists.

## 1. Primary user and the one job

**Primary user: the payer.** A retail or small-business customer of a bank, wallet or exchange who is about to make one payment to a recipient they chose.

**The job:** "When I approve one payment, make the rail execute exactly that (this recipient, this amount, once) and show me that anything else was stopped."

The payer is the user, not the buyer (`docs/BUSINESS.md`: the institution pays). That has a direct structural consequence: every screen belongs to one of three audiences, and today they are mixed on the same pages.

## 2. Users, roles and where each one lives

Roles in the code are capabilities from signed cookies (`cs_customer`, `cs_merchant`, `cs_operator`) plus a pairing token for the phone. This is the mapping the UI should follow.

| Person | Capability in code | Can do (API) | Screen today | Screen it should be |
|---|---|---|---|---|
| Payer, at a desk | `cs_customer` | `POST /api/agreements/:id/pairing` | `/command` | Payments (`/command`) |
| Payer, on the phone | pairing token in `#t=` | `approve`, `decline` | `/approve/[id]` | Approve (`/approve/[id]`) |
| Merchant | `cs_merchant` | `POST /api/agreements`, `execute` | `/lab` section 1 and the green button in section 2 | Checkout (`/shop`) |
| Attacker (a merchant or integration that changed the request) | `cs_merchant` | `execute` with altered fields | `/lab` section 2 | Lab (`/lab`) |
| Demo operator | `cs_operator` | `lab/reset`, `lab/vulnerable-purchase`, `lab/drain` | `/lab` sections 3 and Reset | Lab (`/lab`) |
| Institution staff (support, disputes, risk): the buyer's people | none yet | read `evidence` on `GET /api/agreements/:id` | Evidence inspector inside `/command` | Evidence, opened from a payment; a separate console later |

Two points that follow from the table:

- The merchant has no screen of its own today. Its two legitimate actions (ask for a payment, execute it as approved) sit inside the operator's attack console. `/shop` fixes this.
- The evidence inspector (EIP-712 signature, signer address, block number) is written for institution staff but is open by default in the payer's view. It should be one click away from the payer, not in front of them.

## 3. End-to-end journey (target)

| # | Who | Step | Screen | State shown |
|---|---|---|---|---|
| 1 | Anyone | Lands, reads what CounterSign does in one line, picks "Start a payment" | `/` | none |
| 2 | Merchant side | Chooses the item and rail, presses Pay; a payment request is created | `/shop` | Awaiting your approval |
| 3 | Payer | Sees the request with a QR code; scans it | `/shop` (or `/command`) | Awaiting your approval |
| 4 | Payer | Reads recipient identifier, exact amount, one use, expiry; presses and holds to approve | `/approve/[id]` | Approved |
| 5 | Merchant side | Executes exactly what was approved (automatic in `/shop`) | `/shop` | Executing, then Completed |
| 6 | Payer | Receipt on phone and desktop: paid once, balance moved by exactly the amount, no permission left | `/approve/[id]`, `/shop` | Completed |
| 7 | Payer | Opens the payment in history; sees agreed vs requested vs executed | `/command` | Completed |
| 8 | Operator | Changes the recipient, the amount, asks for a standing allowance, or replays | `/lab` | Stopped |
| 9 | Payer | Sees the stopped attempt, the differing field and an unchanged balance | `/command`, `/approve/[id]` | Stopped |
| 10 | Operator | Runs the same purchase on the unprotected account and drains it | `/lab` | comparison only |

Steps 1 to 7 are the product. Steps 8 to 10 are the proof. The current demo script reaches the first honest payment at 2:30, after two attacks; the product should be understood before it is attacked (see section 8).

## 4. Screen map

### Routes

| Route | Today | Purpose | Nav label | Verdict |
|---|---|---|---|---|
| `/` | `redirect("/command")` | Entry: one-line promise, the three steps, doors into Shop, Payments and Lab, stated limits | Home (logo) | Build (done on this branch, see section 9) |
| `/shop` | planned by lead | Merchant checkout: start a payment, show QR, auto-execute the honest payment, receipt | Checkout | Keep; becomes the start of the journey |
| `/command` | Customer desktop: list, hero, pairing, path, evidence, token panels, bank panels | The payer's payment history and detail | Payments | Keep route for the demo and `e2e/**`; relabel; rename to `/payments` after the deadline |
| `/approve/[id]` | Phone approval and receipt | The approval itself. This is the core surface of the product | Approve | Keep as is |
| `/lab` | Propose, attack, compare, reset, log | Operator-only attack and comparison controls | Lab | Keep; narrow to attacks, comparison, reset once `/shop` proposes and executes |

### Navigation

Today the only links are: `/` to `/command` (redirect), the flask icon and empty-state button on `/command` to `/lab`, and "Open customer view" on `/lab` to `/command`. The rail icons on `/command` scroll to anchors (`#payment`, `#chain`, `#bank`); they are not navigation between screens. Nothing links to `/`.

Target, exchange-style top navigation shared by `/`, `/shop`, `/command`:

`CounterSign` (to `/`) · **Checkout** (`/shop`) · **Payments** (`/command`) · **Assets** (anchor on `/command` until it earns a route) · language · connection status · **Lab** (right-aligned, visually separate, marked operator).

`/approve/[id]` gets no global navigation. A payer holding a phone with one payment on it should have exactly two exits: approve or decline.

### Inside `/command` (sections, in order)

| Section today | Keep / change |
|---|---|
| Agreement list ("Agreements") | Rename "Payments". Same list |
| Hero (amount, recipient, state pill) | Keep |
| PairPhone ("Approve on your phone", button "Pair phone") | Show the QR immediately for a signed-in payer; the extra click adds nothing |
| TransactionPath (Approved, Attempted, Executed) | Keep; align stage names with the phone (section 6) |
| Evidence inspector (open by default, 340 px) | Closed by default; open automatically when a payment is Stopped or Completed |
| ChainPanel "Token purchase, before and after" incl. "Vulnerable comparison" | Split: the payer's own balance and allowance go to Assets; the vulnerable comparison moves to `/lab` |
| BankPanel "Bank accounts" (customer, merchant and `ACC-UNKNOWN-777`) | Assets shows the payer's account; other parties' balances belong in `/lab` or in Evidence |

## 5. Top 5 structure problems, by demo impact

**1. There is no front door, and the first screen sends the payer to the operator console.**
`src/app/page.tsx` redirects to `/command`, which opens empty with "No payment to show" and a primary button "Open demo lab" (`desktop.empty.action`). A judge who opens the URL sees an empty dashboard and is told to go to a page headed "Operator only".
Fix: `/` becomes a real entry (promise, three steps, three doors). The `/command` empty state should say "Start a payment" and link to `/shop`; `list.empty` should stop mentioning the demo lab.

**2. The honest payment can only be completed from the attack console.**
"Execute as approved" lives in `/lab` section 2 beside "Substitute recipient" and "Inflate amount ×5", and "Propose 100.00 AED transfer" is in `/lab` section 1. So the happy path is operated from a page labelled demonstration controls, and the phone sits on "The payment has not been executed yet" until someone switches windows.
Fix: `/shop` owns propose and honest execute (the lead's work). Then remove the propose buttons from the main `/lab` flow (keep "Propose transfer expiring in 10 s" as the one lab-only fixture) and renumber `/lab` as 1 Attack, 2 Compare, 3 Reset.

**3. Three typed sign-ins and one unnecessary click sit between "pay" and "approve".**
`/command` asks for a customer key in the header (`signIn.label`: "Demo sign-in · customer key"), `/lab` asks for an operator key and a merchant key, and after signing in the payer must still press "Pair phone" before any QR exists. On stage that is four inputs before the phone is used.
Fix: choose the role once at the entry (`/` offers the doors; each destination keeps its own disclosed demo sign-in, pre-filled as `/command` already does). On `/command` and `/shop`, request the pairing link as soon as a payment is awaiting approval and the customer capability is present, and show the QR without a click. The pairing API and token rules stay exactly as they are.

**4. One thing has four names.**
The desktop list calls it an "Agreement" (`list.title`), the nav and the phone call it a "Payment", the page is titled "Command", the lab prints the raw state (`state: rejected`) while the customer sees "Stopped". Stage names differ too: desktop "Approved / Attempted / Executed", phone "Approval / Attempt / ...". A viewer cannot tell that the phone and the desktop show the same object.
Fix: the user-facing noun is "payment" everywhere; "agreement" stays in code and API only. One set of stage names and one set of state labels (section 6), used on desktop, phone and lab.

**5. The payer's screen carries operator and institution content.**
`/command` shows a "Vulnerable comparison" account, a third party's bank balance (`ACC-UNKNOWN-777`), an always-open inspector with signature bytes, and a flask icon to the operator lab in the main rail. It reads as a test harness rather than as a customer's payment screen.
Fix: payer view shows my payment, my approval, my balance, my receipt. Evidence is a drill-down. The comparison and other parties' balances move to `/lab`. The lab link stays, right-aligned and labelled "Lab (operator)".

Smaller, cheap and specific:

- `mobile.notFound.body` says "Ask the merchant for a new approval link". The link is minted with the customer capability on the payer's own desktop, never by the merchant. Change to "Open the payment on your computer and create a new approval link."
- In `/lab` the "Replay" button calls the same request as "Execute as approved" but is styled as an attack. Label it "Execute again (replay)" so the log line is honest about what was sent.
- After approval the phone has no next step. Once `/shop` executes automatically this resolves itself; until then the Approved status should say who acts next: "Waiting for the merchant to execute."
- `/lab` has no link to `/` and no link to `/shop`.

## 6. Naming and branding

**Name.** "CounterSign", one word, capital C and S, in every visible place. Never "Countersign", "Counter Sign" or "CS" in the interface (`cs_` stays in code). The lab is "CounterSign Lab".

**Tagline.** "One payment. Exactly as agreed." Keep it; it is the claim the product can prove. Supporting line, used directly under it: "This recipient. This amount. Once." Those three facts are also the three things the phone shows and the three things the rail checks, so the same triplet should appear on the entry page, on the approval card and in the receipt.

**Section labels.**

| Today | Use |
|---|---|
| "Command" (page title), `/command` | Payments |
| "Agreements" (list) | Payments |
| "Pair phone" / "Approve on your phone" | Approve on your phone (one label; "pairing" is implementation) |
| "Evidence" | Evidence (keep) |
| "Token purchase, before and after" / "Bank accounts" | Assets |
| "Demo lab (operator)" / "CounterSign Lab" | Lab (operator) |
| "Demo sign-in · customer key" | Demo sign-in (keep the word "demo"; it is a disclosed stand-in) |

**Stage names** (desktop path, phone path, lab log): **Agreed → Requested → Executed**. "Agreed" matches the tagline; "Requested" is neutral about whether the request was honest, which "Attempted" is not.

**State labels** (codes unchanged, labels from `messages/en/common.json`):

| Code | Today | Use | Colour token |
|---|---|---|---|
| `awaiting_approval` | Awaiting your approval | Awaiting your approval | amber |
| `approved` | Approved | Approved, not yet paid | amber |
| `executing` | Executing | Executing | amber |
| `settled` | Completed | Paid as agreed | mint |
| `rejected` | Stopped | Stopped | coral |
| `declined` | Declined | Declined | muted |
| `expired` | Expired | Expired | muted |
| `failed` | Failed | Failed | coral |

"Approved" alone reads as success; the payment has not moved yet, so the label should say so. "Completed" says nothing about the claim; "Paid as agreed" does. "Stopped" is right: the payer-facing word for a rail rejection should describe the outcome, not the mechanism.

**Tone.** Plain statements of fact in the second person: what you approved, what was requested, what executed. Numbers and identifiers before adjectives. No fear vocabulary and none of these words: secure, safe, trusted, verified, fraud, scam, guaranteed, protected-by. "Protected" is acceptable only as the name of the account that enforces the approval, next to "Unprotected comparison". Every screen that shows money says which environment it is ("Bank simulation", "Local-chain demo"), as the code already does.

**Claims the interface must never make.** Scam detection, merchant verification, real bank access, fund recovery. The recipient display name is always shown with its "not verified" note.

## 7. Business fit of the structure

This is how the structure should follow `docs/BUSINESS.md`; it adds no new commercial claim.

- CounterSign is infrastructure sold to an institution. In a real deployment the payer never visits a CounterSign site: Checkout is the merchant's page, Payments and Assets are the bank's or wallet's app, and only Approve and Evidence are CounterSign's own surfaces. The demo should say this in one sentence so nobody assumes a consumer app is being pitched.
- The surface the buyer pays for is Evidence (the per-payment record of agreed vs requested vs executed). It deserves its own route with a shareable link per payment after the deadline; today it is only a side panel.
- The crypto rail is the stated wedge. The entry page and the demo should therefore lead with the token purchase, where the standing-allowance comparison is real and read from the chain, and present the bank ledger as the second rail and as a simulation.
- The largest gap to a real product is the server-side demo signer. The approval screen is structured so that a device key or passkey can replace it without changing any screen; that is worth saying aloud.

## 8. What to cut

From the demo flow:

- Attack before success. Reorder `docs/DEMO_SCRIPT.md`: honest crypto purchase through `/shop` first (about 60 s), then one attack per kind in `/lab`, then the unprotected comparison, then the bank rail in one sentence.
- "10 concurrent" and "Propose transfer expiring in 10 s" from the spoken script. Keep the buttons; they answer questions, they do not carry the story.
- Typing keys on stage. Sign in to all roles before the audience arrives.
- The language switch as the closing beat. Show it once on the approval card, in passing; the close should be the receipt.

From the screens:

- "Vulnerable comparison" and third-party balances on `/command` (move to `/lab`).
- The always-open inspector (closed by default).
- The "Pair phone" click.
- The word "agreement" in any user-facing string.
- The `?fixture=1` paths from anything shown to an audience.

From the pitch:

- Any sentence that could be heard as fraud or scam prevention.
- Pricing models as decisions. `docs/BUSINESS.md` lists them as options; keep it that way.

## 9. Status of these recommendations

Implemented on branch `w/product`: see the commit log of that branch and the final section of the hand-off message. Everything in sections 4 to 8 that touches `/command`, `/approve`, `/shop`, `/lab`, `messages/**` or `docs/DEMO_SCRIPT.md` is a recommendation only; those files are owned by the lead and were not edited.
