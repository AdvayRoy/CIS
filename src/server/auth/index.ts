// OWNER: worker C (w/bank). Trusted approval service: sessions, agreements, pairing tokens, EIP-712 approval.
//
// Signing/verification design (the port is synchronous, viem's signer and verifier are async):
//  * When a pairing token is issued or checked, the isolated demo signer pre-signs the agreement's EIP-712
//    typed data with viem and the signature is verified with viem `verifyTypedData`. The result is held in
//    this module's memory only; nothing is stored or returned.
//  * `approve` (valid pairing token required) releases that verified signature into the database together
//    with the typed-data hash (`digest`) and an HMAC seal over {id, digest, signer, signature}.
//  * The bank recomputes the typed-data hash from the STORED terms inside its transaction and checks it
//    against digest + seal (`authInternals.approvalBindingOk`, synchronous). `authInternals.verifyApproval`
//    re-runs the full async viem signature verification on stored data.
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { hashTypedData, verifyTypedData, type Hex } from "viem";
import {
  BANK_ACCOUNTS, BANK_ASSET,
  type AgreementDraft, type AgreementView, type PaymentAgreement,
} from "../../shared/contract";
import type { AuthPort, Outcome } from "../../shared/ports";
import { typedDataFor } from "../../shared/typedData";
import {
  PortError, addEvent, addEvidence, getApprovalRow, getBalance, getDb, getRow, expireIfDue, listViews, loadView,
  nowMs, resetAll, setClock, setState, type ApprovalRow,
} from "../db";
import { capsFromRequest, hmacHex, issueSession, safeEqual } from "./session";
import { signerAccount } from "./signer";

const PAIRING_TTL_MS = 5 * 60 * 1000;
const sha256Hex = (s: string) => createHash("sha256").update(s).digest("hex");

type TD = Parameters<typeof hashTypedData>[0];
const digestOf = (a: PaymentAgreement): Hex => hashTypedData(typedDataFor(a) as unknown as TD);
const sealOf = (id: string, digest: string, signer: string, signature: string) =>
  hmacHex("approval-seal", [id, digest, signer.toLowerCase(), signature].join("|"));

interface Presigned { digest: Hex; signer: string; signature: Hex }
const g = globalThis as unknown as { __csPresigned?: Map<string, Presigned>; __csPresigning?: Map<string, Promise<void>> };
const presigned = (g.__csPresigned ??= new Map());
const presigning = (g.__csPresigning ??= new Map());

/** Sign + verify the stored terms with viem; result stays in memory until `approve` releases it. */
function prepareApproval(id: string): Promise<void> {
  const row = getRow(id);
  if (!row) return Promise.resolve();
  const agreement = JSON.parse(row.json) as PaymentAgreement;
  const digest = digestOf(agreement);
  if (presigned.get(id)?.digest === digest) return Promise.resolve();
  const running = presigning.get(id);
  if (running) return running;
  const p = (async () => {
    const account = signerAccount();
    const td = typedDataFor(agreement) as unknown as Parameters<typeof account.signTypedData>[0];
    const signature = await account.signTypedData(td);
    const ok = await verifyTypedData({ ...(td as object), address: account.address, signature } as Parameters<typeof verifyTypedData>[0]);
    if (ok) presigned.set(id, { digest, signer: account.address, signature });
  })().catch((e) => { console.error("[auth] presign failed", e); }).finally(() => { presigning.delete(id); });
  presigning.set(id, p);
  return p;
}

function pairingValid(id: string, token: string): boolean {
  if (!token || typeof token !== "string") return false;
  const row = getDb().prepare("SELECT agreement_id, expires_at FROM pairing_tokens WHERE token_hash = ?")
    .get(sha256Hex(token)) as { agreement_id: string; expires_at: number } | undefined;
  return !!row && safeEqual(row.agreement_id, id) && row.expires_at > nowMs();
}

const hasLivePairing = (id: string) =>
  !!getDb().prepare("SELECT 1 FROM pairing_tokens WHERE agreement_id = ? AND expires_at > ? LIMIT 1").get(id, nowMs());

