// OWNER: worker C (w/bank). SQLite storage shared by the auth service and the bank simulation.
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  BANK_ACCOUNTS, BANK_ASSET,
  type AgreementEvent, type AgreementState, type AgreementView, type Approval,
  type ExecutionEvidence, type PaymentAgreement, type Reason,
} from "../../shared/contract";

export type Db = Database.Database;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS agreements (
  id TEXT PRIMARY KEY,
  json TEXT NOT NULL,
  state TEXT NOT NULL,
  expiry INTEGER NOT NULL,
  nonce TEXT NOT NULL UNIQUE,
  execution_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS approvals (
  agreement_id TEXT PRIMARY KEY REFERENCES agreements(id),
  signer TEXT NOT NULL,
  signature TEXT NOT NULL,
  digest TEXT NOT NULL,
  seal TEXT NOT NULL,
  approved_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  agreement_id TEXT NOT NULL,
  type TEXT NOT NULL,
  at INTEGER NOT NULL,
  reason TEXT
);
CREATE INDEX IF NOT EXISTS events_by_agreement ON events(agreement_id, seq);
CREATE TABLE IF NOT EXISTS evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agreement_id TEXT NOT NULL,
  json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS evidence_by_agreement ON evidence(agreement_id, id);
CREATE TABLE IF NOT EXISTS bank_accounts (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  balance TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ledger_transfers (
  id TEXT PRIMARY KEY,
  agreement_id TEXT NOT NULL UNIQUE,
  debit_account TEXT NOT NULL,
  credit_account TEXT NOT NULL,
  amount TEXT NOT NULL,
  posted_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS consumed_nonces (
  nonce TEXT PRIMARY KEY,
  agreement_id TEXT NOT NULL,
  consumed_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS pairing_tokens (
  token_hash TEXT PRIMARY KEY,
  agreement_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
`;

export const SEED_ACCOUNTS = [
  { id: BANK_ACCOUNTS.customer, displayName: "Customer current account", balance: "100000" },
  { id: BANK_ACCOUNTS.merchant, displayName: "Merchant settlement account", balance: "0" },
  { id: BANK_ACCOUNTS.attacker, displayName: "Unrecognised account", balance: "0" },
] as const;

type Holder = { db: Db; path: string } | undefined;
const g = globalThis as unknown as { __csDb?: Holder; __csNow?: () => number };

/** Unix ms. Tests may override through setClock. */
export const nowMs = (): number => (g.__csNow ? g.__csNow() : Date.now());
export const setClock = (fn: (() => number) | null) => { g.__csNow = fn ?? undefined; };

function seedAccounts(db: Db) {
  const ins = db.prepare("INSERT OR IGNORE INTO bank_accounts (id, display_name, balance) VALUES (?, ?, ?)");
  for (const a of SEED_ACCOUNTS) ins.run(a.id, a.displayName, a.balance);
}

/** Single module-level connection; kept on globalThis so Next.js dev reloads reuse it. */
export function getDb(): Db {
  const path = process.env.CS_DB_PATH || "./data/countersign.db";
  const full = path === ":memory:" ? path : resolve(path);
  if (g.__csDb && g.__csDb.path === full && g.__csDb.db.open) return g.__csDb.db;
  if (g.__csDb?.db.open) g.__csDb.db.close();
  if (full !== ":memory:") mkdirSync(dirname(full), { recursive: true });
  const db = new Database(full);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  seedAccounts(db);
  g.__csDb = { db, path: full };
  return db;
}

/** Delete every row and reseed the fixed scenario accounts. */
export function resetAll(): void {
  const db = getDb();
  db.transaction(() => {
    for (const t of ["approvals", "pairing_tokens", "consumed_nonces", "ledger_transfers", "evidence", "events", "agreements", "bank_accounts"])
      db.prepare(`DELETE FROM ${t}`).run();
    db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('events','evidence')").run();
    seedAccounts(db);
  }).immediate();
}

export interface AgreementRow {
  id: string; json: string; state: AgreementState; expiry: number; nonce: string; execution_count: number; created_at: number;
}
export interface ApprovalRow {
  agreement_id: string; signer: string; signature: string; digest: string; seal: string; approved_at: number;
}

export const getRow = (id: string) =>
  getDb().prepare("SELECT * FROM agreements WHERE id = ?").get(id) as AgreementRow | undefined;
export const getApprovalRow = (id: string) =>
  getDb().prepare("SELECT * FROM approvals WHERE agreement_id = ?").get(id) as ApprovalRow | undefined;

export function addEvent(agreementId: string, type: AgreementEvent["type"], reason: Reason | null = null, at = nowMs()) {
  getDb().prepare("INSERT INTO events (agreement_id, type, at, reason) VALUES (?, ?, ?, ?)").run(agreementId, type, at, reason);
}
export function setState(id: string, state: AgreementState) {
  getDb().prepare("UPDATE agreements SET state = ? WHERE id = ?").run(state, id);
}
export function addEvidence(agreementId: string, ev: ExecutionEvidence): number {
  return Number(getDb().prepare("INSERT INTO evidence (agreement_id, json) VALUES (?, ?)").run(agreementId, JSON.stringify(ev)).lastInsertRowid);
}
export function updateEvidence(rowId: number, ev: ExecutionEvidence) {
  getDb().prepare("UPDATE evidence SET json = ? WHERE id = ?").run(JSON.stringify(ev), rowId);
}

const EXPIRABLE: AgreementState[] = ["awaiting_approval", "approved", "rejected"];
/** Flip an unexecuted agreement past its expiry to `expired` (with event). Returns the current state. */
export function expireIfDue(row: AgreementRow): AgreementState {
  if (EXPIRABLE.includes(row.state) && nowMs() >= row.expiry * 1000) {
    const changed = getDb().prepare(
      `UPDATE agreements SET state = 'expired' WHERE id = ? AND state IN ('awaiting_approval','approved','rejected')`,
    ).run(row.id).changes;
    if (changed) addEvent(row.id, "agreement.expired", "EXPIRED");
    return "expired";
  }
  return row.state;
}

export function loadView(id: string): AgreementView | null {
  const db = getDb();
  const row = getRow(id);
  if (!row) return null;
  const state = expireIfDue(row);
  const ap = getApprovalRow(id);
  const approval: Approval | null = ap ? { signer: ap.signer, signature: ap.signature, approvedAt: ap.approved_at } : null;
  const events = (db.prepare("SELECT seq, agreement_id, type, at, reason FROM events WHERE agreement_id = ? ORDER BY seq").all(id) as
    { seq: number; agreement_id: string; type: AgreementEvent["type"]; at: number; reason: Reason | null }[])
    .map((e) => ({ seq: e.seq, agreementId: e.agreement_id, type: e.type, at: e.at, reason: e.reason }));
  const evidence = (db.prepare("SELECT json FROM evidence WHERE agreement_id = ? ORDER BY id").all(id) as { json: string }[])
    .map((r) => JSON.parse(r.json) as ExecutionEvidence);
  return {
    agreement: JSON.parse(row.json) as PaymentAgreement,
    state, approval, events, evidence, executionCount: row.execution_count,
  };
}

export function listViews(): AgreementView[] {
  const ids = getDb().prepare("SELECT id FROM agreements ORDER BY created_at, rowid").all() as { id: string }[];
  return ids.map((r) => loadView(r.id)).filter((v): v is AgreementView => v !== null);
}

export function listAccounts() {
  return (getDb().prepare("SELECT id, display_name, balance FROM bank_accounts ORDER BY rowid").all() as
    { id: string; display_name: string; balance: string }[])
    .map((a) => ({ id: a.id, displayName: a.display_name, balance: a.balance, asset: BANK_ASSET }));
}
export const getBalance = (id: string): string | null =>
  (getDb().prepare("SELECT balance FROM bank_accounts WHERE id = ?").get(id) as { balance: string } | undefined)?.balance ?? null;

/** Port errors understood by the lead's `handle()` helper ({code, status}). */
export class PortError extends Error {
  constructor(public code: Reason | "BAD_REQUEST", message: string, public status: number) { super(message); }
}
