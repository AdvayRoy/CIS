// OWNER: worker B. LABELLED FIXTURE, used only when the page is opened with ?fixture=1.
// It never talks to the server and the screen shows a visible "Fixture data" banner.
import type { AgreementState, AgreementView, ExecutionEvidence, PaymentAgreement, Rail } from "@/shared/contract";
import { STATES } from "@/shared/contract";

const ID = "00000000-0000-4000-8000-000000000001";
const SHOP = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const ACCOUNT = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
const TOKEN = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

export type FixtureOptions = { state: AgreementState; rail: Rail; paired: boolean; offline: boolean; at: number };

export function parseFixtureOptions(search: string): FixtureOptions | null {
  const q = new URLSearchParams(search);
  if (q.get("fixture") !== "1") return null;
  const s = q.get("state") as AgreementState | null;
  return {
    state: s && (STATES as readonly string[]).includes(s) ? s : "awaiting_approval",
    rail: q.get("rail") === "crypto" ? "crypto" : "bank",
    paired: q.get("paired") !== "0",
    offline: q.get("offline") === "1",
    at: Date.now(),
  };
}

export function fixtureView(state: AgreementState, rail: Rail, nowMs: number): AgreementView {
  const now = Math.floor(nowMs / 1000);
  const bank = rail === "bank";
  const amount = bank ? "10000" : "100000000000000000000";
  const start = bank ? "100000" : "1000000000000000000000";
  const after = bank ? "90000" : "900000000000000000000";
  const agreement: PaymentAgreement = {
    id: ID,
    payer: bank ? "ACC-CUSTOMER-001" : ACCOUNT,
    recipient: bank ? "ACC-MERCHANT-001" : SHOP,
    recipientDisplayName: "Northwind Market",
    rail,
    asset: bank ? { code: "AED", decimals: 2, address: null } : { code: "CSUSD", decimals: 18, address: TOKEN },
    amount,
    operation: bank ? "bank.transfer" : "crypto.purchase",
    itemId: bank ? null : "1",
    expiry: state === "expired" ? now - 30 : now + 272,
    nonce: "7",
    domain: bank ? null : { chainId: 31337, verifyingContract: ACCOUNT },
    createdAt: now - 20,
  };
  const approved = !["awaiting_approval", "declined", "expired"].includes(state);
  const rejected: ExecutionEvidence = {
    agreement,
    attempt: { agreementId: ID, recipient: bank ? "ACC-UNKNOWN-777" : "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", amount, operation: agreement.operation, continuingAllowance: "0" },
    decision: {
      accepted: false, reason: "RECIPIENT_MISMATCH", decidedAt: nowMs - 4000,
      diffs: [{ field: "recipient", approved: agreement.recipient, attempted: bank ? "ACC-UNKNOWN-777" : "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" }],
    },
    receipt: null,
    observed: { payerBalance: start, recipientBalance: "0", allowance: bank ? null : "0", executionCount: 0, observedAt: nowMs - 4000 },
  };
  const settled: ExecutionEvidence = {
    agreement,
    attempt: { agreementId: ID, recipient: agreement.recipient, amount, operation: agreement.operation, continuingAllowance: "0" },
    decision: { accepted: true, reason: "OK", diffs: [], decidedAt: nowMs - 2000 },
    receipt: bank
      ? { kind: "ledger", transferId: "TRF-FIXTURE-0001", debitAccount: agreement.payer, creditAccount: agreement.recipient, amount, postedAt: nowMs - 2000 }
      : { kind: "chain", chainId: 31337, txHash: "0x" + "ab".repeat(32), blockNumber: "12", status: "success", revertReason: null },
    observed: { payerBalance: after, recipientBalance: amount, allowance: bank ? null : "0", executionCount: 1, observedAt: nowMs - 2000 },
  };
  const failed: ExecutionEvidence = {
    ...settled,
    decision: { accepted: false, reason: "EXECUTION_REVERTED", diffs: [], decidedAt: nowMs - 2000 },
    receipt: bank ? null : { kind: "chain", chainId: 31337, txHash: "0x" + "cd".repeat(32), blockNumber: "12", status: "reverted", revertReason: "fixture revert" },
    observed: { payerBalance: start, recipientBalance: "0", allowance: bank ? null : "0", executionCount: 0, observedAt: nowMs - 2000 },
  };
  const evidence = state === "rejected" ? [rejected] : state === "settled" ? [rejected, settled] : state === "failed" ? [failed] : [];
  return {
    agreement,
    state,
    approval: approved ? { signer: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", signature: "0x" + "12".repeat(65), approvedAt: nowMs - 9000 } : null,
    events: [],
    evidence,
    executionCount: state === "settled" ? 1 : 0,
  };
}
