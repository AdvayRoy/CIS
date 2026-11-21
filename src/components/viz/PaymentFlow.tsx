"use client";
// OWNER: w/viz. Payer -> CounterSign -> Recipient, drawn only from the view and the selected server evidence.
import { useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { MotionConfig, motion } from "motion/react";
import { Landmark, Shield, ShieldCheck, ShieldOff, ShieldX, Store, Wallet, type LucideIcon } from "lucide-react";
import type { AgreementView, ExecutionEvidence } from "@/shared/contract";
import { cn } from "@/lib/cn";
import { fmtAmount, short } from "@/components/desktop/format";

export type FlowMode = "idle" | "approved" | "executing" | "settled" | "rejected" | "closed";

/**
 * The selected evidence wins over the agreement state: a settled agreement with a newer
 * rejected attempt (e.g. a replay) renders as rejected, never as a repeated success.
 */
export function flowMode(view: AgreementView, evidence: ExecutionEvidence | null): FlowMode {
  if (evidence) {
    if (!evidence.decision.accepted) return "rejected";
    const r = evidence.receipt;
    // A posted receipt proves the debit even when the follow-up balance read returned nothing.
    if (evidence.observed.executionCount > 0 || (r && (r.kind === "ledger" || r.status === "success"))) return "settled";
    return view.state === "executing" ? "executing" : "rejected";
  }
  switch (view.state) {
    case "awaiting_approval": return "idle";
    case "approved": return "approved";
    case "executing": return "executing";
    case "settled": return "settled";
    case "rejected": case "failed": return "rejected";
    default: return "closed";
  }
}

const CY = 80, GATE = 500, L0 = 96, L1 = 452, R0 = 548, R1 = 904;
const TICKS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => 124 + i * 30);
const pct = (x: number) => `${x / 10}%`;
const EASE = [0.22, 1, 0.36, 1] as const;
const SPRING = { type: "spring", stiffness: 170, damping: 22, mass: 0.9 } as const;
const TRAVEL = 2.2, TRAVEL_TIMES = [0, 0.4, 0.56, 1], STOP = 1.2, STOP_TIMES = [0, 0.7, 0.86, 1];
const HALT = 430;

const TONE: Record<FlowMode, string> = {
  idle: "text-amber", approved: "text-mint", executing: "text-mint", settled: "text-mint", rejected: "text-coral", closed: "text-muted",
};
const PILL: Record<FlowMode, string> = {
  idle: "border border-white/25 text-fg", approved: "bg-white text-black", executing: "bg-white text-black",
  settled: "bg-mint text-black", rejected: "bg-coral text-black", closed: "border border-white/15 text-muted",
};
const GATE_ICON: Record<FlowMode, LucideIcon> = {
  idle: Shield, approved: ShieldCheck, executing: ShieldCheck, settled: ShieldCheck, rejected: ShieldX, closed: ShieldOff,
};
// One progress value moves the chip from the start edge of its track to the end edge, so it cannot leave the track.
const CHIP_POS = { left: "calc(var(--p) * 100%)", translate: "calc(var(--p) * -100%)" };
const CHIP_TRACK = "pointer-events-none absolute top-1/2 hidden h-0 sm:block";
const LABEL = "text-[11px] font-medium tracking-[0.16em] text-muted uppercase";
const FIGURE = "mt-2 text-[26px] leading-none font-semibold tracking-[-0.04em] sm:text-[44px] lg:text-[56px]";

