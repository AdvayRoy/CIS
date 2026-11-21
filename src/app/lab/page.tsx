"use client";
// Lead-owned. Operator-only demonstration controls + checkout fixture. English only by design.
import { useCallback, useState } from "react";
import Link from "next/link";
import { api, ApiFailure, type ExecuteResult } from "@/lib/api";
import { usePoll } from "@/lib/usePoll";
import { BANK_ACCOUNTS, formatUnitsStr, type AgreementView, type Overview } from "@/shared/contract";

const TOKEN_100 = "100000000000000000000";
const SUBSTITUTE_ADDR = "0x000000000000000000000000000000000000dEaD";

type Log = { at: number; label: string; ok: boolean; detail: string };

function Btn({ children, onClick, tone = "default", disabled }: { children: React.ReactNode; onClick: () => void; tone?: "default" | "danger" | "ok"; disabled?: boolean }) {
  const toneCls = tone === "danger" ? "border-coral/50 text-coral hover:bg-coral/10" : tone === "ok" ? "border-mint/50 text-mint hover:bg-mint/10" : "border-line text-fg hover:bg-surface-2";
  return <button disabled={disabled} onClick={onClick} className={`min-h-10 rounded-full border bg-white/5 px-4 py-2 text-sm transition-colors disabled:opacity-40 ${toneCls}`}>{children}</button>;
}
function Section({ title, note, step, children }: { title: string; note?: string; step?: number; children: React.ReactNode }) {
  return (
    <section className="rounded-[24px] border border-line bg-surface p-6">
      <h2 className="flex items-center gap-3 text-sm font-medium text-fg">{step && <span aria-hidden className="tabular flex size-7 items-center justify-center rounded-full border border-line bg-white/10 text-xs text-iris">{step}</span>}{title}</h2>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
      <div className="mt-4 flex flex-wrap gap-2">{children}</div>
    </section>
  );
}

