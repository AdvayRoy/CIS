/**
 * Check 10: failed / pending / disconnected states are never rendered as a
 * successful settlement. Also the phone half of check 5 (no token, no approval).
 */
import { test, expect } from "@playwright/test";
import {
  DESKTOPS, DISCONNECTED_RE, PHONES, successClaims, bodyText, createAgreement, desktop, executeApi,
  expectNoHorizontalOverflow, getState, getView, pairing, phone, realErrors, resetAll, shot,
} from "./helpers";

test.beforeEach(async () => { await resetAll(); });

test("10 pending: awaiting and approved-but-unexecuted are not shown as success", async ({ browser }) => {
  const created = await createAgreement("bank");
  const id = created.agreement.id;
  const pair = await pairing(id);
  const desk = await desktop(browser, DESKTOPS[1]);
  const ph = await phone(browser, PHONES[1]);
  await desk.page.goto("/command"); await ph.page.goto(pair.approvePath);
  await expect(ph.page.getByRole("button", { name: /approve this payment/i })).toBeVisible();
  await expect(desk.page.locator("body")).toContainText("ACC-MERCHANT-001");
  expect(successClaims(await bodyText(ph.page))).toEqual([]);
  expect(successClaims(await bodyText(desk.page))).toEqual([]);
  await ph.page.getByRole("button", { name: /approve this payment/i }).click({ delay: 1100 });
  await expect.poll(async () => (await getView(id)).state).toBe("approved");
  await ph.page.waitForTimeout(2500); // several polls: nothing may drift to success on its own
  expect(successClaims(await bodyText(ph.page)), "approved (pending execution) on phone").toEqual([]);
  expect(successClaims(await bodyText(desk.page)), "approved (pending execution) on desktop").toEqual([]);
  await shot(ph.page, "phone-375x667-pending-approved");
  await shot(desk.page, "desktop-1280x800-pending-approved");
  await desk.context.close(); await ph.context.close();
});

test("10 stopped: a rejected recipient substitution is shown as stopped, never as success", async ({ browser }) => {
  const created = await createAgreement("bank");
  const id = created.agreement.id;
  const pair = await pairing(id);
  const desk = await desktop(browser, DESKTOPS[0]);
  const ph = await phone(browser, PHONES[0]);
  await desk.page.goto("/command"); await ph.page.goto(pair.approvePath);
  await ph.page.getByRole("button", { name: /approve this payment/i }).click({ delay: 1100 });
  await expect.poll(async () => (await getView(id)).state).toBe("approved");

  const ex = await executeApi(await getView(id), { recipient: "ACC-UNKNOWN-777" });
  expect(ex.status).toBe(409);
  expect((await getState()).bank.accounts.find((a) => a.id === "ACC-UNKNOWN-777")!.balance).toBe("0");

  await expect(desk.page.locator("body"), "desktop shows the attempted (substituted) recipient").toContainText("ACC-UNKNOWN-777");
  await expect(desk.page.locator("body")).toContainText(/stopped|rejected|differs/i);
  await ph.page.waitForTimeout(2500);
  const pt = await bodyText(ph.page); const dt = await bodyText(desk.page);
  expect(successClaims(pt), "phone must not show success after a rejected attempt").toEqual([]);
  expect(successClaims(dt), "desktop must not show success after a rejected attempt").toEqual([]);
  expect(dt, "desktop still shows the full 1,000.00 balance").toMatch(/1,?000(\.00)?/);
  await expectNoHorizontalOverflow(desk.page, "desktop rejected");
  await expectNoHorizontalOverflow(ph.page, "phone rejected");
  await shot(ph.page, "phone-390x844-stopped");
  await shot(desk.page, "desktop-1440x900-stopped");
  expect(realErrors(ph.errors)).toEqual([]); expect(realErrors(desk.errors)).toEqual([]);
  await desk.context.close(); await ph.context.close();
});

test("10 expired: an expired approval request shows expired, offers no approval, no success", async ({ browser }) => {
  const created = await createAgreement("bank", { ttlSeconds: 5 });
  const id = created.agreement.id;
  const pair = await pairing(id);
  const ph = await phone(browser, PHONES[0]);
  await ph.page.goto(pair.approvePath);
  await expect(ph.page.getByRole("button", { name: /approve this payment/i })).toBeVisible();
  await expect(ph.page.locator("body")).toContainText(/expired/i, { timeout: 15_000 });
  const btn = ph.page.getByRole("button", { name: /approve this payment/i });
  if (await btn.count()) await expect(btn, "approve must be disabled once expired").toBeDisabled();
  expect(successClaims(await bodyText(ph.page))).toEqual([]);
  expect((await getView(id)).state).toBe("expired");
  await shot(ph.page, "phone-390x844-expired");
  await ph.context.close();
});

test("10 declined: declining on the phone is shown as declined on both views", async ({ browser }) => {
  const created = await createAgreement("bank");
  const id = created.agreement.id;
  const pair = await pairing(id);
  const desk = await desktop(browser, DESKTOPS[0]);
  const ph = await phone(browser, PHONES[0]);
  await desk.page.goto("/command"); await ph.page.goto(pair.approvePath);
  await ph.page.getByRole("button", { name: /decline/i }).click();
  // a confirm step is allowed
  const confirm = ph.page.getByRole("button", { name: /decline/i });
  await ph.page.waitForTimeout(400);
  if ((await getView(id)).state !== "declined" && await confirm.count()) await confirm.last().click().catch(() => {});
  await expect.poll(async () => (await getView(id)).state).toBe("declined");
  await expect(ph.page.locator("body")).toContainText(/declined/i);
  await expect(desk.page.locator("body")).toContainText(/declined/i);
  expect(successClaims(await bodyText(ph.page))).toEqual([]);
  expect(successClaims(await bodyText(desk.page))).toEqual([]);
  await shot(ph.page, "phone-390x844-declined");
  await desk.context.close(); await ph.context.close();
});

