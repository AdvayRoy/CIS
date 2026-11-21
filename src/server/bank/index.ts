// OWNER: worker C (w/bank). Bank simulation: transactional SQLite ledger enforcing the approved agreement.
//
// `execute` runs in ONE IMMEDIATE transaction: reload the stored agreement, check the approval binding
// (typed-data hash of the stored terms vs. the signed digest + seal, see src/server/auth/index.ts), compare the
// untrusted attempt with the approved facts, check expiry/state/funds, consume the nonce (UNIQUE) and move
// money. Rejections write evidence/events but never touch balances and never consume the nonce.
import { randomUUID } from "node:crypto";
import type {
  AgreementState, Decision, ExecutionEvidence, FieldDiff, Observed, PaymentAgreement, PaymentAttempt, Reason, Receipt,
} from "../../shared/contract";
import type { AgreementView, } from "../../shared/contract";
import type { BankPort, Outcome } from "../../shared/ports";
import { authInternals } from "../auth";
import {
  PortError, addEvent, addEvidence, expireIfDue, getApprovalRow, getBalance, getDb, getRow, listAccounts, nowMs,
  resetAll, setState, updateEvidence,
} from "../db";

interface TransferRow { id: string; agreement_id: string; debit_account: string; credit_account: string; amount: string; posted_at: number }

const transferFor = (agreementId: string) =>
  getDb().prepare("SELECT * FROM ledger_transfers WHERE agreement_id = ?").get(agreementId) as TransferRow | undefined;
const receiptOf = (t: TransferRow | undefined): Receipt | null => t
  ? { kind: "ledger", transferId: t.id, debitAccount: t.debit_account, creditAccount: t.credit_account, amount: t.amount, postedAt: t.posted_at }
  : null;

/** Balances and execution count as READ from the ledger tables. */
function observe(agreement: PaymentAgreement, attemptedRecipient: string): Observed {
  const n = (getDb().prepare("SELECT COUNT(*) AS n FROM ledger_transfers WHERE agreement_id = ?").get(agreement.id) as { n: number }).n;
  return {
    payerBalance: getBalance(agreement.payer) ?? "0",
    // the account the attempt tried to pay: shows that a substituted recipient received nothing
    recipientBalance: getBalance(attemptedRecipient) ?? "0",
    allowance: null,
    executionCount: n,
    observedAt: nowMs(),
  };
}

function diffsOf(a: PaymentAgreement, t: PaymentAttempt): FieldDiff[] {
  const d: FieldDiff[] = [];
  if (t.recipient !== a.recipient) d.push({ field: "recipient", approved: a.recipient, attempted: t.recipient });
  if (t.amount !== a.amount) d.push({ field: "amount", approved: a.amount, attempted: t.amount });
  if (t.operation !== a.operation) d.push({ field: "operation", approved: a.operation, attempted: t.operation });
  if ((t.continuingAllowance ?? "0") !== "0") d.push({ field: "continuingAllowance", approved: "0", attempted: t.continuingAllowance });
  return d;
}
const DIFF_REASON: Record<string, Reason> = {
  recipient: "RECIPIENT_MISMATCH", amount: "AMOUNT_MISMATCH", operation: "OPERATION_NOT_ALLOWED",
  continuingAllowance: "CONTINUING_PERMISSION_NOT_ALLOWED",
};