export default function LabPage() {
  const { data: caps } = usePoll(() => api.caps(), 3000);
  const { data: ov, connected } = usePoll<Overview>(() => api.state(), 1000);
  const [keys, setKeys] = useState({ operator: "", merchant: "" });
  const [log, setLog] = useState<Log[]>([]);
  const [busy, setBusy] = useState(false);
  const push = (label: string, ok: boolean, detail: string) => setLog((l) => [{ at: Date.now(), label, ok, detail }, ...l].slice(0, 40));

  const run = useCallback(async (label: string, fn: () => Promise<string>) => {
    setBusy(true);
    try { push(label, true, await fn()); }
    catch (e) { const f = e as ApiFailure; push(label, false, `${f.code ?? "ERR"} (${f.status ?? "-"}) ${f.message}`); }
    finally { setBusy(false); }
  }, []);
  const describe = (r: ExecuteResult) =>
    `${r.decision.accepted ? "ACCEPTED" : "REJECTED"} · ${r.decision.reason}` +
    (r.decision.diffs.length ? ` · diffs: ${r.decision.diffs.map((d) => `${d.field} ${d.approved}→${d.attempted}`).join("; ")}` : "") +
    ` · payer balance ${r.evidence.observed.payerBalance} · executions ${r.evidence.observed.executionCount}`;

  const authed = caps?.caps.operator && caps?.caps.merchant;
  const shop = ov?.chain.protected?.shop;
  const ags = ov?.agreements ?? [];

  const exec = (v: AgreementView, kind: "honest" | "recipient" | "amount" | "allowance") => {
    const a = v.agreement; const isBank = a.rail === "bank";
    const attempt = {
      recipient: kind === "recipient" ? (isBank ? BANK_ACCOUNTS.attacker : SUBSTITUTE_ADDR) : a.recipient,
      amount: kind === "amount" ? (BigInt(a.amount) * 5n).toString() : a.amount,
      operation: a.operation,
      continuingAllowance: kind === "allowance" ? "115792089237316195423570985008687907853269984665640564039457584007913129639935" : "0",
    };
    return run(`execute:${kind} ${a.id.slice(0, 8)}`, async () => describe(await api.execute(a.id, attempt)));
  };
  const concurrent = (v: AgreementView) => run(`execute x10 concurrent ${v.agreement.id.slice(0, 8)}`, async () => {
    const a = v.agreement;
    const rs = await Promise.all(Array.from({ length: 10 }, () =>
      api.execute(a.id, { recipient: a.recipient, amount: a.amount, operation: a.operation, continuingAllowance: "0" }).catch(() => null)));
    const acc = rs.filter((r) => r?.decision.accepted).length;
    const fresh = await api.agreement(a.id);
    return `${acc} accepted of ${rs.length}; authoritative execution count ${fresh.executionCount}`;
  });

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-amber">Operator only · demonstration controls</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight"><span className="hero-amount">CounterSign Lab</span></h1>
          <p className="mt-1 text-sm text-muted">Bank simulation · Local-chain demo · {connected === false ? "disconnected" : connected ? "connected" : "connecting"}</p>
        </div>
        <Link href="/command" className="btn-primary rounded-full px-5 py-2.5 text-sm">Open customer view</Link>
      </header>

      {!authed && (
        <Section title="Demo sign-in" note="Role keys stand in for real authentication (disclosed demo component). Local defaults: demo-operator / demo-merchant.">
          <input aria-label="operator key" placeholder="operator key" type="password" value={keys.operator} onChange={(e) => setKeys({ ...keys, operator: e.target.value })} className="min-h-10 rounded-[12px] border border-line bg-bg px-3 text-sm" />
          <input aria-label="merchant key" placeholder="merchant key" type="password" value={keys.merchant} onChange={(e) => setKeys({ ...keys, merchant: e.target.value })} className="min-h-10 rounded-[12px] border border-line bg-bg px-3 text-sm" />
          <Btn onClick={() => run("sign-in", async () => { await api.signIn("operator", keys.operator); await api.signIn("merchant", keys.merchant); return "operator + merchant capabilities granted (no customer capability)"; })}>Sign in</Btn>
        </Section>
      )}

      <div className="mt-5 grid gap-5">
        <Section step={1} title="Propose a payment (merchant checkout fixture)" note="Next: the customer opens /command, pairs a phone and approves there. The merchant receives no approval capability; the customer must pair and approve.">
          <Btn disabled={!authed || busy || !shop} onClick={() => run("create crypto purchase", async () => { const v = await api.createAgreement({ rail: "crypto", recipient: shop!, recipientDisplayName: "Demo Shop", amount: TOKEN_100, itemId: "1", ttlSeconds: 600 }); return `created ${v.agreement.id}`; })}>Propose 100 CSUSD purchase</Btn>
          <Btn disabled={!authed || busy} onClick={() => run("create bank transfer", async () => { const v = await api.createAgreement({ rail: "bank", recipient: BANK_ACCOUNTS.merchant, recipientDisplayName: "Demo Merchant LLC", amount: "10000", ttlSeconds: 600 }); return `created ${v.agreement.id}`; })}>Propose 100.00 AED transfer</Btn>
          <Btn disabled={!authed || busy} onClick={() => run("create short-lived bank transfer", async () => { const v = await api.createAgreement({ rail: "bank", recipient: BANK_ACCOUNTS.merchant, recipientDisplayName: "Demo Merchant LLC", amount: "10000", ttlSeconds: 10 }); return `created ${v.agreement.id} (expires in 10 s)`; })}>Propose transfer expiring in 10 s</Btn>
        </Section>

        <Section step={2} title="Attempt execution (merchant / attack fixture)" note="The fixture can alter the execution proposal. It cannot approve, rewrite approved facts or debit directly.">
          {ags.length === 0 && <p className="text-sm text-muted">No agreements yet.</p>}
          <div className="grid w-full gap-3">
            {ags.map((v) => (
              <div key={v.agreement.id} className="rounded-[12px] border border-line bg-white/5 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span><span className="ident text-muted">{v.agreement.id.slice(0, 8)}</span> · {v.agreement.rail} · {formatUnitsStr(v.agreement.amount, v.agreement.asset.decimals)} {v.agreement.asset.code}</span>
                  <span className="text-muted">state: <span className="text-fg">{v.state}</span> · executions: {v.executionCount}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Btn tone="ok" disabled={!authed || busy} onClick={() => exec(v, "honest")}>Execute as approved</Btn>
                  <Btn tone="danger" disabled={!authed || busy} onClick={() => exec(v, "recipient")}>Substitute recipient</Btn>
                  <Btn tone="danger" disabled={!authed || busy} onClick={() => exec(v, "amount")}>Inflate amount ×5</Btn>
                  <Btn tone="danger" disabled={!authed || busy} onClick={() => exec(v, "allowance")}>Ask unlimited allowance</Btn>
                  <Btn tone="danger" disabled={!authed || busy} onClick={() => exec(v, "honest")}>Replay</Btn>
                  <Btn tone="danger" disabled={!authed || busy} onClick={() => concurrent(v)}>10 concurrent</Btn>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section step={3} title="Compare with an unprotected account (operator)" note="The vulnerable account is an INTENTIONAL comparison fixture: unlimited approval, then the shop drains it later. The same drain is actually sent against the protected account.">
          <Btn tone="danger" disabled={!authed || busy} onClick={() => run("vulnerable purchase", async () => { const s = await api.labVulnerablePurchase(); return `vulnerable balance ${s.customerBalance}, allowance ${s.allowance}`; })}>Run vulnerable purchase</Btn>
          <Btn tone="danger" disabled={!authed || busy} onClick={() => run("drain vulnerable", async () => { const s = await api.labDrain("vulnerable"); return `drain ${s.drainAttempt?.succeeded ? "SUCCEEDED" : "failed"} · balance ${s.customerBalance}`; })}>Send later drain → vulnerable</Btn>
          <Btn tone="danger" disabled={!authed || busy} onClick={() => run("drain protected", async () => { const s = await api.labDrain("protected"); return `drain ${s.drainAttempt?.succeeded ? "SUCCEEDED" : "FAILED"}${s.drainAttempt?.revertReason ? ` (${s.drainAttempt.revertReason})` : ""} · balance ${s.customerBalance} · allowance ${s.allowance}`; })}>Send later drain → protected</Btn>
        </Section>

        <Section title="Reset" note="Clears the ledger and agreements and restores the deterministic chain state.">
          <Btn disabled={!authed || busy} onClick={() => run("reset", async () => { const r = await api.labReset(); return `reset ok · chain reset ${r.chainReset}`; })}>Reset demonstration</Btn>
        </Section>

        <section className="rounded-[24px] border border-line bg-surface p-6">
          <h2 className="text-sm font-medium">Result log (server responses)</h2>
          <ul className="mt-3 space-y-1.5 text-xs">
            {log.length === 0 && <li className="text-muted">Nothing yet.</li>}
            {log.map((l) => (
              <li key={l.at + l.label} className="flex gap-3">
                <span className="ident text-muted">{new Date(l.at).toLocaleTimeString()}</span>
                <span className={l.ok ? "text-mint" : "text-coral"}>{l.ok ? "OK" : "ERR"}</span>
                <span className="text-fg">{l.label}</span>
                <span className="ident text-muted">{l.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
