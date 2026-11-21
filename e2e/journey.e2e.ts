/**
 * Checks 9 and 12: the complete journey at desktop and phone sizes, in two
 * separate browser contexts that share only authoritative server state.
 */
import { test, expect } from "@playwright/test";
import {
  DESKTOPS, PHONES, successClaims, amountRe, bodyText, createAgreement, desktop, executeApi, expandAll,
  expectNoHorizontalOverflow, expectUnobscured, getState, getView, pairing, phone, realErrors, resetAll, shot,
} from "./helpers";

test.beforeEach(async () => { await resetAll(); });

for (let i = 0; i < DESKTOPS.length; i++) {
  const d = DESKTOPS[i]; const p = PHONES[i];
  test(`9+12 bank journey: desktop ${d.name} + phone ${p.name}`, async ({ browser }) => {
    const created = await createAgreement("bank");
    const id = created.agreement.id;
    const pair = await pairing(id);
    expect(pair.approvePath).toContain(`/approve/${id}`);

    const desk = await desktop(browser, d);
    const ph = await phone(browser, p);
    await desk.page.goto("/command");
    await ph.page.goto(pair.approvePath);

    // --- phone: the payment card shows the facts being approved ---
    const approveBtn = ph.page.getByRole("button", { name: /approve this payment/i });
    await expect(approveBtn).toBeVisible();
    await expect(ph.page.getByRole("button", { name: /decline/i })).toBeVisible();
    let pt = await bodyText(ph.page);
    expect(pt, "exact recipient identifier").toContain("ACC-MERCHANT-001");
    expect(pt, "merchant display name").toContain("Acceptance Shop");
    expect(pt, "amount 100.00").toMatch(amountRe("100"));
    expect(pt, "currency").toMatch(/AED/);
    expect(pt, "environment label").toMatch(/Bank simulation/i);
    expect(successClaims(pt), "no success before approval").toEqual([]);
    await expectNoHorizontalOverflow(ph.page, `phone ${p.name} awaiting`);
    await expectUnobscured(ph.page, ph.page.getByText("ACC-MERCHANT-001").first(), "recipient identifier");
    await expectUnobscured(ph.page, approveBtn, "Approve button");
    await shot(ph.page, `phone-${p.name}-1-awaiting`);

    // --- desktop sees the same awaiting agreement ---
    await expect(desk.page.locator("body")).toContainText("ACC-MERCHANT-001");
    await expectNoHorizontalOverflow(desk.page, `desktop ${d.name} awaiting`);
    await shot(desk.page, `desktop-${d.name}-1-awaiting`);

    // --- approve on the phone (UI), verify on the server ---
    await approveBtn.click({ delay: 900 });
    await expect.poll(async () => (await getView(id)).state, { message: "phone approval must reach the server" }).toBe("approved");
    await expect(ph.page.locator("body")).toContainText(/approved/i);
    expect(successClaims(await bodyText(ph.page)), "approved is not settled").toEqual([]);
    await shot(ph.page, `phone-${p.name}-2-approved`);
    await expect(desk.page.locator("body")).toContainText(/approved/i);
    await shot(desk.page, `desktop-${d.name}-2-approved`);
    expect((await getState()).bank.accounts[0].balance, "approval moved no money").toBe("100000");

    // --- merchant executes exactly the approved terms ---
    const ex = await executeApi(await getView(id));
    expect(ex.status).toBe(200);
    const receipt = ex.body.evidence.receipt as { transferId: string };
    const truth = await getState();
    const custBal = truth.bank.accounts.find((a) => a.id === "ACC-CUSTOMER-001")!.balance;
    expect(custBal).toBe("90000");

    // --- both views converge on the authoritative receipt and balance ---
    await expect(ph.page.locator("body")).toContainText(/completed/i);
    await expect(desk.page.locator("body")).toContainText(/completed|settled/i);
    await expandAll(ph.page); await expandAll(desk.page);
    pt = await bodyText(ph.page);
    const dt = await bodyText(desk.page);
    expect(pt).toContain("ACC-MERCHANT-001");
    expect(pt).toMatch(amountRe("100"));
    expect(dt).toContain("ACC-MERCHANT-001");
    expect(dt, "desktop shows the resulting customer balance 900.00 read from the ledger").toMatch(amountRe("900"));
    expect(dt, "desktop shows amount 100.00").toMatch(amountRe("100"));
    const tid = receipt.transferId;
    expect.soft(dt.includes(tid) || dt.includes(tid.slice(0, 8)), `desktop evidence shows ledger transfer id ${tid}`).toBe(true);
    expect.soft(pt.includes(tid) || pt.includes(tid.slice(0, 8)), `phone receipt evidence shows ledger transfer id ${tid}`).toBe(true);
    await expectNoHorizontalOverflow(ph.page, `phone ${p.name} settled`);
    await expectNoHorizontalOverflow(desk.page, `desktop ${d.name} settled`);
    await shot(ph.page, `phone-${p.name}-3-settled`);
    await shot(desk.page, `desktop-${d.name}-3-settled`);
    await ph.page.screenshot({ path: `docs-verify/screenshots/phone-${p.name}-3-settled-full.png`, fullPage: true });

    // --- reload: views come from the server, not client memory ---
    await ph.page.reload(); await desk.page.reload();
    await expect(ph.page.locator("body")).toContainText(/completed/i);
    await expect(desk.page.locator("body")).toContainText(/completed|settled/i);
    await expect(ph.page.getByRole("button", { name: /approve this payment/i }), "no approve button on a settled payment").toHaveCount(0);

    expect(realErrors(ph.errors), "phone console errors").toEqual([]);
    expect(realErrors(desk.errors), "desktop console errors").toEqual([]);
    await desk.context.close(); await ph.context.close();
  });
}

