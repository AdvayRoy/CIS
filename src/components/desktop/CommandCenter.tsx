"use client";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { ArrowLeftRight, Coins, ClipboardCheck, FlaskConical, Landmark, ShoppingBag, PanelRightClose, PanelRightOpen, ShieldCheck, WifiOff } from "lucide-react";
import { api } from "@/lib/api";
import { usePoll } from "@/lib/usePoll";
import { cn } from "@/lib/cn";
import type { Overview } from "@/shared/contract";
import { FIXTURE_OVERVIEW } from "./fixture";
import { EASE, LABEL, fmtAmount, fmtAsset, short, stateTone, toneBg, toneText, type Stage, type Tone } from "./format";
import { AgreementList } from "./AgreementList";
import { TransactionPath } from "./TransactionPath";
import { EvidenceInspector } from "./EvidenceInspector";
import { PairPhone } from "./PairPhone";
import { BankPanel, ChainPanel } from "./RailPanels";
import { Ident, Notice, Pill } from "./ui";
import { AssetsStrip } from "./AssetsStrip";
import { LanguageSelector } from "@/components/i18n/LanguageSelector";

const noSubscribe = () => () => {};

function SignIn({ onDone }: { onDone: () => void }) {
  const t = useTranslations("desktop");
  const [key, setKey] = useState("demo-customer");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <form className="flex items-center gap-2" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setFailed(false);
      try { await api.signIn("customer", key); onDone(); } catch { setFailed(true); } finally { setBusy(false); }
    }}>
      <label htmlFor="cs-role-key" className={cn("text-xs whitespace-nowrap", failed ? "text-coral" : "text-muted")}>
        {failed ? t("signIn.failed") : t("signIn.label")}
      </label>
      <input id="cs-role-key" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" spellCheck={false}
        aria-invalid={failed} className="ident h-9 w-32 rounded-full border border-line px-3 text-[12px] text-fg" />
      <button type="submit" disabled={busy || !key} className="btn-primary h-9 rounded-full px-4 text-[13px] disabled:opacity-40">
        {t("signIn.action")}
      </button>
    </form>
  );
}

