"use client";
import Link from "next/link";
import { api } from "@/lib/api";
import { usePoll } from "@/lib/usePoll";
import { formatUnitsStr, type Overview } from "@/shared/contract";
import { attempts, byReason, ratio, receiptId, securityCases, type CaseStatus, type Row } from "./metrics";
import { Research } from "./Research";
import { RecordedSuite } from "./RecordedSuite";

const card = "rounded-[20px] border border-line bg-surface p-6";
const th = "px-3 py-2 text-start text-[10px] font-normal tracking-widest text-muted uppercase";
const td = "px-3 py-2 align-top text-xs";

function ts(ms: number | null) {
  return ms ? new Date(ms).toISOString().replace("T", " ").slice(0, 19) + " UTC" : "—";
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: string }) {
  return (
    <div className="rounded-[16px] border border-line bg-white/5 p-4">
      <p className="text-[10px] tracking-widest text-muted uppercase">{label}</p>
      <p className={`ticker mt-2 font-mono text-xl font-semibold ${tone ?? "text-fg"}`}>{value}</p>
      <p className="mt-1 text-[11px] leading-snug text-muted">{sub}</p>
    </div>
  );
}

function StatusPill({ s }: { s: CaseStatus }) {
  const m = {
    observed: ["Observed in this session", "border-mint/40 text-mint"],
    contradicted: ["Observed: expectation NOT met", "border-coral/40 text-coral"],
    unverified: ["Unverified: not yet executed in this session", "border-amber/40 text-amber"],
  } as const;
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] tracking-wide uppercase ${m[s][1]}`}>{m[s][0]}</span>;
}

function Financial({ ov, rows }: { ov: Overview; rows: Row[] }) {
  const N = rows.length;
  const accepted = rows.filter((r) => r.ev.decision.accepted);
  const rejected = N - accepted.length;
  const reasons = byReason(rows);
  const A = ov.agreements.length;
  const settled = ov.agreements.filter((a) => a.state === "settled").length;
  const execSum = ov.agreements.reduce((s, a) => s + a.executionCount, 0);
  const over = ov.agreements.filter((a) => a.executionCount > 1).length;
  const receipts = rows.filter((r) => r.ev.receipt);
  // "Legitimate" = made after the customer approved, and the attempt equals the approved terms field-for-field (no diffs possible) and asks for no continuing allowance.
  const legit = rows.filter(({ view, ev }) => !!view.approval && ev.decision.decidedAt >= view.approval.approvedAt && ev.attempt.recipient === ev.agreement.recipient && ev.attempt.operation === ev.agreement.operation && ev.attempt.continuingAllowance === "0"
    && (ev.agreement.rail === "bank" ? ev.attempt.amount === ev.agreement.amount : BigInt(ev.attempt.amount) <= BigInt(ev.agreement.amount)));
  const legitFirst = legit.filter(({ ev }) => ev.decision.reason !== "REPLAYED");
  const legitOk = legitFirst.filter(({ ev }) => ev.decision.accepted).length;
  const tok = ov.chain.token;
  const fmtTok = (v: string) => (tok ? `${formatUnitsStr(v, tok.decimals)} ${tok.code}` : v);

  return (
    <section className={card} aria-labelledby="ev-fin">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="ev-fin" className="text-lg font-semibold tracking-tight">1 · Live financial evidence</h2>
        <p className="font-mono text-[11px] text-muted">source GET /api/state · server time {ts(ov.serverTime)}</p>
      </div>
      <p className="mt-2 max-w-3xl text-xs leading-relaxed text-amber">
        Simulated funds only: {ov.labels.bank} (AED in a local ledger) and {ov.labels.chain} (CSUSD test token on a local chain). No real money, no real customers.
        These are measurements of this demo session, not real-world financial statistics. Sample sizes are small and are printed with every figure.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Authorization decisions" value={N === 0 ? "no executions yet" : String(N)} sub={`across ${A} agreement${A === 1 ? "" : "s"} in this session`} />
        <Stat label="Accepted" value={ratio(accepted.length, N)} sub="accepted decisions / all decisions" tone={N ? "text-mint" : undefined} />
        <Stat label="Rejected" value={ratio(rejected, N)} sub="rejected decisions / all decisions" tone={rejected ? "text-coral" : undefined} />
        <Stat label="Legitimate payment success" value={ratio(legitOk, legitFirst.length)} sub="accepted / attempts made after customer approval that match the approved terms exactly (replays excluded)" tone={legitFirst.length ? "text-mint" : undefined} />
        <Stat label="Settled agreements" value={A === 0 ? "no agreements yet" : `${settled} / ${A}`} sub="state = settled / all agreements" />
        <Stat label="Executions recorded" value={A === 0 ? "no executions yet" : String(execSum)} sub={`sum of executionCount over ${A} agreement${A === 1 ? "" : "s"}; ${over} with count > 1`} tone={over ? "text-coral" : undefined} />
        <Stat label="Receipts" value={ratio(receipts.length, N)} sub={`${receipts.filter((r) => r.ev.receipt?.kind === "ledger").length} ledger, ${receipts.filter((r) => r.ev.receipt?.kind === "chain").length} chain / all decisions`} />
        <Stat label="Local chain" value={ov.chain.available ? `block ${ov.chain.blockNumber ?? "?"}` : "unavailable"} sub={ov.chain.available ? `chainId ${ov.chain.chainId ?? "?"} · ${ov.labels.chain}` : "token figures cannot be read in this session"} tone={ov.chain.available ? undefined : "text-amber"} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-[10px] tracking-widest text-muted uppercase">Blocked attempts by decision reason (n = {rejected})</h3>
          {rejected === 0 ? <p className="mt-2 text-xs text-muted">No rejected attempt in this session. Run attacks from <Link className="underline" href="/lab">/lab</Link>.</p> : (
            <table className="mt-2 w-full border-collapse font-mono">
              <thead><tr className="border-b border-line"><th className={th}>Reason</th><th className={th}>Count</th><th className={th}>Share of rejections</th></tr></thead>
              <tbody>{reasons.map((r) => (
                <tr key={r.reason} className="border-b border-line/50"><td className={`${td} text-coral`}>{r.reason}</td><td className={td}>{r.n}</td><td className={td}>{ratio(r.n, rejected)}</td></tr>
              ))}</tbody>
            </table>
          )}
        </div>
        <div>
          <h3 className="text-[10px] tracking-widest text-muted uppercase">Observed balances · {ov.labels.bank} (simulated AED)</h3>
          {!ov.bank.available ? <p className="mt-2 text-xs text-amber">Bank simulation unavailable.</p> : (
            <table className="mt-2 w-full border-collapse font-mono">
              <thead><tr className="border-b border-line"><th className={th}>Account</th><th className={th}>Name</th><th className={th}>Balance</th></tr></thead>
              <tbody>{ov.bank.accounts.map((a) => (
                <tr key={a.id} className="border-b border-line/50"><td className={td}><span className="ident">{a.id}</span></td><td className={`${td} font-sans text-muted`}>{a.displayName}</td><td className={`${td} ticker`}>{formatUnitsStr(a.balance, a.asset.decimals)} {a.asset.code}</td></tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-[10px] tracking-widest text-muted uppercase">Token balances and allowances read from the EVM · {ov.labels.chain} (test token)</h3>
        {!ov.chain.available ? <p className="mt-2 text-xs text-amber">Local chain not available; nothing to show.</p> : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse font-mono">
              <thead><tr className="border-b border-line"><th className={th}>Account</th><th className={th}>Customer</th><th className={th}>Shop</th><th className={th}>Attacker</th><th className={th}>Allowance customer→shop</th><th className={th}>Purchased</th><th className={th}>Drain attempt</th></tr></thead>
              <tbody>{[ov.chain.protected, ov.chain.vulnerable].map((s) => s && (
                <tr key={s.label} className="border-b border-line/50">
                  <td className={td}>{s.label}</td>
                  <td className={`${td} ticker`}>{fmtTok(s.customerBalance)}</td>
                  <td className={`${td} ticker`}>{fmtTok(s.shopBalance)}</td>
                  <td className={`${td} ticker`}>{fmtTok(s.attackerBalance)}</td>
                  <td className={`${td} ticker max-w-[220px] break-all ${s.allowance === "0" ? "text-mint" : "text-coral"}`}>{fmtTok(s.allowance)}</td>
                  <td className={td}>{s.purchased ? "yes" : "no"}{s.lastPurchaseTx && <span className="ident block text-[10px] text-muted">{s.lastPurchaseTx}</span>}</td>
                  <td className={td}>{!s.drainAttempt ? <span className="text-muted">not attempted</span> : (
                    <><span className={s.drainAttempt.succeeded ? "text-coral" : "text-mint"}>{s.drainAttempt.succeeded ? "succeeded" : "reverted"}</span> · requested {fmtTok(s.drainAttempt.amountRequested)}
                      {s.drainAttempt.revertReason && <span className="block text-[10px] text-muted">{s.drainAttempt.revertReason}</span>}
                      {s.drainAttempt.txHash && <span className="ident block text-[10px] text-muted">{s.drainAttempt.txHash}</span>}</>
                  )}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-6">
        <h3 className="text-[10px] tracking-widest text-muted uppercase">Decision log (n = {N}, newest first)</h3>
        {N === 0 ? <p className="mt-2 text-xs text-muted">No executions yet. Pay in <Link className="underline" href="/shop">/shop</Link>, run attacks in <Link className="underline" href="/lab">/lab</Link>; this table fills from the server state.</p> : (
          <div className="mt-2 max-h-[420px] overflow-auto">
            <table className="w-full border-collapse font-mono">
              <thead><tr className="border-b border-line"><th className={th}>Decided</th><th className={th}>Rail</th><th className={th}>Decision</th><th className={th}>Attempted</th><th className={th}>Receipt</th><th className={th}>Observed after</th></tr></thead>
              <tbody>{rows.map(({ view, ev }, i) => {
                const a = ev.agreement; const f = (v: string) => `${formatUnitsStr(v, a.asset.decimals)} ${a.asset.code}`;
                return (
                  <tr key={`${a.id}-${i}`} className="border-b border-line/50">
                    <td className={`${td} whitespace-nowrap text-muted`}>{ts(ev.decision.decidedAt)}</td>
                    <td className={td}>{a.rail}</td>
                    <td className={`${td} ${ev.decision.accepted ? "text-mint" : "text-coral"}`}>{ev.decision.accepted ? "ACCEPTED" : "REJECTED"} · {ev.decision.reason}
                      {ev.decision.diffs.map((d) => <span key={d.field} className="block text-[10px] text-muted">{d.field}: approved <span className="ident">{d.approved}</span> → attempted <span className="ident">{d.attempted}</span></span>)}</td>
                    <td className={td}>{f(ev.attempt.amount)}<span className="ident block text-[10px] text-muted">→ {ev.attempt.recipient}</span></td>
                    <td className={td}>{ev.receipt ? <><span className="text-muted">{ev.receipt.kind === "ledger" ? "ledger transfer" : `tx · block ${ev.receipt.blockNumber} · ${ev.receipt.status}`}</span><span className="ident block text-[10px]">{receiptId(ev.receipt)}</span></> : <span className="text-muted">none</span>}</td>
                    <td className={`${td} text-[11px] text-muted`}>payer {f(ev.observed.payerBalance)} · recipient {f(ev.observed.recipientBalance)}{ev.observed.allowance !== null && <> · allowance {f(ev.observed.allowance)}</>} · executions {ev.observed.executionCount}<span className="ident block text-[10px]">{view.agreement.id}</span></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function Matrix({ ov, rows }: { ov: Overview; rows: Row[] }) {
  const cases = securityCases(ov, rows);
  const observed = cases.filter((c) => c.status === "observed").length;
  return (
    <section className={card} aria-labelledby="ev-sec">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="ev-sec" className="text-lg font-semibold tracking-tight">2 · Security test matrix</h2>
        <p className="font-mono text-[11px] text-muted">{observed} / {cases.length} cases observed in this session</p>
      </div>
      <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted">
        A case is marked observed only when a matching event exists in the current server state. Nothing here is hardcoded as passed; a case with no executed event is unverified. A reset in /lab clears this evidence.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead><tr className="border-b border-line"><th className={th}>Case</th><th className={th}>Status</th><th className={th}>Result</th><th className={th}>Evidence</th><th className={th}>Most recent execution</th></tr></thead>
          <tbody>{cases.map((c) => (
            <tr key={c.key} className="border-b border-line/50">
              <td className={td}><span className="font-medium text-fg">{c.name}</span><span className="mt-1 block max-w-[240px] text-[11px] leading-snug text-muted">{c.expectation}</span></td>
              <td className={td}><StatusPill s={c.status} /></td>
              <td className={`${td} max-w-[280px] font-mono text-[11px] leading-snug break-words [overflow-wrap:anywhere]`}>{c.result}{c.status === "unverified" && c.produce && <span className="mt-1 block font-sans text-muted">How to produce it: {c.produce}</span>}</td>
              <td className={`${td} max-w-[300px]`}>{c.evidence.length === 0 ? <span className="text-muted">none</span> : c.evidence.map((e, i) => (
                <span key={i} className="mb-1 block text-[11px] text-muted">{e.label}{e.id && <span className="ident block text-[10px] text-fg">{e.id}</span>}</span>
              ))}</td>
              <td className={`${td} font-mono text-[11px] whitespace-nowrap text-muted`}>{c.at ? ts(c.at) : c.status === "unverified" ? "never (this session)" : "no timestamp in /api/state"}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <RecordedSuite />
    </section>
  );
}

export function EvidenceLab() {
  const { data: ov, connected } = usePoll<Overview>(() => api.state(), 2000);
  const rows = ov ? attempts(ov) : [];
  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-6 py-10">
      <header>
        <p className="text-xs tracking-widest text-muted uppercase">CounterSign · Evidence Lab</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Measured, not claimed.</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Every figure in sections 1 and 2 is computed in your browser from the server's current state. This page only reads; it cannot create, approve or execute anything.
        </p>
        <p className="mt-3 flex flex-wrap items-center gap-3 font-mono text-[11px]">
          <span className={connected ? "text-mint" : connected === false ? "text-coral" : "text-muted"}>{connected ? "● live · polling every 2s" : connected === false ? "● disconnected · figures may be stale" : "○ loading"}</span>
          <Link href="/shop" className="text-muted underline">/shop: make a payment</Link>
          <Link href="/lab" className="text-muted underline">/lab: run attacks</Link>
        </p>
      </header>
      {!ov ? <section className={card}><p className="text-sm text-muted">{connected === false ? "Cannot reach the server. No evidence is shown rather than showing stale or invented figures." : "Reading server state…"}</p></section> : (
        <><Financial ov={ov} rows={rows} /><Matrix ov={ov} rows={rows} /></>
      )}
      <Research />
    </main>
  );
}
