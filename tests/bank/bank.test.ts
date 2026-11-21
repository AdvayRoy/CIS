import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ATTACKER, CUSTOMER, MERCHANT, tempDb } from "./helpers";

const dbPath = tempDb();
const { auth, authInternals } = await import("../../src/server/auth");
const { bank } = await import("../../src/server/bank");
const { getDb } = await import("../../src/server/db");
const { AgreementViewSchema, ExecutionEvidenceSchema } = await import("../../src/shared/contract");

const balance = (id: string) => bank.accounts().find((a) => a.id === id)!.balance;
const transfers = () => (getDb().prepare("SELECT COUNT(*) AS n FROM ledger_transfers").get() as { n: number }).n;
const draft = (over: Record<string, unknown> = {}) =>
  ({ rail: "bank" as const, recipient: MERCHANT, recipientDisplayName: "Corner Shop", amount: "10000", ...over });
const attempt = (id: string, over: Record<string, string> = {}) =>
  ({ agreementId: id, recipient: MERCHANT, amount: "10000", operation: "bank.transfer", continuingAllowance: "0", ...over });

async function approved(over: Record<string, unknown> = {}) {
  const v = auth.createAgreement(draft(over), null);
  const { token } = auth.issuePairing(v.agreement.id);
  await authInternals.prepareApproval(v.agreement.id);
  return auth.approve(v.agreement.id, token);
}
const exec = (id: string, over: Record<string, string> = {}) => bank.execute(auth.get(id)!, attempt(id, over));

beforeEach(() => { authInternals.setClock(null); auth.reset(); bank.reset(); });
afterAll(() => authInternals.setClock(null));