const RM_QUERY = "(prefers-reduced-motion: reduce)";
const subscribeRM = (cb: () => void) => {
  const mq = window.matchMedia(RM_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
/** Hydration-safe: the server snapshot is "motion allowed", the client corrects it before paint settles. */
const usePrefersReducedMotion = () => useSyncExternalStore(subscribeRM, () => window.matchMedia(RM_QUERY).matches, () => false);

function Money({ value, code, className, codeClassName, strike }: { value: string; code: string; className?: string; codeClassName?: string; strike?: boolean }) {
  return (
    <span dir="ltr" className={cn("tabular inline-flex items-baseline gap-[0.3em] [unicode-bidi:isolate]", className)}>
      <span className={cn(strike && "line-through decoration-current decoration-[0.07em]")}>{value}</span>
      <span className={cn("text-[0.42em] font-medium tracking-wide", codeClassName ?? "text-muted")}>{code}</span>
    </span>
  );
}

function NodeIcon({ icon: Icon, x, className }: { icon: LucideIcon; x: number; className?: string }) {
  return (
    <g className="origin-center [transform-box:fill-box] rtl:-scale-x-100">
      <Icon aria-hidden x={x - 14} y={CY - 14} size={28} strokeWidth={1.75} className={className} />
    </g>
  );
}

export function PaymentFlow({ view, evidence }: { view: AgreementView; evidence: ExecutionEvidence | null }) {
  const t = useTranslations("desktop");
  const tc = useTranslations("common");
  const tm = useTranslations("mobile");
  const reduce = usePrefersReducedMotion();
  const [arrivedKey, setArrivedKey] = useState<string | null>(null);
  const a = view.agreement;
  const code = a.asset.code;
  const amt = (v: string) => fmtAmount(v, a.asset.decimals);

  const mode = flowMode(view, evidence);
  const tone = TONE[mode];
  const stopped = !!evidence && !evidence.decision.accepted;
  const diffs = new Set(stopped ? evidence.decision.diffs.map((d) => d.field) : []);
  const moved = mode === "settled" && !!evidence;
  const blocked = mode === "rejected";
  const solid = mode !== "idle" && mode !== "closed";
  // Remount (and so replay) only when the mode or the selected attempt changes, never on a poll tick.
  const animate = !reduce;
  const runKey = `${mode}:${evidence?.decision.decidedAt ?? 0}:${evidence?.observed.observedAt ?? 0}:${animate ? "m" : "s"}`;
  // Settlement is claimed only once the travelling payment has actually finished, not on a parallel timer.
  const travels = animate && moved;
  const arrived = !travels || arrivedKey === runKey;
  const verdictAt = animate && stopped ? STOP * 0.75 : 0;
  const gateAt = !animate ? 0 : moved ? TRAVEL * 0.4 : stopped ? STOP * 0.7 : 0;

  const status = mode === "idle" ? tc("state.awaiting_approval")
    : mode === "rejected" ? (stopped || view.state !== "failed" ? tc("state.rejected") : tc("state.failed"))
    : mode === "closed" ? tc(`state.${view.state}`)
    : tc(`state.${mode}`);
  const detail = evidence && (stopped || moved) ? tc(`reason.${evidence.decision.reason}`)
    : mode === "idle" ? t("path.awaiting")
    : mode === "settled" ? null
    : t("path.notExecuted");

  const GateIcon = GATE_ICON[mode];
  const PayerIcon = a.rail === "bank" ? Landmark : Wallet;
  const litIn = mode === "settled" || (blocked && !!evidence);
  const litOut = mode === "settled";

  return (
    <MotionConfig reducedMotion="user">
      <section role="group" aria-label={tm("path.label")} data-testid="payment-flow" data-mode={mode}
        className="relative overflow-hidden rounded-[20px] border border-white/10 bg-black p-5 sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[15px] font-semibold tracking-tight text-fg">{tc("brand")}</p>
          <motion.p key={`s-${runKey}`} className={cn("inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] leading-none font-semibold", PILL[mode])}
            initial={animate ? { opacity: 0, scale: 0.94 } : false} animate={arrived ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.94 }} transition={{ ...SPRING, delay: verdictAt }}>
            {mode === "idle" && <span className="size-1.5 rounded-full bg-amber" />}
            {status}
          </motion.p>
        </div>

        {/* approved vs executed/attempted: the two figures the evidence can prove */}
        <div className="mt-7 grid grid-cols-2 gap-5 sm:gap-8">
          <div className="min-w-0">
            <p className={LABEL}>{t("path.approved")}</p>
            <p className={FIGURE}><Money value={amt(a.amount)} code={code} className="text-fg" /></p>
          </div>
          <motion.div key={runKey} className="min-w-0 border-s border-white/10 ps-5 sm:ps-8"
            initial={animate ? { opacity: 0, y: 8 } : false} animate={arrived ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }} transition={{ ...SPRING, delay: verdictAt }}>
            <p className={LABEL}>{stopped ? t("path.attempted") : t("path.executed")}</p>
            <p className={FIGURE}>
              {moved ? <Money value={amt(evidence.attempt.amount)} code={code} className="text-mint" />
                : stopped ? <Money value={amt(evidence.attempt.amount)} code={code} className="text-coral" strike={diffs.has("amount")} />
                : <span className="text-white/25">—</span>}
            </p>
          </motion.div>
        </div>

        {/* stage: mirrored as a whole in RTL so the payer always sits at the inline start */}
        <div className="relative mt-8 rtl:-scale-x-100">
          <svg viewBox="0 0 1000 160" aria-hidden className="block h-auto w-full overflow-visible">
            {/* rail: one measured track into the enforcement point, one out of it */}
            <g fill="none" stroke="#fff" strokeLinecap="round">
              <path d={`M ${L0} ${CY} H ${L1}`} strokeOpacity="0.18" strokeWidth="1.5" />
              <path d={`M ${R0} ${CY} H ${R1}`} strokeOpacity={blocked ? 0.14 : 0.18} strokeWidth="1.5" strokeDasharray={blocked ? "1 9" : undefined} />
              {TICKS.map((x) => <path key={x} d={`M ${x} ${CY - 5} V ${CY + 5}`} strokeOpacity="0.14" />)}
              {!blocked && TICKS.map((x) => <path key={x} d={`M ${1000 - x} ${CY - 5} V ${CY + 5}`} strokeOpacity="0.14" />)}
            </g>
            <g key={runKey} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={tone}>
              {litIn && (
                <motion.path d={`M ${L0} ${CY} H ${blocked ? HALT : L1}`}
                  initial={animate ? { pathLength: 0 } : false} animate={{ pathLength: 1 }}
                  transition={{ duration: moved ? TRAVEL * 0.4 : STOP * 0.7, ease: moved ? "easeInOut" : "easeOut" }} />
              )}
              {litOut && (
                <motion.path d={`M ${R0} ${CY} H ${R1}`}
                  initial={animate ? { pathLength: 0, opacity: 0 } : false} animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: moved ? TRAVEL * 0.44 : 0.8, delay: animate && moved ? TRAVEL * 0.56 : 0, ease: moved ? "easeInOut" : EASE, opacity: { duration: 0.01, delay: animate && moved ? TRAVEL * 0.56 : 0 } }} />
              )}
            </g>

            {/* payer */}
            <rect x="16" y={CY - 40} width="80" height="80" rx="22" fill="#0d0d0d" stroke="#fff" strokeOpacity="0.22" strokeWidth="1.5" />
            <NodeIcon icon={PayerIcon} x={56} className="text-fg" />

            {/* recipient: hollow when the attempt was stopped, filled only on proven settlement */}
            <g opacity={blocked ? 0.45 : 1}>
              <rect x="904" y={CY - 40} width="80" height="80" rx="22" fill={blocked ? "none" : "#0d0d0d"} stroke="#fff" strokeOpacity="0.22" strokeWidth="1.5"
                strokeDasharray={blocked ? "2 7" : undefined} strokeLinecap="round" />
              <NodeIcon icon={Store} x={944} className="text-fg" />
            </g>
            {mode === "settled" && (
              <motion.g key={`lit-${runKey}`} initial={animate ? { opacity: 0 } : false} animate={{ opacity: arrived ? 1 : 0 }}
                transition={{ duration: 0.35 }}>
                <rect x="904" y={CY - 40} width="80" height="80" rx="22" className="fill-mint" />
                <NodeIcon icon={Store} x={944} className="text-black" />
              </motion.g>
            )}
            {travels && arrived && (
              <motion.rect key={`arrive-${runKey}`} x="904" y={CY - 40} width="80" height="80" rx="22" fill="none" className="stroke-mint" strokeWidth="1.5"
                initial={{ opacity: 0, scale: 1 }} animate={{ opacity: [0, 0.8, 0], scale: [1, 1.1, 1.36] }}
                transition={{ duration: 1, ease: "easeOut" }} />
            )}

            {/* the payment itself: crosses only on settlement, halts at the barrier when stopped */}
            {moved && animate && (
              <g key={`orb-${runKey}`} className="text-mint">
                <motion.circle cy={CY} r="12" fill="none" stroke="currentColor" strokeWidth="1.5"
                  initial={{ cx: L0, opacity: 0 }} animate={{ cx: [L0, L1, R0, R1], opacity: [0, 0.5, 0.5, 0] }}
                  transition={{ duration: TRAVEL, times: TRAVEL_TIMES, ease: "easeInOut" }} />
                <motion.circle cy={CY} r="6" fill="currentColor"
                  initial={{ cx: L0, opacity: 0 }} animate={{ cx: [L0, L1, R0, R1], opacity: [0, 1, 1, 0] }}
                  transition={{ duration: TRAVEL, times: TRAVEL_TIMES, ease: "easeInOut" }}
                  onAnimationComplete={() => setArrivedKey(runKey)} />
              </g>
            )}
            {stopped && (
              <g key={`halt-${runKey}`} className="text-coral">
                <motion.circle cy={CY} r="6" fill="currentColor"
                  initial={animate ? { cx: L0, opacity: 0 } : false} animate={{ cx: animate ? [L0, HALT - 4, HALT - 16, HALT - 12] : HALT - 12, opacity: 1 }}
                  transition={{ duration: STOP, times: STOP_TIMES, ease: "easeOut" }} />
                <motion.path d={`M ${HALT} ${CY - 20} V ${CY + 20}`} stroke="currentColor" strokeWidth="3" strokeLinecap="round"
                  initial={animate ? { opacity: 0, scaleY: 0.3 } : false} animate={{ opacity: 1, scaleY: 1 }}
                  transition={{ ...SPRING, delay: gateAt }} />
              </g>
            )}

            {/* CounterSign enforcement point */}
            <g className={tone}>
              {mode === "idle" && animate && (
                <motion.circle cx={GATE} cy={CY} fill="none" stroke="currentColor" strokeWidth="1.25"
                  initial={{ r: 52, opacity: 0.6 }} animate={{ r: [52, 68, 52], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 4.4, repeat: Infinity, ease: "easeInOut" }} />
              )}
              <circle cx={GATE} cy={CY} r="60" fill="none" stroke="#fff" strokeOpacity="0.1" />
              <circle cx={GATE} cy={CY} r="44" fill={solid ? "#fff" : "#000"} stroke="#fff" strokeOpacity={solid ? 0 : mode === "idle" ? 0.4 : 0.18} strokeWidth="1.5" />
              {(mode === "settled" || blocked) && (
                <motion.circle key={`disc-${runKey}`} cx={GATE} cy={CY} r="44" fill="currentColor"
                  initial={animate ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ duration: 0.25, delay: gateAt }} />
              )}
              {solid && (
                <g transform={`rotate(-90 ${GATE} ${CY})`}>
                  <motion.circle key={`ring-${runKey}`} cx={GATE} cy={CY} r="52" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                    initial={animate ? { pathLength: 0, opacity: 0 } : false} animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ ...SPRING, stiffness: 60, delay: animate ? gateAt + 0.05 : 0 }} />
                </g>
              )}
              {blocked && animate && (
                <motion.circle key={`shock-${runKey}`} cx={GATE} cy={CY} fill="none" stroke="currentColor" strokeWidth="1.5"
                  initial={{ r: 52, opacity: 0 }} animate={{ r: [52, 56, 84], opacity: [0, 0.7, 0] }}
                  transition={{ duration: 0.8, delay: gateAt, ease: "easeOut" }} />
              )}
              <motion.g key={`icon-${mode}`} initial={animate ? { scale: 0.6, opacity: 0 } : false} animate={{ scale: 1, opacity: 1 }} transition={SPRING}>
                <NodeIcon icon={GateIcon} x={GATE} className={solid ? "text-black" : mode === "idle" ? "text-fg" : "text-muted"} />
              </motion.g>
            </g>
          </svg>

          {/* amount riding the payment: each chip stays inside its own rail segment, so it never covers a node */}
          {animate && moved && [
            { from: L0, to: L1, delay: 0, duration: TRAVEL * 0.4 },
            { from: R0, to: R1, delay: TRAVEL * 0.56, duration: TRAVEL * 0.44 },
          ].map((seg) => (
            <div key={`chip-${seg.from}-${runKey}`} aria-hidden className={CHIP_TRACK} style={{ left: pct(seg.from + 12), right: pct(1000 - seg.to + 12) }}>
              <motion.div className="absolute bottom-4" style={CHIP_POS}
                initial={{ "--p": 0, opacity: 0 }} animate={{ "--p": 1, opacity: [0, 1, 1, 0] }}
                transition={{ duration: seg.duration, delay: seg.delay, ease: "easeInOut", opacity: { duration: seg.duration, delay: seg.delay, times: [0, 0.2, 0.8, 1], ease: "linear" } }}>
                <span className="inline-block rounded-full bg-mint px-3 py-1 text-[13px] font-semibold whitespace-nowrap text-black rtl:-scale-x-100">
                  <Money value={amt(evidence.attempt.amount)} code={code} codeClassName="text-black/60" />
                </span>
              </motion.div>
            </div>
          ))}
          {stopped && (
            <div key={`chip-${runKey}`} aria-hidden className={CHIP_TRACK} style={{ left: pct(L0 + 12), right: pct(1000 - HALT + 14) }}>
              <motion.div className="absolute bottom-4" style={CHIP_POS}
                initial={animate ? { "--p": 0, opacity: 0 } : false}
                animate={{ "--p": animate ? [0, 1, 0.95, 0.97] : 0.97, opacity: 1 }}
                transition={{ duration: STOP, times: STOP_TIMES, ease: "easeOut" }}>
                <span className="inline-block rounded-full bg-coral px-3 py-1 text-[13px] font-semibold whitespace-nowrap text-black rtl:-scale-x-100">
                  <Money value={amt(evidence.attempt.amount)} code={code} codeClassName="text-black/60" strike={diffs.has("amount")} />
                </span>
              </motion.div>
            </div>
          )}
        </div>

        {/* captions */}
        <div className="mt-7 grid grid-cols-2 gap-x-3 gap-y-5 border-t border-white/10 pt-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)] sm:gap-8 sm:pt-6">
          <div className="min-w-0">
            <p className={LABEL}>{tc("field.payer")}</p>
            <p className="mt-2 wrap-anywhere"><span title={a.payer} className="ident text-[13px] text-fg">{short(a.payer)}</span></p>
            {evidence && (
              <motion.div key={runKey} className="mt-4" initial={animate ? { opacity: 0, y: 4 } : false} animate={arrived ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
                transition={{ ...SPRING, delay: animate && !moved ? STOP : 0 }}>
                <p className="text-[12px] text-muted">{t("path.payerBalance")}</p>
                <p className="mt-1 text-[18px] font-semibold tracking-tight sm:text-[22px]"><Money value={amt(evidence.observed.payerBalance)} code={code} className="text-fg" /></p>
              </motion.div>
            )}
          </div>

          <motion.div key={`d-${runKey}`} className="order-last col-span-2 min-w-0 text-center sm:order-none sm:col-span-1"
            initial={animate ? { opacity: 0, y: 4 } : false} animate={arrived ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }} transition={{ ...SPRING, delay: verdictAt }}>
            {detail && <p className={cn("mx-auto max-w-[28ch] text-[13px] leading-5 font-medium", blocked ? "text-coral" : "text-fg")}>{detail}</p>}
            {(mode === "settled" || blocked) && view.executionCount > 0 && (
              <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-[12px] text-muted">
                {tc("field.executionCount")}<span className="tabular font-semibold text-fg">{view.executionCount}</span>
              </p>
            )}
          </motion.div>

          <div className="min-w-0 text-end">
            <p className={LABEL}>{tc("field.recipient")}</p>
            <p className={cn("mt-2 text-[14px] font-semibold wrap-anywhere", blocked ? "text-muted" : "text-fg")}>{a.recipientDisplayName}</p>
            <p className="wrap-anywhere"><span title={a.recipient} className="ident text-[12px] text-muted">{short(a.recipient)}</span></p>
            {moved && (
              <motion.p key={runKey} className="mt-3 text-[18px] font-semibold tracking-tight sm:text-[22px]"
                initial={animate ? { opacity: 0, y: 6, scale: 0.96 } : false} animate={arrived ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 6, scale: 0.96 }}
                transition={SPRING}>
                <Money value={`+${amt(evidence.attempt.amount)}`} code={code} className="text-mint" />
              </motion.p>
            )}
            {blocked && (
              <motion.div key={runKey} className="mt-3" initial={animate ? { opacity: 0, y: 4 } : false} animate={{ opacity: 1, y: 0 }}
                transition={{ ...SPRING, delay: animate && evidence ? STOP : 0 }}>
                {stopped && diffs.has("recipient") && (
                  <p className="wrap-anywhere"><span title={evidence.attempt.recipient} className="ident text-[12px] text-coral line-through decoration-coral">{short(evidence.attempt.recipient)}</span></p>
                )}
                <p className="mt-1 text-[13px] font-semibold text-coral">{t("path.notExecuted")}</p>
              </motion.div>
            )}
          </div>
        </div>
      </section>
    </MotionConfig>
  );
}