export function CommandCenter() {
  const t = useTranslations("desktop");
  const tc = useTranslations("common");
  // ?fixture=1 is read on the client only, so the default (server-rendered) path is always the real API.
  const fixture = useSyncExternalStore<boolean | null>(noSubscribe,
    () => new URLSearchParams(window.location.search).get("fixture") === "1", () => null);

  const live = usePoll<Overview>(api.state, 1000, fixture === false);
  const [capsTick, setCapsTick] = useState(0);
  const [caps, setCaps] = useState<{ customer: boolean } | null>(null);
  useEffect(() => {
    let stop = false;
    api.caps().then((r) => { if (!stop) setCaps(r.caps); }).catch(() => { if (!stop) setCaps(null); });
    return () => { stop = true; };
  }, [capsTick, live.connected]);

  const overview = fixture ? FIXTURE_OVERVIEW : live.data;
  const [inspectorOpen, setInspectorOpen] = useState(true);
  // User picks are remembered only while the authoritative state they were made against is unchanged:
  // a newly created agreement becomes the focus, and new evidence moves focus to its stage.
  const [pick, setPick] = useState<{ id: string; newest: string | null } | null>(null);
  const [stagePick, setStagePick] = useState<{ key: string; stage: Stage } | null>(null);
  const [attemptPick, setAttemptPick] = useState<{ key: string; idx: number } | null>(null);

  const agreements = useMemo(() => [...(overview?.agreements ?? [])].sort((a, b) => b.agreement.createdAt - a.agreement.createdAt), [overview]);
  const newestId = agreements[0]?.agreement.id ?? null;
  const selectedId = pick && pick.newest === newestId ? pick.id : null;
  const view = agreements.find((v) => v.agreement.id === selectedId) ?? agreements[0] ?? null;
  const count = view?.evidence.length ?? 0;
  const key = `${view?.agreement.id ?? ""}:${count}`;
  const lastEv = view && count ? view.evidence[count - 1] : null;
  const bad = !!lastEv && !lastEv.decision.accepted;
  const evidenceIdx = count ? Math.min(attemptPick?.key === key ? attemptPick.idx : count - 1, count - 1) : -1;
  const evidence = view && evidenceIdx >= 0 ? view.evidence[evidenceIdx] : null;
  const defaultStage: Stage = !count || !view ? "approved" : view.evidence[count - 1].decision.accepted ? "executed" : "attempted";
  const stage = stagePick?.key === key ? stagePick.stage : defaultStage;

  // Four-step summary of the selected attempt. Every value comes from server evidence; nothing is inferred client-side.
  const summary: { label: string; value: string; tone: Tone }[] = view ? [
    { label: t("path.approved"), tone: view.approval ? "mint" : view.state === "awaiting_approval" ? "amber" : "muted",
      value: view.approval ? fmtAsset(view.agreement.amount, view.agreement.asset) : tc(`state.${view.state}`) },
    { label: t("path.attempted"), tone: !evidence ? "muted" : evidence.decision.diffs.length ? "coral" : "mint",
      value: evidence ? fmtAsset(evidence.attempt.amount, view.agreement.asset) : t("path.noAttempt") },
    { label: t("inspector.decision"), tone: !evidence ? "muted" : evidence.decision.accepted ? "mint" : "coral",
      value: evidence ? (evidence.decision.accepted ? t("inspector.accepted") : t("inspector.rejected")) : "—" },
    { label: t("path.executed"), tone: !evidence ? "muted" : evidence.decision.accepted && evidence.receipt ? "mint" : "coral",
      value: evidence ? tc(`reason.${evidence.decision.reason}`) : t("path.notExecuted") },
  ] : [];

  const select = (id: string) => setPick({ id, newest: newestId });
  const setStage = (s: Stage) => setStagePick({ key, stage: s });
  const setAttemptIdx = (idx: number) => setAttemptPick({ key, idx });
  const pickStage = (s: Stage) => { setStage(s); setInspectorOpen(true); };

  const conn: { tone: Tone; label: string } = fixture
    ? { tone: "amber", label: t("fixture.badge") }
    : live.connected === true ? (live.error ? { tone: "amber", label: t("status.serverError") } : { tone: "mint", label: tc("connection.connected") })
    : live.connected === false ? { tone: "coral", label: tc("connection.disconnected") }
    : { tone: "muted", label: tc("connection.connecting") };
  const stale = !fixture && live.connected === false;
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const navBtn = "flex size-10 items-center justify-center rounded-xl text-muted transition-colors duration-200 hover:bg-surface hover:text-fg";

  return (
    <MotionConfig reducedMotion="user">
    <div className="flex h-[calc(100dvh-1.5rem)] min-h-0 w-full overflow-hidden text-fg">
      {/* Slim rail */}
      <aside className="glass-bar flex w-12 shrink-0 flex-col items-center gap-2 border-e border-line py-3 sm:w-16">
        <div className="mb-2 flex size-9 items-center justify-center rounded-[14px] btn-primary" title={tc("brand")}><ShieldCheck aria-hidden className="size-5" /></div>
        <button type="button" className={navBtn} onClick={() => scrollTo("payment")} aria-label={t("nav.payment")} title={t("nav.payment")}><ArrowLeftRight aria-hidden className="size-[18px]" /></button>
        <button type="button" className={navBtn} onClick={() => scrollTo("chain")} aria-label={t("nav.chain")} title={t("nav.chain")}><Coins aria-hidden className="size-[18px]" /></button>
        <button type="button" className={navBtn} onClick={() => scrollTo("bank")} aria-label={t("nav.bank")} title={t("nav.bank")}><Landmark aria-hidden className="size-[18px]" /></button>
        <Link href="/shop" className={cn(navBtn, "mt-auto")} aria-label="Demo Shop" title="Demo Shop"><ShoppingBag aria-hidden className="size-[18px]" /></Link>
        <Link href="/evidence" className={navBtn} aria-label="Evidence" title="Evidence"><ClipboardCheck aria-hidden className="size-[18px]" /></Link>
        <Link href="/lab" className={navBtn} aria-label={t("nav.lab")} title={t("nav.lab")}><FlaskConical aria-hidden className="size-[18px]" /></Link>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass-bar relative z-20 flex h-16 shrink-0 items-center gap-3 border-b border-line px-4 sm:gap-4 sm:px-6">
          <div className="flex min-w-0 items-baseline gap-3">
            <h1 className="truncate font-sans text-[15px] font-semibold tracking-tight">{tc("brand")}</h1>
            <span aria-hidden className="h-3 w-px self-center bg-line max-md:hidden" />
            <span className={cn(LABEL, "truncate max-md:hidden")}>{t("title")}</span>
          </div>
          <div className="ms-auto flex shrink-0 items-center gap-2 sm:gap-3">
            {!fixture && caps && !caps.customer && <SignIn onDone={() => setCapsTick((n) => n + 1)} />}
            {!fixture && caps?.customer && <span className="text-xs text-muted">{t("signIn.active")}</span>}
            {/* LANGUAGE SELECTOR SLOT — worker F: render <LanguageSelector /> from "@/components/i18n/LanguageSelector" inside this element. */}
            <div data-slot="language-selector" className="flex items-center"><LanguageSelector /></div>
            <span role="status" aria-live="polite"><Pill tone={conn.tone}>{conn.label}</Pill></span>
            <button type="button" onClick={() => setInspectorOpen((o) => !o)} aria-expanded={inspectorOpen} aria-controls="evidence-inspector"
              aria-label={inspectorOpen ? t("inspector.hide") : t("inspector.show")} title={inspectorOpen ? t("inspector.hide") : t("inspector.show")}
              className="flex size-9 items-center justify-center rounded-xl border border-line text-muted hover:bg-surface hover:text-fg">
              {inspectorOpen ? <PanelRightClose aria-hidden className="size-4 rtl:rotate-180" /> : <PanelRightOpen aria-hidden className="size-4 rtl:rotate-180" />}
            </button>
          </div>
        </header>

        <AnimatePresence initial={false}>
          {(stale || fixture) && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: EASE }}
              role="alert" className={cn("shrink-0 overflow-hidden border-b text-[13px]", stale ? "border-coral/40 bg-coral/10 text-coral" : "border-amber/40 bg-amber/10 text-amber")}>
              <p className="flex items-center gap-2 px-5 py-2">{stale && <WifiOff aria-hidden className="size-4" />}{stale ? tc("reason.DISCONNECTED") : t("fixture.banner")}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Below lg the three columns stack and the whole row scrolls; from lg up each column scrolls on its own. */}
        <div className="flex min-h-0 flex-1 max-lg:flex-col max-lg:overflow-y-auto">
          <div className="flex shrink-0 flex-col border-line max-lg:max-h-56 max-lg:border-b lg:w-60 lg:border-e min-[1400px]:w-64"><AgreementList agreements={agreements} selectedId={view?.agreement.id ?? null} onSelect={select} /></div>

          <main className={cn("min-w-0 overflow-x-hidden transition-opacity duration-200 max-lg:shrink-0 lg:flex-1 lg:overflow-y-auto", stale && "opacity-70")}>
            <div className="mx-auto flex max-w-[1040px] flex-col gap-4 p-4 sm:p-6">
              {overview && <AssetsStrip overview={overview} bankLabel={tc("env.bank")} chainLabel={tc("env.chain")} payLabel="Demo Shop" protectedRail={bad && view ? view.agreement.rail : null} />}
              <section id="payment" className="flex flex-col gap-4">
                {!overview ? <Notice tone={live.connected === false ? "coral" : "muted"}>{live.connected === false ? t("status.noData") : t("status.loading")}</Notice>
                  : !view ? (
                    <div className="rounded-[16px] border border-line bg-surface p-10">
                      <p className="text-lg font-medium">{t("empty.title")}</p>
                      <p className="mt-1 max-w-md text-[13px] leading-relaxed text-muted">{t("empty.body")}</p>
                      <Link href="/shop" className="mt-4 btn-primary inline-flex h-11 items-center rounded-full px-5 text-sm">Demo Shop</Link>
                    </div>
                  ) : (<>
                    <div key={`${view.agreement.id}:${view.state}:${count}`} className={cn("overflow-hidden rounded-[16px] border bg-surface transition-colors duration-300", bad ? "border-coral/50 cs-stop" : view.state === "settled" ? "border-mint/40" : "border-line")}>
                     <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 p-5 sm:p-7">
                      <div className="min-w-0">
                        <p className={cn(LABEL, "flex items-center gap-2")}>
                          <span>{tc(`rail.${view.agreement.rail}`)}</span><span aria-hidden>·</span>
                          <span>{tc(`env.${view.agreement.rail === "bank" ? "bank" : "chain"}`)}</span>
                        </p>
                        <p className="tabular mt-3 text-5xl leading-none font-semibold tracking-[-0.03em] break-words sm:text-[64px]"><span className="hero-amount">{fmtAmount(view.agreement.amount, view.agreement.asset.decimals)}</span>
                          <span className="ms-2 text-xl font-normal text-muted">{view.agreement.asset.code}</span></p>
                        <p className="mt-4 truncate text-[13px] text-muted">
                          {t("hero.to")} <span className="text-fg">{view.agreement.recipientDisplayName}</span>{" "}
                          <Ident value={view.agreement.recipient} display={short(view.agreement.recipient, 10, 8)} />
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                        <motion.span key={view.state} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.25, ease: EASE }}>
                          <Pill tone={stateTone(view.state)} className="px-3 py-1.5 text-[13px]">{tc(`state.${view.state}`)}</Pill>
                        </motion.span>
                        <span className="tabular text-xs text-muted">{tc("field.executionCount")}: {view.executionCount}</span>
                      </div>
                     </div>
                     {/* Intended -> attempted -> enforced -> outcome, every cell read from the server's evidence. */}
                     <div className="overflow-hidden border-t border-line">
                     <dl className="-ms-px -mt-px grid grid-cols-2 sm:grid-cols-4">
                       {summary.map((c) => (
                         <div key={c.label} className="min-w-0 border-s border-t border-line px-5 py-3.5">
                           <dt className={LABEL}>{c.label}</dt>
                           <dd className={cn("mt-1.5 flex min-w-0 items-start gap-2 text-[13px] leading-5 font-medium", c.tone === "muted" ? "text-muted" : "text-fg")}>
                             <span aria-hidden className={cn("mt-[7px] size-1.5 shrink-0 rounded-full", toneBg[c.tone])} />
                             <span className={cn("tabular min-w-0 break-words", c.tone !== "muted" && c.tone !== "mint" && toneText[c.tone])}>{c.value}</span>
                           </dd>
                         </div>
                       ))}
                     </dl>
                     </div>
                    </div>

                    {view.state === "awaiting_approval" && (
                      <PairPhone key={view.agreement.id} agreementId={view.agreement.id} canPair={!fixture && !!caps?.customer} serverTime={overview.serverTime} />
                    )}

                    {/* PAYMENT FLOW SLOT: mount the full-width Payer -> CounterSign -> Recipient component here, e.g. <PaymentFlow view={view} evidence={evidence} />. */}
                    <div data-slot="payment-flow" className="contents" />

                    <TransactionPath view={view} evidence={evidence} stage={stage} onStage={pickStage} />

                    {view.evidence.length > 1 && (
                      <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
                        <span className={cn(LABEL, "me-2")}>{t("attempts.label")}</span>
                        {view.evidence.map((e, i) => (
                          <button key={i} type="button" onClick={() => setAttemptIdx(i)} aria-pressed={i === evidenceIdx}
                            className={cn("relative h-8 rounded-full px-3 transition-colors duration-200", i === evidenceIdx ? "text-fg" : "text-muted hover:text-fg")}>
                            {i === evidenceIdx && <motion.span layoutId="attempt-active" aria-hidden transition={{ duration: 0.3, ease: EASE }} className="absolute inset-0 rounded-full border border-line bg-white/[0.07]" />}
                            <span className="relative">
                            <span aria-hidden className={cn("me-1.5 inline-block size-1.5 rounded-full align-middle", e.decision.accepted ? "bg-mint" : "bg-coral")} />
                            {t("attempts.item", { n: i + 1 })} · {e.decision.accepted ? t("inspector.accepted") : t("inspector.rejected")}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>)}
              </section>
              {overview && view?.agreement.rail === "bank" && <BankPanel bank={overview.bank} label={tc("env.bank")} />}
              {overview && <ChainPanel chain={overview.chain} label={tc("env.chain")} />}
              {overview && view?.agreement.rail !== "bank" && <BankPanel bank={overview.bank} label={tc("env.bank")} />}
            </div>
          </main>

          <motion.aside id="evidence-inspector" aria-label={t("inspector.title")} aria-hidden={!inspectorOpen} inert={!inspectorOpen}
            initial={false} animate={{ width: inspectorOpen ? 340 : 0 }} transition={{ duration: 0.32, ease: EASE }}
            className={cn("shrink-0 overflow-hidden glass-bar max-lg:!w-full", inspectorOpen ? "border-line max-lg:border-t lg:border-s" : "max-lg:hidden")}>
            <EvidenceInspector view={view} evidence={evidence} stage={stage} onStage={setStage} />
          </motion.aside>
        </div>
      </div>
    </div>
    </MotionConfig>
  );
}
