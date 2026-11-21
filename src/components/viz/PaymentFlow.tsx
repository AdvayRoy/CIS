"use client";
// OWNER: w/viz. Payer -> CounterSign -> Recipient, drawn only from the view and the selected server evidence.
import { useId, useSyncExternalStore } from "react";
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
    if (evidence.observed.executionCount > 0) return "settled";
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

const CY = 100, GATE = 500, LANES = [-2, -1, 0, 1, 2];
const L0 = 112, L1 = 448, R0 = 552, R1 = 888;
const laneIn = (k: number) => `M ${L0} ${CY + k * 12} C 250 ${CY + k * 12}, 330 ${CY + k * 3}, ${L1} ${CY + k * 3}`;
const laneOut = (k: number) => `M ${R0} ${CY + k * 3} C 670 ${CY + k * 3}, 750 ${CY + k * 12}, ${R1} ${CY + k * 12}`;
const pct = (x: number) => `${x / 10}%`;
const EASE = [0.22, 1, 0.36, 1] as const;
const SPRING = { type: "spring", stiffness: 150, damping: 20, mass: 0.9 } as const;
const TRAVEL = 2.3, TRAVEL_TIMES = [0, 0.4, 0.56, 1], STOP = 1.3, STOP_TIMES = [0, 0.7, 0.86, 1];

const TONE: Record<FlowMode, string> = {
  idle: "text-amber", approved: "text-mint", executing: "text-mint", settled: "text-mint", rejected: "text-coral", closed: "text-muted",
};
const GATE_ICON: Record<FlowMode, LucideIcon> = {
  idle: Shield, approved: ShieldCheck, executing: ShieldCheck, settled: ShieldCheck, rejected: ShieldX, closed: ShieldOff,
};

