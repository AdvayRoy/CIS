// Lead-owned typed client for UI workers. Always no-store; never cached by a service worker.
import type { AgreementDraft, AgreementView, Overview, PaymentAttempt, TokenScenario, Decision, ExecutionEvidence, AgreementState } from "@/shared/contract";

export class ApiFailure extends Error {
  constructor(public code: string, message: string, public status: number, public body?: unknown) { super(message); }
}
async function call<T>(path: string, init?: RequestInit & { okStatuses?: number[] }): Promise<T> {
  let res: Response;
  try { res = await fetch(path, { cache: "no-store", credentials: "same-origin", ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) } }); }
  catch { throw new ApiFailure("DISCONNECTED", "network unreachable", 0); }
  const body = await res.json().catch(() => null);
  if (!res.ok && !(init?.okStatuses ?? []).includes(res.status))
    throw new ApiFailure(body?.error?.code ?? "BAD_REQUEST", body?.error?.message ?? res.statusText, res.status, body);
  return body as T;
}
export type ExecuteResult = { decision: Decision; evidence: ExecutionEvidence; state: AgreementState; view: AgreementView };
export const api = {
  state: () => call<Overview>("/api/state"),
  caps: () => call<{ caps: { customer: boolean; merchant: boolean; operator: boolean } }>("/api/session"),
  signIn: (role: "customer" | "merchant" | "operator", key: string) =>
    call<{ ok: true }>("/api/session", { method: "POST", body: JSON.stringify({ role, key }) }),
  agreement: (id: string) => call<AgreementView>(`/api/agreements/${id}`),
  createAgreement: (d: AgreementDraft) => call<AgreementView>("/api/agreements", { method: "POST", body: JSON.stringify(d) }),
  pairing: (id: string) => call<{ token: string; expiresAt: number; approvePath: string }>(`/api/agreements/${id}/pairing`, { method: "POST" }),
  checkPairing: (id: string, token: string) => call<{ valid: boolean }>(`/api/agreements/${id}/pairing/check`, { headers: { "x-cs-pairing": token } }),
  approve: (id: string, token: string) => call<AgreementView>(`/api/agreements/${id}/approve`, { method: "POST", headers: { "x-cs-pairing": token } }),
  decline: (id: string, token: string) => call<AgreementView>(`/api/agreements/${id}/decline`, { method: "POST", headers: { "x-cs-pairing": token } }),
  /** 409 = rejected by the rail; body still carries decision + evidence. */
  execute: (id: string, a: Omit<PaymentAttempt, "agreementId">) =>
    call<ExecuteResult>(`/api/agreements/${id}/execute`, { method: "POST", body: JSON.stringify(a), okStatuses: [409] }),
  labReset: () => call<{ ok: true; chainReset: boolean }>("/api/lab/reset", { method: "POST" }),
  labVulnerablePurchase: () => call<TokenScenario>("/api/lab/vulnerable-purchase", { method: "POST" }),
  labDrain: (which: "protected" | "vulnerable") => call<TokenScenario>("/api/lab/drain", { method: "POST", body: JSON.stringify({ which }) }),
};
