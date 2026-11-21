/**
 * FIXTURE DATA — NOT LIVE STATE.
 * Used only when /command is opened with ?fixture=1 (layout development before the backend exists).
 * The default path always renders the real /api/state. The UI shows a visible "Fixture data" banner in this mode.
 */
import type { AgreementView, ExecutionEvidence, Overview, PaymentAgreement, PaymentAttempt, TokenScenario } from "@/shared/contract";

const T = 1795249200; // fixed unix seconds
const AED = { code: "AED", decimals: 2, address: null };
const TOKEN = { code: "CSUSD", decimals: 18, address: "0x5FbDB2315678afecb367f032d93F642f64180aa3" };
const SHOP = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
const ACCOUNT = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
const SIGNER = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const SIG = "0x" + "ab12".repeat(32) + "1b";
const e18 = (n: number) => `${n}${"0".repeat(18)}`;

const bankAgreement = (n: number): PaymentAgreement => ({
  id: `00000000-0000-4000-8000-00000000000${n}`, payer: "ACC-CUSTOMER-001", recipient: "ACC-MERCHANT-001",
  recipientDisplayName: "Harbour Books", rail: "bank", asset: AED, amount: "10000", operation: "bank.transfer",
  itemId: null, expiry: T + 600, nonce: `${7000 + n}`, domain: null, createdAt: T,
});
const cryptoAgreement = (n: number): PaymentAgreement => ({
  id: `00000000-0000-4000-8000-00000000000${n}`, payer: ACCOUNT, recipient: SHOP,
  recipientDisplayName: "Token Shop", rail: "crypto", asset: TOKEN, amount: e18(100), operation: "crypto.purchase",
  itemId: "1", expiry: T + 600, nonce: `${7000 + n}`, domain: { chainId: 31337, verifyingContract: ACCOUNT }, createdAt: T,
});
const attempt = (a: PaymentAgreement, over: Partial<PaymentAttempt> = {}): PaymentAttempt => ({
  agreementId: a.id, recipient: a.recipient, amount: a.amount, operation: a.operation, continuingAllowance: "0", ...over,
});
const approval = { signer: SIGNER, signature: SIG, approvedAt: (T + 20) * 1000 };
const ev = (a: PaymentAgreement, seq: number, type: AgreementView["events"][number]["type"], reason: AgreementView["events"][number]["reason"] = null) =>
  ({ seq, agreementId: a.id, type, at: (T + seq * 5) * 1000, reason });

const a1 = bankAgreement(1);
const a1ok: ExecutionEvidence = {
  agreement: a1, attempt: attempt(a1), decision: { accepted: true, reason: "OK", diffs: [], decidedAt: (T + 30) * 1000 },
  receipt: { kind: "ledger", transferId: "TRF-000001", debitAccount: a1.payer, creditAccount: a1.recipient, amount: "10000", postedAt: (T + 30) * 1000 },
  observed: { payerBalance: "90000", recipientBalance: "10000", allowance: null, executionCount: 1, observedAt: (T + 30) * 1000 },
};
const a1replay: ExecutionEvidence = {
  agreement: a1, attempt: attempt(a1), decision: { accepted: false, reason: "REPLAYED", diffs: [], decidedAt: (T + 40) * 1000 },
  receipt: null, observed: { payerBalance: "90000", recipientBalance: "10000", allowance: null, executionCount: 1, observedAt: (T + 40) * 1000 },
};
const a2 = bankAgreement(2);
const a2bad: ExecutionEvidence = {
  agreement: a2, attempt: attempt(a2, { recipient: "ACC-UNKNOWN-777", amount: "95000" }),
  decision: { accepted: false, reason: "RECIPIENT_MISMATCH", decidedAt: (T + 50) * 1000, diffs: [
    { field: "recipient", approved: "ACC-MERCHANT-001", attempted: "ACC-UNKNOWN-777" },
    { field: "amount", approved: "10000", attempted: "95000" } ] },
  receipt: null, observed: { payerBalance: "90000", recipientBalance: "10000", allowance: null, executionCount: 0, observedAt: (T + 50) * 1000 },
};
const a3 = cryptoAgreement(3);
const a3ok: ExecutionEvidence = {
  agreement: a3, attempt: attempt(a3), decision: { accepted: true, reason: "OK", diffs: [], decidedAt: (T + 60) * 1000 },
  receipt: { kind: "chain", chainId: 31337, txHash: "0x" + "c3".repeat(32), blockNumber: "12", status: "success", revertReason: null },
  observed: { payerBalance: e18(900), recipientBalance: e18(100), allowance: "0", executionCount: 1, observedAt: (T + 60) * 1000 },
};
const a4 = cryptoAgreement(4);

const scenario = (label: TokenScenario["label"]): TokenScenario => label === "protected"
  ? { label, customer: ACCOUNT, shop: SHOP, customerBalance: e18(900), shopBalance: e18(100), attackerBalance: "0", allowance: "0",
      purchased: true, lastPurchaseTx: "0x" + "c3".repeat(32),
      drainAttempt: { txHash: null, succeeded: false, revertReason: "ERC20InsufficientAllowance", amountRequested: e18(900) } }
  : { label, customer: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", shop: SHOP, customerBalance: "0", shopBalance: e18(100), attackerBalance: e18(900),
      allowance: "115792089237316195423570985008687907853269984665640564039457584007913129639935".slice(0, 78),
      purchased: true, lastPurchaseTx: "0x" + "d4".repeat(32),
      drainAttempt: { txHash: "0x" + "e5".repeat(32), succeeded: true, revertReason: null, amountRequested: e18(900) } };

export const FIXTURE_OVERVIEW: Overview = {
  serverTime: (T + 90) * 1000,
  labels: { bank: "Bank simulation", chain: "Local-chain demo" },
  bank: { available: true, accounts: [
    { id: "ACC-CUSTOMER-001", displayName: "Customer", balance: "90000", asset: AED },
    { id: "ACC-MERCHANT-001", displayName: "Harbour Books", balance: "10000", asset: AED },
    { id: "ACC-UNKNOWN-777", displayName: "Unknown account", balance: "0", asset: AED } ] },
  chain: { available: true, chainId: 31337, blockNumber: "14", token: TOKEN, protected: scenario("protected"), vulnerable: scenario("vulnerable") },
  agreements: [
    { agreement: a4, state: "awaiting_approval", approval: null, events: [ev(a4, 1, "agreement.created")], evidence: [], executionCount: 0 },
    { agreement: a3, state: "settled", approval, evidence: [a3ok], executionCount: 1,
      events: [ev(a3, 1, "agreement.created"), ev(a3, 2, "pairing.issued"), ev(a3, 3, "agreement.approved"), ev(a3, 4, "attempt.received"), ev(a3, 5, "execution.settled", "OK")] },
    { agreement: a2, state: "rejected", approval, evidence: [a2bad], executionCount: 0,
      events: [ev(a2, 1, "agreement.created"), ev(a2, 3, "agreement.approved"), ev(a2, 4, "attempt.received"), ev(a2, 5, "attempt.rejected", "RECIPIENT_MISMATCH")] },
    { agreement: a1, state: "settled", approval, evidence: [a1ok, a1replay], executionCount: 1,
      events: [ev(a1, 1, "agreement.created"), ev(a1, 3, "agreement.approved"), ev(a1, 4, "attempt.received"), ev(a1, 5, "execution.settled", "OK"),
        ev(a1, 6, "attempt.received"), ev(a1, 7, "attempt.rejected", "REPLAYED")] },
  ],
};
