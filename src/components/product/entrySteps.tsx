"use client";
// Scroll-driven "how one payment goes" section: the panel follows the step in view. Sample values only.
import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { BANK_ACCOUNTS } from "@/shared/contract";
import { Panel, useReducedMotionFlag } from "@/components/product/entryPanels";

export type EntryStep = { n: number; icon: LucideIcon; title: string; body: string; href: string; cta: string };

const EASE = [0.165, 0.84, 0.44, 1] as const;
const M = BANK_ACCOUNTS.merchant;
type Row = [string, string, boolean?];
const TERMS: Row[] = [["Recipient", M], ["Amount", "100.00 AED"], ["Use", "Once"]];
const VIS: { title: string; rows: Row[]; foot: string; tone: "plain" | "hold" | "ok" | "stop"; note?: string }[] = [
  { title: "Payment request", rows: TERMS, foot: "Waiting for approval", tone: "plain" },
  { title: "Approved terms", rows: TERMS, foot: "Hold to approve", tone: "hold" },
  { title: "Attempted payment", rows: TERMS, foot: "MATCHED", tone: "ok", note: "Balance moves by 100.00 AED" },
  { title: "Attempted payment", rows: [["Recipient", M], ["Amount", "500.00 AED", true], ["Use", "Once"]], foot: "AMOUNT_MISMATCH", tone: "stop", note: "Balance unchanged" },
  { title: "Evidence", rows: [["Approved", "100.00 AED · once"], ["Attempted", "500.00 AED", true], ["Decision", "Stopped"], ["Balance after", "Unchanged"]], foot: "Evidence recorded", tone: "plain" },
];

function StepVisual({ i }: { i: number }) {
  const reduced = useReducedMotionFlag();
  const v = VIS[i];
  return (
    <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} transition={{ staggerChildren: 0.08, delayChildren: 0.1 }}
      className="w-full max-w-[380px] rounded-[22px] bg-white p-5 text-[#131312] shadow-[0_1px_2px_rgb(19_19_18/0.06),0_24px_48px_-28px_rgb(19_19_18/0.45)] sm:p-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#6B6962]">{v.title}</p>
      <dl className="mt-3 divide-y divide-[#131312]/10 text-[14px]">
        {v.rows.map(([k, val, hot]) => (
          <motion.div key={k} variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } } }} className="flex items-baseline justify-between gap-4 py-2.5">
            <dt className="shrink-0 text-[#6B6962]">{k}</dt>
            <dd className={cn("tabular m-0 min-w-0 text-end font-medium", val.startsWith("ACC-") && "ident text-[12px]", hot && "rounded-md bg-[#FF5466]/15 px-1.5 text-[#B3182B]")}>{val}</dd>
          </motion.div>
        ))}
      </dl>
      <motion.div variants={{ hidden: { opacity: 0, scale: 0.96 }, show: { opacity: 1, scale: 1, transition: { duration: 0.45, ease: EASE } } }}
        className={cn("relative mt-4 flex h-12 items-center justify-center gap-2 overflow-hidden rounded-full text-[13px] font-semibold",
          v.tone === "ok" ? "bg-[#BCFF2F]" : v.tone === "stop" ? "bg-[#131312] text-[#FAF9F5]" : "bg-[#F1EFEA]")}>
        {v.tone === "hold" && !reduced && (
          <motion.span aria-hidden className="absolute inset-0 origin-left bg-[#BCFF2F]" initial={{ scaleX: 0 }} animate={{ scaleX: [0, 1, 1, 0] }} transition={{ duration: 3.2, times: [0, 0.6, 0.9, 1], repeat: Infinity, ease: "linear" }} />
        )}
        {v.tone === "ok" && <Check aria-hidden className="size-4" />}
        {v.tone === "stop" && <X aria-hidden className="size-4 text-[#FF5466]" />}
        <span className={cn("relative", (v.tone === "ok" || v.tone === "stop") && "font-mono text-[12px] tracking-[0.04em]")}>{v.foot}</span>
      </motion.div>
      {v.note && <p className="mt-3 text-center text-[12px] text-[#6B6962]">{v.note}</p>}
    </motion.div>
  );
}

export function StepsScroll({ steps }: { steps: readonly EntryStep[] }) {
  const [active, setActive] = useState(0);
  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-2 lg:gap-16">
      <ol className="m-0 flex list-none flex-col gap-12 p-0 lg:gap-0 lg:pb-[14vh]">
        {steps.map((s, i) => (
          <motion.li key={s.n} onViewportEnter={() => setActive(i)} viewport={{ margin: "-45% 0px -45% 0px" }} className="lg:flex lg:min-h-[56vh] lg:items-center">
            <div className={cn("w-full transition-opacity duration-500 motion-reduce:transition-none", i !== active && "lg:opacity-35")}>
              <Link href={s.href} className="group block max-w-xl">
                <span className="flex items-center gap-3">
                  <span className="tabular flex size-9 items-center justify-center rounded-full border border-line text-xs text-fg">{s.n}</span>
                  <s.icon aria-hidden className="size-5 text-muted transition-colors duration-200 group-hover:text-fg" />
                </span>
                <span className="mt-5 block text-[28px] font-medium leading-[1.1] tracking-[-0.02em] text-fg sm:text-[40px]">{s.title}</span>
                <span className="mt-3 block text-[15px] leading-relaxed text-muted sm:text-[17px]">{s.body}</span>
                <span className="mt-5 inline-flex items-center gap-1.5 border-b border-fg/30 pb-0.5 text-[14px] text-fg">{s.cta}<ArrowRight aria-hidden className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none rtl:rotate-180" /></span>
              </Link>
              <Panel title={`Step ${s.n}`} className="mt-6 !min-h-0 lg:hidden"><StepVisual i={i} /></Panel>
            </div>
          </motion.li>
        ))}
      </ol>
      <div className="hidden lg:block">
        <div className="sticky top-24">
          <Panel title={`Step ${active + 1} of ${steps.length}`} className="h-[min(640px,calc(100vh-8rem))]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={active} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3, ease: EASE }} className="flex w-full justify-center">
                <StepVisual i={active} />
              </motion.div>
            </AnimatePresence>
          </Panel>
        </div>
      </div>
    </div>
  );
}
