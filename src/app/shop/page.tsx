"use client";
// Merchant checkout fixture (English, demo). Holds only the merchant capability: it can propose a payment
// and submit the execution attempt. It cannot approve; the customer does that on a paired phone.
// Every paid / stopped / balance figure below is read from the server response for the current order id.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { ArrowRight, Check, Loader2, ShieldCheck, Smartphone, X } from "lucide-react";
import { api, type ApiFailure } from "@/lib/api";
import { usePoll } from "@/lib/usePoll";
import { cn } from "@/lib/cn";
import { BANK_ACCOUNTS, type AgreementView, type Overview } from "@/shared/contract";
import { ProductBar, type JourneyStep } from "@/components/product/Journey";
import { fmtAsset } from "@/components/desktop/format";

const TOKEN_100 = "100000000000000000000";
const EASE = [0.165, 0.84, 0.44, 1] as const;
type Rail = "bank" | "crypto";

const label = "text-[11px] font-medium uppercase tracking-[0.14em] text-muted";
const card = "rounded-[16px] border border-line bg-surface p-6 sm:p-8";

function Fact({ k, children, tone }: { k: string; children: React.ReactNode; tone?: "mint" | "coral" | "amber" }) {
  return (
    <div className="grid gap-1 border-t border-line py-3 first:border-t-0 first:pt-0 last:pb-0 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-4">
      <dt className={label}>{k}</dt>
      <dd dir="auto" className={cn("min-w-0 text-start text-sm leading-relaxed", tone === "mint" ? "text-mint" : tone === "coral" ? "text-coral" : tone === "amber" ? "text-amber" : "text-fg")}>{children}</dd>
    </div>
  );
}