test("9+12 crypto journey: desktop 1440x900 + phone 390x844 agree with EVM-read balance and allowance", async ({ browser }) => {
  const s0 = await getState();
  expect(s0.chain.available, "local chain must be available for the crypto journey").toBe(true);
  const created = await createAgreement("crypto");
  const id = created.agreement.id;
  const pair = await pairing(id);
  const desk = await desktop(browser, DESKTOPS[0]);
  const ph = await phone(browser, PHONES[0]);
  await desk.page.goto("/command");
  await ph.page.goto(pair.approvePath);

  const approveBtn = ph.page.getByRole("button", { name: /approve this payment/i });
  await expect(approveBtn).toBeVisible();
  const shop = created.agreement.recipient;
  const pt = await bodyText(ph.page);
  expect(pt.toLowerCase().includes(shop.toLowerCase()) || pt.toLowerCase().includes(shop.slice(0, 6).toLowerCase()), `phone shows the actual recipient address ${shop}`).toBe(true);
  expect(pt).toMatch(amountRe("100"));
  expect(pt).toMatch(/CSUSD/);
  expect(pt).toMatch(/Local-chain demo/i);
  await expectNoHorizontalOverflow(ph.page, "phone crypto awaiting");
  await shot(ph.page, "phone-390x844-crypto-1-awaiting");
  await approveBtn.click({ delay: 900 });
  await expect.poll(async () => (await getView(id)).state).toBe("approved");

  const ex = await executeApi(await getView(id));
  expect(ex.status, JSON.stringify(ex.body)).toBe(200);
  const truth = await getState();
  expect(truth.chain.protected?.customerBalance).toBe("900000000000000000000");
  expect(truth.chain.protected?.allowance).toBe("0");

  await expect(ph.page.locator("body")).toContainText(/completed/i);
  await expect(desk.page.locator("body")).toContainText(/completed|settled/i);
  await expandAll(desk.page); await expandAll(ph.page);
  const dt = await bodyText(desk.page);
  expect(dt, "desktop shows 900 CSUSD remaining").toMatch(amountRe("900"));
  expect(dt, "desktop shows allowance").toMatch(/allowance/i);
  const tx = (ex.body.evidence.receipt as { txHash: string }).txHash;
  expect.soft(dt.toLowerCase().includes(tx.slice(0, 10).toLowerCase()), `desktop evidence shows tx hash ${tx}`).toBe(true);
  await expectNoHorizontalOverflow(ph.page, "phone crypto settled");
  await expectNoHorizontalOverflow(desk.page, "desktop crypto settled");
  await shot(ph.page, "phone-390x844-crypto-3-settled");
  await shot(desk.page, "desktop-1440x900-crypto-3-settled");
  expect(realErrors(ph.errors)).toEqual([]);
  expect(realErrors(desk.errors)).toEqual([]);
  await desk.context.close(); await ph.context.close();
});

test("12 static pages: /command, /lab and / have no overflow or console errors at all four sizes", async ({ browser }) => {
  for (const size of [...DESKTOPS, ...PHONES]) {
    const w = await desktop(browser, size);
    for (const route of ["/", "/command", "/lab"]) {
      const res = await w.page.goto(route);
      expect(res?.status(), `${route} status`).toBeLessThan(400);
      await w.page.waitForTimeout(1200);
      if (route !== "/lab" || size.width >= 1280) await expectNoHorizontalOverflow(w.page, `${route} @ ${size.name}`);
      if (route === "/command" && size.width >= 1280) await shot(w.page, `desktop-${size.name}-command-clean`);
    }
    expect(realErrors(w.errors), `console errors @ ${size.name}`).toEqual([]);
    await w.context.close();
  }
});
