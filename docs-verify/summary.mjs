// Prints a per-check tally from the vitest and Playwright JSON reports in test-results/.
import fs from "node:fs";
const tally = {};
const add = (check, ok, name, msg) => {
  const t = (tally[check] ??= { pass: 0, fail: 0, skip: 0, failures: [] });
  if (ok === null) t.skip++; else if (ok) t.pass++; else { t.fail++; t.failures.push(`${name} :: ${(msg ?? "").split("\n")[0].slice(0, 300)}`); }
};
try {
  const v = JSON.parse(fs.readFileSync("data/verify-out/acceptance.json", "utf8"));
  for (const f of v.testResults ?? []) for (const a of f.assertionResults ?? []) {
    const group = a.ancestorTitles?.[1] ?? a.ancestorTitles?.[0] ?? "?";
    const check = group.match(/^(\d+)/)?.[1] ?? "?";
    add(`vitest ${check}`, a.status === "passed" ? true : a.status === "failed" ? false : null, a.title, a.failureMessages?.[0]);
  }
  if (!(v.testResults ?? []).some((f) => f.assertionResults?.length)) console.log("vitest: no assertion results:", v.testResults?.[0]?.message?.slice(0, 400));
} catch (e) { console.log("no vitest json:", e.message); }
try {
  const p = JSON.parse(fs.readFileSync("test-results/e2e-results.json", "utf8"));
  const walk = (s) => { for (const sp of s.specs ?? []) for (const t of sp.tests ?? []) {
      const r = t.results?.[t.results.length - 1];
      const checks = sp.title.match(/^([\d+]+)/)?.[1] ?? "?";
      add(`e2e ${checks}`, r?.status === "passed" ? true : r?.status === "skipped" ? null : false, sp.title, r?.error?.message?.replace(/\u001b\[[0-9;]*m/g, ""));
    } for (const c of s.suites ?? []) walk(c); };
  for (const s of p.suites ?? []) walk(s);
} catch (e) { console.log("no playwright json:", e.message); }
for (const [k, t] of Object.entries(tally).sort()) {
  console.log(`${k.padEnd(12)} pass ${t.pass} fail ${t.fail} skip ${t.skip}`);
  for (const f of t.failures) console.log(`    FAIL ${f}`);
}
