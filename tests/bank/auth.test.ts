import { beforeEach, describe, expect, it } from "vitest";
import { MERCHANT, useTempDb } from "./helpers";

useTempDb();
const { auth, authInternals } = await import("../../src/server/auth");
const { bank } = await import("../../src/server/bank");
const { getDb } = await import("../../src/server/db");
const { typedDataFor } = await import("../../src/shared/typedData");
const { verifyTypedData } = await import("viem");

const draft = { rail: "bank" as const, recipient: MERCHANT, recipientDisplayName: "Corner Shop", amount: "10000" };
const reqWith = (cookie: string) => new Request("http://localhost/api/session", { headers: cookie ? { cookie } : {} });
const pair = (setCookie: string) => setCookie.split(";")[0];
const NONE = { customer: false, merchant: false, operator: false };

beforeEach(() => { authInternals.setClock(null); auth.reset(); });

describe("sessions", () => {
  it("issues a signed HttpOnly SameSite=Lax cookie only for the right role key", () => {
    expect(auth.issueSession("customer", "nope")).toBeNull();
    expect(auth.issueSession("customer", "demo-merchant")).toBeNull();
    const s = auth.issueSession("customer", "demo-customer")!;
    expect(s.cookie).toMatch(/^cs_customer=[^;]+; Path=\/; HttpOnly; SameSite=Lax; Max-Age=\d+$/);
    expect(auth.capsFromRequest(reqWith(pair(s.cookie)))).toEqual({ ...NONE, customer: true });
  });

  it("merchant and operator cookies give no customer capability", () => {
    const m = pair(auth.issueSession("merchant", "demo-merchant")!.cookie);
    const o = pair(auth.issueSession("operator", "demo-operator")!.cookie);
    expect(auth.capsFromRequest(reqWith(`${m}; ${o}`))).toEqual({ customer: false, merchant: true, operator: true });
    // re-labelling a merchant cookie as a customer cookie does not work
    expect(auth.capsFromRequest(reqWith(m.replace("cs_merchant=", "cs_customer=")))).toEqual(NONE);
  });

  it("rejects tampered, unsigned and expired cookies and ignores non-cookie inputs", () => {
    const c = pair(auth.issueSession("customer", "demo-customer")!.cookie);
    expect(auth.capsFromRequest(reqWith(c.slice(0, -1) + (c.endsWith("0") ? "1" : "0")))).toEqual(NONE);
    const forged = Buffer.from(JSON.stringify({ r: "customer", exp: 9999999999 })).toString("base64url");
    expect(auth.capsFromRequest(reqWith(`cs_customer=${forged}.`))).toEqual(NONE);
    expect(auth.capsFromRequest(reqWith(`cs_customer=${forged}`))).toEqual(NONE);
    expect(auth.capsFromRequest(new Request("http://localhost/?cs_customer=" + c.split("=")[1], { headers: { authorization: c } }))).toEqual(NONE);
    authInternals.setClock(() => Date.now() + 9 * 3600 * 1000);
    expect(auth.capsFromRequest(reqWith(c))).toEqual(NONE);
  });
});

