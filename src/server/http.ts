// Lead-owned HTTP helpers for API routes.
import type { Reason } from "@/shared/contract";
import type { Role } from "@/shared/ports";
import { auth } from "@/server/auth";

const NO_STORE = { "cache-control": "no-store" };
export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body, (_k, v) => (typeof v === "bigint" ? v.toString() : v)), {
    status, headers: { "content-type": "application/json", ...NO_STORE, ...headers },
  });
export const fail = (code: Reason | "BAD_REQUEST", message: string, status: number) =>
  json({ error: { code, message } }, status);

export class HttpError extends Error {
  constructor(public code: Reason | "BAD_REQUEST", message: string, public status: number) { super(message); }
}
export function requireRole(req: Request, role: Role) {
  if (!auth.capsFromRequest(req)[role])
    throw new HttpError("UNAUTHORIZED_CAPABILITY", `requires ${role} capability`, 403);
}
export async function handle(fn: () => Promise<Response> | Response): Promise<Response> {
  try { return await fn(); } catch (e) {
    if (e instanceof HttpError) return fail(e.code, e.message, e.status);
    const anyE = e as { name?: string; issues?: unknown; code?: string; status?: number; message?: string };
    if (anyE?.name === "ZodError") return fail("BAD_REQUEST", JSON.stringify(anyE.issues), 400);
    // Ports may throw { code: Reason, status } shaped errors.
    if (anyE?.code && anyE?.status) return fail(anyE.code as Reason, anyE.message ?? "", anyE.status);
    console.error("[api]", e);
    return fail("BAD_REQUEST", anyE?.message ?? "internal error", 500);
  }
}
export const readJson = async (req: Request) => { try { return await req.json(); } catch { return {}; } };