const RM_QUERY = "(prefers-reduced-motion: reduce)";
const subscribeRM = (cb: () => void) => {
  const mq = window.matchMedia(RM_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
/** Hydration-safe: the server snapshot is "motion allowed", the client corrects it before paint settles. */
const usePrefersReducedMotion = () => useSyncExternalStore(subscribeRM, () => window.matchMedia(RM_QUERY).matches, () => false);

function Money({ value, code, className, strike }: { value: string; code: string; className?: string; strike?: boolean }) {
  return (
    <span dir="ltr" className={cn("tabular inline-flex items-baseline gap-1.5 [unicode-bidi:isolate]", className)}>
      <span className={cn(strike && "line-through decoration-coral/80 decoration-2")}>{value}</span>
      <span className="text-[0.5em] font-medium tracking-wide text-muted">{code}</span>
    </span>
  );
}

function NodeIcon({ icon: Icon, x, className }: { icon: LucideIcon; x: number; className?: string }) {
  return (
    <g className="origin-center [transform-box:fill-box] rtl:-scale-x-100">
      <Icon aria-hidden x={x - 15} y={CY - 15} size={30} strokeWidth={1.5} className={className} />
    </g>
  );
}

export function PaymentFlow({ view, evidence }: { view: AgreementView; evidence: ExecutionEvidence | null }) {
  const t = useTranslations("desktop");
  const tc = useTranslations("common");
  const tm = useTranslations("mobile");
  const reduce = usePrefersReducedMotion();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const a = view.agreement;
  const code = a.asset.code;
  const amt = (v: string) => fmtAmount(v, a.asset.decimals);

  const mode = flowMode(view, evidence);
  const tone = TONE[mode];
  const stopped = !!evidence && !evidence.decision.accepted;
  const diffs = new Set(stopped ? evidence.decision.diffs.map((d) => d.field) : []);
  const moved = mode === "settled" && !!evidence;
  const blocked = mode === "rejected";
  // Remount (and so replay) only when the mode or the selected attempt changes, never on a poll tick.
  const animate = !reduce;
  const runKey = `${mode}:${evidence?.decision.decidedAt ?? 0}:${evidence?.observed.observedAt ?? 0}:${animate ? "m" : "s"}`;

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
        className="relative overflow-hidden rounded-[16px] border border-line bg-surface p-5 sm:p-7">
        {/* approved vs executed/attempted: the two figures the evidence can prove */}
        <div className="flex items-end justify-between gap-6">
          <div className="min-w-0">
            <p className="text-[11px] font-medium tracking-[0.14em] text-muted uppercase">{t("path.approved")}</p>
            <p className="mt-1 text-[28px] leading-none font-semibold tracking-tight sm:text-[34px]">
              <Money value={amt(a.amount)} code={code} className="text-fg" />
            </p>
          </div>
          <motion.div key={runKey} className="min-w-0 text-end"
            initial={animate ? { opacity: 0, y: 6 } : false} animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, delay: animate ? (moved ? TRAVEL - 0.25 : stopped ? STOP - 0.35 : 0) : 0 }}>
            <p className={cn("text-[11px] font-medium tracking-[0.14em] uppercase", moved ? "text-mint" : stopped ? "text-coral" : "text-muted")}>
              {stopped ? t("path.attempted") : t("path.executed")}
            </p>
            <p className="mt-1 text-[28px] leading-none font-semibold tracking-tight sm:text-[34px]">
              {moved ? <Money value={amt(evidence.attempt.amount)} code={code} className="text-mint" />
                : stopped ? <Money value={amt(evidence.attempt.amount)} code={code} className="text-coral" strike={diffs.has("amount")} />
                : <span className="text-muted/60">—</span>}
            </p>
          </motion.div>
        </div>

        {/* stage: mirrored as a whole in RTL so the payer always sits at the inline start */}
        <div className="relative mt-5 rtl:-scale-x-100">
          <svg viewBox="0 0 1000 200" aria-hidden className="block h-auto w-full overflow-visible">
            <defs>
              <linearGradient id={`${uid}-in`} gradientUnits="userSpaceOnUse" x1={L0} x2={L1} y1="0" y2="0" className={tone}>
                <stop offset="0" stopColor="currentColor" stopOpacity="0.12" />
                <stop offset="1" stopColor="currentColor" stopOpacity="1" />
              </linearGradient>
              <linearGradient id={`${uid}-out`} gradientUnits="userSpaceOnUse" x1={R0} x2={R1} y1="0" y2="0" className={tone}>
                <stop offset="0" stopColor="currentColor" stopOpacity="1" />
                <stop offset="1" stopColor="currentColor" stopOpacity="0.3" />
              </linearGradient>
              <radialGradient id={`${uid}-glass`} cx="0.35" cy="0.25" r="0.9">
                <stop offset="0" stopColor="#fff" stopOpacity="0.2" />
                <stop offset="0.55" stopColor="#fff" stopOpacity="0.05" />
                <stop offset="1" stopColor="#fff" stopOpacity="0.02" />
              </radialGradient>
              <filter id={`${uid}-blur`} x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="7" /></filter>
              <filter id={`${uid}-haze`} x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="26" /></filter>
            </defs>

            {/* lanes: five fine conduits that pinch through the enforcement aperture */}
            <g fill="none" stroke="#fff" strokeLinecap="round">
              {LANES.map((k) => (
                <path key={`i${k}`} d={laneIn(k)} strokeOpacity={k === 0 ? 0.18 : 0.07} strokeWidth={k === 0 ? 1.5 : 1} />
              ))}
              {LANES.map((k) => (
                <path key={`o${k}`} d={laneOut(k)} strokeOpacity={k === 0 ? (blocked ? 0.1 : 0.18) : blocked ? 0.04 : 0.07}
                  strokeWidth={k === 0 ? 1.5 : 1} strokeDasharray={blocked ? "2 7" : undefined} />
              ))}
            </g>

            <g key={runKey} fill="none" strokeLinecap="round">
              {litIn && LANES.map((k) => (
                <motion.path key={`li${k}`} d={laneIn(k)} stroke={`url(#${uid}-in)`} strokeWidth={k === 0 ? 2 : 1}
                  initial={animate ? { pathLength: 0, opacity: 0 } : false} animate={{ pathLength: 1, opacity: k === 0 ? 1 : 0.5 }}
                  transition={{ duration: 0.9, delay: Math.abs(k) * 0.07, ease: EASE }} />
              ))}
              {litOut && LANES.map((k) => (
                <motion.path key={`lo${k}`} d={laneOut(k)} stroke={`url(#${uid}-out)`} strokeWidth={k === 0 ? 2 : 1}
                  initial={animate ? { pathLength: 0, opacity: 0 } : false} animate={{ pathLength: 1, opacity: k === 0 ? 1 : 0.5 }}
                  transition={{ duration: 0.9, delay: (moved ? TRAVEL * 0.56 : 0.3) + Math.abs(k) * 0.07, ease: EASE }} />
              ))}
            </g>

            {/* payer */}
            <g>
              <rect x="20" y={CY - 42} width="84" height="84" rx="24" fill={`url(#${uid}-glass)`} stroke="#fff" strokeOpacity="0.16" />
              <path d={`M 34 ${CY - 41.5} H 90`} stroke="#fff" strokeOpacity="0.35" strokeLinecap="round" />
              <NodeIcon icon={PayerIcon} x={62} className="text-fg" />
            </g>

            {/* recipient: dims when the attempt was stopped, lights only on proven settlement */}
            <g opacity={blocked ? 0.42 : 1}>
              <rect x="896" y={CY - 42} width="84" height="84" rx="24" fill={`url(#${uid}-glass)`}
                className="stroke-white/15" strokeDasharray={blocked ? "3 6" : undefined} />
              <path d={`M 910 ${CY - 41.5} H 966`} stroke="#fff" strokeOpacity="0.35" strokeLinecap="round" />
              <NodeIcon icon={Store} x={938} className="text-fg" />
              {mode === "settled" && (
                <motion.g key={`lit-${runKey}`} initial={animate ? { opacity: 0 } : false} animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: animate && moved ? TRAVEL - 0.15 : 0 }}>
                  <rect x="896" y={CY - 42} width="84" height="84" rx="24" fill="#0a0a0a" className="stroke-mint/60" />
                  <rect x="896" y={CY - 42} width="84" height="84" rx="24" fill={`url(#${uid}-glass)`} />
                  <NodeIcon icon={Store} x={938} className="text-mint" />
                </motion.g>
              )}
            </g>
            {moved && animate && (
              <motion.rect key={`arrive-${runKey}`} x="896" y={CY - 42} width="84" height="84" rx="24" fill="none" className="stroke-mint" strokeWidth="1.5"
                initial={{ opacity: 0, scale: 1 }} animate={{ opacity: [0, 0.75, 0], scale: [1, 1.08, 1.32] }}
                transition={{ duration: 1.1, delay: TRAVEL - 0.1, ease: "easeOut" }} />
            )}

            {/* the payment itself: crosses only on settlement, halts at the aperture when stopped */}
            {moved && animate && (
              <g key={`orb-${runKey}`} className="text-mint">
                <motion.ellipse cy={CY} rx="26" ry="7" fill="currentColor" filter={`url(#${uid}-blur)`}
                  initial={{ cx: L0, opacity: 0 }} animate={{ cx: [L0, L1, R0, R1], opacity: [0, 0.9, 0.9, 0] }}
                  transition={{ duration: TRAVEL, times: TRAVEL_TIMES, ease: "easeInOut" }} />
                <motion.circle cy={CY} r="4.5" fill="#fff"
                  initial={{ cx: L0, opacity: 0 }} animate={{ cx: [L0, L1, R0, R1], opacity: [0, 1, 1, 0] }}
                  transition={{ duration: TRAVEL, times: TRAVEL_TIMES, ease: "easeInOut" }} />
              </g>
            )}
            {stopped && (
              <g key={`halt-${runKey}`} className="text-coral">
                <motion.ellipse cy={CY} rx="18" ry="7" fill="currentColor" filter={`url(#${uid}-blur)`}
                  initial={animate ? { cx: L0, opacity: 0 } : false} animate={{ cx: animate ? [L0, 432, 420, 424] : 424, opacity: animate ? [0, 0.9, 0.8, 0.6] : 0.6 }}
                  transition={{ duration: STOP, times: STOP_TIMES, ease: "easeOut" }} />
                <motion.circle cy={CY} r="4.5" fill="currentColor"
                  initial={animate ? { cx: L0, opacity: 0 } : false} animate={{ cx: animate ? [L0, 432, 420, 424] : 424, opacity: 1 }}
                  transition={{ duration: STOP, times: STOP_TIMES, ease: "easeOut" }} />
                <motion.path d={`M 439 ${CY - 22} V ${CY + 22}`} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                  initial={animate ? { opacity: 0, scaleY: 0.3 } : false} animate={{ opacity: 1, scaleY: 1 }}
                  transition={{ ...SPRING, delay: animate ? STOP * 0.7 : 0 }} />
              </g>
            )}
            {/* CounterSign enforcement point */}
            <g className={tone}>
              <motion.circle cx={GATE} cy={CY} r="70" fill="currentColor" filter={`url(#${uid}-haze)`}
                initial={false} animate={{ opacity: mode === "idle" && animate ? [0.1, 0.24, 0.1] : mode === "closed" ? 0.04 : 0.16 }}
                transition={mode === "idle" && animate ? { duration: 4.6, repeat: Infinity, ease: "easeInOut" } : { duration: 0.5 }} />
              {mode === "idle" && animate && (
                <motion.circle cx={GATE} cy={CY} fill="none" stroke="currentColor" strokeWidth="1"
                  initial={{ r: 54, opacity: 0.45 }} animate={{ r: [54, 68, 54], opacity: [0.45, 0.08, 0.45] }}
                  transition={{ duration: 4.6, repeat: Infinity, ease: "easeInOut" }} />
              )}
              <circle cx={GATE} cy={CY} r="60" fill="none" stroke="#fff" strokeOpacity="0.07" />
              <circle cx={GATE} cy={CY} r="46" fill="#050505" />
              <circle cx={GATE} cy={CY} r="46" fill={`url(#${uid}-glass)`} stroke="#fff" strokeOpacity="0.2" />
              {mode !== "idle" && mode !== "closed" && (
                <g transform={`rotate(-90 ${GATE} ${CY})`}>
                  <motion.circle key={`ring-${runKey}`} cx={GATE} cy={CY} r="52" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"
                    initial={animate ? { pathLength: 0, opacity: 0 } : false} animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ ...SPRING, stiffness: 60, delay: animate ? (moved ? TRAVEL * 0.4 : stopped ? STOP * 0.7 : 0.05) : 0 }} />
                </g>
              )}
              {blocked && animate && (
                <motion.circle key={`shock-${runKey}`} cx={GATE} cy={CY} fill="none" stroke="currentColor" strokeWidth="1.5"
                  initial={{ r: 46, opacity: 0 }} animate={{ r: [46, 50, 78], opacity: [0, 0.7, 0] }}
                  transition={{ duration: 0.8, delay: evidence ? STOP * 0.7 : 0, ease: "easeOut" }} />
              )}
              <motion.g key={`icon-${mode}`} initial={animate ? { scale: 0.6, opacity: 0 } : false} animate={{ scale: 1, opacity: 1 }} transition={SPRING}>
                <NodeIcon icon={GateIcon} x={GATE} />
              </motion.g>
            </g>

          </svg>

          {/* amount riding the payment */}
          {animate && moved && (
            <motion.div key={`chip-${runKey}`} aria-hidden className="pointer-events-none absolute top-1/2 hidden -translate-x-1/2 -translate-y-[calc(100%+14px)] sm:block"
              initial={{ left: pct(L0), opacity: 0 }} animate={{ left: [pct(L0), pct(L1), pct(R0), pct(R1)], opacity: [0, 1, 1, 0] }}
              transition={{ duration: TRAVEL, times: TRAVEL_TIMES, ease: "easeInOut" }}>
              <span className="glass inline-block rounded-full border border-mint/40 bg-black/50 px-2.5 py-1 text-[12px] font-medium whitespace-nowrap text-mint rtl:-scale-x-100">
                <Money value={amt(evidence.attempt.amount)} code={code} />
              </span>
            </motion.div>
          )}
          {stopped && (
            <motion.div key={`chip-${runKey}`} aria-hidden className="pointer-events-none absolute top-1/2 hidden -translate-x-1/2 -translate-y-[calc(100%+14px)] sm:block"
              initial={animate ? { left: pct(L0), opacity: 0 } : false} animate={{ left: animate ? [pct(L0), pct(350), pct(338), pct(342)] : pct(342), opacity: 1 }}
              transition={{ duration: STOP, times: STOP_TIMES, ease: "easeOut" }}>
              <span className="glass inline-block rounded-full border border-coral/45 bg-black/50 px-2.5 py-1 text-[12px] font-medium whitespace-nowrap text-coral rtl:-scale-x-100">
                <Money value={amt(evidence.attempt.amount)} code={code} strike={diffs.has("amount")} />
              </span>
            </motion.div>
          )}
        </div>

        {/* captions */}
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1fr)] gap-3 sm:gap-6">
          <div className="min-w-0">
            <p className="text-[11px] font-medium tracking-[0.14em] text-muted uppercase">{tc("field.payer")}</p>
            <p className="mt-1 truncate"><span title={a.payer} className="ident text-[12px] text-fg">{short(a.payer)}</span></p>
            {evidence && (
              <motion.div key={runKey} className="mt-3" initial={animate ? { opacity: 0, y: 4 } : false} animate={{ opacity: 1, y: 0 }}
                transition={{ ...SPRING, delay: animate ? (moved ? 0.5 : STOP) : 0 }}>
                <p className="text-[11px] text-muted">{t("path.payerBalance")}</p>
                <p className="mt-0.5 text-[17px] font-medium tracking-tight"><Money value={amt(evidence.observed.payerBalance)} code={code} className="text-fg" /></p>
              </motion.div>
            )}
          </div>

          <div className="min-w-0 text-center">
            <p className="text-[13px] font-semibold tracking-tight text-fg">{tc("brand")}</p>
            <motion.div key={`s-${runKey}`}
              initial={animate ? { opacity: 0, y: 4 } : false} animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING, delay: animate ? (moved ? TRAVEL - 0.2 : stopped ? STOP * 0.75 : 0) : 0 }}>
              <p className={cn("mt-1 text-[13px] font-medium", tone)}>{status}</p>
              {detail && <p className="mx-auto mt-1 max-w-[30ch] text-[12px] leading-4 text-muted">{detail}</p>}
              {(mode === "settled" || blocked) && view.executionCount > 0 && (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 text-[11px] text-muted">
                  {tc("field.executionCount")}<span className="tabular text-fg">{view.executionCount}</span>
                </p>
              )}
            </motion.div>
          </div>

          <div className="min-w-0 text-end">
            <p className="text-[11px] font-medium tracking-[0.14em] text-muted uppercase">{tc("field.recipient")}</p>
            <p className={cn("mt-1 truncate text-[13px] font-medium", blocked ? "text-muted" : "text-fg")}>{a.recipientDisplayName}</p>
            <p className="truncate"><span title={a.recipient} className="ident text-[12px] text-muted">{short(a.recipient)}</span></p>
            {moved && (
              <motion.p key={runKey} className="mt-2 text-[17px] font-medium tracking-tight"
                initial={animate ? { opacity: 0, y: 6, scale: 0.96 } : false} animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ ...SPRING, delay: animate ? TRAVEL - 0.15 : 0 }}>
                <Money value={`+${amt(evidence.attempt.amount)}`} code={code} className="text-mint" />
              </motion.p>
            )}
            {blocked && (
              <motion.div key={runKey} className="mt-2" initial={animate ? { opacity: 0, y: 4 } : false} animate={{ opacity: 1, y: 0 }}
                transition={{ ...SPRING, delay: animate && evidence ? STOP : 0 }}>
                {stopped && diffs.has("recipient") && (
                  <p className="truncate"><span title={evidence.attempt.recipient} className="ident text-[12px] text-coral line-through decoration-coral/80">{short(evidence.attempt.recipient)}</span></p>
                )}
                <p className="mt-0.5 text-[12px] font-medium text-coral">{t("path.notExecuted")}</p>
              </motion.div>
            )}
          </div>
        </div>
      </section>
    </MotionConfig>
  );
}