describe("pairing and approval", () => {
  it("approve without or with a wrong pairing token fails and leaves the agreement unapproved", async () => {
    const a = auth.createAgreement(draft, null);
    const b = auth.createAgreement(draft, null);
    const tokenB = auth.issuePairing(b.agreement.id).token;
    auth.issuePairing(a.agreement.id);
    await authInternals.prepareApproval(a.agreement.id);
    for (const t of ["", "not-a-token", tokenB]) {
      expect(auth.checkPairing(a.agreement.id, t)).toBe(false);
      expect(() => auth.approve(a.agreement.id, t)).toThrowError(expect.objectContaining({ code: "UNAUTHORIZED_CAPABILITY", status: 403 }));
      expect(() => auth.decline(a.agreement.id, t)).toThrowError(expect.objectContaining({ code: "UNAUTHORIZED_CAPABILITY" }));
    }
    const view = auth.get(a.agreement.id)!;
    expect(view.state).toBe("awaiting_approval");
    expect(view.approval).toBeNull();
    expect(bank.execute(view, { agreementId: a.agreement.id, recipient: MERCHANT, amount: "10000", operation: "bank.transfer", continuingAllowance: "0" }).decision.reason).toBe("NOT_APPROVED");
  });

  it("stores only a hash of the pairing token, which expires after five minutes", async () => {
    const a = auth.createAgreement({ ...draft, ttlSeconds: 900 }, null);
    const { token, expiresAt } = auth.issuePairing(a.agreement.id);
    expect(expiresAt - Date.now()).toBeGreaterThan(290_000);
    expect(expiresAt - Date.now()).toBeLessThanOrEqual(300_000);
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    const rows = getDb().prepare("SELECT token_hash FROM pairing_tokens").all() as { token_hash: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].token_hash).not.toContain(token);
    expect(auth.checkPairing(a.agreement.id, token)).toBe(true);
    await authInternals.prepareApproval(a.agreement.id);
    authInternals.setClock(() => Date.now() + 301_000);
    expect(auth.checkPairing(a.agreement.id, token)).toBe(false);
    expect(() => auth.approve(a.agreement.id, token)).toThrowError(expect.objectContaining({ code: "UNAUTHORIZED_CAPABILITY" }));
  });

  it("approval is a real EIP-712 signature by the demo signer over the stored terms", async () => {
    const a = auth.createAgreement(draft, null);
    expect(a.agreement).toMatchObject({ payer: "ACC-CUSTOMER-001", rail: "bank", operation: "bank.transfer", domain: null, asset: { code: "AED", decimals: 2, address: null } });
    const { token } = auth.issuePairing(a.agreement.id);
    await authInternals.prepareApproval(a.agreement.id);
    const v = auth.approve(a.agreement.id, token);
    expect(v.state).toBe("approved");
    expect(v.approval!.signer).toBe(auth.signerAddress());
    expect(auth.signerAddress()).toBe("0x70997970C51812dc3A010C7d01b50e0d17dc79C8"); // Anvil account #1
    const td = typedDataFor(v.agreement) as unknown as Record<string, unknown>;
    expect(await verifyTypedData({ ...td, address: v.approval!.signer, signature: v.approval!.signature } as never)).toBe(true);
    const other = typedDataFor({ ...v.agreement, amount: "10001" }) as unknown as Record<string, unknown>;
    expect(await verifyTypedData({ ...other, address: v.approval!.signer, signature: v.approval!.signature } as never)).toBe(false);
    // approving twice is refused
    expect(() => auth.approve(a.agreement.id, token)).toThrowError(expect.objectContaining({ code: "REPLAYED" }));
  });

  it("cannot approve an expired agreement", async () => {
    const a = auth.createAgreement({ ...draft, ttlSeconds: 5 }, null);
    const { token } = auth.issuePairing(a.agreement.id);
    await authInternals.prepareApproval(a.agreement.id);
    authInternals.setClock(() => Date.now() + 6_000);
    expect(() => auth.approve(a.agreement.id, token)).toThrowError(expect.objectContaining({ code: "EXPIRED" }));
    expect(auth.get(a.agreement.id)!.state).toBe("expired");
  });

  it("builds crypto agreements from the chain binding and persists crypto outcomes", () => {
    const token = { code: "CSUSD", decimals: 18, address: "0x5FbDB2315678afecb367f032d93F642f64180aa3" };
    const payer = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
    const shop = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
    const v = auth.createAgreement({ rail: "crypto", recipient: shop, recipientDisplayName: "Shop", amount: "100000000000000000000", itemId: "1" },
      { chainId: 31337, verifyingContract: payer, token, payer });
    expect(v.agreement).toMatchObject({ payer, asset: token, operation: "crypto.purchase", itemId: "1", domain: { chainId: 31337, verifyingContract: payer } });
    const decision = { accepted: true, reason: "OK" as const, diffs: [], decidedAt: Date.now() };
    const evidence = {
      agreement: v.agreement,
      attempt: { agreementId: v.agreement.id, recipient: shop, amount: v.agreement.amount, operation: "crypto.purchase", continuingAllowance: "0" },
      decision,
      receipt: { kind: "chain" as const, chainId: 31337, txHash: "0x" + "ab".repeat(32), blockNumber: "7", status: "success" as const, revertReason: null },
      observed: { payerBalance: "900000000000000000000", recipientBalance: "100000000000000000000", allowance: "0", executionCount: 1, observedAt: Date.now() },
    };
    const after = auth.recordOutcome(v.agreement.id, { decision, evidence, state: "settled" });
    expect(after).toMatchObject({ state: "settled", executionCount: 1 });
    expect(after.evidence).toEqual([evidence]);
    const replay = { ...decision, accepted: false, reason: "REPLAYED" as const };
    const again = auth.recordOutcome(v.agreement.id, { decision: replay, evidence: { ...evidence, decision: replay }, state: "rejected" });
    expect(again).toMatchObject({ state: "settled", executionCount: 1 });
    expect(again.evidence).toHaveLength(2);
    expect(again.events.at(-1)).toMatchObject({ type: "attempt.rejected", reason: "REPLAYED" });
  });
});
