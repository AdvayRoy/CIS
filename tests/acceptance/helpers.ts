/**
 * Independent acceptance harness (worker E). HTTP-level only: it talks to the
 * integrated app at BASE_URL exactly like a browser would, with real signed
 * cookies from POST /api/session and the pairing flow. It imports nothing from
 * src/server so it cannot share bugs with the implementation.
 */
import { createPublicClient, http, erc20Abi, type Address } from "viem";
import type { AgreementView, Overview, TokenScenario, Decision, ExecutionEvidence } from "../../src/shared/contract";

// vitest itself sets process.env.BASE_URL to "/" (vite base); only accept absolute URLs. CS_BASE_URL wins if set.
const rawBase = [process.env.CS_BASE_URL, process.env.BASE_URL].find((u) => !!u && /^https?:\/\//.test(u));
export const BASE_URL = (rawBase ?? "http://localhost:3000").replace(/\/$/, "");
export const ANVIL_RPC_URL = process.env.ANVIL_RPC_URL ?? "http://127.0.0.1:8545";
export const KEYS = {
  customer: process.env.CS_CUSTOMER_KEY ?? "demo-customer",
  merchant: process.env.CS_MERCHANT_KEY ?? "demo-merchant",
  operator: process.env.CS_OPERATOR_KEY ?? "demo-operator",
} as const;
export type Role = keyof typeof KEYS;

export const BANK = { customer: "ACC-CUSTOMER-001", merchant: "ACC-MERCHANT-001", attacker: "ACC-UNKNOWN-777" } as const;
export const BANK_START = "100000";
export const BANK_PRICE = "10000";
export const E18 = "000000000000000000";
export const TOKEN_START = "1000" + E18;
export const TOKEN_PRICE = "100" + E18;
export const TOKEN_AFTER = "900" + E18;

export interface Res<T = unknown> { status: number; body: T; headers: Headers }
export interface ExecBody { decision: Decision; evidence: ExecutionEvidence; state: string; view: AgreementView; error?: { code: string; message: string } }

/** A cookie-jar HTTP client: one instance == one browser context. */
export class Client {
  private jar = new Map<string, string>();
  constructor(public label = "anon") {}
  cookieNames() { return [...this.jar.keys()]; }
  setRawCookie(name: string, value: string) { this.jar.set(name, value); }
  async req<T = unknown>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<Res<T>> {
    const h: Record<string, string> = { "content-type": "application/json", ...headers };
    if (this.jar.size) h.cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await fetch(BASE_URL + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store" });
    for (const sc of res.headers.getSetCookie?.() ?? []) {
      const [pair] = sc.split(";"); const i = pair.indexOf("=");
      if (i > 0) this.jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
    const text = await res.text();
    let parsed: unknown = null; try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
    return { status: res.status, body: parsed as T, headers: res.headers };
  }
  get<T = unknown>(path: string, headers?: Record<string, string>) { return this.req<T>("GET", path, undefined, headers); }
  post<T = unknown>(path: string, body?: unknown, headers?: Record<string, string>) { return this.req<T>("POST", path, body, headers); }
  async signIn(role: Role, key: string = KEYS[role]) { return this.post<{ ok: boolean }>("/api/session", { role, key }); }
}

export async function signedIn(...roles: Role[]): Promise<Client> {
  const c = new Client(roles.join("+"));
  for (const r of roles) {
    const res = await c.signIn(r);
    if (res.status !== 200) throw new Error(`sign-in as ${r} failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return c;
}

export const anon = () => new Client("anon");
export async function state(): Promise<Overview> {
  const r = await anon().get<Overview>("/api/state");
  if (r.status !== 200) throw new Error(`/api/state ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
}
export async function bankBalances() {
  const s = await state();
  const of = (id: string) => { const a = s.bank.accounts.find((x) => x.id === id); if (!a) throw new Error(`account ${id} missing from /api/state`); return a.balance; };
  return { customer: of(BANK.customer), merchant: of(BANK.merchant), attacker: of(BANK.attacker) };
}
export async function view(id: string): Promise<AgreementView> {
  const r = await anon().get<AgreementView>(`/api/agreements/${id}`);
  if (r.status !== 200) throw new Error(`GET agreement ${id}: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
}
export async function reset(): Promise<Res<{ ok: boolean; chainReset: boolean }>> {
  const op = await signedIn("operator");
  return op.post("/api/lab/reset");
}

export interface DraftOpts { rail?: "bank" | "crypto"; recipient?: string; amount?: string; ttlSeconds?: number; itemId?: string | null; recipientDisplayName?: string }
export async function createAgreement(merchant: Client, o: DraftOpts = {}): Promise<AgreementView> {
  const rail = o.rail ?? "bank";
  let recipient = o.recipient;
  if (!recipient) {
    if (rail === "bank") recipient = BANK.merchant;
    else {
      const s = await state();
      if (!s.chain.available || !s.chain.protected) throw new Error("crypto rail unavailable: /api/state chain.available=false or chain.protected=null");
      recipient = s.chain.protected.shop;
    }
  }
  const draft = {
    rail, recipient, recipientDisplayName: o.recipientDisplayName ?? "Acceptance Shop",
    amount: o.amount ?? (rail === "bank" ? BANK_PRICE : TOKEN_PRICE),
    itemId: o.itemId === undefined ? (rail === "crypto" ? "1" : null) : o.itemId,
    ...(o.ttlSeconds ? { ttlSeconds: o.ttlSeconds } : {}),
  };
  const r = await merchant.post<AgreementView>("/api/agreements", draft);
  if (r.status !== 201) throw new Error(`create agreement: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
}
export async function pair(customer: Client, id: string): Promise<string> {
  const r = await customer.post<{ token: string; expiresAt: number; approvePath: string }>(`/api/agreements/${id}/pairing`);
  if (r.status !== 200 && r.status !== 201) throw new Error(`pairing: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.token;
}
/** Approve from a context that holds ONLY the pairing token (no cookies), like the phone. */
export async function approveWithToken(id: string, token: string) {
  return anon().post<AgreementView>(`/api/agreements/${id}/approve`, undefined, { "x-cs-pairing": token });
}
export async function createApproved(merchant: Client, customer: Client, o: DraftOpts = {}): Promise<AgreementView> {
  const v = await createAgreement(merchant, o);
  const token = await pair(customer, v.agreement.id);
  const r = await approveWithToken(v.agreement.id, token);
  if (r.status !== 200) throw new Error(`approve: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
}
export function attemptFor(v: AgreementView, over: Partial<{ recipient: string; amount: string; operation: string; continuingAllowance: string }> = {}) {
  return { recipient: v.agreement.recipient, amount: v.agreement.amount, operation: v.agreement.operation, continuingAllowance: "0", ...over };
}
export async function execute(merchant: Client, id: string, attempt: unknown) {
  return merchant.post<ExecBody>(`/api/agreements/${id}/execute`, attempt);
}

/** Independent EVM reads (not through the app). */
export function evm() { return createPublicClient({ transport: http(ANVIL_RPC_URL) }); }
export async function evmBalance(token: string, who: string): Promise<string> {
  return (await evm().readContract({ address: token as Address, abi: erc20Abi, functionName: "balanceOf", args: [who as Address] })).toString();
}
export async function evmAllowance(token: string, owner: string, spender: string): Promise<string> {
  return (await evm().readContract({ address: token as Address, abi: erc20Abi, functionName: "allowance", args: [owner as Address, spender as Address] })).toString();
}
export async function chainOrThrow(): Promise<{ token: string; protected: TokenScenario; vulnerable: TokenScenario }> {
  const s = await state();
  if (!s.chain.available || !s.chain.token?.address || !s.chain.protected || !s.chain.vulnerable)
    throw new Error(`crypto rail unavailable: ${JSON.stringify({ available: s.chain.available, token: s.chain.token, protected: !!s.chain.protected, vulnerable: !!s.chain.vulnerable })}`);
  return { token: s.chain.token.address, protected: s.chain.protected, vulnerable: s.chain.vulnerable };
}
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export async function serverReachable(): Promise<boolean> {
  try { const r = await fetch(BASE_URL + "/api/health", { cache: "no-store" }); return r.status === 200; } catch { return false; }
}
