"use client";
// Scroll-driven section: the approved terms, the app's attempt and the enforcement result come together as the reader scrolls.
import { useRef, useState } from "react";
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
import { cn } from "@/lib/cn";
import { AttemptCard, EASE, FlowRail, Label, PhoneApproval, SERIF, TermsCard } from "./pieces";

const STEPS = [
  { k: "Intended", t: "The customer approves one payment", d: "Recipient, amount and permissions are shown on the phone. Press and hold to approve." },
  { k: "Attempted", t: "The app submits an instruction", d: "Whatever the application sends is placed next to the terms that were approved." },
  { k: "Enforced", t: "CounterSign compares every term", d: "Recipient, amount, continuing permission and use must all match." },
  { k: "Outcome", t: "The money moves once, or not at all", d: "A matching payment settles. A changed payment is stopped and balances stay where they were." },
];

const T = { duration: 0.4, ease: EASE };

export function ScrollStory() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const next = Math.min(STEPS.length - 1, Math.floor(v * STEPS.length));
    setStep((s) => (s === next ? s : next));
  });
  const at = reduce ? STEPS.length - 1 : step;

  return (
    <section id="how" className="scroll-mt-14 border-t border-line">
      <div ref={ref} className={cn("relative", !reduce && "lg:h-[320vh]")}>
        <div className={cn("mx-auto w-full max-w-[1240px] px-5 py-20 sm:px-8", !reduce && "lg:sticky lg:top-14 lg:flex lg:h-[calc(100vh-56px)] lg:items-center lg:py-0")}>
          <div className="grid w-full gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
            <div className="min-w-0">
              <Label>How it works</Label>
              <h2 className={cn(SERIF, "mt-4 max-w-[14ch] text-[40px] leading-[1.02] tracking-tight sm:text-[56px]")}>
                Four pieces. <span className="text-muted">One answer.</span>
              </h2>
              <ol className="mt-10 space-y-1">
                {STEPS.map((s, i) => {
                  const on = i === at;
                  return (
                    <li key={s.k} className={cn("border-t border-line py-4 transition-opacity duration-300", on ? "opacity-100" : "lg:opacity-40")}>
                      <div className="flex items-baseline gap-4">
                        <span className="tabular w-6 text-[12px] text-muted">0{i + 1}</span>
                        <div className="min-w-0">
                          <p className="text-[17px] font-semibold tracking-tight">{s.t}</p>
                          <p className={cn("mt-1.5 text-[14px] leading-relaxed text-muted", !on && "lg:hidden")}>{s.d}</p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>

            <div className="relative min-w-0 rounded-[24px] border border-line bg-[#0D0D0C] p-4 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <TermsCard checked={at >= 2} />
                </div>
                <div className="relative min-w-0">
                  <motion.div
                    initial={false}
                    animate={{ opacity: at >= 1 ? 1 : 0, y: at >= 1 ? 0 : 24 }}
                    transition={T}
                    className="max-lg:!transform-none max-lg:!opacity-100"
                  >
                    <AttemptCard attempt="match" />
                  </motion.div>
                  <motion.div
                    aria-hidden
                    initial={false}
                    animate={{ opacity: at === 0 ? 1 : 0, y: at === 0 ? 0 : -24 }}
                    transition={T}
                    className="pointer-events-none absolute inset-x-0 top-0 hidden justify-center lg:flex"
                  >
                    <PhoneApproval approved={false} />
                  </motion.div>
                </div>
              </div>
              <motion.div
                initial={false}
                animate={{ opacity: at >= 2 ? 1 : 0.28, y: at >= 2 ? 0 : 12 }}
                transition={T}
                className="mt-4 max-lg:!transform-none max-lg:!opacity-100"
              >
                <FlowRail attempt="match" resolved={at >= 3} />
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
