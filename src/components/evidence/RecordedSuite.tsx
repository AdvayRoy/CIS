// Static text copied from docs-verify/RESULTS.md. A recorded run, not live data.
const RUNS = [
  ["Acceptance suite (vitest, tests/acceptance)", "37 passed / 0 failed"],
  ["Browser journeys (Playwright)", "16 passed / 0 failed"],
  ["Unit tests (pnpm test)", "235 passed, 52 skipped"],
  ["Contract tests (forge test)", "21 passed"],
] as const;

export function RecordedSuite() {
  return (
    <div className="mt-6 rounded-[16px] border border-line bg-white/5 p-4">
      <h3 className="text-[10px] tracking-widest text-muted uppercase">Recorded automated run · static text, not live</h3>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        As recorded in <span className="ident">docs-verify/RESULTS.md</span>: run on <span className="ident">main 1fe6cae</span>, 2026-11-21 08:53 UTC, production build. This page did not run these tests and cannot confirm they pass on the commit you are viewing.
      </p>
      <table className="mt-3 w-full border-collapse font-mono">
        <tbody>{RUNS.map(([k, v]) => (
          <tr key={k} className="border-b border-line/50"><td className="px-3 py-1.5 text-xs text-muted">{k}</td><td className="px-3 py-1.5 text-xs">{v}</td></tr>
        ))}</tbody>
      </table>
      <p className="mt-2 text-[11px] leading-snug text-muted">Limits stated in the same file: Chromium only with emulated viewports; no physical iPhone, Safari/WebKit or installed-PWA run.</p>
    </div>
  );
}