test("10 disconnected: offline is shown as disconnected, never as success; reconnect reloads the truth", async ({ browser }) => {
  const created = await createAgreement("bank");
  const id = created.agreement.id;
  const pair = await pairing(id);
  const desk = await desktop(browser, DESKTOPS[0]);
  const ph = await phone(browser, PHONES[0]);
  await desk.page.goto("/command"); await ph.page.goto(pair.approvePath);
  await ph.page.getByRole("button", { name: /approve this payment/i }).click({ delay: 1100 });
  await expect.poll(async () => (await getView(id)).state).toBe("approved");
  // wait until both views have polled the approved state ("Approved" alone is also a static stage label)
  await expect(ph.page.locator("body")).not.toContainText(/awaiting your approval/i);
  await expect(desk.page.locator("body")).not.toContainText(/awaiting your approval/i);
  await expect(ph.page.locator("body")).toContainText(/approved/i);

  await ph.context.setOffline(true); await desk.context.setOffline(true);
  await expect(ph.page.locator("body"), "phone must say it is disconnected").toContainText(DISCONNECTED_RE, { timeout: 10_000 });
  await expect(desk.page.locator("body"), "desktop must say it is disconnected").toContainText(DISCONNECTED_RE, { timeout: 10_000 });
  // The payment settles on the server while both views are offline: they cannot know, so they must not claim it.
  const ex = await executeApi(await getView(id));
  expect(ex.status).toBe(200);
  await ph.page.waitForTimeout(2500);
  expect(successClaims(await bodyText(ph.page)), "offline phone must not claim settlement").toEqual([]);
  expect(successClaims(await bodyText(desk.page)), "offline desktop must not claim settlement").toEqual([]);
  await shot(ph.page, "phone-390x844-disconnected");
  await shot(desk.page, "desktop-1440x900-disconnected");

  await ph.context.setOffline(false); await desk.context.setOffline(false);
  await expect(ph.page.locator("body"), "after reconnect the phone shows the settled truth").toContainText(/completed/i, { timeout: 10_000 });
  await expect(desk.page.locator("body")).toContainText(/completed|settled/i, { timeout: 10_000 });
  await expect(ph.page.locator("body")).not.toContainText(/\bdisconnected\b/i, { timeout: 10_000 });
  await shot(ph.page, "phone-390x844-reconnected");
  await desk.context.close(); await ph.context.close();
});

test("10 disconnected approval: tapping Approve while offline does not show approved or success", async ({ browser }) => {
  const created = await createAgreement("bank");
  const id = created.agreement.id;
  const pair = await pairing(id);
  const ph = await phone(browser, PHONES[0]);
  await ph.page.goto(pair.approvePath);
  const btn = ph.page.getByRole("button", { name: /approve this payment/i });
  await expect(btn).toBeVisible();
  await ph.context.setOffline(true);
  await ph.page.waitForTimeout(1500);
  if (await btn.isEnabled().catch(() => false)) await btn.click().catch(() => {});
  await ph.page.waitForTimeout(2000);
  expect((await getView(id)).state, "server never saw an approval").toBe("awaiting_approval");
  await shot(ph.page, "phone-390x844-offline-approve");
  const pt = await bodyText(ph.page);
  expect(successClaims(pt)).toEqual([]);
  // "Approved" alone is also a static stage label of the progress path, so check the state wording instead.
  expect(pt, "must not tell the customer they approved when the approval never reached the server").not.toMatch(/you approved|approval (sent|received|recorded)/i);
  expect(pt).toMatch(DISCONNECTED_RE);
  await shot(ph.page, "phone-390x844-offline-approve");
  await ph.context.close();
});

test("5 (browser) the approval page without a valid pairing token offers no working approval", async ({ browser }) => {
  const created = await createAgreement("bank");
  const id = created.agreement.id;
  for (const [label, suffix, cookies] of [["no-token", "", false], ["forged-token", "#t=forged-token", false], ["merchant-cookies", "", true]] as const) {
    const w = cookies ? await desktop(browser, PHONES[0]) : await phone(browser, PHONES[0]);
    if (cookies) await w.context.clearCookies({ name: "cs_customer" });
    await w.page.goto(`/approve/${id}${suffix}`);
    await w.page.waitForTimeout(1500);
    const btn = w.page.getByRole("button", { name: /approve this payment/i });
    if (await btn.count() && await btn.isEnabled()) { await btn.click().catch(() => {}); await w.page.waitForTimeout(1200); }
    const v = await getView(id);
    expect(v.state, label).toBe("awaiting_approval");
    expect(v.approval, label).toBeNull();
    expect(successClaims(await bodyText(w.page)), label).toEqual([]);
    await shot(w.page, `phone-390x844-${label}`);
    await w.context.close();
  }
});

test("10 service worker never serves approval/payment APIs from cache", async ({ browser }) => {
  const ph = await phone(browser, PHONES[0]);
  await ph.page.goto("/");
  await ph.page.waitForTimeout(1500);
  const cached = await ph.page.evaluate(async () => {
    const out: string[] = [];
    if (!("caches" in window)) return out;
    for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) out.push(r.url);
    return out;
  });
  expect(cached.filter((u) => new URL(u).pathname.startsWith("/api/")), "API responses in Cache Storage").toEqual([]);
  const res = await ph.page.request.get("/api/state");
  expect(res.headers()["cache-control"]).toContain("no-store");
  await ph.context.close();
});
