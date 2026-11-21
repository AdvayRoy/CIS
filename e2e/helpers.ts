import { expect, request, type APIRequestContext, type Browser, type BrowserContext, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import type { AgreementView, Overview } from "../src/shared/contract";

export const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const KEYS = {
  customer: process.env.CS_CUSTOMER_KEY ?? "demo-customer",
  merchant: process.env.CS_MERCHANT_KEY ?? "demo-merchant",
  operator: process.env.CS_OPERATOR_KEY ?? "demo-operator",
} as const;
export type Role = keyof typeof KEYS;
export const SHOTS = path.join(__dirname, "..", "docs-verify", "screenshots");
fs.mkdirSync(SHOTS, { recursive: true });

export const DESKTOPS = [{ name: "1440x900", width: 1440, height: 900 }, { name: "1280x800", width: 1280, height: 800 }];
export const PHONES = [{ name: "390x844", width: 390, height: 844 }, { name: "375x667", width: 375, height: 667 }];

/** Words that claim successful settlement to the person. common.json: state.settled = "Completed". */
export const SUCCESS_RE = /\b(completed|settled|payment complete|paid|payment successful|success(ful)?)\b/i;
export const DISCONNECTED_RE = /disconnected|offline|reconnecting|connection lost|no connection/i;

export async function api(...roles: Role[]): Promise<APIRequestContext> {
  const ctx = await request.newContext({ baseURL: BASE_URL });
  for (const role of roles) {
    const r = await ctx.post("/api/session", { data: { role, key: KEYS[role] } });
    expect(r.status(), `sign-in ${role}`).toBe(200);
  }
  return ctx;
}
export async function resetAll() {
  const op = await api("operator");
  const r = await op.post("/api/lab/reset");
  expect(r.status(), "reset").toBe(200);
  await op.dispose();
}
export async function getState(): Promise<Overview> {
  const a = await request.newContext({ baseURL: BASE_URL });
  const s = (await (await a.get("/api/state")).json()) as Overview; await a.dispose(); return s;
}
export async function getView(id: string): Promise<AgreementView> {
  const a = await request.newContext({ baseURL: BASE_URL });
  const s = (await (await a.get(`/api/agreements/${id}`)).json()) as AgreementView; await a.dispose(); return s;
}
export async function createAgreement(rail: "bank" | "crypto" = "bank", extra: Record<string, unknown> = {}): Promise<AgreementView> {
  const m = await api("merchant");
  let draft: Record<string, unknown>;
  if (rail === "bank") draft = { rail, recipient: "ACC-MERCHANT-001", recipientDisplayName: "Acceptance Shop", amount: "10000", ...extra };
  else {
    const s = await getState();
    if (!s.chain.available || !s.chain.protected) throw new Error("crypto rail unavailable");
    draft = { rail, recipient: s.chain.protected.shop, recipientDisplayName: "Acceptance Shop", amount: "100000000000000000000", itemId: "1", ...extra };
  }
  const r = await m.post("/api/agreements", { data: draft });
  expect(r.status(), `create agreement: ${await r.text()}`).toBe(201);
  const v = (await r.json()) as AgreementView; await m.dispose(); return v;
}
export async function pairing(id: string): Promise<{ token: string; approvePath: string }> {
  const c = await api("customer");
  const r = await c.post(`/api/agreements/${id}/pairing`);
  expect(r.ok(), `pairing: ${await r.text()}`).toBe(true);
  const b = await r.json(); await c.dispose(); return b;
}
export async function executeApi(v: AgreementView, over: Record<string, string> = {}) {
  const m = await api("merchant");
  const r = await m.post(`/api/agreements/${v.agreement.id}/execute`, {
    data: { recipient: v.agreement.recipient, amount: v.agreement.amount, operation: v.agreement.operation, continuingAllowance: "0", ...over },
  });
  const out = { status: r.status(), body: await r.json() }; await m.dispose(); return out;
}

export interface Watched { page: Page; errors: string[]; context: BrowserContext }
function watch(page: Page, context: BrowserContext): Watched {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console.error: ${m.text()}`); });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return { page, errors, context };
}
/** Desktop context: the operator's Mac browser, signed in with the demo role keys. */
export async function desktop(browser: Browser, size: { width: number; height: number }): Promise<Watched> {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: size });
  for (const role of ["customer", "merchant", "operator"] as const)
    expect((await context.request.post("/api/session", { data: { role, key: KEYS[role] } })).status()).toBe(200);
  return watch(await context.newPage(), context);
}
/** Phone context: a SEPARATE browser context with no cookies; only the pairing link. */
export async function phone(browser: Browser, size: { width: number; height: number }): Promise<Watched> {
  const context = await browser.newContext({
    baseURL: BASE_URL, viewport: size, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  });
  return watch(await context.newPage(), context);
}
export async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false });
}
export async function bodyText(page: Page): Promise<string> {
  return (await page.locator("body").innerText()).replace(/\u00a0/g, " ");
}
export async function expectNoHorizontalOverflow(page: Page, label: string) {
  const m = await page.evaluate(() => {
    const de = document.documentElement; const vw = window.innerWidth;
    const offenders: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && (r.right > vw + 1 || r.left < -1)) {
        const cs = getComputedStyle(el);
        if (cs.position === "fixed" || cs.visibility === "hidden") continue;
        // clipped by a scrolling/hidden ancestor is not page overflow
        let p = el.parentElement, clipped = false;
        while (p && p !== document.body) { const o = getComputedStyle(p).overflowX; if (o !== "visible") { clipped = true; break; } p = p.parentElement; }
        if (!clipped) offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} [${Math.round(r.left)},${Math.round(r.right)}]`);
      }
    }
    return { scrollWidth: de.scrollWidth, bodyScrollWidth: document.body.scrollWidth, vw, offenders: offenders.slice(0, 5) };
  });
  expect(m.scrollWidth, `${label}: document scrollWidth ${m.scrollWidth} > viewport ${m.vw}; ${m.offenders.join(" | ")}`).toBeLessThanOrEqual(m.vw + 1);
  expect(m.bodyScrollWidth, `${label}: body scrollWidth`).toBeLessThanOrEqual(m.vw + 1);
  expect(m.offenders, `${label}: elements extend beyond the viewport`).toEqual([]);
}
/** The element is on screen, not clipped and not covered by another element at its centre. */
export async function expectUnobscured(page: Page, locator: ReturnType<Page["locator"]>, label: string) {
  await locator.scrollIntoViewIfNeeded();
  await expect(locator, label).toBeInViewport({ ratio: 0.99 });
  const ok = await locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!top && (el === top || el.contains(top) || top.contains(el));
  });
  expect(ok, `${label} is covered by another element`).toBe(true);
}
/** Open every collapsed disclosure so evidence text becomes readable. */
export async function expandAll(page: Page) {
  for (let pass = 0; pass < 3; pass++) {
    const closed = page.locator('[aria-expanded="false"]:visible, details:not([open]) > summary:visible');
    const n = await closed.count();
    if (!n) break;
    for (let i = 0; i < n; i++) await closed.nth(0).click({ timeout: 2000 }).catch(() => {});
  }
}
export const realErrors = (errs: string[]) => errs.filter((e) => !/ERR_INTERNET_DISCONNECTED|ERR_NETWORK_CHANGED|Failed to fetch|net::ERR_FAILED|Load failed/i.test(e));
export const fmtBank = (minor: string) => `${minor.slice(0, -2) || "0"}.${minor.slice(-2).padStart(2, "0")}`;
/** matches "900", "900.00" but not "1,900" or "9000" */
export const amountRe = (whole: string) => new RegExp(`(^|[^0-9,.])${whole}(\\.0+)?(?![0-9]|[.,][0-9])`);
