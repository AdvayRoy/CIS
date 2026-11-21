// Integration test for the crypto rail: spawns a private Anvil, deploys, and drives ChainPort.
// Requires Foundry's `anvil` (PATH or ~/.foundry/bin). Skipped with a warning when it is missing.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { privateKeyToAccount } from "viem/accounts";
import type { AgreementView, PaymentAgreement, PaymentAttempt } from "../../src/shared/contract";
import type { ChainPort } from "../../src/shared/ports";
import { cryptoTypedData } from "../../src/shared/typedData";

const E18 = BigInt("1000000000000000000");
const units = (n: number) => (BigInt(n) * E18).toString();
// Anvil account #1: public test key, local chain only. Plays the trusted demo customer signer.
const signer = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
const stranger = privateKeyToAccount("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a");

function findAnvil(): string | null {
  const local = join(homedir(), ".foundry", "bin", "anvil");
  if (existsSync(local)) return local;
  return spawnSync("anvil", ["--version"]).status === 0 ? "anvil" : null;
}
const anvilBin = findAnvil();
if (!anvilBin) console.warn("[tests/chain] anvil not found; crypto integration tests SKIPPED (not verified)");

const port = 18545 + Math.floor(Math.random() * 2000);
const rpc = `http://127.0.0.1:${port}`;
let anvil: ChildProcess | undefined;
let dir = "";
let chain: ChainPort;
let bind: NonNullable<Awaited<ReturnType<ChainPort["binding"]>>>;

async function waitForRpc() {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(rpc, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
      });
      if (r.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("anvil did not start");
}

async function approved(over: Partial<PaymentAgreement> = {}, by = signer): Promise<AgreementView> {
  const agreement: PaymentAgreement = {
    id: randomUUID(), payer: bind.payer, recipient: bind.shop, recipientDisplayName: "Demo Shop",
    rail: "crypto", asset: bind.token, amount: units(100), operation: "crypto.purchase", itemId: "42",
    expiry: Math.floor(Date.now() / 1000) + 600, nonce: String(Math.floor(Math.random() * 1e15)),
    domain: { chainId: bind.chainId, verifyingContract: bind.verifyingContract }, createdAt: Date.now(),
    ...over,
  };
  const signature = await by.signTypedData(cryptoTypedData(agreement));
  return {
    agreement, state: "approved", approval: { signer: by.address, signature, approvedAt: Date.now() },
    events: [], evidence: [], executionCount: 0,
  };
}
const attemptFor = (v: AgreementView, over: Partial<PaymentAttempt> = {}): PaymentAttempt => ({
  agreementId: v.agreement.id, recipient: v.agreement.recipient, amount: v.agreement.amount,
  operation: "crypto.purchase", continuingAllowance: "0", ...over,
});