export const bank: BankPort = {
  execute(view: AgreementView, attemptIn: PaymentAttempt): Outcome {
    const db = getDb();
    const id = view.agreement.id;
    const attempt: PaymentAttempt = { ...attemptIn, agreementId: id, continuingAllowance: attemptIn.continuingAllowance ?? "0" };

    const tx = db.transaction(() => {
      const row = getRow(id);
      if (!row) throw new PortError("NOT_FOUND", "no such agreement", 404);
      const agreement = JSON.parse(row.json) as PaymentAgreement; // stored terms, never the caller's copy
      const at = nowMs();
      addEvent(id, "attempt.received", null, at);
      const diffs = diffsOf(agreement, attempt);

      const finish = (accepted: boolean, reason: Reason, state: AgreementState, receipt: Receipt | null) => {
        const decision: Decision = { accepted, reason, diffs, decidedAt: at };
        if (!accepted) addEvent(id, "attempt.rejected", reason, at);
        if (state !== row.state && !(state === "expired")) setState(id, state);
        const evidence: ExecutionEvidence = { agreement, attempt, decision, receipt, observed: observe(agreement, attempt.recipient) };
        return { evidence, state, rowId: addEvidence(id, evidence) };
      };

      // 1. Already settled: idempotent replay, return the EXISTING receipt.
      const existing = transferFor(id);
      if (existing || row.state === "settled") return finish(false, "REPLAYED", "settled", receiptOf(existing));
      // 2. Terminal / not yet approved.
      if (row.state === "declined") return finish(false, "DECLINED", "declined", null);
      if (expireIfDue(row) === "expired") return finish(false, "EXPIRED", "expired", null);
      const approval = getApprovalRow(id);
      if (row.state === "awaiting_approval" || !approval) return finish(false, "NOT_APPROVED", row.state, null);
      if (row.state !== "approved" && row.state !== "rejected") return finish(false, "NOT_APPROVED", row.state, null);
      // 3. Stored terms must still be exactly what was signed.
      if (!authInternals.approvalBindingOk(agreement, approval)) return finish(false, "INVALID_SIGNATURE", "rejected", null);
      // 4. Attempt vs approved facts.
      if (agreement.rail !== "bank") return finish(false, "RAIL_MISMATCH", "rejected", null);
      if (diffs.length) return finish(false, DIFF_REASON[diffs[0].field] ?? "OPERATION_NOT_ALLOWED", "rejected", null);
      // 5. Funds (checked before the nonce so a shortfall does not burn the authorization).
      const amount = BigInt(agreement.amount);
      const payerBal = getBalance(agreement.payer), recipBal = getBalance(agreement.recipient);
      if (payerBal === null || recipBal === null) return finish(false, "NOT_FOUND", "rejected", null);
      if (BigInt(payerBal) < amount) return finish(false, "INSUFFICIENT_FUNDS", "rejected", null);
      // 6. Consume the single-use nonce; UNIQUE constraint is the replay barrier.
      try {
        db.prepare("INSERT INTO consumed_nonces (nonce, agreement_id, consumed_at) VALUES (?, ?, ?)").run(agreement.nonce, id, at);
      } catch {
        return finish(false, "REPLAYED", row.state, null);
      }
      // 7. Debit, credit, ledger entry.
      addEvent(id, "execution.started", null, at);
      const setBal = db.prepare("UPDATE bank_accounts SET balance = ? WHERE id = ?");
      setBal.run((BigInt(payerBal) - amount).toString(), agreement.payer);
      setBal.run((BigInt(getBalance(agreement.recipient)!) + amount).toString(), agreement.recipient);
      const transferId = randomUUID();
      db.prepare("INSERT INTO ledger_transfers (id, agreement_id, debit_account, credit_account, amount, posted_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(transferId, id, agreement.payer, agreement.recipient, agreement.amount, at);
      db.prepare("UPDATE agreements SET execution_count = 1 WHERE id = ?").run(id);
      addEvent(id, "execution.settled", null, at);
      return finish(true, "OK", "settled", receiptOf(transferFor(id)));
    });

    const { evidence, state, rowId } = tx.immediate();
    // Read the persisted ledger back AFTER commit; this is what the caller receives as evidence.
    const agreement = evidence.agreement;
    const final: ExecutionEvidence = {
      ...evidence,
      receipt: evidence.decision.accepted || evidence.decision.reason === "REPLAYED" ? receiptOf(transferFor(id)) : null,
      observed: observe(agreement, attempt.recipient),
    };
    updateEvidence(rowId, final);
    return { decision: final.decision, evidence: final, state };
  },

  accounts: () => listAccounts(),
  reset: () => resetAll(),
};
