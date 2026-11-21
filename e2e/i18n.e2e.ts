// Lead-owned: live approval flow in English, Russian and Arabic against the real server (no fixtures).
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { createAgreement, pairing, executeApi, getView, getState, resetAll, desktop, phone, shot, bodyText,
  expectNoHorizontalOverflow, realErrors, PHONES, DESKTOPS } from "./helpers";

const msg = (l: string, ns: string) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "messages", l, `${ns}.json`), "utf8"));
const CASES = [{ code: "en", dir: "ltr" }, { code: "ru", dir: "ltr" }, { code: "ar", dir: "rtl" }];

for (const c of CASES) {
  test(`i18n live bank flow in ${c.code} (${c.dir}) on phone 390x844 + desktop`, async ({ browser }) => {
    await resetAll();
    const m = msg(c.code, "mobile"); const common = msg(c.code, "common");
    const created = await createAgreement("bank"); const id = created.agreement.id;
    const pair = await pairing(id);
    const ph = await phone(browser, PHONES[0]); const desk = await desktop(browser, DESKTOPS[1]);
    for (const w of [ph, desk]) await w.context.addInitScript((l) => { try { localStorage.setItem("cs.locale", l); } catch {} }, c.code);
    await desk.page.goto("/command"); await ph.page.goto(pair.approvePath);

    const html = ph.page.locator("html");
    await expect(html).toHaveAttribute("lang", c.code); await expect(html).toHaveAttribute("dir", c.dir);
    await expect(desk.page.locator("html")).toHaveAttribute("dir", c.dir);
    const approve = ph.page.getByTestId("approve");
    await expect(approve).toContainText(m.action.approve);
    let pt = await bodyText(ph.page);
    expect(pt).toContain("ACC-MERCHANT-001"); expect(pt).toContain("AED"); expect(pt).toMatch(/(^|[^0-9])100([.,]00)?(?![0-9])/);
    if (c.code !== "en") expect(pt, "no English approve label leaks").not.toMatch(/approve this payment/i);
    // identifiers stay LTR even in RTL
    const identDir = await ph.page.getByText("ACC-MERCHANT-001").first().evaluate((e) => getComputedStyle(e).direction);
    expect(identDir).toBe("ltr");
    await expectNoHorizontalOverflow(ph.page, `phone ${c.code} awaiting`);
    await shot(ph.page, `i18n-${c.code}-phone-1-awaiting`);

    await approve.click();
    await expect.poll(async () => (await getView(id)).state).toBe("approved");

    // mutated recipient is stopped; reason is rendered in the selected language
    const v = await getView(id);
    const bad = await executeApi(v, { recipient: "ACC-UNKNOWN-777" });
    expect(bad.status).toBe(409);
    await expect(ph.page.getByTestId("stopped-reason")).toHaveText(common.reason.RECIPIENT_MISMATCH);
    await expectNoHorizontalOverflow(ph.page, `phone ${c.code} stopped`);
    await shot(ph.page, `i18n-${c.code}-phone-2-stopped`);
    expect((await getState()).bank.accounts.find((a) => a.id === "ACC-CUSTOMER-001")!.balance).toBe("100000");

    const ok = await executeApi(await getView(id));
    expect(ok.status).toBe(200);
    await expect(ph.page.getByTestId("receipt-paid")).toBeVisible();
    await expect(ph.page.getByTestId("state-banner")).toContainText(common.state.settled);
    pt = await bodyText(ph.page);
    expect(pt).toContain("ACC-MERCHANT-001");
    await expectNoHorizontalOverflow(ph.page, `phone ${c.code} settled`);
    await expectNoHorizontalOverflow(desk.page, `desktop ${c.code} settled`);
    await shot(ph.page, `i18n-${c.code}-phone-3-settled`); await shot(desk.page, `i18n-${c.code}-desktop-settled`);
    expect((await getState()).bank.accounts.find((a) => a.id === "ACC-CUSTOMER-001")!.balance).toBe("90000");
    expect(realErrors(ph.errors)).toEqual([]); expect(realErrors(desk.errors)).toEqual([]);
    await ph.context.close(); await desk.context.close();
  });
}

test("i18n: switching language on the phone is instant, keeps payment state and persists", async ({ browser }) => {
  await resetAll();
  const created = await createAgreement("bank"); const id = created.agreement.id; const pair = await pairing(id);
  const ph = await phone(browser, PHONES[0]);
  await ph.page.goto(pair.approvePath);
  await ph.page.getByTestId("approve").click();
  await expect.poll(async () => (await getView(id)).state).toBe("approved");
  let navigations = 0; ph.page.on("framenavigated", (f) => { if (f === ph.page.mainFrame()) navigations++; });
  await ph.page.locator('[data-slot="language-selector"] button').first().click();
  await ph.page.getByText("العربية", { exact: true }).click();
  await expect(ph.page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(ph.page.getByTestId("state-banner")).toContainText(msg("ar", "common").state.approved);
  expect(navigations, "no reload").toBe(0);
  expect(await ph.page.evaluate(() => localStorage.getItem("cs.locale"))).toBe("ar");
  await expectNoHorizontalOverflow(ph.page, "phone ar after switch");
  await shot(ph.page, "i18n-switch-ar-approved");
  await ph.context.close();
});
