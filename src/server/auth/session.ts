// OWNER: worker C (w/bank). Signed HttpOnly session cookies (HMAC-SHA256, node:crypto).
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Caps, Role } from "../../shared/ports";
import { nowMs } from "../db";

const ROLES: Role[] = ["customer", "merchant", "operator"];
const SESSION_TTL_S = 8 * 60 * 60;
const ROLE_KEY_ENV: Record<Role, [string, string]> = {
  customer: ["CS_CUSTOMER_KEY", "demo-customer"],
  merchant: ["CS_MERCHANT_KEY", "demo-merchant"],
  operator: ["CS_OPERATOR_KEY", "demo-operator"],
};
const secret = () => process.env.CS_SESSION_SECRET || "countersign-local-demo-session-secret";

export const hmacHex = (purpose: string, data: string) =>
  createHmac("sha256", secret()).update(purpose).update("\n").update(data).digest("hex");
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function issueSession(role: Role, key: string): { cookie: string } | null {
  if (!ROLES.includes(role)) return null;
  const [envName, fallback] = ROLE_KEY_ENV[role];
  if (typeof key !== "string" || !safeEqual(hmacHex("role-key", key), hmacHex("role-key", process.env[envName] || fallback))) return null;
  const payload = Buffer.from(JSON.stringify({ r: role, exp: Math.floor(nowMs() / 1000) + SESSION_TTL_S })).toString("base64url");
  const value = `${payload}.${hmacHex("session", payload)}`;
  return { cookie: `cs_${role}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_S}` };
}

function validFor(role: Role, value: string | undefined): boolean {
  if (!value) return false;
  const dot = value.indexOf(".");
  if (dot < 1) return false;
  const payload = value.slice(0, dot), mac = value.slice(dot + 1);
  if (!safeEqual(mac, hmacHex("session", payload))) return false;
  try {
    const p = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { r?: unknown; exp?: unknown };
    return p.r === role && typeof p.exp === "number" && p.exp * 1000 > nowMs();
  } catch { return false; }
}

/** Capabilities come from cookies only; a cookie signed for one role never grants another. */
export function capsFromRequest(req: Request): Caps {
  const jar = new Map<string, string>();
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) jar.set(part.slice(0, i).trim(), part.slice(i + 1).trim());
  }
  return {
    customer: validFor("customer", jar.get("cs_customer")),
    merchant: validFor("merchant", jar.get("cs_merchant")),
    operator: validFor("operator", jar.get("cs_operator")),
  };
}