function mustView(id: string): AgreementView {
  const v = loadView(id);
  if (!v) throw new PortError("NOT_FOUND", "no such agreement", 404);
  return v;
}

/** Row in a state where approve/decline is allowed, or throws. Call inside a transaction. */
function requireAwaiting(id: string, token: string) {
  if (!pairingValid(id, token)) throw new PortError("UNAUTHORIZED_CAPABILITY", "valid pairing token required", 403);
  const row = getRow(id);
  if (!row) throw new PortError("NOT_FOUND", "no such agreement", 404);
  const state = expireIfDue(row);
  if (state === "expired") return { row, expired: true as const };
  if (state === "declined") throw new PortError("DECLINED", "agreement was declined", 409);
  if (state !== "awaiting_approval") throw new PortError("REPLAYED", `agreement is already ${state}`, 409);
  return { row, expired: false as const };
}

export const auth: AuthPort = {
  capsFromRequest,
  issueSession,

  createAgreement(draft: AgreementDraft, domain) {
    const now = nowMs();
    const ttl = Math.min(900, Math.max(5, Math.floor(draft.ttlSeconds ?? 300)));
    let agreement: PaymentAgreement;
    const base = {
      id: randomUUID(),
      recipient: draft.recipient,
      recipientDisplayName: draft.recipientDisplayName,
      amount: draft.amount,
      expiry: Math.floor(now / 1000) + ttl,
      nonce: BigInt("0x" + randomBytes(16).toString("hex")).toString(10),
      createdAt: now,
    };
    if (draft.rail === "bank") {
      if (getBalance(draft.recipient) === null) throw new PortError("BAD_REQUEST", "unknown recipient bank account", 400);
      if (draft.recipient === BANK_ACCOUNTS.customer) throw new PortError("BAD_REQUEST", "recipient must differ from payer", 400);
      agreement = { ...base, payer: BANK_ACCOUNTS.customer, rail: "bank", asset: BANK_ASSET, operation: "bank.transfer", itemId: null, domain: null };
    } else {
      if (!domain) throw new PortError("RAIL_UNAVAILABLE", "local chain unavailable", 503);
      agreement = {
        ...base, payer: domain.payer, rail: "crypto", asset: domain.token, operation: "crypto.purchase",
        itemId: draft.itemId ?? null, domain: { chainId: domain.chainId, verifyingContract: domain.verifyingContract },
      };
    }
    const db = getDb();
    db.transaction(() => {
      db.prepare("INSERT INTO agreements (id, json, state, expiry, nonce, execution_count, created_at) VALUES (?, ?, 'awaiting_approval', ?, ?, 0, ?)")
        .run(agreement.id, JSON.stringify(agreement), agreement.expiry, agreement.nonce, now);
      addEvent(agreement.id, "agreement.created", null, now);
    }).immediate();
    return mustView(agreement.id);
  },

  issuePairing(id: string) {
    const view = mustView(id);
    if (view.state !== "awaiting_approval") {
      if (view.state === "expired") throw new PortError("EXPIRED", "agreement expired", 409);
      throw new PortError("REPLAYED", `agreement is already ${view.state}`, 409);
    }
    const token = randomBytes(32).toString("base64url");
    const expiresAt = nowMs() + PAIRING_TTL_MS;
    const db = getDb();
    db.transaction(() => {
      db.prepare("DELETE FROM pairing_tokens WHERE expires_at <= ?").run(nowMs());
      db.prepare("INSERT INTO pairing_tokens (token_hash, agreement_id, expires_at) VALUES (?, ?, ?)").run(sha256Hex(token), id, expiresAt);
      addEvent(id, "pairing.issued");
    }).immediate();
    void prepareApproval(id);
    return { token, expiresAt };
  },

  checkPairing(id: string, pairingToken: string) {
    const ok = pairingValid(id, pairingToken);
    if (ok && getRow(id)?.state === "awaiting_approval") void prepareApproval(id);
    return ok;
  },

  approve(id: string, pairingToken: string) {
    const db = getDb();
    const result = db.transaction((): "ok" | "expired" | "not_ready" => {
      const { row, expired } = requireAwaiting(id, pairingToken);
      if (expired) return "expired";
      const agreement = JSON.parse(row.json) as PaymentAgreement;
      const digest = digestOf(agreement);
      const pre = presigned.get(id);
      if (!pre || pre.digest !== digest) return "not_ready";
      const at = nowMs();
      db.prepare("INSERT INTO approvals (agreement_id, signer, signature, digest, seal, approved_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(id, pre.signer, pre.signature, digest, sealOf(id, digest, pre.signer, pre.signature), at);
      setState(id, "approved");
      addEvent(id, "agreement.approved", null, at);
      return "ok";
    }).immediate();
    if (result === "expired") throw new PortError("EXPIRED", "agreement expired before approval", 409);
    if (result === "not_ready") {
      void prepareApproval(id);
      throw new PortError("RAIL_UNAVAILABLE", "signer is preparing this approval; retry in a moment", 503);
    }
    presigned.delete(id);
    return mustView(id);
  },

  decline(id: string, pairingToken: string) {
    const db = getDb();
    const expired = db.transaction(() => {
      const r = requireAwaiting(id, pairingToken);
      if (r.expired) return true;
      setState(id, "declined");
      addEvent(id, "agreement.declined", "DECLINED");
      return false;
    }).immediate();
    if (expired) throw new PortError("EXPIRED", "agreement expired", 409);
    presigned.delete(id);
    return mustView(id);
  },

  get(id: string) {
    const view = loadView(id);
    // Keep the pre-signed approval warm (e.g. after a server restart) while a live pairing token exists.
    if (view?.state === "awaiting_approval" && !presigned.has(id) && hasLivePairing(id)) void prepareApproval(id);
    return view;
  },
  list: () => listViews(),

  recordOutcome(id: string, outcome: Outcome) {
    const db = getDb();
    db.transaction(() => {
      const row = getRow(id);
      if (!row) throw new PortError("NOT_FOUND", "no such agreement", 404);
      const { decision, state } = outcome;
      const at = decision.decidedAt || nowMs();
      addEvent(id, "attempt.received", null, at);
      addEvidence(id, outcome.evidence);
      const settled = decision.accepted && state === "settled";
      if (settled) {
        addEvent(id, "execution.started", null, at);
        addEvent(id, "execution.settled", null, at);
        db.prepare("UPDATE agreements SET execution_count = execution_count + 1 WHERE id = ?").run(id);
      } else if (state === "failed") {
        addEvent(id, "execution.failed", decision.reason, at);
      } else {
        addEvent(id, "attempt.rejected", decision.reason, at);
      }
      // A later rejected attempt (e.g. replay) never un-settles a settled agreement.
      if (row.state !== "settled" && row.state !== "declined") setState(id, state);
    }).immediate();
    return mustView(id);
  },

  signerAddress: () => signerAccount().address,

  reset() {
    presigned.clear();
    resetAll();
  },
};

/** Server-internal helpers for the bank simulation and tests. Not part of the HTTP surface. */
export const authInternals = {
  /** Resolves once the pre-signed approval for `id` is ready (tests / eager callers). */
  prepareApproval,
  /** Synchronous: stored terms still hash to the digest that was signed, and the seal is intact. */
  approvalBindingOk(agreement: PaymentAgreement, ap: ApprovalRow | undefined): boolean {
    if (!ap || ap.agreement_id !== agreement.id) return false;
    let digest: string;
    try { digest = digestOf(agreement); } catch { return false; }
    return safeEqual(digest, ap.digest)
      && safeEqual(ap.signer.toLowerCase(), signerAccount().address.toLowerCase())
      && safeEqual(sealOf(agreement.id, ap.digest, ap.signer, ap.signature), ap.seal);
  },
  /** Async: full viem EIP-712 signature verification of the STORED approval against the STORED terms. */
  async verifyApproval(id: string): Promise<boolean> {
    const row = getRow(id), ap = getApprovalRow(id);
    if (!row || !ap) return false;
    try {
      const td = typedDataFor(JSON.parse(row.json) as PaymentAgreement);
      return await verifyTypedData({ ...(td as object), address: signerAccount().address, signature: ap.signature as Hex } as Parameters<typeof verifyTypedData>[0]);
    } catch { return false; }
  },
  setClock,
};
