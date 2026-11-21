/**
 * CounterSign acceptance checks 1-8 and 11 (docs/CONTRACT.md, directive §8).
 * HTTP-level against BASE_URL. One file on purpose: the ledger and the chain
 * are shared state, so scenarios must run sequentially.
 *
 * Without a reachable server the suite is skipped (so `pnpm test` still runs
 * unit tests); set ACCEPTANCE=1 to make an unreachable server a hard failure.
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  BANK, BANK_PRICE, BANK_START, TOKEN_AFTER, TOKEN_PRICE, TOKEN_START, BASE_URL, Client,
  anon, approveWithToken, attemptFor, bankBalances, chainOrThrow, createAgreement, createApproved,
  evmAllowance, evmBalance, execute, pair, reset, serverReachable, signedIn, sleep, state, view,
} from "./helpers";
import { AgreementViewSchema, ExecutionEvidenceSchema, OverviewSchema } from "../../src/shared/contract";

const reachable = await serverReachable();
if (!reachable && process.env.ACCEPTANCE) throw new Error(`ACCEPTANCE=1 but ${BASE_URL}/api/health is unreachable`);
if (!reachable) console.warn(`[acceptance] ${BASE_URL} unreachable: acceptance suite SKIPPED (NOT RUN)`);

const START = { customer: BANK_START, merchant: "0", attacker: "0" };
const AFTER_ONE = { customer: "90000", merchant: "10000", attacker: "0" };

describe.skipIf(!reachable)("CounterSign acceptance", () => {
  let merchant: Client; let customer: Client; let operator: Client;

  beforeAll(async () => {
    merchant = await signedIn("merchant");
    customer = await signedIn("customer");
    operator = await signedIn("operator");
  });
  beforeEach(async () => {
    const r = await reset();
    expect(r.status, `reset failed: ${JSON.stringify(r.body)}`).toBe(200);
    expect(await bankBalances()).toEqual(START);
  });

  describe("0 preconditions: sessions and contract shapes", () => {
    it("session cookies are signed, HttpOnly, and grant exactly one capability", async () => {
      const c = anon();
      const res = await c.signIn("merchant");
      expect(res.status).toBe(200);
      const setCookie = (res.headers.getSetCookie?.() ?? []).join("\n");
      expect(setCookie).toMatch(/cs_merchant=/);
      expect(setCookie.toLowerCase()).toContain("httponly");
      const caps = await c.get<{ caps: Record<string, boolean> }>("/api/session");
      expect(caps.body.caps).toEqual({ customer: false, merchant: true, operator: false });
      expect((await anon().get<{ caps: Record<string, boolean> }>("/api/session")).body.caps).toEqual({ customer: false, merchant: false, operator: false });
    });
    it("wrong role key is refused and sets no cookie", async () => {
      const c = anon();
      for (const role of ["customer", "merchant", "operator"] as const) {
        const r = await c.signIn(role, "wrong-key");
        expect(r.status).toBe(403);
      }
      // merchant key must not buy the customer role
      expect((await c.signIn("customer", "demo-merchant")).status).toBe(403);
      expect(c.cookieNames()).toEqual([]);
    });
    it("/api/state matches the frozen Overview schema and is not cacheable", async () => {
      const r = await anon().get("/api/state");
      expect(r.status).toBe(200);
      expect(r.headers.get("cache-control")).toContain("no-store");
      const parsed = OverviewSchema.safeParse(r.body);
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    });
  });

  describe("1 approved legitimate bank transfer settles once", () => {
    it("settles exactly the agreed amount to the agreed recipient with a persisted ledger receipt", async () => {
      const created = await createAgreement(merchant);
      expect(created.state).toBe("awaiting_approval");
      expect(created.approval).toBeNull();
      expect(created.agreement.payer).toBe(BANK.customer);
      expect(created.agreement.recipient).toBe(BANK.merchant);
      expect(created.agreement.amount).toBe(BANK_PRICE);
      // creating an agreement returns no approval capability
      expect(JSON.stringify(created)).not.toMatch(/"token"|pairing[^.]|x-cs-pairing/i);

      const token = await pair(customer, created.agreement.id);
      const approved = await approveWithToken(created.agreement.id, token);
      expect(approved.status).toBe(200);
      expect(approved.body.state).toBe("approved");
      expect(approved.body.approval?.signature).toMatch(/^0x[0-9a-fA-F]{130}$/);
      expect(await bankBalances(), "approval alone must not move money").toEqual(START);

      const r = await execute(merchant, created.agreement.id, attemptFor(approved.body));
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(r.body.decision).toMatchObject({ accepted: true, reason: "OK", diffs: [] });
      expect(r.body.state).toBe("settled");
      const ev = ExecutionEvidenceSchema.safeParse(r.body.evidence);
      expect(ev.success, JSON.stringify(ev.error?.issues)).toBe(true);
      expect(r.body.evidence.receipt).toMatchObject({ kind: "ledger", debitAccount: BANK.customer, creditAccount: BANK.merchant, amount: BANK_PRICE });
      expect(r.body.evidence.observed).toMatchObject({ payerBalance: "90000", recipientBalance: "10000", allowance: null, executionCount: 1 });

      // persisted, re-read through independent requests
      expect(await bankBalances()).toEqual(AFTER_ONE);
      const v = await view(created.agreement.id);
      expect(AgreementViewSchema.safeParse(v).success).toBe(true);
      expect(v.state).toBe("settled");
      expect(v.executionCount).toBe(1);
      const accepted = v.evidence.filter((e) => e.decision.accepted);
      expect(accepted).toHaveLength(1);
      expect(accepted[0].receipt).toEqual(r.body.evidence.receipt);
      expect(v.events.map((e) => e.type)).toEqual(expect.arrayContaining(["agreement.created", "agreement.approved"]));
      const inState = (await state()).agreements.find((a) => a.agreement.id === created.agreement.id);
      expect(inState?.state).toBe("settled");
    });

    it("execute before approval moves nothing (NOT_APPROVED)", async () => {
      const created = await createAgreement(merchant);
      const r = await execute(merchant, created.agreement.id, attemptFor(created));
      expect(r.status).toBe(409);
      expect(r.body.decision).toMatchObject({ accepted: false, reason: "NOT_APPROVED" });
      expect(r.body.evidence.receipt).toBeNull();
      expect(await bankBalances()).toEqual(START);
      expect((await view(created.agreement.id)).executionCount).toBe(0);
    });

    it("execute after the customer declined moves nothing", async () => {
      const created = await createAgreement(merchant);
      const token = await pair(customer, created.agreement.id);
      const d = await anon().post(`/api/agreements/${created.agreement.id}/decline`, undefined, { "x-cs-pairing": token });
      expect(d.status).toBe(200);
      expect((await view(created.agreement.id)).state).toBe("declined");
      const r = await execute(merchant, created.agreement.id, attemptFor(created));
      expect(r.status).toBe(409);
      expect(r.body.decision.accepted).toBe(false);
      expect(await bankBalances()).toEqual(START);
      // a declined agreement cannot be approved afterwards with the same token
      const late = await approveWithToken(created.agreement.id, token);
      expect((await view(created.agreement.id)).state, `late approve returned ${late.status}`).toBe("declined");
    });

    it("execute needs the merchant capability; customer/operator/anonymous cannot execute", async () => {
      const approved = await createApproved(merchant, customer);
      for (const c of [anon(), customer, operator]) {
        const r = await execute(c, approved.agreement.id, attemptFor(approved));
        expect(r.status, c.label).toBe(403);
      }
      expect(await bankBalances()).toEqual(START);
    });
  });

  describe("2 recipient and amount mutations cause no unauthorized ledger movement", () => {
    const cases: Array<{ name: string; over: Record<string, string>; reasons: string[]; field: string }> = [
      { name: "recipient substituted with ACC-UNKNOWN-777", over: { recipient: BANK.attacker }, reasons: ["RECIPIENT_MISMATCH"], field: "recipient" },
      { name: "amount raised by one minor unit", over: { amount: "10001" }, reasons: ["AMOUNT_MISMATCH", "AMOUNT_EXCEEDS_LIMIT"], field: "amount" },
      { name: "amount raised to the whole balance", over: { amount: "100000" }, reasons: ["AMOUNT_MISMATCH", "AMOUNT_EXCEEDS_LIMIT"], field: "amount" },
      { name: "amount lowered (bank debit must be exact)", over: { amount: "9999" }, reasons: ["AMOUNT_MISMATCH"], field: "amount" },
      { name: "operation changed", over: { operation: "bank.standing_order" }, reasons: ["OPERATION_NOT_ALLOWED"], field: "operation" },
      { name: "continuing permission requested", over: { continuingAllowance: "100000" }, reasons: ["CONTINUING_PERMISSION_NOT_ALLOWED"], field: "continuingAllowance" },
    ];
    for (const c of cases) {
      it(`${c.name}: rejected, field-level diff, zero movement`, async () => {
        const approved = await createApproved(merchant, customer);
        const id = approved.agreement.id;
        const r = await execute(merchant, id, attemptFor(approved, c.over));
        expect(r.status, JSON.stringify(r.body)).toBe(409);
        expect(r.body.decision.accepted).toBe(false);
        expect(c.reasons).toContain(r.body.decision.reason);
        const diff = r.body.decision.diffs.find((d) => d.field === c.field);
        expect(diff, `no diff for ${c.field}: ${JSON.stringify(r.body.decision.diffs)}`).toBeTruthy();
        expect(diff!.attempted).toBe(Object.values(c.over)[0]);
        expect(r.body.evidence.receipt).toBeNull();
        expect(r.body.evidence.observed).toMatchObject({ payerBalance: BANK_START, executionCount: 0 });
        expect(r.body.state).not.toBe("settled");

        expect(await bankBalances()).toEqual(START);
        const v = await view(id);
        expect(v.executionCount).toBe(0);
        expect(v.evidence.some((e) => !e.decision.accepted && e.receipt === null), "rejected attempt must be persisted as evidence").toBe(true);
        // approved facts are immutable
        expect(v.agreement).toEqual(approved.agreement);
        expect(v.approval).toEqual(approved.approval);
      });
    }

    it("a rejected mutation never authorizes an altered transfer, even when retried and followed by the legitimate attempt", async () => {
      const approved = await createApproved(merchant, customer);
      const id = approved.agreement.id;
      for (let i = 0; i < 3; i++) {
        expect((await execute(merchant, id, attemptFor(approved, { recipient: BANK.attacker }))).status).toBe(409);
        expect((await execute(merchant, id, attemptFor(approved, { amount: "50000" }))).status).toBe(409);
      }
      expect(await bankBalances()).toEqual(START);
      const legit = await execute(merchant, id, attemptFor(approved));
      const b = await bankBalances();
      expect(b.attacker, "attacker account must never be credited").toBe("0");
      // Either the legitimate transfer still settles once, or the agreement was stopped; never anything else.
      if (legit.status === 200) expect(b).toEqual(AFTER_ONE); else expect(b).toEqual(START);
      console.info(`[check 2] legitimate attempt after rejected mutations -> HTTP ${legit.status} ${legit.body.decision?.reason}`);
    });

    it("the merchant cannot rewrite approved facts or smuggle fields through execute", async () => {
      const approved = await createApproved(merchant, customer);
      const id = approved.agreement.id;
      const r = await execute(merchant, id, { ...attemptFor(approved), agreement: { ...approved.agreement, recipient: BANK.attacker, amount: "100000" }, approval: approved.approval, payer: BANK.attacker });
      const b = await bankBalances();
      expect(b.attacker).toBe("0");
      if (r.status === 200) expect(b).toEqual(AFTER_ONE); else expect(b).toEqual(START);
      for (const m of ["PUT", "PATCH", "DELETE"]) {
        const x = await merchant.req(m, `/api/agreements/${id}`, { recipient: BANK.attacker, amount: "100000" });
        expect(x.status, `${m} must not be a mutation path`).toBeGreaterThanOrEqual(400);
      }
      expect((await view(id)).agreement).toEqual(approved.agreement);
    });

    it("malformed amounts are refused without movement", async () => {
      const approved = await createApproved(merchant, customer);
      for (const amount of ["-10000", "100.00", "1e4", "0x2710", "", " 10000"]) {
        const r = await execute(merchant, approved.agreement.id, attemptFor(approved, { amount }));
        expect([400, 409], `amount ${JSON.stringify(amount)} -> ${r.status}`).toContain(r.status);
      }
      expect(await bankBalances()).toEqual(START);
    });
  });

  describe("3 expired authorization is rejected", () => {
    it("an approval created with ttlSeconds 5 cannot be executed after expiry", { timeout: 40_000 }, async () => {
      const approved = await createApproved(merchant, customer, { ttlSeconds: 5 });
      const id = approved.agreement.id;
      const ttl = approved.agreement.expiry - Math.floor(Date.now() / 1000);
      expect(ttl, "server clamps ttl to [5,900]").toBeLessThanOrEqual(6);
      await sleep((Math.max(ttl, 0) + 2) * 1000);
      const r = await execute(merchant, id, attemptFor(approved));
      expect(r.status, JSON.stringify(r.body)).toBe(409);
      expect(r.body.decision).toMatchObject({ accepted: false, reason: "EXPIRED" });
      expect(r.body.evidence.receipt).toBeNull();
      expect(await bankBalances()).toEqual(START);
      const v = await view(id);
      expect(v.state).toBe("expired");
      expect(v.executionCount).toBe(0);
    });
    it("an agreement that expires unapproved cannot be approved or executed", { timeout: 40_000 }, async () => {
      const created = await createAgreement(merchant, { ttlSeconds: 5 });
      const id = created.agreement.id;
      const token = await pair(customer, id);
      await sleep((created.agreement.expiry - Math.floor(Date.now() / 1000) + 2) * 1000);
      const a = await approveWithToken(id, token);
      expect(a.status, "approve after expiry must not succeed").toBeGreaterThanOrEqual(400);
      const v = await view(id);
      expect(v.state).toBe("expired");
      expect(v.approval).toBeNull();
      expect((await execute(merchant, id, attemptFor(created))).status).toBe(409);
      expect(await bankBalances()).toEqual(START);
    });
  });

  describe("4 replayed/concurrent authorization causes no second debit", () => {
    it("20 concurrent executes of one approval produce exactly one debit and one receipt", async () => {
      const approved = await createApproved(merchant, customer);
      const id = approved.agreement.id;
      const results = await Promise.all(Array.from({ length: 20 }, () => execute(merchant, id, attemptFor(approved))));
      const statuses = results.map((r) => r.status);
      expect(statuses.every((s) => s === 200 || s === 409), `statuses ${statuses}`).toBe(true);
      expect(statuses.filter((s) => s === 200).length).toBeGreaterThanOrEqual(1);
      const transferIds = new Set(results.filter((r) => r.status === 200).map((r) => (r.body.evidence.receipt as { transferId: string }).transferId));
      expect(transferIds.size, "every accepted response must carry the SAME receipt").toBe(1);
      for (const r of results.filter((x) => x.status === 409)) expect(r.body.decision.reason).toBe("REPLAYED");

      expect(await bankBalances()).toEqual(AFTER_ONE);
      const v = await view(id);
      expect(v.executionCount).toBe(1);
      expect(v.state).toBe("settled");
      const receipts = new Set(v.evidence.filter((e) => e.receipt).map((e) => (e.receipt as { transferId: string }).transferId));
      expect(receipts.size).toBe(1);
    });

    it("replay after settlement: no second debit; same receipt or REPLAYED", async () => {
      const approved = await createApproved(merchant, customer);
      const id = approved.agreement.id;
      const first = await execute(merchant, id, attemptFor(approved));
      expect(first.status).toBe(200);
      const tid = (first.body.evidence.receipt as { transferId: string }).transferId;
      for (let i = 0; i < 5; i++) {
        const again = await execute(merchant, id, attemptFor(approved));
        if (again.status === 200) expect((again.body.evidence.receipt as { transferId: string }).transferId).toBe(tid);
        else { expect(again.status).toBe(409); expect(again.body.decision.reason).toBe("REPLAYED"); }
      }
      // replay with a mutated recipient after settlement
      const mut = await execute(merchant, id, attemptFor(approved, { recipient: BANK.attacker }));
      expect(mut.status).toBe(409);
      // approving again must not re-arm the authorization
      const token2 = await customer.post<{ token?: string }>(`/api/agreements/${id}/pairing`);
      if (token2.body?.token) await approveWithToken(id, token2.body.token);
      await execute(merchant, id, attemptFor(approved));
      expect(await bankBalances()).toEqual(AFTER_ONE);
      const v = await view(id);
      expect(v.executionCount).toBe(1);
      expect(v.state).toBe("settled");
    });

    it("each agreement gets a unique nonce and id; two agreements settle independently, once each", async () => {
      const a = await createApproved(merchant, customer);
      const b = await createApproved(merchant, customer);
      expect(a.agreement.id).not.toBe(b.agreement.id);
      expect(a.agreement.nonce).not.toBe(b.agreement.nonce);
      // signature of A cannot be replayed against B: executing B with A's terms is still B's single debit
      const rs = await Promise.all([...Array(5)].flatMap(() => [execute(merchant, a.agreement.id, attemptFor(a)), execute(merchant, b.agreement.id, attemptFor(b))]));
      expect(rs.some((r) => r.status === 200)).toBe(true);
      expect(await bankBalances()).toEqual({ customer: "80000", merchant: "20000", attacker: "0" });
    });
  });

  describe("5 merchant/lab capability cannot approve a payment", () => {
    let id: string;
    const stillUnapproved = async () => {
      const v = await view(id);
      expect(v.state).toBe("awaiting_approval");
      expect(v.approval).toBeNull();
    };
    beforeEach(async () => { id = (await createAgreement(merchant)).agreement.id; });

    it("approve with only merchant and/or operator cookies is refused", async () => {
      const both = await signedIn("merchant", "operator");
      for (const c of [merchant, operator, both]) {
        const r = await c.post(`/api/agreements/${id}/approve`);
        expect(r.status, c.label).toBe(403);
        const r2 = await c.post(`/api/agreements/${id}/approve`, { role: "customer", caps: { customer: true }, approved: true });
        expect(r2.status, c.label).toBe(403);
      }
      await stillUnapproved();
    });
    it("merchant and operator cannot mint a pairing token; anonymous cannot either", async () => {
      for (const c of [merchant, operator, anon()]) {
        const r = await c.post<{ token?: string }>(`/api/agreements/${id}/pairing`);
        expect(r.status, c.label).toBe(403);
        expect(r.body?.token).toBeUndefined();
      }
      await stillUnapproved();
    });
    it("body-, query- and header-supplied role claims are ignored", async () => {
      const claims = { role: "customer", key: "demo-customer", caps: { customer: true, merchant: true, operator: true }, customer: true };
      const r1 = await merchant.post<{ token?: string }>(`/api/agreements/${id}/pairing?role=customer&customer=true`, claims, { "x-cs-role": "customer", "x-cs-customer": "1" });
      expect(r1.status).toBe(403);
      const r2 = await anon().post(`/api/agreements/${id}/approve?role=customer`, claims, { "x-cs-role": "customer" });
      expect(r2.status).toBe(403);
      const r3 = await anon().post("/api/agreements", { ...claims, rail: "bank", recipient: BANK.attacker, recipientDisplayName: "x", amount: "1" });
      expect(r3.status).toBe(403);
      const r4 = await anon().post("/api/lab/reset", claims);
      expect(r4.status).toBe(403);
      await stillUnapproved();
    });
    it("forged, unsigned or cross-role cookies grant nothing", async () => {
      const forged = anon();
      forged.setRawCookie("cs_customer", "1");
      forged.setRawCookie("cs_merchant", "true");
      forged.setRawCookie("cs_operator", "demo-operator");
      expect((await forged.get<{ caps: unknown }>("/api/session")).body.caps).toEqual({ customer: false, merchant: false, operator: false });
      expect((await forged.post(`/api/agreements/${id}/pairing`)).status).toBe(403);
      // a genuine merchant cookie value replayed under the customer cookie name
      const m = anon(); const res = await m.signIn("merchant");
      const val = (res.headers.getSetCookie?.() ?? []).map((s) => s.split(";")[0]).find((s) => s.startsWith("cs_merchant="))?.slice("cs_merchant=".length);
      expect(val).toBeTruthy();
      const cross = anon(); cross.setRawCookie("cs_customer", val!);
      expect((await cross.get<{ caps: { customer: boolean } }>("/api/session")).body.caps.customer).toBe(false);
      expect((await cross.post(`/api/agreements/${id}/pairing`)).status).toBe(403);
      await stillUnapproved();
    });
    it("absent, empty, forged and tampered pairing tokens are refused", async () => {
      const real = await pair(customer, id);
      const flipped = real.slice(0, -1) + (real.endsWith("A") ? "B" : "A");
      for (const t of [undefined, "", "forged", "0".repeat(64), id, flipped, real + "x", real.toUpperCase() === real ? real.toLowerCase() : real.toUpperCase()]) {
        const r = await merchant.post(`/api/agreements/${id}/approve`, undefined, t === undefined ? {} : { "x-cs-pairing": t });
        expect(r.status, `token ${JSON.stringify(t)}`).toBe(403);
        if (t !== undefined && t !== "") {
          const chk = await anon().get<{ valid: boolean }>(`/api/agreements/${id}/pairing/check`, { "x-cs-pairing": t });
          expect(chk.body?.valid ?? false).toBe(false);
        }
      }
      // token in body/query instead of header is not an approval
      expect((await anon().post(`/api/agreements/${id}/approve?t=${encodeURIComponent(real)}`, { token: real, pairing: real })).status).toBe(403);
      await stillUnapproved();
    });
    it("a pairing token for a different agreement cannot approve this one", async () => {
      const other = (await createAgreement(merchant, { recipient: BANK.attacker, amount: "100000" })).agreement.id;
      const tokenForThis = await pair(customer, id);
      const r = await approveWithToken(other, tokenForThis);
      expect(r.status).toBe(403);
      expect((await anon().get<{ valid: boolean }>(`/api/agreements/${other}/pairing/check`, { "x-cs-pairing": tokenForThis })).body.valid).toBe(false);
      const vo = await view(other);
      expect(vo.state).toBe("awaiting_approval");
      expect(vo.approval).toBeNull();
      expect((await execute(merchant, other, attemptFor(vo))).status).toBe(409);
      expect(await bankBalances()).toEqual(START);
      await stillUnapproved();
      // and the token still works for the agreement it was minted for
      expect((await anon().get<{ valid: boolean }>(`/api/agreements/${id}/pairing/check`, { "x-cs-pairing": tokenForThis })).body.valid).toBe(true);
      expect((await approveWithToken(id, tokenForThis)).status).toBe(200);
    });
    it("the merchant-visible surface never leaks a pairing token, signer key or session secret", async () => {
      const token = await pair(customer, id);
      const surfaces = [await merchant.get(`/api/agreements/${id}`), await merchant.get("/api/state"), await merchant.get("/api/agreements"), await merchant.get("/api/health")];
      for (const s of surfaces) {
        const text = JSON.stringify(s.body);
        expect(text.includes(token), "pairing token leaked to a non-customer surface").toBe(false);
        // Anvil account #1 private key (default demo signer)
        expect(text.toLowerCase()).not.toContain("59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
      }
      await stillUnapproved();
    });
    it("lab endpoints need the operator capability", async () => {
      for (const c of [anon(), merchant, customer]) {
        expect((await c.post("/api/lab/reset")).status, c.label).toBe(403);
        expect((await c.post("/api/lab/vulnerable-purchase")).status, c.label).toBe(403);
        expect((await c.post("/api/lab/drain", { which: "protected" })).status, c.label).toBe(403);
      }
    });
  });

  describe("6 protected crypto purchase completes for the agreed amount", () => {
    it("settles 100 CSUSD through the constrained adapter with a real chain receipt", { timeout: 60_000 }, async () => {
      const c0 = await chainOrThrow();
      expect(c0.protected.customerBalance).toBe(TOKEN_START);
      expect(await evmBalance(c0.token, c0.protected.customer)).toBe(TOKEN_START);
      expect(await evmAllowance(c0.token, c0.protected.customer, c0.protected.shop)).toBe("0");
      const shopBefore = await evmBalance(c0.token, c0.protected.shop);

      const approved = await createApproved(merchant, customer, { rail: "crypto" });
      const a = approved.agreement;
      expect(a.rail).toBe("crypto");
      expect(a.recipient.toLowerCase()).toBe(c0.protected.shop.toLowerCase());
      expect(a.payer.toLowerCase()).toBe(c0.protected.customer.toLowerCase());
      expect(a.asset.address?.toLowerCase()).toBe(c0.token.toLowerCase());
      expect(a.domain?.chainId).toBeTypeOf("number");
      expect(await evmBalance(c0.token, c0.protected.customer), "approval alone must not move tokens").toBe(TOKEN_START);

      const r = await execute(merchant, a.id, attemptFor(approved));
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(r.body.decision).toMatchObject({ accepted: true, reason: "OK" });
      expect(r.body.state).toBe("settled");
      expect(r.body.evidence.receipt).toMatchObject({ kind: "chain", status: "success" });
      const txHash = (r.body.evidence.receipt as { txHash: `0x${string}` }).txHash;
      const { evm } = await import("./helpers");
      const receipt = await evm().getTransactionReceipt({ hash: txHash });
      expect(receipt.status, "receipt must exist on the EVM").toBe("success");

      // independent EVM reads
      expect(await evmBalance(c0.token, c0.protected.customer)).toBe(TOKEN_AFTER);
      const shopAfter = await evmBalance(c0.token, c0.protected.shop);
      expect((BigInt(shopAfter) - BigInt(shopBefore)).toString()).toBe(TOKEN_PRICE);
      expect(r.body.evidence.observed).toMatchObject({ payerBalance: TOKEN_AFTER, allowance: "0", executionCount: 1 });
      const s = await state();
      expect(s.chain.protected).toMatchObject({ customerBalance: TOKEN_AFTER, allowance: "0", purchased: true });
      const v = await view(a.id);
      expect(v.state).toBe("settled");
      expect(v.executionCount).toBe(1);
    });

    it("mutated crypto attempts (recipient, amount, residual allowance) move no tokens", { timeout: 60_000 }, async () => {
      const c0 = await chainOrThrow();
      const approved = await createApproved(merchant, customer, { rail: "crypto" });
      const id = approved.agreement.id;
      const attacker = "0x000000000000000000000000000000000000dEaD";
      const muts = [{ recipient: attacker }, { amount: "1000" + "000000000000000000" }, { continuingAllowance: TOKEN_START }, { operation: "crypto.approve" }];
      for (const over of muts) {
        const r = await execute(merchant, id, attemptFor(approved, over));
        expect(r.status, JSON.stringify(over)).toBe(409);
        expect(r.body.decision.accepted).toBe(false);
      }
      expect(await evmBalance(c0.token, c0.protected.customer)).toBe(TOKEN_START);
      expect(await evmAllowance(c0.token, c0.protected.customer, c0.protected.shop)).toBe("0");
      expect(await evmAllowance(c0.token, c0.protected.customer, attacker)).toBe("0");
      expect((await view(id)).executionCount).toBe(0);
    });

    it("crypto execute before approval and replay after settlement move no extra tokens", { timeout: 60_000 }, async () => {
      const c0 = await chainOrThrow();
      const created = await createAgreement(merchant, { rail: "crypto" });
      const early = await execute(merchant, created.agreement.id, attemptFor(created));
      expect(early.status).toBe(409);
      expect(await evmBalance(c0.token, c0.protected.customer)).toBe(TOKEN_START);

      const approved = await createApproved(merchant, customer, { rail: "crypto" });
      expect((await execute(merchant, approved.agreement.id, attemptFor(approved))).status).toBe(200);
      for (let i = 0; i < 3; i++) await execute(merchant, approved.agreement.id, attemptFor(approved));
      expect(await evmBalance(c0.token, c0.protected.customer)).toBe(TOKEN_AFTER);
      expect((await view(approved.agreement.id)).executionCount).toBe(1);
    });
  });

  describe("7 residual allowance is zero and the actual later drain fails", () => {
    it("after the protected purchase allowance(customer, shop) == 0 and the shop's transferFrom reverts", { timeout: 60_000 }, async () => {
      const c0 = await chainOrThrow();
      const approved = await createApproved(merchant, customer, { rail: "crypto" });
      expect((await execute(merchant, approved.agreement.id, attemptFor(approved))).status).toBe(200);
      expect(await evmAllowance(c0.token, c0.protected.customer, c0.protected.shop)).toBe("0");

      const d = await operator.post<import("../../src/shared/contract").TokenScenario>("/api/lab/drain", { which: "protected" });
      expect(d.status, JSON.stringify(d.body)).toBe(200);
      expect(d.body.label).toBe("protected");
      expect(d.body.drainAttempt, "the drain must actually be attempted").not.toBeNull();
      expect(d.body.drainAttempt!.succeeded).toBe(false);
      expect(BigInt(d.body.drainAttempt!.amountRequested) > BigInt(0)).toBe(true);
      expect(d.body.drainAttempt!.revertReason ?? d.body.drainAttempt!.txHash, "a revert reason or reverted tx hash is required as evidence").toBeTruthy();
      expect(d.body).toMatchObject({ customerBalance: TOKEN_AFTER, allowance: "0" });
      // independent EVM reads: 900 tokens remain
      expect(await evmBalance(c0.token, c0.protected.customer)).toBe(TOKEN_AFTER);
      expect(await evmAllowance(c0.token, c0.protected.customer, c0.protected.shop)).toBe("0");
      expect((await state()).chain.protected?.customerBalance).toBe(TOKEN_AFTER);
    });
  });

  describe("8 vulnerable comparison: the same attack succeeds", () => {
    it("the vulnerable purchase leaves excess allowance and the later drain takes tokens", { timeout: 60_000 }, async () => {
      const c0 = await chainOrThrow();
      expect(await evmBalance(c0.token, c0.vulnerable.customer)).toBe(TOKEN_START);
      const p = await operator.post<import("../../src/shared/contract").TokenScenario>("/api/lab/vulnerable-purchase");
      expect(p.status, JSON.stringify(p.body)).toBe(200);
      expect(p.body).toMatchObject({ label: "vulnerable", purchased: true, customerBalance: TOKEN_AFTER });
      const allowance = await evmAllowance(c0.token, p.body.customer, p.body.shop);
      expect(BigInt(allowance) > BigInt(0), "vulnerable path must leave a residual allowance").toBe(true);
      expect(p.body.allowance).toBe(allowance);
      expect(await evmBalance(c0.token, p.body.customer)).toBe(TOKEN_AFTER);

      const d = await operator.post<import("../../src/shared/contract").TokenScenario>("/api/lab/drain", { which: "vulnerable" });
      expect(d.status, JSON.stringify(d.body)).toBe(200);
      expect(d.body.drainAttempt?.succeeded).toBe(true);
      expect(d.body.drainAttempt?.txHash).toMatch(/^0x[0-9a-fA-F]{64}$/);
      const after = await evmBalance(c0.token, p.body.customer);
      expect(BigInt(after) < BigInt(TOKEN_AFTER), `customer balance after drain ${after}`).toBe(true);
      expect(d.body.customerBalance).toBe(after);
      expect(BigInt(d.body.attackerBalance) + BigInt(d.body.shopBalance) > BigInt(p.body.attackerBalance) + BigInt(p.body.shopBalance)).toBe(true);
      // isolation: the protected account is untouched by the vulnerable scenario
      expect(await evmBalance(c0.token, c0.protected.customer)).toBe(TOKEN_START);
    });
  });

  describe("11 reset restores a clean deterministic demonstration", () => {
    const normalize = (s: Awaited<ReturnType<typeof state>>) => ({
      bank: s.bank, agreements: s.agreements, labels: s.labels,
      chain: { available: s.chain.available, chainId: s.chain.chainId, token: s.chain.token, protected: s.chain.protected, vulnerable: s.chain.vulnerable },
    });
    it("bank: after settlements and rejections, reset returns to 1,000.00 / 0 / 0 with no agreements", async () => {
      const first = normalize(await state());
      expect(first.agreements).toEqual([]);
      const a = await createApproved(merchant, customer);
      await execute(merchant, a.agreement.id, attemptFor(a, { recipient: BANK.attacker }));
      await execute(merchant, a.agreement.id, attemptFor(a));
      await createAgreement(merchant);
      expect((await state()).agreements.length).toBe(2);
      const r = await reset();
      expect(r.status).toBe(200);
      expect(r.body.ok).toBe(true);
      const second = normalize(await state());
      expect(second.bank.accounts.map((x) => [x.id, x.balance])).toEqual([[BANK.customer, BANK_START], [BANK.merchant, "0"], [BANK.attacker, "0"]]);
      expect(second.agreements).toEqual([]);
      expect(second.bank).toEqual(first.bank);
      expect((await anon().get(`/api/agreements/${a.agreement.id}`)).status).toBe(404);
      // an old approval cannot be executed after reset
      const x = await execute(merchant, a.agreement.id, attemptFor(a));
      expect(x.status).toBeGreaterThanOrEqual(400);
      expect(await bankBalances()).toEqual(START);
      // the demo is repeatable after reset
      const b = await createApproved(merchant, customer);
      expect((await execute(merchant, b.agreement.id, attemptFor(b))).status).toBe(200);
      expect(await bankBalances()).toEqual(AFTER_ONE);
    });
    it("reset is idempotent: two consecutive resets give identical state", async () => {
      await reset(); const s1 = normalize(await state());
      await reset(); const s2 = normalize(await state());
      expect(s2).toEqual(s1);
    });
    it("chain: after purchase + drains, reset returns both accounts to 1,000 CSUSD and zero allowance", { timeout: 120_000 }, async () => {
      const c0 = await chainOrThrow();
      const first = normalize(await state());
      const a = await createApproved(merchant, customer, { rail: "crypto" });
      await execute(merchant, a.agreement.id, attemptFor(a));
      await operator.post("/api/lab/vulnerable-purchase");
      await operator.post("/api/lab/drain", { which: "vulnerable" });
      await operator.post("/api/lab/drain", { which: "protected" });
      const r = await reset();
      expect(r.body).toMatchObject({ ok: true, chainReset: true });
      const c1 = await chainOrThrow();
      for (const sc of [c1.protected, c1.vulnerable]) {
        expect(sc).toMatchObject({ customerBalance: TOKEN_START, allowance: "0", purchased: false, drainAttempt: null, lastPurchaseTx: null });
        expect(await evmBalance(c1.token, sc.customer)).toBe(TOKEN_START);
        expect(await evmAllowance(c1.token, sc.customer, sc.shop)).toBe("0");
      }
      expect(normalize(await state())).toEqual(first);
      void c0;
      // repeatable
      const b = await createApproved(merchant, customer, { rail: "crypto" });
      expect((await execute(merchant, b.agreement.id, attemptFor(b))).status).toBe(200);
      expect(await evmBalance(c1.token, c1.protected.customer)).toBe(TOKEN_AFTER);
    });
  });
});