describe.skipIf(!anvilBin)("crypto rail (Anvil + ChainPort)", () => {
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "cs-chain-"));
    process.env.ANVIL_RPC_URL = rpc;
    process.env.CS_CHAIN_DEPLOYMENT = join(dir, "deployment.json");
    delete process.env.CS_EXECUTOR_PRIVATE_KEY;
    delete process.env.CS_SIGNER_PRIVATE_KEY;
    chain = (await import("../../src/server/chain/index")).chain;

    // before anvil is up: never throws, reports unavailable
    expect(await chain.status()).toEqual({ available: false, chainId: null, blockNumber: null });
    expect(await chain.binding()).toBeNull();

    anvil = spawn(anvilBin!, ["--port", String(port), "--silent"], { stdio: "ignore" });
    await waitForRpc();
    expect((await chain.status()).available).toBe(false); // node up, nothing deployed
    const { deployAll } = await import("../../src/server/chain/deploy");
    await deployAll();
    bind = (await chain.binding())!;
  }, 60_000);

  afterAll(() => {
    anvil?.kill("SIGKILL");
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("starts from 1,000 tokens each and zero allowance", async () => {
    const st = await chain.status();
    expect(st.available).toBe(true);
    expect(st.chainId).toBe(31337);
    expect(bind.verifyingContract).toBe(bind.payer);
    const s = await chain.scenarios();
    for (const x of [s.protected!, s.vulnerable!]) {
      expect(x.customerBalance).toBe(units(1000));
      expect(x.allowance).toBe("0");
      expect(x.purchased).toBe(false);
      expect(x.lastPurchaseTx).toBeNull();
      expect(x.drainAttempt).toBeNull();
    }
  });

  it("rejects mutated attempts on-chain with real reverted receipts and no token movement", async () => {
    const v = await approved();
    const cases: Array<[Partial<PaymentAttempt>, string, string]> = [
      [{ recipient: "0x000000000000000000000000000000000000dEaD" }, "RECIPIENT_MISMATCH", "ShopMismatch"],
      [{ amount: units(1000) }, "AMOUNT_EXCEEDS_LIMIT", "AmountExceedsLimit"],
    ];
    for (const [over, reason, err] of cases) {
      const o = await chain.executeProtected(v, attemptFor(v, over));
      expect(o.decision.accepted).toBe(false);
      expect(o.decision.reason).toBe(reason);
      expect(o.decision.diffs.length).toBeGreaterThan(0);
      expect(o.state).toBe("rejected");
      expect(o.evidence.receipt).toMatchObject({ kind: "chain", status: "reverted", revertReason: err });
      expect(o.evidence.observed).toMatchObject({ payerBalance: units(1000), allowance: "0", executionCount: 0 });
    }
    // not expressible through the adapter: refused without a transaction
    const c = await chain.executeProtected(v, attemptFor(v, { continuingAllowance: units(1000) }));
    expect(c.decision.reason).toBe("CONTINUING_PERMISSION_NOT_ALLOWED");
    expect(c.evidence.receipt).toBeNull();
    const op = await chain.executeProtected(v, attemptFor(v, { operation: "crypto.approve" }));
    expect(op.decision.reason).toBe("OPERATION_NOT_ALLOWED");

    // signature by someone who is not the account owner
    const forged = await approved({}, stranger);
    const f = await chain.executeProtected(forged, attemptFor(forged));
    expect(f.decision.reason).toBe("INVALID_SIGNATURE");
    expect(f.evidence.receipt).toMatchObject({ status: "reverted", revertReason: "InvalidSignature" });

    // facts rewritten after approval (higher limit) no longer match the signature
    const rewritten = { ...v, agreement: { ...v.agreement, amount: units(1000) } };
    const r = await chain.executeProtected(rewritten, attemptFor(rewritten));
    expect(r.decision.reason).toBe("INVALID_SIGNATURE");

    // signed for another chain id
    const wrongDomain = await approved({ domain: { chainId: 1, verifyingContract: bind.verifyingContract } });
    const w = await chain.executeProtected(wrongDomain, attemptFor(wrongDomain));
    expect(w.decision.reason).toBe("DOMAIN_MISMATCH");
    expect(w.evidence.receipt).toMatchObject({ status: "reverted", revertReason: "InvalidSignature" });

    // expired
    const old = await approved({ expiry: Math.floor(Date.now() / 1000) - 60 });
    const e = await chain.executeProtected(old, attemptFor(old));
    expect(e.decision.reason).toBe("EXPIRED");
    expect(e.evidence.receipt).toMatchObject({ status: "reverted", revertReason: "Expired" });

    // not approved: nothing is sent
    const unsigned: AgreementView = { ...v, approval: null, state: "awaiting_approval" };
    const n = await chain.executeProtected(unsigned, attemptFor(unsigned));
    expect(n.decision.reason).toBe("NOT_APPROVED");
    expect(n.evidence.receipt).toBeNull();

    const s = (await chain.scenarios()).protected!;
    expect(s.customerBalance).toBe(units(1000));
    expect(s.allowance).toBe("0");
    expect(s.purchased).toBe(false);
  });

  it("protected purchase: 900 left, allowance 0, replay refused, later drain reverts", async () => {
    const v = await approved();
    const o = await chain.executeProtected(v, attemptFor(v));
    expect(o.decision).toMatchObject({ accepted: true, reason: "OK", diffs: [] });
    expect(o.state).toBe("settled");
    expect(o.evidence.receipt).toMatchObject({ kind: "chain", status: "success", revertReason: null, chainId: 31337 });
    expect(o.evidence.observed).toMatchObject({
      payerBalance: units(900), recipientBalance: units(100), allowance: "0", executionCount: 1,
    });

    const replay = await chain.executeProtected(v, attemptFor(v));
    expect(replay.decision).toMatchObject({ accepted: false, reason: "REPLAYED" });
    expect(replay.evidence.receipt).toMatchObject({ status: "reverted", revertReason: "NonceUsed" });
    expect(replay.evidence.observed).toMatchObject({ payerBalance: units(900), executionCount: 1 });

    const [a, b] = await Promise.all([approved(), approved()]);
    void b;
    const twice = await Promise.all([chain.executeProtected(a, attemptFor(a)), chain.executeProtected(a, attemptFor(a))]);
    expect(twice.filter((x) => x.decision.accepted).length).toBe(1); // concurrent duplicate: one debit
    expect((await chain.scenarios()).protected!.customerBalance).toBe(units(800));

    const drained = await chain.attemptDrain("protected");
    expect(drained.drainAttempt).toMatchObject({
      succeeded: false, revertReason: "ERC20InsufficientAllowance", amountRequested: units(800),
    });
    expect(drained.drainAttempt!.txHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(drained.customerBalance).toBe(units(800));
    expect(drained.attackerBalance).toBe("0");
    expect(drained.allowance).toBe("0");
    expect(drained.purchased).toBe(true);
    expect(drained.lastPurchaseTx).toBe(twice.find((x) => x.decision.accepted)!.evidence.receipt!.kind === "chain"
      ? (twice.find((x) => x.decision.accepted)!.evidence.receipt as { txHash: string }).txHash : null);
  });

  it("vulnerable comparison: unlimited allowance stays and the same drain succeeds", async () => {
    const bought = await chain.runVulnerablePurchase();
    expect(bought.customerBalance).toBe(units(900));
    expect(BigInt(bought.allowance) > BigInt(units(1000))).toBe(true);
    expect(bought.purchased).toBe(true);
    expect(bought.lastPurchaseTx).toMatch(/^0x[0-9a-f]{64}$/);

    const drained = await chain.attemptDrain("vulnerable");
    expect(drained.drainAttempt).toMatchObject({ succeeded: true, revertReason: null, amountRequested: units(900) });
    expect(drained.customerBalance).toBe("0");
    expect(drained.attackerBalance).toBe(units(900));
  });

  it("reset restores the deterministic state and the rail still works", async () => {
    await chain.reset();
    let s = await chain.scenarios();
    for (const x of [s.protected!, s.vulnerable!]) {
      expect(x).toMatchObject({
        customerBalance: units(1000), shopBalance: "0", attackerBalance: "0", allowance: "0",
        purchased: false, lastPurchaseTx: null, drainAttempt: null,
      });
    }
    const v = await approved();
    const o = await chain.executeProtected(v, attemptFor(v));
    expect(o.decision.accepted).toBe(true);
    await chain.reset(); // second reset uses the re-taken snapshot
    s = await chain.scenarios();
    expect(s.protected!.customerBalance).toBe(units(1000));
    expect(s.protected!.purchased).toBe(false);
  });
});
