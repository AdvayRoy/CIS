// Pure derivations over the Overview returned by GET /api/state. Nothing here is a constant result.
import { formatUnitsStr } from "@/shared/contract";
import type { AgreementView, ExecutionEvidence, Overview, Reason, Receipt } from "@/shared/contract";

export type Row = { view: AgreementView; ev: ExecutionEvidence };

export function attempts(ov: Overview): Row[] {
  return ov.agreements
    .flatMap((view) => view.evidence.map((ev) => ({ view, ev })))
    .sort((a, b) => b.ev.decision.decidedAt - a.ev.decision.decidedAt);
}

export function receiptId(r: Receipt | null): string | null {
  return r ? (r.kind === "ledger" ? r.transferId : r.txHash) : null;
}

export function byReason(rows: Row[]): { reason: Reason; n: number }[] {
  const m = new Map<Reason, number>();
  for (const { ev } of rows) if (!ev.decision.accepted) m.set(ev.decision.reason, (m.get(ev.decision.reason) ?? 0) + 1);
  return [...m.entries()].map(([reason, n]) => ({ reason, n })).sort((a, b) => b.n - a.n);
}

/** "n / N (p%)"; never a percentage when the denominator is 0. */
export function ratio(n: number, d: number): string {
  if (d === 0) return "no executions yet";
  return `${n} / ${d} (${((n / d) * 100).toFixed(1)}%)`;
}

export type CaseStatus = "observed" | "contradicted" | "unverified";
export type CaseResult = {
  key: string;
  name: string;
  expectation: string;
  status: CaseStatus;
  result: string;
  evidence: { label: string; id: string | null }[];
  at: number | null;
  produce: string;
};

function rejections(rows: Row[], reasons: Reason[]) {
  return rows.filter(({ ev }) => !ev.decision.accepted && reasons.includes(ev.decision.reason));
}

function rejectionCase(key: string, name: string, expectation: string, reasons: Reason[], rows: Row[], produce: string): CaseResult {
  const hits = rejections(rows, reasons);
  if (!hits.length) return { key, name, expectation, status: "unverified", result: "No such attempt in this session", evidence: [], at: null, produce };
  const leaked = hits.filter(({ ev }) => ev.receipt && ev.receipt.kind === "chain" && ev.receipt.status === "success" || (ev.receipt?.kind === "ledger"));
  const top = hits[0];
  const diff = top.ev.decision.diffs.map((d) => `${d.field}: approved ${d.approved}, attempted ${d.attempted}`).join("; ");
  return {
    key, name, expectation,
    status: leaked.length ? "contradicted" : "observed",
    result: `${hits.length} attempt${hits.length === 1 ? "" : "s"} rejected (${[...new Set(hits.map((h) => h.ev.decision.reason))].join(", ")}); ${hits.length - leaked.length} / ${hits.length} without a successful receipt`,
    evidence: [
      { label: "agreement", id: top.view.agreement.id },
      ...(diff ? [{ label: diff, id: null }] : []),
      ...(top.ev.receipt ? [{ label: top.ev.receipt.kind === "chain" ? `chain tx (${top.ev.receipt.status})` : "ledger transfer", id: receiptId(top.ev.receipt) }] : []),
    ],
    at: top.ev.decision.decidedAt,
    produce,
  };
}

