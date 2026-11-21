"use client";
// Scroll-driven section: a sticky stage whose product graphic is driven by scroll progress through four steps.
import { useRef, useState } from "react";
import { motion, useMotionValue, useMotionValueEvent, useScroll, useTransform, type MotionValue } from "motion/react";
import { cn } from "@/lib/cn";
import { Label, SERIF, usePrefersReducedMotion } from "./pieces";
import { AttemptFragment, Cap, CompareFragment, OutcomeFragment, Panel, TermsFragment } from "./scrollGraphics";

const STEPS = [
  { k: "Intended", t: "The customer approves one payment", d: "Recipient, exact amount and one use are shown on the phone. Press and hold to approve.", G: TermsFragment },
  { k: "Attempted", t: "The app submits an instruction", d: "Whatever the application sends is placed next to the terms that were approved.", G: AttemptFragment },
  { k: "Enforced", t: "CounterSign compares every term", d: "Recipient, amount and use must all match. One difference is enough to stop it.", G: CompareFragment },
  { k: "Outcome", t: "The money moves once, or not at all", d: "A matching payment settles. A changed payment is stopped and balances stay where they were.", G: OutcomeFragment },
];
const N = STEPS.length;

function Scene({ p, i, intro }: { p: MotionValue<number>; i: number; intro: MotionValue<number> }) {
  const s = i / N;
  const e = (i + 1) / N;
  const first = i === 0;
  const last = i === N - 1;
  const stops = first ? [0, e - 0.03, e - 0.005] : last ? [s - 0.005, s + 0.025, 1] : [s - 0.005, s + 0.025, e - 0.03, e - 0.005];
  const opacity = useTransform(p, stops, first ? [1, 1, 0] : last ? [0, 1, 1] : [0, 1, 1, 0]);
  const y = useTransform(p, stops, first ? [0, 0, -28] : last ? [28, 0, 0] : [28, 0, 0, -28]);
  const seg = useTransform(p, [first ? 0 : s + 0.02, e - (last ? 0.06 : 0.085)], [0, 1]);
  // The first fragment starts assembling while the section scrolls into view, so the stage is never empty when it pins.
  const lead = useTransform(intro, [0.45, 1], [0, 0.3]);
  const local = useTransform(() => (first ? lead.get() + seg.get() * 0.7 : seg.get()));
  const G = STEPS[i].G;
  return (
    <motion.div style={{ opacity, y }} className="absolute inset-0 flex items-center justify-center px-8 pb-20 pt-16 xl:px-12">
      <div className="w-full max-w-[440px] xl:max-w-[464px]">
        <G p={local} />
      </div>
    </motion.div>
  );
}

function StepBar({ p, i }: { p: MotionValue<number>; i: number }) {
  const scaleX = useTransform(p, [i / N, (i + 1) / N], [0, 1]);
  return <motion.span aria-hidden style={{ scaleX }} className="absolute inset-x-0 -top-px hidden h-px origin-left bg-fg lg:block" />;
}

export function ScrollStory() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = usePrefersReducedMotion();
  const [step, setStep] = useState(0);
  const full = useMotionValue(1);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const { scrollYProgress: intro } = useScroll({ target: ref, offset: ["start end", "start start"] });
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const next = Math.min(N - 1, Math.floor(v * N));
    setStep((s) => (s === next ? s : next));
  });

  return (
    <section id="how" className="scroll-mt-14 border-t border-line">
      <div ref={ref} className={cn("relative", !reduce && "lg:h-[380vh]")}>
        <div className={cn("mx-auto w-full max-w-[1240px] px-5 py-20 sm:px-8", !reduce && "lg:sticky lg:top-14 lg:flex lg:h-[calc(100vh-56px)] lg:items-center lg:py-0")}>
          <div className={cn("grid w-full gap-12", !reduce && "lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16")}>
            <div className="min-w-0">
              <Label>How it works</Label>
              <h2 className={cn(SERIF, "mt-4 max-w-[14ch] text-[40px] leading-[1.02] tracking-tight sm:text-[56px]")}>
                Four pieces. <span className="text-muted">One answer.</span>
              </h2>
              <ol className={cn("mt-10", reduce ? "grid gap-x-8 gap-y-2 lg:grid-cols-2" : "space-y-1")}>
                {STEPS.map((s, i) => {
                  const on = reduce || i === step;
                  return (
                    <li key={s.k} className={cn("relative border-t border-line py-4 transition-opacity duration-300", !on && "lg:opacity-40", reduce && "flex flex-col")}>
                      {!reduce && <StepBar p={scrollYProgress} i={i} />}
                      <div className="flex items-baseline gap-4">
                        <span className="tabular w-6 shrink-0 text-[12px] text-muted">0{i + 1}</span>
                        <div className="min-w-0">
                          <p className="text-[17px] font-semibold tracking-tight">{s.t}</p>
                          <p className={cn("mt-1.5 text-[14px] leading-relaxed text-muted", !on && "lg:hidden")}>{s.d}</p>
                        </div>
                      </div>
                      <Panel className={cn("mt-5 px-4 py-6 sm:p-8", reduce ? "flex-1" : "lg:hidden")}>
                        <div className="mx-auto flex h-full w-full max-w-[440px] flex-col justify-center">
                          <s.G p={full} />
                        </div>
                      </Panel>
                    </li>
                  );
                })}
              </ol>
              <p className={cn("border-t border-line pt-4 text-[11px] uppercase tracking-[0.14em] text-muted", !reduce && "lg:hidden")}>Illustration · sample values</p>
            </div>

            <Panel className={cn("hidden h-[min(660px,calc(100vh-136px))] min-w-0", !reduce && "lg:block")}>
              <div className="absolute inset-x-8 top-7 flex items-center justify-between gap-4 xl:inset-x-10">
                <Cap>Illustration · sample values</Cap>
                <Cap className="tabular">
                  0{step + 1} / 0{N}
                </Cap>
              </div>
              {STEPS.map((s, i) => (
                <Scene key={s.k} p={scrollYProgress} i={i} intro={intro} />
              ))}
              <div className="absolute inset-x-8 bottom-7 xl:inset-x-10">
                <div className="relative h-px bg-black/10">
                  <motion.span aria-hidden style={{ scaleX: scrollYProgress }} className="absolute inset-0 origin-left bg-[#131312]" />
                </div>
                <div className="mt-3 grid grid-cols-4 text-[11px] font-medium uppercase tracking-[0.14em]">
                  {STEPS.map((s, i) => (
                    <span key={s.k} className={cn("transition-colors duration-300", i <= step ? "text-[#131312]" : "text-[#131312]/40")}>
                      {s.k}
                    </span>
                  ))}
                </div>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </section>
  );
}