describe("bank simulation", () => {
  it("seeds the fixed scenario accounts", () => {
    expect(bank.accounts().map((a) => [a.id, a.balance])).toEqual([[CUSTOMER, "100000"], [MERCHANT, "0"], [ATTACKER, "0"]]);
  });

  it("settles a legitimate approved transfer exactly once", async () => {
    const v = await approved();
    expect(v.state).toBe("approved");
    expect(await authInternals.verifyApproval(v.agreement.id)).toBe(true);
    const out = exec(v.agreement.id);
    expect(out.decision).toMatchObject({ accepted: true, reason: "OK", diffs: [] });
    expect(out.state).toBe("settled");
    expect(out.evidence.receipt).toMatchObject({ kind: "ledger", debitAccount: CUSTOMER, creditAccount: MERCHANT, amount: "10000" });
    expect(out.evidence.observed).toMatchObject({ payerBalance: "90000", recipientBalance: "10000", allowance: null, executionCount: 1 });
    expect(balance(CUSTOMER)).toBe("90000");
    expect(balance(MERCHANT)).toBe("10000");
    const view = auth.get(v.agreement.id)!;
    expect(AgreementViewSchema.parse(view).state).toBe("settled");
    expect(view.executionCount).toBe(1);
    expect(view.evidence).toHaveLength(1);
    ExecutionEvidenceSchema.parse(view.evidence[0]);
    expect(view.events.map((e) => e.type)).toEqual([
      "agreement.created", "pairing.issued", "agreement.approved", "attempt.received", "execution.started", "execution.settled",
    ]);
    const seqs = view.events.map((e) => e.seq);
    expect([...seqs].sort((a, b) => a - b)).toEqual(seqs);
    expect(new Set(seqs).size).toBe(seqs.length);
  });

  it("rejects recipient substitution, moves nothing, and the legitimate transfer still works", async () => {
    const v = await approved();
    const bad = exec(v.agreement.id, { recipient: ATTACKER });
    expect(bad.decision).toMatchObject({ accepted: false, reason: "RECIPIENT_MISMATCH" });
    expect(bad.decision.diffs).toEqual([{ field: "recipient", approved: MERCHANT, attempted: ATTACKER }]);
    expect(bad.evidence.receipt).toBeNull();
    expect(bad.evidence.observed).toMatchObject({ payerBalance: "100000", recipientBalance: "0", executionCount: 0 });
    expect([balance(CUSTOMER), balance(MERCHANT), balance(ATTACKER), transfers()]).toEqual(["100000", "0", "0", 0]);
    const ok = exec(v.agreement.id);
    expect(ok.decision.accepted).toBe(true);
    expect([balance(CUSTOMER), balance(MERCHANT), balance(ATTACKER), transfers()]).toEqual(["90000", "10000", "0", 1]);
  });

  it("rejects amount mutation, moves nothing, and the legitimate transfer still works", async () => {
    const v = await approved();
    for (const amount of ["10001", "100000", "9999"]) {
      const bad = exec(v.agreement.id, { amount });
      expect(bad.decision).toMatchObject({ accepted: false, reason: "AMOUNT_MISMATCH" });
      expect(bad.decision.diffs).toEqual([{ field: "amount", approved: "10000", attempted: amount }]);
    }
    expect([balance(CUSTOMER), balance(MERCHANT), transfers()]).toEqual(["100000", "0", 0]);
    expect(auth.get(v.agreement.id)!.state).toBe("rejected");
    expect(exec(v.agreement.id).decision.accepted).toBe(true);
    expect([balance(CUSTOMER), balance(MERCHANT), transfers()]).toEqual(["90000", "10000", 1]);
  });

  it("rejects a different operation and any continuing permission", async () => {
    const v = await approved();
    expect(exec(v.agreement.id, { operation: "bank.standing_order" }).decision.reason).toBe("OPERATION_NOT_ALLOWED");
    expect(exec(v.agreement.id, { continuingAllowance: "1" }).decision.reason).toBe("CONTINUING_PERMISSION_NOT_ALLOWED");
    expect(transfers()).toBe(0);
  });

  it("rejects an expired authorization", async () => {
    const v = await approved({ ttlSeconds: 5 });
    authInternals.setClock(() => Date.now() + 6_000);
    const out = exec(v.agreement.id);
    expect(out.decision).toMatchObject({ accepted: false, reason: "EXPIRED" });
    expect(out.state).toBe("expired");
    authInternals.setClock(null); // expiry is terminal even if the clock goes back
    expect(exec(v.agreement.id).decision.reason).toBe("EXPIRED");
    expect([balance(CUSTOMER), transfers()]).toEqual(["100000", 0]);
    const view = auth.get(v.agreement.id)!;
    expect(view.state).toBe("expired");
    expect(view.events.filter((e) => e.type === "agreement.expired")).toHaveLength(1);
  });

  it("lazily expires unexecuted agreements on get/list and clamps ttl", () => {
    const v = auth.createAgreement(draft({ ttlSeconds: 1 }), null);
    expect(v.agreement.expiry - Math.floor(v.agreement.createdAt / 1000)).toBe(5);
    const d = auth.createAgreement(draft(), null);
    expect(d.agreement.expiry - Math.floor(d.agreement.createdAt / 1000)).toBe(300);
    authInternals.setClock(() => Date.now() + 10_000);
    expect(auth.get(v.agreement.id)!.state).toBe("expired");
    expect(auth.list().map((x) => x.state)).toEqual(["expired", "awaiting_approval"]);
  });

  it("rejects execution before approval and after decline", async () => {
    const v = auth.createAgreement(draft(), null);
    expect(exec(v.agreement.id).decision.reason).toBe("NOT_APPROVED");
    const { token } = auth.issuePairing(v.agreement.id);
    expect(auth.decline(v.agreement.id, token).state).toBe("declined");
    expect(exec(v.agreement.id).decision.reason).toBe("DECLINED");
    expect(() => auth.approve(v.agreement.id, token)).toThrow();
    expect(transfers()).toBe(0);
  });

  it("sequential replay returns the existing receipt and never debits twice", async () => {
    const v = await approved();
    const first = exec(v.agreement.id);
    const replay = exec(v.agreement.id);
    expect(replay.decision).toMatchObject({ accepted: false, reason: "REPLAYED" });
    expect(replay.evidence.receipt).toEqual(first.evidence.receipt);
    expect(replay.evidence.observed.executionCount).toBe(1);
    expect(replay.state).toBe("settled");
    expect([balance(CUSTOMER), balance(MERCHANT), transfers()]).toEqual(["90000", "10000", 1]);
    expect(auth.get(v.agreement.id)!.executionCount).toBe(1);
  });

  it("20 concurrent in-process executes produce exactly one debit", async () => {
    const v = await approved();
    const outs = await Promise.all(Array.from({ length: 20 }, () => Promise.resolve().then(() => exec(v.agreement.id))));
    expect(outs.filter((o) => o.decision.accepted)).toHaveLength(1);
    expect(outs.filter((o) => o.decision.reason === "REPLAYED")).toHaveLength(19);
    expect([balance(CUSTOMER), balance(MERCHANT), transfers()]).toEqual(["90000", "10000", 1]);
  });

  it("20 concurrent executes from separate processes produce exactly one debit", async () => {
    const v = await approved();
    const child = fileURLToPath(new URL("./fixtures/exec-child.ts", import.meta.url));
    const startAt = String(Date.now() + 4000);
    const outs = await Promise.all(Array.from({ length: 20 }, () => new Promise<{ accepted: boolean; reason: string; transferId: string | null }>((res, rej) => {
      execFile(process.execPath, ["--import", "tsx", child, v.agreement.id, MERCHANT, "10000", startAt],
        { env: { ...process.env, CS_DB_PATH: dbPath }, timeout: 60_000 },
        (err, stdout, stderr) => (err ? rej(new Error(String(err) + stderr)) : res(JSON.parse(stdout))));
    })));
    expect(outs.filter((o) => o.accepted)).toHaveLength(1);
    expect(outs.filter((o) => o.reason === "REPLAYED")).toHaveLength(19);
    expect(new Set(outs.map((o) => o.transferId)).size).toBe(1);
    expect([balance(CUSTOMER), balance(MERCHANT), transfers()]).toEqual(["90000", "10000", 1]);
    expect(auth.get(v.agreement.id)!.executionCount).toBe(1);
  }, 90_000);

  it("fails the signature/hash check when the stored agreement is tampered with", async () => {
    const v = await approved();
    const db = getDb();
    const tampered = { ...v.agreement, recipient: ATTACKER };
    db.prepare("UPDATE agreements SET json = ? WHERE id = ?").run(JSON.stringify(tampered), v.agreement.id);
    expect(await authInternals.verifyApproval(v.agreement.id)).toBe(false);
    const out = exec(v.agreement.id, { recipient: ATTACKER });
    expect(out.decision).toMatchObject({ accepted: false, reason: "INVALID_SIGNATURE" });
    expect([balance(CUSTOMER), balance(ATTACKER), transfers()]).toEqual(["100000", "0", 0]);
    // restoring the signed terms makes the original authorization usable again
    db.prepare("UPDATE agreements SET json = ? WHERE id = ?").run(JSON.stringify(v.agreement), v.agreement.id);
    expect(exec(v.agreement.id).decision.accepted).toBe(true);
  });

  it("fails when the stored signature or digest is swapped", async () => {
    const a = await approved();
    const b = await approved({ amount: "500" });
    const db = getDb();
    const row = db.prepare("SELECT signature, digest, seal FROM approvals WHERE agreement_id = ?").get(b.agreement.id) as { signature: string; digest: string; seal: string };
    db.prepare("UPDATE approvals SET signature = ?, digest = ?, seal = ? WHERE agreement_id = ?").run(row.signature, row.digest, row.seal, a.agreement.id);
    expect(exec(a.agreement.id).decision.reason).toBe("INVALID_SIGNATURE");
    expect(transfers()).toBe(0);
  });

  it("rejects when funds are insufficient without burning the authorization", async () => {
    const v = await approved();
    const db = getDb();
    db.prepare("UPDATE bank_accounts SET balance = '5' WHERE id = ?").run(CUSTOMER);
    expect(exec(v.agreement.id).decision.reason).toBe("INSUFFICIENT_FUNDS");
    db.prepare("UPDATE bank_accounts SET balance = '100000' WHERE id = ?").run(CUSTOMER);
    expect(exec(v.agreement.id).decision.accepted).toBe(true);
  });

  it("reset is deterministic", async () => {
    const v = await approved();
    exec(v.agreement.id);
    const snapshot = () => JSON.stringify({ accounts: bank.accounts(), list: auth.list(), transfers: transfers() });
    auth.reset(); bank.reset();
    const first = snapshot();
    expect(JSON.parse(first)).toMatchObject({ list: [], transfers: 0 });
    expect(balance(CUSTOMER)).toBe("100000");
    expect(auth.get(v.agreement.id)).toBeNull();
    const again = await approved();
    exec(again.agreement.id);
    expect(auth.get(again.agreement.id)!.events[0].seq).toBe(1);
    auth.reset(); bank.reset();
    expect(snapshot()).toBe(first);
  });
});