export default function ShopPage() {
  const tc = useTranslations("common");
  const { data: ov } = usePoll<Overview>(() => api.state(), 1500);
  const [rail, setRail] = useState<Rail>("bank");
  const [id, setId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: polled, connected } = usePoll<AgreementView>(() => api.agreement(id!), 1000, !!id);
  // Never render a previous order's state for the current order id.
  const view = polled && polled.agreement.id === id ? polled : null;
  const submitted = useRef<string | null>(null);
  const shop = ov?.chain.protected?.shop;
  const chainUp = !!ov?.chain.available && !!shop;

  // An honest merchant submits exactly what was approved, once, as soon as the approval exists.
  useEffect(() => {
    if (!view || view.state !== "approved" || submitted.current === view.agreement.id) return;
    submitted.current = view.agreement.id;
    const a = view.agreement;
    api.execute(a.id, { recipient: a.recipient, amount: a.amount, operation: a.operation, continuingAllowance: "0" })
      .catch((e: ApiFailure) => setError(`${e.code}: ${e.message}`));
  }, [view]);

  const pay = async () => {
    setBusy(true); setError(null);
    try {
      await api.signIn("merchant", "demo-merchant");
      const v = await api.createAgreement(rail === "bank"
        ? { rail: "bank", recipient: BANK_ACCOUNTS.merchant, recipientDisplayName: "Demo Merchant LLC", amount: "10000", ttlSeconds: 600 }
        : { rail: "crypto", recipient: shop!, recipientDisplayName: "Demo Shop", amount: TOKEN_100, itemId: "1", ttlSeconds: 600 });
      setId(v.agreement.id);
    } catch (e) { const f = e as ApiFailure; setError(`${f.code ?? "ERR"}: ${f.message}`); }
    finally { setBusy(false); }
  };

  const state = view?.state;
  const receipt = view?.evidence.find((e) => e.receipt)?.receipt;
  const last = view && view.evidence.length ? view.evidence[view.evidence.length - 1] : null;
  const step = !id || !view ? 0 : state === "awaiting_approval" ? 1 : state === "approved" || state === "executing" ? 2 : state === "settled" ? 3 : -1;
  const steps = ["Order placed", "Customer approves on their phone", "Shop submits the approved payment", "Paid"];
  const code = rail === "bank" ? "AED" : "CSUSD";
  const price = rail === "bank" ? "100.00 AED" : "100 CSUSD";
  const recipient = view ? view.agreement.recipient : rail === "bank" ? BANK_ACCOUNTS.merchant : shop ?? "";
  const journey: JourneyStep = step === 1 ? "approval" : step === 2 ? "execution" : step === 3 || step === -1 ? "evidence" : "checkout";
  const fmt = (amount: string) => view ? fmtAsset(amount, view.agreement.asset) : amount;

  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.3, ease: EASE }}>
      <ProductBar current={journey} context="Demo Shop" />
      <main className="mx-auto grid w-full max-w-6xl items-start gap-5 px-4 py-6 sm:px-6 sm:py-10 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <section className={card} aria-labelledby="order-title">
          <p className={label}>Demo Shop · Order</p>
          <h1 id="order-title" className="mt-4 text-[36px] leading-[1.08] sm:text-[44px]">Annual membership</h1>
          <p className="ticker mt-6 flex flex-wrap items-baseline gap-x-2 text-[56px] font-medium leading-none sm:text-[72px]">
            <span className="hero-amount">{rail === "bank" ? "100.00" : "100"}</span><span className="text-xl font-normal text-muted">{code}</span>
          </p>
          <div className="seg mt-7" role="group" aria-label="Payment method">
            <button type="button" aria-pressed={rail === "bank"} disabled={!!id} onClick={() => setRail("bank")}>Bank transfer</button>
            <button type="button" aria-pressed={rail === "crypto"} disabled={!!id || !chainUp} onClick={() => setRail("crypto")}>CSUSD token</button>
          </div>
          {!chainUp && <p className="mt-2 text-xs text-amber">Local chain is not available; token payment is disabled.</p>}

          <div className="mt-7 rounded-[12px] border border-line p-4">
            <p className={label}>What you will be asked to approve</p>
            <dl className="mt-3 space-y-2 text-[13px]">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5"><dt className="text-muted">{tc("field.recipient")}</dt><dd className="ident min-w-0 text-end text-[12px] text-fg">{recipient || "-"}</dd></div>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5"><dt className="text-muted">{tc("field.amount")}</dt><dd className="tabular text-fg">{rail === "bank" ? "Exactly" : "At most"} {price}</dd></div>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5"><dt className="text-muted">Use</dt><dd className="text-fg">Once</dd></div>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5"><dt className="text-muted">{tc("field.continuingAllowance")}</dt><dd className="text-fg">None</dd></div>
            </dl>
            <p className="mt-3 text-xs leading-relaxed text-muted">The shop cannot change the recipient, take more than that, or charge twice.</p>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            {!id ? (
              <button type="button" onClick={pay} disabled={busy} className="btn-primary inline-flex h-12 items-center gap-2 rounded-full px-7 text-sm disabled:opacity-50">
                {busy ? <Loader2 aria-hidden className="size-4 animate-spin motion-reduce:animate-none" /> : <ShieldCheck aria-hidden className="size-4" />}Pay with CounterSign
              </button>
            ) : (
              <button type="button" onClick={() => { setId(null); setError(null); }} className="inline-flex h-12 items-center rounded-full border border-line px-6 text-sm transition-colors duration-200 hover:bg-surface-2">New order</button>
            )}
          </div>
          {error && <p role="alert" className="mt-4 text-sm text-coral">{error}</p>}
        </section>

        <section className={cn(card, id && "order-first md:order-none")} aria-live="polite" aria-labelledby="status-title">
          <h2 id="status-title" className={label}>Order status</h2>
          {!id && <p className="mt-5 text-sm leading-relaxed text-muted">Nothing ordered yet. Choose a payment method and press Pay with CounterSign.</p>}
          {id && (
            <>
              <ol className="mt-5 space-y-4">
                {steps.map((s, i) => {
                  // A stopped order keeps the steps the server confirmed: it exists, and it was approved only if an approval is recorded.
                  const reached = step === -1 ? (view?.approval ? 2 : 1) : step;
                  const done = reached > i || step === 3; const active = step !== -1 && step === i && step !== 3;
                  const stopped = step === -1 && reached === i;
                  return (
                    <li key={s} className="flex items-start gap-3">
                      <span className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] transition-colors duration-300",
                        done ? "border-mint bg-mint text-black" : stopped ? "border-coral text-coral" : active ? "border-amber text-amber" : "border-line text-muted")}>
                        {done ? <Check aria-hidden className="size-3.5" /> : stopped ? <X aria-hidden className="size-3.5" /> : active ? <Loader2 aria-hidden className="size-3.5 animate-spin motion-reduce:animate-none" /> : i + 1}
                      </span>
                      <span className={cn("text-sm transition-colors duration-300", done || active || stopped ? "text-fg" : "text-muted")}>{s}</span>
                    </li>
                  );
                })}
              </ol>
              {connected === false && <p role="alert" className="mt-5 text-sm text-amber">Connection lost. The status above may be out of date.</p>}

              <AnimatePresence mode="wait" initial={false}>
                {step === 1 && (
                  <motion.div key="wait" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-6 rounded-[12px] border border-amber/40 p-4">
                    <p className="flex items-center gap-2 text-sm font-medium text-amber"><Smartphone aria-hidden className="size-4" />Waiting for the customer</p>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted">Open your CounterSign account, pair your phone and approve this payment there. This shop page cannot approve it.</p>
                    <Link href="/command" target="_blank" rel="noopener" className="btn-primary mt-4 inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm">Open CounterSign account<ArrowRight aria-hidden className="size-4 rtl:rotate-180" /></Link>
                  </motion.div>
                )}
                {step === -1 && view && (
                  <motion.div key="stopped" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-6">
                    <p role="alert" className="cs-stop flex items-start gap-2 rounded-[12px] border border-coral/50 p-4 text-sm text-coral"><X aria-hidden className="mt-0.5 size-4 shrink-0" /><span>Not paid: {view.state === "declined" ? "the customer declined on their phone." : view.state === "expired" ? "the approval window expired." : `state ${view.state}.`}</span></p>
                  </motion.div>
                )}
                {step === 3 && view && (
                  <motion.div key="paid" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-6 rounded-[12px] border border-mint/50 p-5">
                    <p className="flex items-center gap-2 text-xl font-semibold text-mint"><Check aria-hidden className="size-5" />Order confirmed</p>
                    <p dir="auto" className="tabular mt-1.5 text-start text-xs text-muted">{view.agreement.rail === "bank" ? "Paid" : "Approved limit"} {fmt(view.agreement.amount)}, executed {view.executionCount} time.</p>
                    {receipt && <p className="ident mt-2 text-[11px] text-muted">{receipt.kind === "ledger" ? receipt.transferId : receipt.txHash}</p>}
                  </motion.div>
                )}
              </AnimatePresence>

              {view && (
                <dl className="mt-6 border-t border-line pt-5">
                  <Fact k="You intended">
                    <span className="tabular">{fmt(view.agreement.amount)}</span> to <span className="ident text-[12px]">{view.agreement.recipient}</span>, once, no continuing permission.
                    <span dir="auto" className="block text-xs text-muted">{view.approval ? "Approved on the paired phone." : tc(`state.${view.state}`)}</span>
                  </Fact>
                  <Fact k="Shop attempted">
                    {last ? <><span className="tabular">{fmt(last.attempt.amount)}</span> to <span className="ident text-[12px]">{last.attempt.recipient}</span></> : <span className="text-muted">Nothing submitted yet.</span>}
                  </Fact>
                  <Fact k="CounterSign enforced" tone={last ? (last.decision.accepted ? "mint" : "coral") : undefined}>
                    {last ? tc(`reason.${last.decision.reason}`) : <span className="text-muted">No decision yet.</span>}
                  </Fact>
                  <Fact k="Money">
                    <span className="tabular">{tc("field.executionCount")}: {view.executionCount}</span>
                    <span dir="auto" className="tabular block text-xs text-muted">{last ? <>{tc("field.balance")} after the attempt: {fmt(last.observed.payerBalance)}</> : "No attempt has reached the rail."}</span>
                  </Fact>
                </dl>
              )}

              {(step === 3 || step === -1) && (
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href="/evidence" className="btn-primary inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm">See the evidence<ArrowRight aria-hidden className="size-4 rtl:rotate-180" /></Link>
                  <Link href="/command" className="inline-flex h-11 items-center rounded-full border border-line px-5 text-sm transition-colors duration-200 hover:bg-surface-2">View in Payments</Link>
                </div>
              )}
              <p className="ident mt-6 text-[11px] text-muted">{id}</p>
            </>
          )}
        </section>
      </main>
    </MotionConfig>
  );
}
