"use client";
/**
 * FIXTURE DATA — NOT REAL TRANSACTION RESULTS.
 * Hand-written views that exercise every PaymentFlow state for layout work. Nothing here was produced by the
 * server, ledger or chain. The gallery always renders a visible "Fixture data" banner. Do not mount it in product routes.
 */
import { useState } from "react";
import type { AgreementView, ExecutionEvidence, PaymentAgreement } from "@/shared/contract";
import { PaymentFlow } from "./PaymentFlow";

const T = 1795249200;
const bank: PaymentAgreement = {
  id: "00000000-0000-4000-8000-0000000000f1", payer: "ACC-CUSTOMER-001", recipient: "ACC-MERCHANT-001",
  recipientDisplayName: "Harbour Books", rail: "bank", asset: { code: "AED", decimals: 2, address: null }, amount: "10000",
  operation: "bank.transfer", itemId: null, expiry: T + 600, nonce: "7001", domain: null, createdAt: T,
};
const ACCOUNT = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
const crypto: PaymentAgreement = {
  ...bank, id: "00000000-0000-4000-8000-0000000000f2", payer: ACCOUNT, recipient: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  recipientDisplayName: "Token Shop", rail: "crypto", asset: { code: "CSUSD", decimals: 18, address: "0x5FbDB2315678afecb367f032d93F642f64180aa3" },
  amount: `100${"0".repeat(18)}`, operation: "crypto.purchase", itemId: "1", domain: { chainId: 31337, verifyingContract: ACCOUNT },
};
const approval = { signer: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", signature: "0x" + "ab".repeat(65), approvedAt: (T + 20) * 1000 };

const ok = (a: PaymentAgreement, payerBalance: string, recipientBalance: string): ExecutionEvidence => ({
  agreement: a, attempt: { agreementId: a.id, recipient: a.recipient, amount: a.amount, operation: a.operation, continuingAllowance: "0" },
  decision: { accepted: true, reason: "OK", diffs: [], decidedAt: (T + 30) * 1000 },
  receipt: a.rail === "bank"
    ? { kind: "ledger", transferId: "TRF-FIXTURE", debitAccount: a.payer, creditAccount: a.recipient, amount: a.amount, postedAt: (T + 30) * 1000 }
    : { kind: "chain", chainId: 31337, txHash: "0x" + "c3".repeat(32), blockNumber: "12", status: "success", revertReason: null },
  observed: { payerBalance, recipientBalance, allowance: a.rail === "bank" ? null : "0", executionCount: 1, observedAt: (T + 30) * 1000 },
});
const mismatch: ExecutionEvidence = {
  agreement: bank, attempt: { agreementId: bank.id, recipient: "ACC-UNKNOWN-777", amount: "95000", operation: "bank.transfer", continuingAllowance: "0" },
  decision: { accepted: false, reason: "RECIPIENT_MISMATCH", decidedAt: (T + 50) * 1000, diffs: [
    { field: "recipient", approved: "ACC-MERCHANT-001", attempted: "ACC-UNKNOWN-777" },
    { field: "amount", approved: "10000", attempted: "95000" }] },
  receipt: null, observed: { payerBalance: "100000", recipientBalance: "0", allowance: null, executionCount: 0, observedAt: (T + 50) * 1000 },
};
const replay: ExecutionEvidence = {
  ...ok(bank, "90000", "10000"), decision: { accepted: false, reason: "REPLAYED", diffs: [], decidedAt: (T + 40) * 1000 }, receipt: null,
  observed: { payerBalance: "90000", recipientBalance: "10000", allowance: null, executionCount: 1, observedAt: (T + 40) * 1000 },
};
const view = (agreement: PaymentAgreement, state: AgreementView["state"], evidence: ExecutionEvidence[] = []): AgreementView => ({
  agreement, state, approval: state === "awaiting_approval" ? null : approval, events: [], evidence,
  executionCount: evidence.at(-1)?.observed.executionCount ?? 0,
});

const bankOk = ok(bank, "90000", "10000");
const cryptoOk = ok(crypto, `900${"0".repeat(18)}`, `100${"0".repeat(18)}`);

export const PAYMENT_FLOW_FIXTURES: { key: string; label: string; view: AgreementView; evidence: ExecutionEvidence | null }[] = [
  { key: "awaiting", label: "Awaiting approval", view: view(bank, "awaiting_approval"), evidence: null },
  { key: "approved", label: "Approved", view: view(bank, "approved"), evidence: null },
  { key: "settled", label: "Settled (bank)", view: view(bank, "settled", [bankOk]), evidence: bankOk },
  { key: "settled-crypto", label: "Settled (token)", view: view(crypto, "settled", [cryptoOk]), evidence: cryptoOk },
  { key: "rejected", label: "Rejected (mismatch)", view: view(bank, "rejected", [mismatch]), evidence: mismatch },
  { key: "replay", label: "Rejected replay", view: view(bank, "settled", [bankOk, replay]), evidence: replay },
];

export function PaymentFlowFixtureGallery() {
  const [key, setKey] = useState(PAYMENT_FLOW_FIXTURES[0].key);
  const [run, setRun] = useState(0);
  const f = PAYMENT_FLOW_FIXTURES.find((x) => x.key === key) ?? PAYMENT_FLOW_FIXTURES[0];
  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-4 p-6">
      <p role="note" className="rounded-[14px] border border-amber/40 bg-amber/10 px-4 py-2 text-[13px] text-amber">
        Fixture data — not real transaction results. Nothing shown here was executed.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <div className="seg flex-wrap">
          {PAYMENT_FLOW_FIXTURES.map((x) => (
            <button key={x.key} type="button" aria-pressed={x.key === key} onClick={() => setKey(x.key)}>{x.label}</button>
          ))}
        </div>
        <button type="button" onClick={() => setRun((n) => n + 1)} className="h-9 rounded-full border border-line px-4 text-[13px] text-muted hover:text-fg">Replay</button>
      </div>
      <PaymentFlow key={`${key}:${run}`} view={f.view} evidence={f.evidence} />
    </div>
  );
}
