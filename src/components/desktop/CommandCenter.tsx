"use client";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { ArrowLeftRight, Coins, FlaskConical, Landmark, ShoppingBag, PanelRightClose, PanelRightOpen, ShieldCheck, WifiOff } from "lucide-react";
import { api } from "@/lib/api";
import { usePoll } from "@/lib/usePoll";
import { cn } from "@/lib/cn";
import type { Overview } from "@/shared/contract";
import { FIXTURE_OVERVIEW } from "./fixture";
import { fmtAmount, short, stateTone, type Stage, type Tone } from "./format";
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
    <div className="flex h-dvh min-h-0 w-full overflow-hidden text-fg">
      {/* Slim rail */}
      <aside className="glass-bar flex w-16 shrink-0 flex-col items-center gap-2 border-e border-line py-3">
        <div className="mb-2 flex size-9 items-center justify-center rounded-[14px] btn-primary" title={tc("brand")}><ShieldCheck aria-hidden className="size-5" /></div>
        <button type="button" className={navBtn} onClick={() => scrollTo("payment")} aria-label={t("nav.payment")} title={t("nav.payment")}><ArrowLeftRight aria-hidden className="size-[18px]" /></button>
        <button type="button" className={navBtn} onClick={() => scrollTo("chain")} aria-label={t("nav.chain")} title={t("nav.chain")}><Coins aria-hidden className="size-[18px]" /></button>
        <button type="button" className={navBtn} onClick={() => scrollTo("bank")} aria-label={t("nav.bank")} title={t("nav.bank")}><Landmark aria-hidden className="size-[18px]" /></button>
        <Link href="/shop" className={cn(navBtn, "mt-auto")} aria-label="Demo Shop" title="Demo Shop"><ShoppingBag aria-hidden className="size-[18px]" /></Link>
        <Link href="/lab" className={navBtn} aria-label={t("nav.lab")} title={t("nav.lab")}><FlaskConical aria-hidden className="size-[18px]" /></Link>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass-bar relative z-20 flex h-16 shrink-0 items-center gap-4 border-b border-line px-6">
          <div className="flex min-w-0 items-baseline gap-3">
            <h1 className="text-[15px] font-semibold tracking-tight">{tc("brand")}</h1>
            <p className="hidden truncate text-[13px] text-muted min-[1360px]:block">{tc("tagline")}</p>
          </div>
          <div className="ms-auto flex shrink-0 items-center gap-3">
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
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
              role="alert" className={cn("shrink-0 overflow-hidden border-b text-[13px]", stale ? "border-coral/40 bg-coral/10 text-coral" : "border-amber/40 bg-amber/10 text-amber")}>
              <p className="flex items-center gap-2 px-5 py-2">{stale && <WifiOff aria-hidden className="size-4" />}{stale ? tc("reason.DISCONNECTED") : t("fixture.banner")}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex min-h-0 flex-1">
          <div className="w-60 shrink-0 border-e border-line min-[1400px]:w-64"><AgreementList agreements={agreements} selectedId={view?.agreement.id ?? null} onSelect={select} /></div>

          <main className={cn("min-w-0 flex-1 overflow-x-hidden overflow-y-auto transition-opacity duration-200", stale && "opacity-70")}>
            <div className="mx-auto flex max-w-[1000px] flex-col gap-5 p-6">
              {overview && <AssetsStrip overview={overview} bankLabel={tc("env.bank")} chainLabel={tc("env.chain")} payLabel="Demo Shop" protectedRail={bad && view ? view.agreement.rail : null} />}
              <section id="payment" className="flex flex-col gap-5">
                {!overview ? <Notice tone={live.connected === false ? "coral" : "muted"}>{live.connected === false ? t("status.noData") : t("status.loading")}</Notice>
                  : !view ? (
                    <div className="rounded-[20px] border border-line bg-surface p-10">
                      <p className="text-lg font-medium">{t("empty.title")}</p>
                      <p className="mt-1 max-w-md text-[13px] leading-relaxed text-muted">{t("empty.body")}</p>
                      <Link href="/shop" className="mt-4 btn-primary inline-flex h-11 items-center rounded-full px-5 text-sm">Demo Shop</Link>
                    </div>
                  ) : (<>
                    <div key={`${view.agreement.id}:${view.state}:${count}`} className={cn("tilt sheen flex items-end justify-between gap-6 rounded-[20px] border bg-surface p-7", bad ? "border-coral/50 glow-coral cs-stop" : view.state === "settled" ? "border-mint/40 glow-mint" : "border-line")}>
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-[13px] text-muted">
                          <span>{tc(`rail.${view.agreement.rail}`)}</span><span aria-hidden>·</span>
                          <span>{tc(`env.${view.agreement.rail === "bank" ? "bank" : "chain"}`)}</span>
                        </p>
                        <p className="tabular mt-1 text-6xl font-semibold tracking-tight"><span className="hero-amount">{fmtAmount(view.agreement.amount, view.agreement.asset.decimals)}</span>
                          <span className="ms-2 text-xl font-normal text-muted">{view.agreement.asset.code}</span></p>
                        <p className="mt-2 truncate text-[13px] text-muted">
                          {t("hero.to")} <span className="text-fg">{view.agreement.recipientDisplayName}</span>{" "}
                          <Ident value={view.agreement.recipient} display={short(view.agreement.recipient, 10, 8)} />
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <motion.span key={view.state} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.22 }}>
                          <Pill tone={stateTone(view.state)} className="px-3 py-1.5 text-[13px]">{tc(`state.${view.state}`)}</Pill>
                        </motion.span>
                        <span className="tabular text-xs text-muted">{tc("field.executionCount")}: {view.executionCount}</span>
                      </div>
                    </div>

                    {view.state === "awaiting_approval" && (
                      <PairPhone key={view.agreement.id} agreementId={view.agreement.id} canPair={!fixture && !!caps?.customer} serverTime={overview.serverTime} />
                    )}

                    <TransactionPath view={view} evidence={evidence} stage={stage} onStage={pickStage} />

                    {view.evidence.length > 1 && (
                      <div className="flex flex-wrap items-center gap-2 text-[13px]">
                        <span className="text-muted">{t("attempts.label")}</span>
                        {view.evidence.map((e, i) => (
                          <button key={i} type="button" onClick={() => setAttemptIdx(i)} aria-pressed={i === evidenceIdx}
                            className={cn("h-8 rounded-lg border px-3 transition-colors duration-200", i === evidenceIdx ? "border-line bg-surface-2 text-fg" : "border-transparent text-muted hover:text-fg")}>
                            <span aria-hidden className={cn("me-1.5 inline-block size-1.5 rounded-full align-middle", e.decision.accepted ? "bg-mint" : "bg-coral")} />
                            {t("attempts.item", { n: i + 1 })} · {e.decision.accepted ? t("inspector.accepted") : t("inspector.rejected")}
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
            initial={false} animate={{ width: inspectorOpen ? 340 : 0 }} transition={{ duration: 0.26, ease: "easeOut" }}
            className={cn("shrink-0 overflow-hidden glass-bar", inspectorOpen && "border-s border-line")}>
            <EvidenceInspector view={view} evidence={evidence} stage={stage} onStage={setStage} />
          </motion.aside>
        </div>
      </div>
    </div>
    </MotionConfig>
  );
}