export function securityCases(ov: Overview, rows: Row[]): CaseResult[] {
  const lab = "Run it from /lab (operator key demo-operator) after a payment is created in /shop.";
  const out: CaseResult[] = [];

  out.push(rejectionCase("recipient", "Recipient substitution", "Attempt naming a different recipient than approved is rejected; no debit.", ["RECIPIENT_MISMATCH"], rows, lab));
  out.push(rejectionCase("amount", "Amount manipulation", "Attempt with a different or larger amount than approved is rejected; no debit.", ["AMOUNT_MISMATCH", "AMOUNT_EXCEEDS_LIMIT"], rows, lab));

  // Replay: a REPLAYED rejection AND the agreement's execution count still 1.
  {
    const hits = rejections(rows, ["REPLAYED"]);
    const key = "replay", name = "Replay / double debit", expectation = "Re-submitting a settled payment is rejected; execution count stays 1.";
    if (!hits.length) out.push({ key, name, expectation, status: "unverified", result: "No replay attempt in this session", evidence: [], at: null, produce: "Settle a payment in /shop, then replay it from /lab." });
    else {
      const over = hits.filter((h) => h.view.executionCount > 1);
      const top = hits[0];
      out.push({
        key, name, expectation, status: over.length ? "contradicted" : "observed",
        result: `${hits.length} replay${hits.length === 1 ? "" : "s"} rejected (REPLAYED); execution count ${top.view.executionCount} on the latest replayed agreement; ${hits.length - over.length} / ${hits.length} with count ≤ 1`,
        evidence: [
          { label: "agreement", id: top.view.agreement.id },
          ...(top.ev.receipt ? [{ label: top.ev.receipt.kind === "chain" ? `chain tx (${top.ev.receipt.status})` : "original ledger transfer", id: receiptId(top.ev.receipt) }] : []),
        ],
        at: top.ev.decision.decidedAt, produce: "",
      });
    }
  }

  // Crypto excess allowance: read from the EVM-backed token scenarios, plus any rejected continuing-permission attempts.
  {
    const key = "allowance", name = "Crypto excess allowance", expectation = "After a protected purchase the residual allowance is 0 and a later drain reverts; the unprotected comparison account is drained.";
    const p = ov.chain.protected, v = ov.chain.vulnerable;
    const tok = ov.chain.token;
    const amt = (x: string) => (tok ? `${formatUnitsStr(x, tok.decimals)} ${tok.code}` : x);
    const cont = rejections(rows, ["CONTINUING_PERMISSION_NOT_ALLOWED"]);
    const produce = "Buy with CSUSD in /shop, then run the drain on both accounts in /lab.";
    if (!ov.chain.available || !p) out.push({ key, name, expectation, status: "unverified", result: "Local chain not available in this session", evidence: [], at: null, produce: "Start the demo with Anvil (pnpm demo)." });
    else if (!p.purchased) out.push({
      key, name, expectation, status: "unverified",
      result: `No protected purchase in this session, so there is no post-purchase allowance to test${p.drainAttempt ? " (a drain was attempted, but against an account that never granted an allowance)" : ""}`,
      evidence: [], at: null, produce,
    });
    else if (!p.drainAttempt) out.push({
      key, name, expectation, status: "unverified",
      result: `No drain attempted on the protected account yet (allowance read: ${amt(p.allowance)}${cont.length ? `; ${cont.length} continuing-permission attempt${cont.length === 1 ? "" : "s"} rejected` : ""})`,
      evidence: p.lastPurchaseTx ? [{ label: "protected purchase tx", id: p.lastPurchaseTx }] : [], at: cont[0]?.ev.decision.decidedAt ?? null, produce,
    });
    else {
      const ok = !p.drainAttempt.succeeded && p.allowance === "0";
      out.push({
        key, name, expectation, status: ok ? "observed" : "contradicted",
        result: `Protected: allowance ${amt(p.allowance)}, drain ${p.drainAttempt.succeeded ? "SUCCEEDED" : "reverted"}${p.drainAttempt.revertReason ? ` (${p.drainAttempt.revertReason})` : ""}. Vulnerable comparison: ${v?.drainAttempt ? `allowance ${amt(v.allowance)}, drain ${v.drainAttempt.succeeded ? "succeeded" : "failed"}` : "not executed"}.`,
        evidence: [
          { label: "protected drain tx", id: p.drainAttempt.txHash },
          ...(p.lastPurchaseTx ? [{ label: "protected purchase tx", id: p.lastPurchaseTx }] : []),
          ...(v?.drainAttempt?.txHash ? [{ label: "vulnerable drain tx", id: v.drainAttempt.txHash }] : []),
        ],
        at: null, produce: "",
      });
    }
  }

  out.push(rejectionCase("bypass", "Direct authorization bypass", "Execution attempted without a valid customer approval is rejected; no debit.", ["NOT_APPROVED", "INVALID_SIGNATURE", "UNAUTHORIZED_CAPABILITY"], rows, "Create a payment in /shop and attempt execution from /lab before approving on the phone."));

  // Legitimate payment: accepted decision with a receipt.
  {
    const key = "legit", name = "Legitimate payment", expectation = "An approved, unmodified payment is accepted and settles exactly once with a receipt.";
    const acc = rows.filter(({ ev }) => ev.decision.accepted);
    const withReceipt = acc.filter(({ ev }) => ev.receipt && (ev.receipt.kind === "ledger" || ev.receipt.status === "success"));
    if (!withReceipt.length) out.push({ key, name, expectation, status: "unverified", result: acc.length ? `${acc.length} accepted, none with a successful receipt` : "No accepted payment in this session", evidence: [], at: null, produce: "Pay in /shop and approve on the phone (customer key demo-customer)." });
    else {
      const top = withReceipt[0];
      out.push({
        key, name, expectation, status: "observed",
        result: `${withReceipt.length} / ${acc.length} accepted decisions carry a successful receipt; latest execution count ${top.view.executionCount}, state ${top.view.state}`,
        evidence: [
          { label: top.ev.receipt!.kind === "chain" ? "chain tx (success)" : "ledger transfer", id: receiptId(top.ev.receipt) },
          { label: "agreement", id: top.view.agreement.id },
        ],
        at: top.ev.decision.decidedAt, produce: "",
      });
    }
  }
  return out;
}
